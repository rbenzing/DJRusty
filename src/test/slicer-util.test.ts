import { describe, it, expect } from 'vitest';
import { sliceWindowStart, sliceIndexAt, sliceStartFor } from '../utils/slicer';

const grid = { bpm: 120, anchor: 0 }; // secondsPerBeat = 0.5

describe('sliceWindowStart', () => {
  it('returns the current window start for windowBeats=8 (4s window)', () => {
    expect(sliceWindowStart(grid, 0, 8)).toBeCloseTo(0, 6);
    expect(sliceWindowStart(grid, 3.9, 8)).toBeCloseTo(0, 6);
    expect(sliceWindowStart(grid, 4.1, 8)).toBeCloseTo(4, 6);
  });

  it('aligns to a non-zero anchor', () => {
    const offsetGrid = { bpm: 120, anchor: 0.2 };
    expect(sliceWindowStart(offsetGrid, 0.2, 8)).toBeCloseTo(0.2, 6);
    expect(sliceWindowStart(offsetGrid, 4.0, 8)).toBeCloseTo(0.2, 6);
    expect(sliceWindowStart(offsetGrid, 4.3, 8)).toBeCloseTo(4.2, 6);
  });

  it('supports larger window sizes (windowBeats=16 -> 8s window)', () => {
    expect(sliceWindowStart(grid, 9, 16)).toBeCloseTo(8, 6);
  });

  it('correctly identifies the window at an exact boundary even when the boundary is not exactly representable in floating point (e.g. 121 BPM)', () => {
    const oddGrid = { bpm: 121, anchor: 0 };
    const windowSeconds = (60 / 121) * 4; // secondsPerBeat(121) * 4
    const exactBoundary = windowSeconds * 3; // the exact 4th window's start
    expect(sliceWindowStart(oddGrid, exactBoundary, 4)).toBeCloseTo(windowSeconds * 3, 9);
  });
});

describe('sliceIndexAt', () => {
  it('maps playhead to the correct slice index within an 8-beat window', () => {
    expect(sliceIndexAt(grid, 0, 8)).toBe(0);
    expect(sliceIndexAt(grid, 0.3, 8)).toBe(0); // slice length 0.5s
    expect(sliceIndexAt(grid, 0.6, 8)).toBe(1);
    expect(sliceIndexAt(grid, 3.9, 8)).toBe(7);
  });

  it('scales slice length with window size (windowBeats=16 -> 1s slices)', () => {
    expect(sliceIndexAt(grid, 8.5, 16)).toBe(0);
    expect(sliceIndexAt(grid, 9.5, 16)).toBe(1);
  });

  it('a playhead exactly on a window boundary belongs to the next window (slice 0), not slice 8', () => {
    expect(sliceIndexAt(grid, 4.0, 8)).toBe(0);
  });

  it('a playhead exactly on an odd-BPM window boundary lands in slice 0 of the new window', () => {
    const oddGrid = { bpm: 121, anchor: 0 };
    const windowSeconds = (60 / 121) * 4;
    const exactBoundary = windowSeconds * 3;
    expect(sliceIndexAt(oddGrid, exactBoundary, 4)).toBe(0);
  });
});

describe('sliceStartFor', () => {
  it('computes the [start, end) bounds for a given slice index', () => {
    const { start, end } = sliceStartFor(grid, 0, 8, 3);
    expect(start).toBeCloseTo(1.5, 6);
    expect(end).toBeCloseTo(2.0, 6);
  });

  it('clamps an out-of-range index to [0, 7]', () => {
    const overRange = sliceStartFor(grid, 0, 8, 99);
    const clampedTo7 = sliceStartFor(grid, 0, 8, 7);
    expect(overRange).toEqual(clampedTo7);
  });
});
