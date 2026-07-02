import { type BeatGrid, beatAtOrBefore } from './beatGrid';

/** Loop in-point: snap to the grid beat at or before the playhead (so the playhead is inside the loop). */
export function snapLoopIn(grid: BeatGrid, playhead: number): number {
  return beatAtOrBefore(grid, playhead);
}

/** Loop out-point for a beat-length loop. */
export function loopOutFor(inSec: number, beats: number, bpm: number): number {
  return inSec + (beats / bpm) * 60;
}

export type LoopBeatCount = 1 | 2 | 4 | 8;

/**
 * SHIFT + loop-length button semantics: while a loop is active, a loop-length
 * button click halves/doubles the active loop instead of absolute-selecting
 * the clicked length.
 *
 * - clicked === active → 'deactivate' (same toggle-off behavior as non-shift).
 * - clicked < active → halve the active length, clamped to a minimum of 1.
 * - clicked > active → double the active length, clamped to a maximum of 8.
 */
export function shiftedLoopBeatCount(active: LoopBeatCount, clicked: LoopBeatCount): 'deactivate' | LoopBeatCount {
  if (clicked === active) return 'deactivate';
  if (clicked < active) return Math.max(1, active / 2) as LoopBeatCount;
  return Math.min(8, active * 2) as LoopBeatCount;
}
