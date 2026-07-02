import { describe, it, expect } from 'vitest';
import { dbToLinear } from '../utils/gain';

describe('dbToLinear', () => {
  it('maps 0 dB to unity gain', () => {
    expect(dbToLinear(0)).toBe(1);
  });

  it('maps +20 dB to 10x', () => {
    expect(dbToLinear(20)).toBeCloseTo(10, 6);
  });

  it('maps +6 dB to ~1.995x', () => {
    expect(dbToLinear(6)).toBeCloseTo(1.995, 3);
  });

  it('maps -6 dB to ~0.501x', () => {
    expect(dbToLinear(-6)).toBeCloseTo(0.501, 3);
  });

  it('maps -Infinity dB to silence', () => {
    expect(dbToLinear(-Infinity)).toBe(0);
  });
});
