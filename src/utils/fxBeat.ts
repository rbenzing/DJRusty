/**
 * fxBeat.ts — Maps the FX BEAT/TIME knob (0..1) to a musical beat division.
 * Pure; no React/DOM/store imports.
 */

/** Ordered FX time divisions, in beats. Index 3 (1/2) is the default. */
export const FX_BEAT_DIVISIONS = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4] as const;

/** Map a normalized knob value in [0,1] to the nearest beat division. */
export function fxBeatMultiplier(v: number): number {
  const clamped = Math.max(0, Math.min(1, v));
  const idx = Math.round(clamped * (FX_BEAT_DIVISIONS.length - 1));
  const division = FX_BEAT_DIVISIONS[idx];
  // noUncheckedIndexedAccess: idx is guaranteed in range, but assert for the type.
  return division ?? 1 / 2;
}
