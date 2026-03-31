import { Audio } from "expo-av";
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

let recording: Audio.Recording | null = null;

export async function startBiomarkerRecording(): Promise<void> {
  const permission = await Audio.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Microphone permission not granted");
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording: rec } = await Audio.Recording.createAsync({
    android: {
      extension: ".wav",
      outputFormat: Audio.AndroidOutputFormat.DEFAULT,
      audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 256000,
    },
    ios: {
      extension: ".wav",
      outputFormat: Audio.IOSOutputFormat.LINEARPCM,
      audioQuality: Audio.IOSAudioQuality.HIGH,
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 256000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      mimeType: "audio/wav",
      bitsPerSecond: 256000,
    },
  });

  recording = rec;
}

export async function stopAndAnalyze(): Promise<BiomarkerReport | null> {
  if (!recording) return null;

  try {
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;

    if (!uri) return null;

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

    // Read the WAV file and extract PCM samples
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const samples = extractPCMFromWAV(arrayBuffer);

    if (samples.length === 0) return null;

    // Send to worker for WASM analysis
    if (!AI_CONFIG.workerUrl) return null;

    const analyzeResponse = await fetch(`${AI_CONFIG.workerUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        samples: Array.from(samples),
        sampleRate: 16000,
      }),
    });

    if (!analyzeResponse.ok) {
      throw new Error(`Analysis failed: ${analyzeResponse.status}`);
    }

    return (await analyzeResponse.json()) as BiomarkerReport;
  } catch (error) {
    console.error("Biomarker analysis error:", error);
    recording = null;
    return null;
  }
}

export function isRecording(): boolean {
  return recording !== null;
}

export async function cancelRecording(): Promise<void> {
  if (recording) {
    try {
      await recording.stopAndUnloadAsync();
    } catch {
      // already stopped
    }
    recording = null;
  }
}

function extractPCMFromWAV(buffer: ArrayBuffer): Int16Array {
  const view = new DataView(buffer);

  // Verify WAV header
  if (buffer.byteLength < 44) return new Int16Array(0);

  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (riff !== "RIFF") return new Int16Array(0);

  // Find the "data" chunk
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
    if (chunkSize % 2 !== 0) offset++; // padding byte
  }

  return new Int16Array(0);
}
