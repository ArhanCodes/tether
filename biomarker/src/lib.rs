use serde::Serialize;
use wasm_bindgen::prelude::*;

#[derive(Serialize, serde::Deserialize)]
pub struct BiomarkerReport {
    /// Root-mean-square energy (0.0–1.0). Low values suggest weak voice / fatigue.
    pub energy: f64,
    /// Estimated breaths per minute derived from low-frequency energy envelope.
    pub breathing_rate: f64,
    /// Pitch variability (coefficient of variation). High values may indicate tremor.
    pub pitch_variability: f64,
    /// Number of detected cough-like bursts in the sample.
    pub cough_events: u32,
    /// Zero-crossing rate — elevated in breathy or noisy audio.
    pub zero_crossing_rate: f64,
    /// Short clinical summary suitable for display.
    pub summary: String,
    /// "normal", "monitor", or "alert"
    pub status: String,
}

/// Analyse a buffer of **16-bit signed PCM samples** at the given sample rate
/// and return a JSON-encoded `BiomarkerReport`.
#[wasm_bindgen]
pub fn analyze_audio(samples_i16: &[i16], sample_rate: u32) -> String {
    let samples: Vec<f64> = samples_i16.iter().map(|&s| s as f64 / 32768.0).collect();
    let n = samples.len();

    if n == 0 {
        return serde_json::to_string(&BiomarkerReport {
            energy: 0.0,
            breathing_rate: 0.0,
            pitch_variability: 0.0,
            cough_events: 0,
            zero_crossing_rate: 0.0,
            summary: "No audio data received.".into(),
            status: "normal".into(),
        })
        .unwrap();
    }

    let energy = rms_energy(&samples);
    let zcr = zero_crossing_rate(&samples);
    let breathing_rate = estimate_breathing_rate(&samples, sample_rate);
    let pitch_variability = estimate_pitch_variability(&samples, sample_rate);
    let cough_events = detect_cough_events(&samples, sample_rate);

    let mut flags: Vec<&str> = Vec::new();

    if energy < 0.02 {
        flags.push("voice energy is very low (possible fatigue)");
    }
    if breathing_rate > 24.0 {
        flags.push("breathing rate is elevated");
    }
    if pitch_variability > 0.35 {
        flags.push("vocal tremor detected");
    }
    if cough_events >= 3 {
        flags.push("frequent coughing detected");
    }
    if zcr > 0.3 {
        flags.push("breathy or labored speech pattern");
    }

    let status = if flags.len() >= 2 {
        "alert"
    } else if !flags.is_empty() {
        "monitor"
    } else {
        "normal"
    };

    let summary = if flags.is_empty() {
        "Voice biomarkers are within normal ranges.".into()
    } else {
        format!(
            "Detected: {}. {}",
            flags.join(", "),
            if status == "alert" {
                "Consider contacting your care team."
            } else {
                "Continue monitoring."
            }
        )
    };

    let report = BiomarkerReport {
        energy: round2(energy),
        breathing_rate: round2(breathing_rate),
        pitch_variability: round2(pitch_variability),
        cough_events,
        zero_crossing_rate: round2(zcr),
        summary,
        status: status.into(),
    };

    serde_json::to_string(&report).unwrap()
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

// ── Signal processing ────────────────────────────────────────────────

fn rms_energy(samples: &[f64]) -> f64 {
    let sum_sq: f64 = samples.iter().map(|s| s * s).sum();
    (sum_sq / samples.len() as f64).sqrt()
}

fn zero_crossing_rate(samples: &[f64]) -> f64 {
    if samples.len() < 2 {
        return 0.0;
    }
    let crossings = samples
        .windows(2)
        .filter(|w| (w[0] >= 0.0) != (w[1] >= 0.0))
        .count();
    crossings as f64 / (samples.len() - 1) as f64
}

/// Estimate breathing rate from the low-frequency energy envelope.
/// We split the audio into 200 ms frames, compute per-frame energy,
/// then count peaks in the envelope (each peak ≈ one exhalation).
fn estimate_breathing_rate(samples: &[f64], sample_rate: u32) -> f64 {
    let frame_size = (sample_rate as usize) / 5; // 200 ms frames
    if samples.len() < frame_size * 4 {
        return 0.0; // need enough data
    }

    let envelope: Vec<f64> = samples
        .chunks(frame_size)
        .map(|chunk| rms_energy(chunk))
        .collect();

    // Simple peak detection on the envelope
    let threshold = envelope.iter().copied().sum::<f64>() / envelope.len() as f64;
    let mut peaks = 0u32;
    let mut was_above = false;

    for &val in &envelope {
        if val > threshold * 1.2 && !was_above {
            peaks += 1;
            was_above = true;
        } else if val < threshold * 0.8 {
            was_above = false;
        }
    }

    let duration_sec = samples.len() as f64 / sample_rate as f64;
    if duration_sec < 1.0 {
        return 0.0;
    }

    // Convert peaks to breaths per minute
    (peaks as f64 / duration_sec) * 60.0
}

/// Estimate pitch variability using autocorrelation on overlapping frames.
/// Returns the coefficient of variation of the detected fundamental frequencies.
fn estimate_pitch_variability(samples: &[f64], sample_rate: u32) -> f64 {
    let frame_size = (sample_rate as usize) / 10; // 100 ms frames
    let hop = frame_size / 2;
    let min_lag = sample_rate as usize / 500; // 500 Hz max
    let max_lag = sample_rate as usize / 60; // 60 Hz min

    if frame_size < max_lag * 2 || samples.len() < frame_size {
        return 0.0;
    }

    let mut pitches: Vec<f64> = Vec::new();

    let mut start = 0;
    while start + frame_size <= samples.len() {
        let frame = &samples[start..start + frame_size];

        // Find the lag with the maximum autocorrelation
        let mut best_lag = min_lag;
        let mut best_corr = f64::NEG_INFINITY;

        for lag in min_lag..max_lag.min(frame_size / 2) {
            let mut corr = 0.0;
            let len = frame_size - lag;
            for i in 0..len {
                corr += frame[i] * frame[i + lag];
            }
            corr /= len as f64;

            if corr > best_corr {
                best_corr = corr;
                best_lag = lag;
            }
        }

        // Only accept if the correlation is strong enough
        let frame_energy = rms_energy(frame);
        if best_corr > frame_energy * frame_energy * 0.3 && best_lag > min_lag {
            let freq = sample_rate as f64 / best_lag as f64;
            if (60.0..=500.0).contains(&freq) {
                pitches.push(freq);
            }
        }

        start += hop;
    }

    if pitches.len() < 3 {
        return 0.0;
    }

    let mean = pitches.iter().sum::<f64>() / pitches.len() as f64;
    let variance =
        pitches.iter().map(|p| (p - mean).powi(2)).sum::<f64>() / pitches.len() as f64;
    let std_dev = variance.sqrt();

    std_dev / mean // coefficient of variation
}

/// Detect cough-like events: short bursts of high energy followed by silence.
fn detect_cough_events(samples: &[f64], sample_rate: u32) -> u32 {
    let frame_ms = 30;
    let frame_size = (sample_rate as usize * frame_ms) / 1000;
    if samples.len() < frame_size * 3 {
        return 0;
    }

    let energies: Vec<f64> = samples
        .chunks(frame_size)
        .map(|chunk| rms_energy(chunk))
        .collect();

    let mean_energy = energies.iter().sum::<f64>() / energies.len() as f64;
    let spike_threshold = mean_energy * 3.0;
    let silence_threshold = mean_energy * 0.5;

    let mut coughs = 0u32;
    let mut i = 0;

    while i + 2 < energies.len() {
        // Look for a sharp energy spike followed by a drop
        if energies[i] > spike_threshold {
            // Check that it drops back down within a few frames
            let mut found_drop = false;
            for j in 1..=5.min(energies.len() - i - 1) {
                if energies[i + j] < silence_threshold {
                    found_drop = true;
                    break;
                }
            }
            if found_drop {
                coughs += 1;
                i += 6; // skip ahead past this event
                continue;
            }
        }
        i += 1;
    }

    coughs
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn silence_flags_low_energy() {
        let silence = vec![0i16; 16000]; // 1 second of silence at 16kHz
        let result = analyze_audio(&silence, 16000);
        let report: BiomarkerReport = serde_json::from_str(&result).unwrap();
        assert_eq!(report.status, "monitor");
        assert_eq!(report.energy, 0.0);
    }

    #[test]
    fn empty_audio_handled() {
        let result = analyze_audio(&[], 16000);
        let report: BiomarkerReport = serde_json::from_str(&result).unwrap();
        assert_eq!(report.status, "normal");
    }
}
