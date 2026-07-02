/**
 * gain.ts — Pure decibel↔linear conversion for the channel input trim (GAIN).
 * No React/DOM/store imports so it can be unit-tested in isolation.
 */

/** Convert a gain value in decibels to a linear amplitude multiplier. */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}
