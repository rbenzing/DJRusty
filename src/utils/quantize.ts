/**
 * quantize.ts — Snap a time to the beat grid (QUANTIZE). Pure; wraps beatGrid math.
 */
import { type BeatGrid, nearestBeat } from './beatGrid';

/** Snap a time (seconds) to the nearest beat on the grid. */
export function snapToGrid(grid: BeatGrid, t: number): number {
  return nearestBeat(grid, t);
}
