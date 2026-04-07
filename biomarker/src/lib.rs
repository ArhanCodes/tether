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
    /// Overall confidence in the analysis (0.0–1.0). Based on signal quality,
    /// recording length, and pitch detection hit rate.
    pub confidence: f64,
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
            confidence: 0.0,
            summary: "No audio data received.".into(),
            status: "normal".into(),
        })
        .unwrap();
    }

    // ── Signal quality gate ─────────────────────────────────────────
    let snr = signal_quality(&samples);
    let duration_sec = n as f64 / sample_rate as f64;

    if snr < 0.005 {
        return serde_json::to_string(&BiomarkerReport {
            energy: 0.0,
            breathing_rate: 0.0,
            pitch_variability: 0.0,
            cough_events: 0,
            zero_crossing_rate: 0.0,
            confidence: 0.0,
            summary: "Recording quality too low — please record in a quieter environment and hold the phone closer.".into(),
            status: "normal".into(),
        })
        .unwrap();
    }

    // ── Strip silence before analysis ───────────────────────────────
    let active_samples = strip_silence(&samples, sample_rate);
    let active_duration = active_samples.len() as f64 / sample_rate as f64;

    // Use active samples for voice metrics, full samples for cough/breathing
    let energy = rms_energy(&active_samples);
    let zcr = zero_crossing_rate(&active_samples);
    let breathing_rate = estimate_breathing_rate(&samples, sample_rate);
    let pitch_variability = estimate_pitch_variability(&active_samples, sample_rate);
    let (pitch_hit_rate, _) = pitch_detection_stats(&active_samples, sample_rate);
    let cough_events = detect_cough_events(&samples, sample_rate);

    // ── Confidence scoring ──────────────────────────────────────────
    let snr_score = (snr / 0.1).min(1.0); // maxes at SNR 0.1
    let duration_score = (duration_sec / 10.0).min(1.0); // maxes at 10s
    let active_ratio = if duration_sec > 0.0 { active_duration / duration_sec } else { 0.0 };
    let active_score = (active_ratio / 0.5).min(1.0); // maxes at 50% active
    let pitch_score = pitch_hit_rate.min(1.0);
    let confidence = (snr_score * 0.3 + duration_score * 0.25 + active_score * 0.25 + pitch_score * 0.2).min(1.0);

    // ── Flag detection ──────────────────────────────────────────────
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

    // ── Rich summary with normal ranges ─────────────────────────────
    let summary = build_summary(&flags, status, energy, breathing_rate, pitch_variability, cough_events, zcr, confidence);

    let report = BiomarkerReport {
        energy: round2(energy),
        breathing_rate: round2(breathing_rate),
        pitch_variability: round2(pitch_variability),
        cough_events,
        zero_crossing_rate: round2(zcr),
        confidence: round2(confidence),
        summary,
        status: status.into(),
    };

    serde_json::to_string(&report).unwrap()
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

// ── Signal quality ──────────────────────────────────────────────────

/// Returns a signal-to-noise ratio estimate (0.0 = silence/noise, higher = cleaner).
/// Uses the ratio of top-quartile energy to bottom-quartile energy.
fn signal_quality(samples: &[f64]) -> f64 {
    let frame_size = 512;
    if samples.len() < frame_size * 4 {
        return rms_energy(samples);
    }

    let mut energies: Vec<f64> = samples
        .chunks(frame_size)
        .map(|c| rms_energy(c))
        .collect();
    energies.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let q1_end = energies.len() / 4;
    let q3_start = energies.len() * 3 / 4;

    let noise_floor: f64 = energies[..q1_end].iter().sum::<f64>() / q1_end.max(1) as f64;
    let signal_level: f64 = energies[q3_start..].iter().sum::<f64>() / (energies.len() - q3_start).max(1) as f64;

    if noise_floor < 1e-10 {
        return signal_level;
    }
    signal_level / noise_floor.max(1e-10) * 0.01 // normalized
}

/// Remove silent frames (below adaptive noise floor) to get only voiced segments.
fn strip_silence(samples: &[f64], sample_rate: u32) -> Vec<f64> {
    let frame_size = (sample_rate as usize) / 50; // 20ms frames
    if samples.len() < frame_size * 2 {
        return samples.to_vec();
    }

    let energies: Vec<f64> = samples.chunks(frame_size).map(|c| rms_energy(c)).collect();

    // Adaptive threshold: 2x the 20th percentile energy
    let mut sorted = energies.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let p20 = sorted[sorted.len() / 5];
    let threshold = (p20 * 2.0).max(0.005); // never go below absolute floor

    let mut result = Vec::with_capacity(samples.len());
    for (i, chunk) in samples.chunks(frame_size).enumerate() {
        if i < energies.len() && energies[i] >= threshold {
            result.extend_from_slice(chunk);
        }
    }

    // If stripping removed too much, return original
    if result.len() < samples.len() / 4 {
        return samples.to_vec();
    }
    result
}

