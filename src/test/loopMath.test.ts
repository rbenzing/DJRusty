import { describe, it, expect } from 'vitest';
import { snapLoopIn, loopOutFor, shiftedLoopBeatCount, type LoopBeatCount } from '../utils/loopMath';

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

describe('shiftedLoopBeatCount', () => {
  it('halves the active loop when the clicked count is smaller', () => {
    expect(shiftedLoopBeatCount(4, 2)).toBe(2);
  });
  it('doubles the active loop when the clicked count is larger', () => {
    expect(shiftedLoopBeatCount(2, 4)).toBe(4);
  });
  it('clamps halving at a minimum of 1 (defensive — BEAT_COUNTS floors at 1 in the UI, so this guards the formula itself)', () => {
    expect(shiftedLoopBeatCount(1, 0.5 as unknown as LoopBeatCount)).toBe(1);
  });
  it('clamps doubling at a maximum of 8 (defensive — BEAT_COUNTS ceilings at 8 in the UI, so this guards the formula itself)', () => {
    expect(shiftedLoopBeatCount(8, 16 as unknown as LoopBeatCount)).toBe(8);
  });
  it('returns "deactivate" when the clicked count equals the active count', () => {
    expect(shiftedLoopBeatCount(4, 4)).toBe('deactivate');
  });
});
