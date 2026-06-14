import { type BeatGrid, beatAtOrBefore } from './beatGrid';

/** Loop in-point: snap to the grid beat at or before the playhead (so the playhead is inside the loop). */
export function snapLoopIn(grid: BeatGrid, playhead: number): number {
  return beatAtOrBefore(grid, playhead);
}

/** Loop out-point for a beat-length loop. */
export function loopOutFor(inSec: number, beats: number, bpm: number): number {
  return inSec + (beats / bpm) * 60;
}
