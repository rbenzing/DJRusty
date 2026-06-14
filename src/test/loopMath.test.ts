import { describe, it, expect } from 'vitest';
import { snapLoopIn, loopOutFor } from '../utils/loopMath';

const grid = { bpm: 120, anchor: 0.5 }; // spb 0.5

describe('loopMath', () => {
  it('snapLoopIn snaps the in-point to the beat at or before the playhead', () => {
    expect(snapLoopIn(grid, 1.7)).toBeCloseTo(1.5, 6);
    expect(snapLoopIn(grid, 1.5)).toBeCloseTo(1.5, 6);
  });
  it('loopOutFor returns in + beats*60/bpm', () => {
    expect(loopOutFor(1.5, 4, 120)).toBeCloseTo(3.5, 6); // 4 beats = 2.0s
  });
});
