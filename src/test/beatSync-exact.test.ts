import { describe, it, expect } from 'vitest';
import { exactSyncRate, phaseDelta } from '../utils/beatSync';

describe('exact sync + phase', () => {
  it('exactSyncRate = otherEffectiveBpm / thisBpm (continuous)', () => {
    expect(exactSyncRate(100, 120, 1)).toBeCloseTo(1.2, 6);
    expect(exactSyncRate(100, 120, 1.05)).toBeCloseTo(1.26, 6); // other pitched up 5%
    expect(exactSyncRate(null, 120, 1)).toBeNull();
    expect(exactSyncRate(120, null, 1)).toBeNull();
  });

  it('phaseDelta returns a sub-beat correction within ±half a beat', () => {
    const a = { bpm: 120, anchor: 0.0 };       // spb 0.5
    const b = { bpm: 120, anchor: 0.25 };      // b is a quarter-second (half a beat) ahead
    const d = phaseDelta(a, b, 1.0, 1.0);
    expect(Math.abs(d)).toBeLessThanOrEqual(0.25 + 1e-6); // within half a beat (0.25s)
  });

  it('phaseDelta is ~0 when the two grids are already in phase', () => {
    const a = { bpm: 120, anchor: 0.0 };
    const b = { bpm: 120, anchor: 0.0 };
    expect(phaseDelta(a, b, 3.0, 7.0)).toBeCloseTo(0, 6); // same phase regardless of absolute positions
  });
});
