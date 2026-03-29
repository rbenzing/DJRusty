/**
 * Extract peak amplitudes from an AudioBuffer for waveform display.
 * @param buffer - Decoded audio data
 * @param numPeaks - Number of amplitude samples to return
 * @returns Float32Array of normalised (0–1) peak values, length === numPeaks
 */
export function extractWaveformPeaks(buffer: AudioBuffer, numPeaks: number): Float32Array {
  const peaks = new Float32Array(numPeaks);
  if (numPeaks === 0 || buffer.length === 0) return peaks;

  // Average across channels for mono-compatible waveform
  const channels: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  const samplesPerPeak = Math.max(1, Math.floor(buffer.length / numPeaks));
  let globalMax = 0;

  for (let i = 0; i < numPeaks; i++) {
    const start = i * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, buffer.length);
    let peak = 0;
    for (let s = start; s < end; s++) {
      let sum = 0;
      for (const ch of channels) {
        sum += Math.abs(ch[s] ?? 0);
      }
      const avg = sum / channels.length;
      if (avg > peak) peak = avg;
    }
    peaks[i] = peak;
    if (peak > globalMax) globalMax = peak;
  }

  // Normalise to 0–1
  if (globalMax > 0) {
    for (let i = 0; i < numPeaks; i++) {
      peaks[i] = peaks[i]! / globalMax;
    }
  }

  return peaks;
}
