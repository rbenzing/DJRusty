/**
 * extractColoredPeaks.ts — Frequency-colored waveform peak extraction.
 *
 * For each time window (bar), computes amplitude + frequency band energies
 * using a 1-pole IIR filter to separate bass / mid / high content.
 * O(N) — runs during MP3 decode, same cost as extractWaveformPeaks.
 *
 * Bass (0–300 Hz): low-pass filtered signal energy
 * Mid  (300–3 kHz): band between low and high
 * High (3 kHz–20 kHz): high-pass filtered signal energy
 */

export interface ColoredPeak {
  /** Normalised amplitude (0–1). */
  amp: number;
  /** Normalised bass energy share (0–1). */
  bass: number;
  /** Normalised mid energy share (0–1). */
  mid: number;
  /** Normalised high energy share (0–1). */
  high: number;
}

/**
 * Extract frequency-colored peaks from an AudioBuffer.
 * @param buffer   Decoded audio data.
 * @param numPeaks Number of bars to produce.
 * @returns        Array of ColoredPeak, length === numPeaks.
 */
export function extractColoredPeaks(buffer: AudioBuffer, numPeaks: number): ColoredPeak[] {
  const result: ColoredPeak[] = [];

  if (numPeaks === 0 || buffer.length === 0) return result;

  // Mono mix — average all channels
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  const sampleRate = buffer.sampleRate;
  const samplesPerBar = Math.max(1, Math.floor(buffer.length / numPeaks));

  // 1-pole LPF coefficients (bilinear approximation)
  // α ≈ 2π·fc / sampleRate (small-angle approximation, accurate for fc << sampleRate/2)
  const alphaLow = Math.min(1, (2 * Math.PI * 300) / sampleRate);   // ~300 Hz
  const alphaHigh = Math.min(1, (2 * Math.PI * 3000) / sampleRate); // ~3 kHz

  // IIR state (carry between windows for continuity)
  let lpLow = 0;   // low-pass state for bass extraction
  let lpHigh = 0;  // low-pass state for low+mid extraction (everything below ~3 kHz)

  for (let i = 0; i < numPeaks; i++) {
    const start = i * samplesPerBar;
    const end = Math.min(start + samplesPerBar, buffer.length);

    let rawPeak = 0;
    let bassPeak = 0;
    let midPeak = 0;
    let highPeak = 0;

    for (let s = start; s < end; s++) {
      // Mono mix
      let sample = 0;
      for (const ch of channels) sample += ch[s] ?? 0;
      sample /= channels.length;

      const abs = Math.abs(sample);
      if (abs > rawPeak) rawPeak = abs;

      // Bass: 1-pole LPF at 300 Hz
      lpLow += alphaLow * (sample - lpLow);
      const bassAbs = Math.abs(lpLow);
      if (bassAbs > bassPeak) bassPeak = bassAbs;

      // Low+mid: 1-pole LPF at 3 kHz
      lpHigh += alphaHigh * (sample - lpHigh);

      // Mid: band between ~300 Hz and ~3 kHz
      const midSample = lpHigh - lpLow;
      const midAbs = Math.abs(midSample);
      if (midAbs > midPeak) midPeak = midAbs;

      // High: HPF residual (above ~3 kHz)
      const highSample = sample - lpHigh;
      const highAbs = Math.abs(highSample);
      if (highAbs > highPeak) highPeak = highAbs;
    }

    result.push({ amp: rawPeak, bass: bassPeak, mid: midPeak, high: highPeak });
  }

  // Global normalisation pass — ensure all band values fit in 0–1
  let maxAmp = 0, maxBass = 0, maxMid = 0, maxHigh = 0;
  for (const p of result) {
    if (p.amp  > maxAmp)  maxAmp  = p.amp;
    if (p.bass > maxBass) maxBass = p.bass;
    if (p.mid  > maxMid)  maxMid  = p.mid;
    if (p.high > maxHigh) maxHigh = p.high;
  }

  for (const p of result) {
    if (maxAmp  > 0) p.amp  /= maxAmp;
    if (maxBass > 0) p.bass /= maxBass;
    if (maxMid  > 0) p.mid  /= maxMid;
    if (maxHigh > 0) p.high /= maxHigh;
  }

  return result;
}
