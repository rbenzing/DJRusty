import { describe, it, expect } from 'vitest';
import { fxBeatMultiplier, FX_BEAT_DIVISIONS } from '../utils/fxBeat';

describe('fxBeatMultiplier', () => {
  it('exposes 7 divisions from 1/16 to 4 beats', () => {
    expect(FX_BEAT_DIVISIONS).toEqual([1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4]);
  });

  it('maps 0 to the smallest division (1/16)', () => {
    expect(fxBeatMultiplier(0)).toBe(1 / 16);
  });

  it('maps 1 to the largest division (4)', () => {
    expect(fxBeatMultiplier(1)).toBe(4);
  });

  it('maps the default 0.5 to a half-beat', () => {
    expect(fxBeatMultiplier(0.5)).toBe(1 / 2);
  });

  it('clamps out-of-range values', () => {
    expect(fxBeatMultiplier(-5)).toBe(1 / 16);
    expect(fxBeatMultiplier(5)).toBe(4);
  });
});
