/**
 * volumeMap.ts — Crossfader position to volume curve utilities.
 * Full implementation here for STORY-001.
 * Used by useCrossfade hook and Mixer components in STORY-006.
 */
import type { CrossfaderCurve } from '../types/mixer';

/**
 * Clamps a value to the range [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Converts a crossfader position to per-deck volumes using the specified curve.
 *
 * @param position - Crossfader position in the range [0.0, 1.0].
 * @param curve    - Curve shape: 'smooth' (default), 'linear', or 'sharp'.
 * @returns Volume levels (0–100) for each deck.
 *
 * Curve behaviour at key positions:
 *
 *   smooth (constant-power / cosine):
 *     0.0 → A=100, B=0   |  0.5 → A≈71, B≈71   |  1.0 → A=0,  B=100
 *
 *   linear:
 *     0.0 → A=100, B=0   |  0.5 → A=50,  B=50   |  1.0 → A=0,  B=100
 *
 *   sharp (hard cut):
 *     0.0 → A=100, B=0   |  0.5 → A=100, B=100  |  1.0 → A=0,  B=100
 */
export function crossfaderToVolumes(
  position: number,
  curve: CrossfaderCurve = 'smooth',
): { a: number; b: number } {
  const pos = clamp(position, 0, 1);

  switch (curve) {
    case 'linear': {
      const a = Math.round((1 - pos) * 100);
      const b = Math.round(pos * 100);
      return { a: clamp(a, 0, 100), b: clamp(b, 0, 100) };
    }

    case 'sharp': {
      const a = pos < 0.5 ? 100 : Math.max(0, Math.round(100 * (1 - (pos - 0.5) * 2)));
      const b = pos > 0.5 ? 100 : Math.max(0, Math.round(100 * (pos * 2)));
      return { a: clamp(a, 0, 100), b: clamp(b, 0, 100) };
    }

    case 'smooth':
    default: {
      const a = Math.round(Math.cos(pos * (Math.PI / 2)) * 100);
      const b = Math.round(Math.cos((1 - pos) * (Math.PI / 2)) * 100);
      return { a: clamp(a, 0, 100), b: clamp(b, 0, 100) };
    }
  }
}

/**
 * Computes the composite volume after multiplying the crossfader-derived volume
 * with the per-deck channel fader level.
 *
 * This is the value passed directly to player.setVolume().
 *
 * @param crossfaderVol - Volume from crossfader calculation (0–100).
 * @param channelFader - Per-deck channel fader level (0–100).
 * @returns Final volume to pass to setVolume() (0–100).
 */
export function compositeVolume(crossfaderVol: number, channelFader: number): number {
  return clamp(Math.round(crossfaderVol * (channelFader / 100)), 0, 100);
}
