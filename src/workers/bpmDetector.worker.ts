/**
 * BPM detection worker — uses energy-autocorrelation on the audio signal.
 * Accepts: { channelData: Float32Array, sampleRate: number }
 * Posts:   { bpm: number } on success
 */

const BPM_MIN = 60;
const BPM_MAX = 200;
const WINDOW_SIZE = 1024;

function detectBpm(channelData: Float32Array, sampleRate: number): number {
  // Compute RMS energy envelope in overlapping windows
  const hopSize = WINDOW_SIZE / 2;
  const numFrames = Math.floor((channelData.length - WINDOW_SIZE) / hopSize);
  if (numFrames < 2) return 120; // fallback

  const energy = new Float32Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    const offset = i * hopSize;
    let sum = 0;
    for (let j = 0; j < WINDOW_SIZE; j++) {
      const s = channelData[offset + j] ?? 0;
      sum += s * s;
    }
    energy[i] = Math.sqrt(sum / WINDOW_SIZE);
  }

  // Autocorrelation of energy signal
  const lagMin = Math.floor((60 / BPM_MAX) * sampleRate / hopSize);
  const lagMax = Math.ceil((60 / BPM_MIN) * sampleRate / hopSize);

  let bestLag = lagMin;
  let bestScore = -Infinity;

  for (let lag = lagMin; lag <= lagMax && lag < numFrames; lag++) {
    let score = 0;
    for (let i = 0; i + lag < numFrames; i++) {
      score += (energy[i] ?? 0) * (energy[i + lag] ?? 0);
    }
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  const secondsPerBeat = (bestLag * hopSize) / sampleRate;
  const bpm = 60 / secondsPerBeat;
  return Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(bpm)));
}

self.onmessage = (e: MessageEvent<{ channelData: Float32Array; sampleRate: number }>) => {
  try {
    const { channelData, sampleRate } = e.data;
    const bpm = detectBpm(channelData, sampleRate);
    self.postMessage({ bpm });
  } catch {
    self.postMessage({ bpm: 120 });
  }
};
