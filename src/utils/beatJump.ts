/**
 * beatJump.ts — Pure utility module for beat jump math.
 *
 * No React or store dependencies. Contains the jump-distance calculation,
 * the time clamping helper, and the constant array of available jump sizes.
 */

/**
 * Available beat jump sizes. Matches DJ hardware conventions.
 * 0.5 represents a half-beat jump.
 */
export const BEAT_JUMP_SIZES = [0.5, 1, 2, 4, 8, 16] as const;

export type BeatJumpSize = (typeof BEAT_JUMP_SIZES)[number];

/** Default beat jump size for a fresh deck. */
export const DEFAULT_BEAT_JUMP_SIZE: BeatJumpSize = 4;

/**
 * Calculate the jump duration in seconds for the given number of beats at a BPM.
 *
 * Formula: (beats / bpm) * 60
 *
 * @param beats - Number of beats to jump (e.g. 0.5, 1, 2, 4, 8, 16).
 * @param bpm   - Beats per minute from tap-tempo.
 * @returns Duration in seconds. Always positive.
 */
export function calculateJumpSeconds(beats: number, bpm: number): number {
  return (beats / bpm) * 60;
}

/**
 * Clamp a time value to the valid range [0, duration].
 *
 * @param time     - The candidate time in seconds (may be negative or > duration).
 * @param duration - Track duration in seconds. Must be >= 0.
 * @returns Clamped time.
 */
export function clampTime(time: number, duration: number): number {
  return Math.max(0, Math.min(time, duration));
}
