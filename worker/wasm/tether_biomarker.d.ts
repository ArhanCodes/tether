/* tslint:disable */
/* eslint-disable */

/**
 * Analyse a buffer of **16-bit signed PCM samples** at the given sample rate
 * and return a JSON-encoded `BiomarkerReport`.
 */
export function analyze_audio(samples_i16: Int16Array, sample_rate: number): string;
