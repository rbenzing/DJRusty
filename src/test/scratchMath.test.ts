import { describe, it, expect } from 'vitest';
import {
  SECONDS_PER_ROTATION,
  angleDeg,
  shortestAngleDelta,
  rotationDeltaToSeconds,
  rateFromMovement,
  interpolateSample,
} from '../utils/scratchMath';

describe('scratchMath', () => {
  describe('angleDeg', () => {
    it('returns 0 for a point directly to the right of center', () => {
      expect(angleDeg(0, 0, 100, 0)).toBeCloseTo(0, 5);
    });

    it('returns 90 for a point directly below center (screen y increases downward)', () => {
      expect(angleDeg(0, 0, 0, 100)).toBeCloseTo(90, 5);
    });

    it('returns -90 for a point directly above center', () => {
      expect(angleDeg(0, 0, 0, -100)).toBeCloseTo(-90, 5);
    });

    it('returns 180 (or -180) for a point directly to the left of center', () => {
      const result = angleDeg(0, 0, -100, 0);
      expect(Math.abs(result)).toBeCloseTo(180, 5);
    });
  });

  describe('shortestAngleDelta', () => {
    it('computes a simple positive delta with no wraparound', () => {
      expect(shortestAngleDelta(10, 50)).toBeCloseTo(40, 5);
    });

    it('computes a simple negative delta with no wraparound', () => {
      expect(shortestAngleDelta(50, 10)).toBeCloseTo(-40, 5);
    });

    it('takes the short way across the +180/-180 seam (forward)', () => {
      // 170 -> -170 is a 20-degree forward step across the seam, not -340.
      expect(shortestAngleDelta(170, -170)).toBeCloseTo(20, 5);
    });

    it('takes the short way across the +180/-180 seam (backward)', () => {
      // 10 -> 350 (equivalently -10) is a 20-degree backward step, not +340.
      expect(shortestAngleDelta(10, 350)).toBeCloseTo(-20, 5);
    });

    it('returns 0 for identical angles', () => {
      expect(shortestAngleDelta(45, 45)).toBeCloseTo(0, 5);
    });
  });

  describe('rotationDeltaToSeconds', () => {
    it('converts a full rotation to SECONDS_PER_ROTATION', () => {
      expect(rotationDeltaToSeconds(360)).toBeCloseTo(SECONDS_PER_ROTATION, 5);
    });

    it('converts a half rotation to half of SECONDS_PER_ROTATION', () => {
      expect(rotationDeltaToSeconds(180)).toBeCloseTo(SECONDS_PER_ROTATION / 2, 5);
    });

    it('preserves sign for a reverse (negative) rotation', () => {
      expect(rotationDeltaToSeconds(-90)).toBeCloseTo(-SECONDS_PER_ROTATION / 4, 5);
    });
  });

  describe('rateFromMovement', () => {
    it('returns 1.0 for a movement matching real time (normal speed)', () => {
      expect(rateFromMovement(0.1, 100)).toBeCloseTo(1.0, 5);
    });

    it('returns 2.0 for a movement twice as fast as real time', () => {
      expect(rateFromMovement(0.2, 100)).toBeCloseTo(2.0, 5);
    });

    it('preserves sign for a reverse movement', () => {
      expect(rateFromMovement(-0.1, 100)).toBeCloseTo(-1.0, 5);
    });

    it('returns 0 for a non-positive elapsed time (guards div-by-zero)', () => {
      expect(rateFromMovement(0.1, 0)).toBe(0);
      expect(rateFromMovement(0.1, -5)).toBe(0);
    });
  });

  describe('interpolateSample', () => {
    it('returns the exact sample at an integer position', () => {
      const data = new Float32Array([0, 1, 2, 3]);
      expect(interpolateSample(data, 2)).toBeCloseTo(2, 5);
    });

    it('linearly interpolates at a fractional position', () => {
      const data = new Float32Array([0, 1, 2, 3]);
      expect(interpolateSample(data, 0.5)).toBeCloseTo(0.5, 5);
      expect(interpolateSample(data, 2.25)).toBeCloseTo(2.25, 5);
    });

    it('clamps a negative position to the first sample', () => {
      const data = new Float32Array([5, 1, 2, 3]);
      expect(interpolateSample(data, -10)).toBeCloseTo(5, 5);
    });

    it('clamps a position beyond the array to the last sample', () => {
      const data = new Float32Array([0, 1, 2, 3]);
      expect(interpolateSample(data, 999)).toBeCloseTo(3, 5);
    });

    it('returns 0 for an empty array', () => {
      expect(interpolateSample(new Float32Array(0), 0)).toBe(0);
    });
  });
});
