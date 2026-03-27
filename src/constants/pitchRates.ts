/**
 * Discrete playback rates supported by the YouTube IFrame Player API.
 * These are the only valid values for player.setPlaybackRate().
 */
export const PITCH_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export type PitchRate = (typeof PITCH_RATES)[number];

/**
 * Returns the pitch rate from PITCH_RATES closest to the given value.
 */
export function nearestPitchRate(value: number): PitchRate {
  return PITCH_RATES.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev,
  );
}

/**
 * Default (normal speed) pitch rate.
 */
export const DEFAULT_PITCH_RATE: PitchRate = 1;
