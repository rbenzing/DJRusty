/**
 * scratchMath.ts — pure math for jog-wheel scratch/bend interaction.
 *
 * No DOM or AudioWorkletGlobalScope APIs — importable both by React
 * components (JogWheel.tsx) and by the AudioWorkletProcessor module
 * (scratchProcessor.ts), which runs in an isolated global scope that cannot
 * import anything DOM-dependent.
 */

/** Seconds of track-time per full platter rotation — matches VinylPlatter's existing CSS spin-duration constant (`1.8 / pitchRate` seconds per rotation at rate 1.0). */
export const SECONDS_PER_ROTATION = 1.8;

/**
 * Angle (degrees, -180..180) from a center point to a pointer position.
 * Standard atan2 convention: 0deg points along +X; since screen Y increases
 * downward, positive angles sweep clockwise (toward +Y / "down").
 */
export function angleDeg(centerX: number, centerY: number, pointerX: number, pointerY: number): number {
  return Math.atan2(pointerY - centerY, pointerX - centerX) * (180 / Math.PI);
}

/**
 * Shortest signed delta (degrees) from one angle to another, correctly
 * handling the +180/-180 wraparound (e.g. 170 -> -170 is +20, not -340).
 */
export function shortestAngleDelta(fromDeg: number, toDeg: number): number {
  let delta = (toDeg - fromDeg) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

/** Converts a rotation delta (degrees) to a track-time delta (seconds) via SECONDS_PER_ROTATION. */
export function rotationDeltaToSeconds(deltaDeg: number): number {
  return (deltaDeg / 360) * SECONDS_PER_ROTATION;
}

/**
 * Instantaneous scratch rate (seconds of track-time per second of real time)
 * from a track-time delta and the wall-clock time (ms) it took. Returns 0
 * for a non-positive elapsed time (guards div-by-zero on duplicate/out-of-order events).
 */
export function rateFromMovement(deltaSeconds: number, deltaMs: number): number {
  if (deltaMs <= 0) return 0;
  return deltaSeconds / (deltaMs / 1000);
}

/**
 * Linearly-interpolated sample at a fractional index, clamped to the array's
 * bounds. Used by the scratch worklet to read between two integer sample
 * positions as its read-position advances by a fractional rate each sample.
 */
export function interpolateSample(data: Float32Array, position: number): number {
  const length = data.length;
  if (length === 0) return 0;
  const clamped = Math.max(0, Math.min(position, length - 1));
  const index = Math.floor(clamped);
  const frac = clamped - index;
  const a = data[index] ?? 0;
  const b = data[Math.min(index + 1, length - 1)] ?? a;
  return a + (b - a) * frac;
}
