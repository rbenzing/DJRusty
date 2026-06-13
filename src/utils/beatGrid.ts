/**
 * beatGrid.ts — Pure beat-grid math. No React/DOM/store imports.
 * A grid is { bpm, anchor }: anchor is the time (s) of a known beat-1 (downbeat); 4/4 assumed.
 */
export interface BeatGrid { bpm: number; anchor: number; }

const BEATS_PER_BAR = 4;

export function secondsPerBeat(bpm: number): number { return 60 / bpm; }

export function beatIndexAt(grid: BeatGrid, t: number): number {
  return (t - grid.anchor) / secondsPerBeat(grid.bpm);
}

export function nearestBeat(grid: BeatGrid, t: number): number {
  const spb = secondsPerBeat(grid.bpm);
  return grid.anchor + Math.round(beatIndexAt(grid, t)) * spb;
}

export function beatAtOrBefore(grid: BeatGrid, t: number): number {
  const spb = secondsPerBeat(grid.bpm);
  return grid.anchor + Math.floor(beatIndexAt(grid, t) + 1e-9) * spb;
}

export function nearestBar(grid: BeatGrid, t: number): number {
  const spBar = secondsPerBeat(grid.bpm) * BEATS_PER_BAR;
  return grid.anchor + Math.round((t - grid.anchor) / spBar) * spBar;
}

export function quantize(grid: BeatGrid, t: number, division: number): number {
  const step = secondsPerBeat(grid.bpm) / division;
  return grid.anchor + Math.round((t - grid.anchor) / step) * step;
}

export function phase(grid: BeatGrid, t: number, span: 'beat' | 'bar' = 'beat'): number {
  const unit = secondsPerBeat(grid.bpm) * (span === 'bar' ? BEATS_PER_BAR : 1);
  const raw = ((t - grid.anchor) % unit + unit) % unit;
  return raw / unit;
}

/** Provisional grid proposed from auto-detected BPM. anchor 0 until the DJ taps the downbeat. */
export function proposeGrid(bpm: number): { bpm: number; anchor: number; confirmed: boolean } {
  return { bpm, anchor: 0, confirmed: false };
}
