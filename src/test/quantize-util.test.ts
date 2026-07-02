import { describe, it, expect } from 'vitest';
import { snapToGrid } from '../utils/quantize';

describe('snapToGrid', () => {
  const grid = { bpm: 120, anchor: 0 }; // 0.5 s per beat

  it('snaps forward to the nearest beat', () => {
    expect(snapToGrid(grid, 0.26)).toBeCloseTo(0.5, 6);
  });

  it('snaps backward to the nearest beat', () => {
    expect(snapToGrid(grid, 0.24)).toBeCloseTo(0, 6);
  });

  it('respects the anchor offset', () => {
    expect(snapToGrid({ bpm: 120, anchor: 0.1 }, 0.34)).toBeCloseTo(0.1, 6);
  });
});
