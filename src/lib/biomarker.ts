import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  IOSOutputFormat,
  AudioQuality,
} from "expo-audio";
import AudioModule from "expo-audio/build/AudioModule";
import { createRecordingOptions } from "expo-audio/build/utils/options";
import type { RecordingOptions } from "expo-audio";
import type { AudioRecorder } from "expo-audio/build/AudioModule.types";
import { AI_CONFIG } from "./config";

export type BiomarkerReport = {
  energy: number;
  breathing_rate: number;
  pitch_variability: number;
  cough_events: number;
  zero_crossing_rate: number;
  summary: string;
  status: "normal" | "monitor" | "alert";
};

const TARGET_SAMPLE_RATE = 16000;

const WAV_RECORDING_OPTIONS: RecordingOptions = {
  extension: ".wav",
  sampleRate: TARGET_SAMPLE_RATE,
  numberOfChannels: 1,
  bitRate: 256000,
  android: {
    outputFormat: "default",
    audioEncoder: "default",
    sampleRate: TARGET_SAMPLE_RATE,
  },
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    sampleRate: TARGET_SAMPLE_RATE,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 128000,
  },
};

const MIN_RECORDING_SECONDS = 5;

let recorder: AudioRecorder | null = null;
let recordingStartTime: number | null = null;

export async function startBiomarkerRecording(): Promise<void> {
  const permission = await requestRecordingPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Microphone permission not granted");
  }

  await setAudioModeAsync({
    allowsRecording: true,
    playsInSilentMode: true,
  });

  const options = createRecordingOptions(WAV_RECORDING_OPTIONS);
  recorder = new AudioModule.AudioRecorder(options);
  recordingStartTime = Date.now();
  recorder.record();
}

export function getRecordingElapsedSeconds(): number {
  if (!recordingStartTime) return 0;
  return (Date.now() - recordingStartTime) / 1000;
}

export function getMinRecordingSeconds(): number {
  return MIN_RECORDING_SECONDS;
}

export async function stopAndAnalyze(): Promise<BiomarkerReport> {
  if (!recorder) throw new Error("No active recording");

  const elapsed = getRecordingElapsedSeconds();
  if (elapsed < MIN_RECORDING_SECONDS) {
    await recorder.stop();
    recorder = null;
    recordingStartTime = null;
    throw new Error(`Recording too short (${Math.round(elapsed)}s). Please record for at least ${MIN_RECORDING_SECONDS} seconds.`);
  }

  try {
    await recorder.stop();
    const uri = recorder.uri;
    recorder = null;
    recordingStartTime = null;

    if (!uri) throw new Error("Recording produced no audio file");

    await setAudioModeAsync({ allowsRecording: false });

    const response = await fetch(uri);
    if (!response.ok) throw new Error("Could not read recorded audio file");
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) throw new Error("Recorded audio file is empty — try again");

    // Try WAV parsing first (works on native iOS/Android)
    let samples = extractPCMFromWAV(arrayBuffer);

    // If WAV parsing failed (web produces webm), decode with Web Audio API
    if (samples.length === 0 && typeof AudioContext !== "undefined") {
      samples = await decodeWebAudio(arrayBuffer);
    }

    if (samples.length === 0) throw new Error("Could not decode audio — try recording again");

    // Send to worker for WASM analysis
    if (!AI_CONFIG.workerUrl) throw new Error("Server not configured");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let analyzeResponse: Response;
    try {
      analyzeResponse = await fetch(`${AI_CONFIG.workerUrl}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          samples: Array.from(samples),
          sampleRate: TARGET_SAMPLE_RATE,
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err.name === "AbortError") throw new Error("Analysis timed out — check your connection and try again");
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (!analyzeResponse.ok) {
      const errBody = await analyzeResponse.json().catch(() => null) as { error?: string } | null;
      throw new Error(errBody?.error || `Analysis failed (${analyzeResponse.status})`);
    }

    return (await analyzeResponse.json()) as BiomarkerReport;
  } catch (error) {
    recorder = null;
    recordingStartTime = null;
    throw error;
  }
}

export function isRecording(): boolean {
  return recorder !== null;
}

export async function cancelRecording(): Promise<void> {
  if (recorder) {
    try {
      await recorder.stop();
    } catch {
      // already stopped
    }
    recorder = null;
    recordingStartTime = null;
  }
}

// ── Web Audio API decoder (for webm/mp4 on browsers) ────────────────

async function decodeWebAudio(buffer: ArrayBuffer): Promise<Int16Array> {
  try {
    const audioCtx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    const audioBuffer = await audioCtx.decodeAudioData(buffer);
    await audioCtx.close();

    // Get the first channel as Float32
    const float32 = audioBuffer.getChannelData(0);

    // If the decoded sample rate differs, resample
    let resampled = float32;
    if (audioBuffer.sampleRate !== TARGET_SAMPLE_RATE) {
      resampled = resample(float32, audioBuffer.sampleRate, TARGET_SAMPLE_RATE);
    }

    // Convert Float32 [-1, 1] to Int16
    const int16 = new Int16Array(resampled.length);
    for (let i = 0; i < resampled.length; i++) {
      const clamped = Math.max(-1, Math.min(1, resampled[i]));
      int16[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
    }

    return int16;
  } catch (error) {
    console.error("Web Audio decode error:", error);
    return new Int16Array(0);
  }
}

function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  const ratio = fromRate / toRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const srcIndex = i * ratio;
    const low = Math.floor(srcIndex);
    const high = Math.min(low + 1, input.length - 1);
    const frac = srcIndex - low;
    output[i] = input[low] * (1 - frac) + input[high] * frac;
  }
  return output;
}

// ── WAV parser (for native iOS/Android recordings) ───────────────────

function extractPCMFromWAV(buffer: ArrayBuffer): Int16Array {
  const view = new DataView(buffer);

  if (buffer.byteLength < 44) return new Int16Array(0);

  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (riff !== "RIFF") return new Int16Array(0);

  let offset = 12;
  while (offset + 8 < buffer.byteLength) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3),
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === "data") {
      const dataStart = offset + 8;
      const sampleCount = Math.min(chunkSize, buffer.byteLength - dataStart) / 2;
      const samples = new Int16Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        samples[i] = view.getInt16(dataStart + i * 2, true);
      }
      return samples;
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++;
  }

  return new Int16Array(0);
}
