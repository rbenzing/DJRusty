/**
 * loopUtils.ts — Pure utility functions for loop boundary calculation.
 *
 * Kept separate from store logic so the calculation can be unit-tested
 * independently of Zustand or any browser APIs.
 */

/**
 * Calculate the loop end position in seconds.
 *
 * @param currentTime - The playback position where the loop starts (seconds).
 * @param beatCount   - Number of beats in the loop (e.g. 1, 2, 4, 8).
 * @param bpm         - Beats per minute (must be > 0).
 * @returns The loop end position in seconds.
 */
export function calcLoopEnd(
  currentTime: number,
  beatCount: number,
  bpm: number,
): number {
  return currentTime + (beatCount / bpm) * 60;
}
