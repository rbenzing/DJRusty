/**
 * beatSync.ts — Pure utility functions for beat-sync pitch rate calculation.
 *
 * calculateSyncRate computes the pitch rate needed to match this deck's BPM
 * to the other deck's BPM, returning the closest discrete PITCH_RATES value.
 *
 * These functions are pure (no side effects, no store dependency) so they
 * can be unit-tested without any React or Zustand context.
 */
import { PITCH_RATES, type PitchRate } from '../constants/pitchRates';

/**
 * Find the PITCH_RATES value closest to the given ratio.
 *
 * Uses a simple linear scan — PITCH_RATES has only 8 entries so there is no
 * need for binary search. The pitchRates parameter defaults to PITCH_RATES but
 * can be overridden in tests to verify boundary behaviour.
 *
 * @param ratio - The target playback rate ratio (targetBPM / sourceBPM).
 * @param pitchRates - The array of allowed discrete pitch rates.
 * @returns The closest PitchRate value.
 */
export function findClosestPitchRate(
  ratio: number,
  pitchRates: readonly number[] = PITCH_RATES,
): PitchRate {
  let closest = 1;
  let minDiff = Infinity;

  for (const rate of pitchRates) {
    const diff = Math.abs(ratio - rate);
    if (diff < minDiff) {
      minDiff = diff;
      closest = rate;
    }
  }

  return closest as PitchRate;
}

/**
 * Calculate the pitch rate needed to sync thisDeck's BPM to otherDeck's BPM.
 *
 * Returns null when either BPM is falsy (null, 0, undefined), which maps
 * directly to the disabled state of the SYNC button.
 *
 * @param thisBpm - The tapped BPM of the deck being synced.
 * @param otherBpm - The tapped BPM of the other deck (the target BPM).
 * @param pitchRates - The array of allowed discrete pitch rates.
 * @returns The closest PitchRate, or null if either BPM is falsy.
 */
export function calculateSyncRate(
  thisBpm: number | null,
  otherBpm: number | null,
  pitchRates: readonly number[] = PITCH_RATES,
): PitchRate | null {
  if (!thisBpm || !otherBpm) return null;

  const ratio = otherBpm / thisBpm;
  return findClosestPitchRate(ratio, pitchRates);
}
