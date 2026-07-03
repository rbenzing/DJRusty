/**
 * slicer.ts — Pure math for the SLICER pad mode. No React/DOM/store imports.
 *
 * SLICER divides an upcoming window of `windowBeats` beats (aligned to the
 * grid anchor) into 8 equal slices. These functions compute which window a
 * playhead falls in, which slice within that window it's currently in (for
 * the pad-grid "follow" highlight), and a given slice index's [start, end)
 * bounds (for arming a loop when a pad is pressed).
 */
import { type BeatGrid, secondsPerBeat } from './beatGrid';

/** Available Slicer window sizes, in beats. */
export const SLICE_WINDOW_SIZES = [4, 8, 16, 32] as const;

/** Default Slicer window size for a fresh deck. */
export const DEFAULT_SLICE_WINDOW_BEATS: (typeof SLICE_WINDOW_SIZES)[number] = 8;

const SLICE_COUNT = 8;

/** The start (seconds) of the windowBeats-beat window containing playhead, aligned to the grid anchor. */
export function sliceWindowStart(grid: BeatGrid, playhead: number, windowBeats: number): number {
  const windowSeconds = secondsPerBeat(grid.bpm) * windowBeats;
  return grid.anchor + Math.floor((playhead - grid.anchor) / windowSeconds) * windowSeconds;
}

/** Which of the 8 slices (0-7) currently contains playhead, within its window. Clamped defensively. */
export function sliceIndexAt(grid: BeatGrid, playhead: number, windowBeats: number): number {
  const windowStart = sliceWindowStart(grid, playhead, windowBeats);
  const sliceLength = (secondsPerBeat(grid.bpm) * windowBeats) / SLICE_COUNT;
  const idx = Math.floor((playhead - windowStart) / sliceLength);
  return Math.max(0, Math.min(SLICE_COUNT - 1, idx));
}

/** The [start, end) bounds (seconds) of slice `index` within the window containing playhead. */
export function sliceStartFor(
  grid: BeatGrid,
  playhead: number,
  windowBeats: number,
  index: number,
): { start: number; end: number } {
  const windowStart = sliceWindowStart(grid, playhead, windowBeats);
  const sliceLength = (secondsPerBeat(grid.bpm) * windowBeats) / SLICE_COUNT;
  const clampedIndex = Math.max(0, Math.min(SLICE_COUNT - 1, index));
  const start = windowStart + clampedIndex * sliceLength;
  return { start, end: start + sliceLength };
}