// ── Core signal processing (unchanged algorithms) ───────────────────

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
/// smooth with a moving average, then count peaks (each peak ≈ one exhalation).
fn estimate_breathing_rate(samples: &[f64], sample_rate: u32) -> f64 {
    let frame_size = (sample_rate as usize) / 5; // 200 ms frames
    if samples.len() < frame_size * 4 {
        return 0.0; // need enough data
    }

    let raw_envelope: Vec<f64> = samples
        .chunks(frame_size)
        .map(|chunk| rms_energy(chunk))
        .collect();

    // Low-pass smooth the envelope to separate breathing from speech cadence
    let envelope = smooth_envelope(&raw_envelope, 3);

    // Simple peak detection on the smoothed envelope
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

/// Simple moving-average low-pass filter on an envelope signal.
fn smooth_envelope(envelope: &[f64], window: usize) -> Vec<f64> {
    if envelope.len() <= window {
        return envelope.to_vec();
    }
    let half = window / 2;
    let mut smoothed = Vec::with_capacity(envelope.len());
    for i in 0..envelope.len() {
        let start = if i >= half { i - half } else { 0 };
        let end = (i + half + 1).min(envelope.len());
        let sum: f64 = envelope[start..end].iter().sum();
        smoothed.push(sum / (end - start) as f64);
    }
    smoothed
}

/// Estimate pitch variability using autocorrelation on overlapping frames.
/// Returns the coefficient of variation of the detected fundamental frequencies.
fn estimate_pitch_variability(samples: &[f64], sample_rate: u32) -> f64 {
    let (_, cv) = pitch_detection_stats(samples, sample_rate);
    cv
}

/// Returns (hit_rate, coefficient_of_variation) from pitch detection.
/// hit_rate = fraction of frames where pitch was successfully detected.
fn pitch_detection_stats(samples: &[f64], sample_rate: u32) -> (f64, f64) {
    let frame_size = (sample_rate as usize) / 10; // 100 ms frames
    let hop = frame_size / 2;
    let min_lag = sample_rate as usize / 500; // 500 Hz max
    let max_lag = sample_rate as usize / 60; // 60 Hz min

    if frame_size < max_lag * 2 || samples.len() < frame_size {
        return (0.0, 0.0);
    }

    let mut pitches: Vec<f64> = Vec::new();
    let mut total_frames = 0u32;

    let mut start = 0;
    while start + frame_size <= samples.len() {
        total_frames += 1;
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

    let hit_rate = if total_frames > 0 {
        pitches.len() as f64 / total_frames as f64
    } else {
        0.0
    };

    if pitches.len() < 3 {
        return (hit_rate, 0.0);
    }

    let mean = pitches.iter().sum::<f64>() / pitches.len() as f64;
    let variance =
        pitches.iter().map(|p| (p - mean).powi(2)).sum::<f64>() / pitches.len() as f64;
    let std_dev = variance.sqrt();

    (hit_rate, std_dev / mean) // (hit_rate, coefficient of variation)
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

// ── Summary builder ─────────────────────────────────────────────────

fn build_summary(
    flags: &[&str],
    status: &str,
    energy: f64,
    breathing_rate: f64,
    pitch_variability: f64,
    cough_events: u32,
    zcr: f64,
    confidence: f64,
) -> String {
    if flags.is_empty() {
        let conf_note = if confidence < 0.5 {
            " Recording quality was moderate — try a longer recording in a quieter space for more reliable results."
        } else {
            ""
        };
        return format!("Voice biomarkers are within normal ranges.{}", conf_note);
    }

    let mut details: Vec<String> = Vec::new();

    if energy < 0.02 {
        details.push(format!(
            "Voice energy is very low ({:.2}) — this can indicate fatigue or weakness",
            energy
        ));
    }
    if breathing_rate > 24.0 {
        details.push(format!(
            "Breathing rate is {:.0}/min (normal range: 12–20/min)",
            breathing_rate
        ));
    }
    if pitch_variability > 0.35 {
        details.push(format!(
            "Pitch variability is elevated ({:.2}, threshold: 0.35) — possible vocal tremor",
            pitch_variability
        ));
    }
    if cough_events >= 3 {
        details.push(format!(
            "{} cough events detected in this recording",
            cough_events
        ));
    }
    if zcr > 0.3 {
        details.push(format!(
            "Zero-crossing rate is high ({:.2}) — suggests breathy or labored speech",
            zcr
        ));
    }

    let action = if status == "alert" {
        "Consider contacting your care team."
    } else {
        "Continue monitoring and record again later."
    };

    let conf_note = if confidence < 0.5 {
        " (Note: recording quality was moderate — results may be less precise.)"
    } else {
        ""
    };

    format!("{}. {}{}", details.join(". "), action, conf_note)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn silence_flags_low_energy() {
        let silence = vec![0i16; 16000 * 6]; // 6 seconds of silence at 16kHz
        let result = analyze_audio(&silence, 16000);
        let report: BiomarkerReport = serde_json::from_str(&result).unwrap();
        // Pure silence should be caught by SNR gate
        assert!(report.confidence < 0.5 || report.energy < 0.02);
    }

    #[test]
    fn empty_audio_handled() {
        let result = analyze_audio(&[], 16000);
        let report: BiomarkerReport = serde_json::from_str(&result).unwrap();
        assert_eq!(report.status, "normal");
        assert_eq!(report.confidence, 0.0);
    }

    #[test]
    fn confidence_present() {
        // Generate a simple sine wave
        let mut samples = Vec::with_capacity(16000 * 6);
        for i in 0..16000 * 6 {
            let t = i as f64 / 16000.0;
            samples.push((f64::sin(2.0 * std::f64::consts::PI * 200.0 * t) * 16000.0) as i16);
        }
        let result = analyze_audio(&samples, 16000);
        let report: BiomarkerReport = serde_json::from_str(&result).unwrap();
        assert!(report.confidence > 0.0);
    }

    #[test]
    fn smooth_envelope_works() {
        let env = vec![1.0, 5.0, 1.0, 5.0, 1.0];
        let smoothed = smooth_envelope(&env, 3);
        assert_eq!(smoothed.len(), 5);
        // Middle values should be averaged
        assert!((smoothed[1] - 7.0 / 3.0).abs() < 0.01);
    }
}
