import { describe, it, expect } from 'vitest';
import { gridJumpTarget } from '../utils/beatJump';

const grid = { bpm: 120, anchor: 0.5 }; // spb 0.5
describe('grid-snapped beat jump', () => {
  it('lands on the grid: nearestBeat ± N beats, clamped', () => {
    // playhead 1.7 → nearestBeat 1.5; +4 beats (2.0s) → 3.5
    expect(gridJumpTarget(grid, 1.7, 4, 1, 180)).toBeCloseTo(3.5, 6);
    // -4 beats → -0.5 → clamp 0
    expect(gridJumpTarget(grid, 1.7, 4, -1, 180)).toBeCloseTo(0, 6);
  });
  it('clamps to duration on a forward jump near the end', () => {
    expect(gridJumpTarget(grid, 179.8, 4, 1, 180)).toBeCloseTo(180, 6);
  });
});
