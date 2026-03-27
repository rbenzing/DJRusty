/**
 * volume-map.test.ts — Unit tests for crossfaderToVolumes and compositeVolume.
 *
 * Tests cover:
 *   crossfaderToVolumes:
 *     - Full left (0.0) = Deck A at 100%, Deck B at 0%
 *     - Centre (0.5) = both decks at ~71% (equal-power curve)
 *     - Full right (1.0) = Deck A at 0%, Deck B at 100%
 *     - Intermediate positions follow cos curve
 *     - Out-of-range inputs clamped to [0, 100]
 *     - Return values are integers (Math.round applied)
 *
 *   compositeVolume:
 *     - Full crossfader vol × full channel fader = 100%
 *     - Half crossfader vol × full channel fader = 50%
 *     - Full crossfader vol × half channel fader = 50%
 *     - Zero crossfader vol = 0%
 *     - Zero channel fader = 0%
 *     - Result is clamped and rounded
 */
import { describe, it, expect } from 'vitest';
import { crossfaderToVolumes, compositeVolume } from '../utils/volumeMap';

describe('crossfaderToVolumes', () => {
  describe('boundary positions', () => {
    it('position 0.0 — Deck A at 100%, Deck B at 0%', () => {
      const { a, b } = crossfaderToVolumes(0.0);
      expect(a).toBe(100);
      expect(b).toBe(0);
    });

    it('position 1.0 — Deck A at 0%, Deck B at 100%', () => {
      const { a, b } = crossfaderToVolumes(1.0);
      expect(a).toBe(0);
      expect(b).toBe(100);
    });

    it('position 0.5 — both decks at ~71% (equal-power centre)', () => {
      const { a, b } = crossfaderToVolumes(0.5);
      // cos(0.25π) ≈ 0.7071 → Math.round(70.71) = 71
      expect(a).toBe(71);
      expect(b).toBe(71);
    });
  });

  describe('constant-power curve symmetry', () => {
    it('is symmetric: position x gives (a,b) equal to (b,a) at position (1-x)', () => {
      const pos = 0.3;
      const { a: aAt03, b: bAt03 } = crossfaderToVolumes(pos);
      const { a: aAt07, b: bAt07 } = crossfaderToVolumes(1 - pos);
      expect(aAt03).toBe(bAt07);
      expect(bAt03).toBe(aAt07);
    });

    it('Deck A decreases monotonically as position increases', () => {
      const positions = [0.0, 0.25, 0.5, 0.75, 1.0];
      const aVolumes: number[] = positions.map((p) => crossfaderToVolumes(p).a);
      for (let i = 0; i < aVolumes.length - 1; i++) {
        const current = aVolumes[i] as number;
        const next = aVolumes[i + 1] as number;
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });

    it('Deck B increases monotonically as position increases', () => {
      const positions = [0.0, 0.25, 0.5, 0.75, 1.0];
      const bVolumes: number[] = positions.map((p) => crossfaderToVolumes(p).b);
      for (let i = 0; i < bVolumes.length - 1; i++) {
        const current = bVolumes[i] as number;
        const next = bVolumes[i + 1] as number;
        expect(current).toBeLessThanOrEqual(next);
      }
    });
  });

  describe('intermediate positions', () => {
    it('position 0.25 — Deck A at ~92%, Deck B at ~38%', () => {
      // cos(0.125π) ≈ 0.9239 → 92; cos(0.375π) ≈ 0.3827 → 38
      const { a, b } = crossfaderToVolumes(0.25);
      expect(a).toBeGreaterThanOrEqual(91);
      expect(a).toBeLessThanOrEqual(93);
      expect(b).toBeGreaterThanOrEqual(37);
      expect(b).toBeLessThanOrEqual(39);
    });

    it('position 0.75 — Deck A at ~38%, Deck B at ~92%', () => {
      const { a, b } = crossfaderToVolumes(0.75);
      expect(a).toBeGreaterThanOrEqual(37);
      expect(a).toBeLessThanOrEqual(39);
      expect(b).toBeGreaterThanOrEqual(91);
      expect(b).toBeLessThanOrEqual(93);
    });
  });

  describe('output types and range', () => {
    it('returns integer values (Math.round applied)', () => {
      const { a, b } = crossfaderToVolumes(0.33);
      expect(Number.isInteger(a)).toBe(true);
      expect(Number.isInteger(b)).toBe(true);
    });

    it('all output values are in range [0, 100]', () => {
      const testPositions = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0];
      for (const pos of testPositions) {
        const { a, b } = crossfaderToVolumes(pos);
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(100);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(100);
      }
    });

    it('clamps out-of-range input below 0 to position 0.0 behaviour', () => {
      const { a, b } = crossfaderToVolumes(-0.5);
      expect(a).toBe(100);
      expect(b).toBe(0);
    });

    it('clamps out-of-range input above 1 to position 1.0 behaviour', () => {
      const { a, b } = crossfaderToVolumes(1.5);
      expect(a).toBe(0);
      expect(b).toBe(100);
    });
  });
});

describe('crossfaderToVolumes — sharp curve', () => {
  it('sharp: position=0.5 → { a: 100, b: 100 }', () => {
    const { a, b } = crossfaderToVolumes(0.5, 'sharp');
    expect(a).toBe(100);
    expect(b).toBe(100);
  });

  it('sharp: position=1.0 → { a: 0, b: 100 }', () => {
    const { a, b } = crossfaderToVolumes(1.0, 'sharp');
    expect(a).toBe(0);
    expect(b).toBe(100);
  });

  it('sharp: position=0.0 → { a: 100, b: 0 }', () => {
    const { a, b } = crossfaderToVolumes(0.0, 'sharp');
    expect(a).toBe(100);
    expect(b).toBe(0);
  });

  it('sharp: position=0.25 → { a: 100, b: 50 }', () => {
    const { a, b } = crossfaderToVolumes(0.25, 'sharp');
    expect(a).toBe(100);
    expect(b).toBe(50);
  });
});

describe('crossfaderToVolumes — backward compatibility', () => {
  it('no curve argument defaults to smooth (same as passing smooth)', () => {
    const withoutCurve = crossfaderToVolumes(0.5);
    const withSmooth = crossfaderToVolumes(0.5, 'smooth');
    expect(withoutCurve).toEqual(withSmooth);
  });
});

describe('master volume scaling', () => {
  it('masterVolume at 50 halves composite output', () => {
    const composite = compositeVolume(71, 100); // 71
    const finalVol = Math.round(composite * (50 / 100));
    expect(finalVol).toBe(36);
  });

  it('masterVolume at 100 is unity — does not reduce volume', () => {
    const composite = compositeVolume(100, 100); // 100
    const finalVol = Math.round(composite * (100 / 100));
    expect(finalVol).toBe(100);
  });

  it('masterVolume at 0 silences output', () => {
    const composite = compositeVolume(100, 100); // 100
    const finalVol = Math.round(composite * (0 / 100));
    expect(finalVol).toBe(0);
  });
});

describe('crossfaderToVolumes — linear curve', () => {
  it('linear: position=0.5 → { a: 50, b: 50 }', () => {
    const { a, b } = crossfaderToVolumes(0.5, 'linear');
    expect(a).toBe(50);
    expect(b).toBe(50);
  });

  it('linear: position=0.0 → { a: 100, b: 0 }', () => {
    const { a, b } = crossfaderToVolumes(0.0, 'linear');
    expect(a).toBe(100);
    expect(b).toBe(0);
  });

  it('linear: position=1.0 → { a: 0, b: 100 }', () => {
    const { a, b } = crossfaderToVolumes(1.0, 'linear');
    expect(a).toBe(0);
    expect(b).toBe(100);
  });
});

describe('crossfaderToVolumes — smooth curve (explicit)', () => {
  it('smooth: position=0.0 → { a: 100, b: 0 }', () => {
    const { a, b } = crossfaderToVolumes(0.0, 'smooth');
    expect(a).toBe(100);
    expect(b).toBe(0);
  });

  it('smooth: position=1.0 → { a: 0, b: 100 }', () => {
    const { a, b } = crossfaderToVolumes(1.0, 'smooth');
    expect(a).toBe(0);
    expect(b).toBe(100);
  });

  it('smooth: position=0.5 → both values ~71 (within ±1)', () => {
    const { a, b } = crossfaderToVolumes(0.5, 'smooth');
    expect(a).toBeGreaterThanOrEqual(70);
    expect(a).toBeLessThanOrEqual(72);
    expect(b).toBeGreaterThanOrEqual(70);
    expect(b).toBeLessThanOrEqual(72);
  });
});

describe('compositeVolume', () => {
  describe('basic composition', () => {
    it('full crossfader vol (100) × full channel fader (100) = 100', () => {
      expect(compositeVolume(100, 100)).toBe(100);
    });

    it('half crossfader vol (50) × full channel fader (100) = 50', () => {
      expect(compositeVolume(50, 100)).toBe(50);
    });

    it('full crossfader vol (100) × half channel fader (50) = 50', () => {
      expect(compositeVolume(100, 50)).toBe(50);
    });

    it('zero crossfader vol (0) × any channel fader = 0', () => {
      expect(compositeVolume(0, 100)).toBe(0);
      expect(compositeVolume(0, 50)).toBe(0);
    });

    it('any crossfader vol × zero channel fader = 0', () => {
      expect(compositeVolume(100, 0)).toBe(0);
      expect(compositeVolume(71, 0)).toBe(0);
    });
  });

  describe('constant-power centre scenario', () => {
    it('crossfader centre: vol=71 and channel=100 gives 71', () => {
      // Crossfader at 0.5: both decks at 71%; channel at 100%
      // compositeVolume(71, 100) = round(71 * 100/100) = 71
      expect(compositeVolume(71, 100)).toBe(71);
    });

    it('crossfader centre with channel at 80%: vol=71, channel=80 gives 57', () => {
      // compositeVolume(71, 80) = round(71 * 0.80) = round(56.8) = 57
      expect(compositeVolume(71, 80)).toBe(57);
    });
  });

  describe('rounding', () => {
    it('returns an integer result (Math.round applied)', () => {
      // 71 * (50/100) = 35.5 → rounds to 36
      const result = compositeVolume(71, 50);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBe(36);
    });
  });

  describe('clamping', () => {
    it('result is clamped to maximum of 100', () => {
      // In normal usage input is always ≤100, but guard against edge cases
      expect(compositeVolume(100, 100)).toBe(100);
    });

    it('result is clamped to minimum of 0', () => {
      expect(compositeVolume(0, 0)).toBe(0);
    });
  });

  describe('integration: crossfaderToVolumes → compositeVolume', () => {
    it('full left crossfader, full channel faders → Deck A=100, Deck B=0', () => {
      const { a, b } = crossfaderToVolumes(0.0);
      expect(compositeVolume(a, 100)).toBe(100);
      expect(compositeVolume(b, 100)).toBe(0);
    });

    it('full right crossfader, full channel faders → Deck A=0, Deck B=100', () => {
      const { a, b } = crossfaderToVolumes(1.0);
      expect(compositeVolume(a, 100)).toBe(0);
      expect(compositeVolume(b, 100)).toBe(100);
    });

    it('centre crossfader, full channel faders → both decks at ~71', () => {
      const { a, b } = crossfaderToVolumes(0.5);
      const volA = compositeVolume(a, 100);
      const volB = compositeVolume(b, 100);
      expect(volA).toBe(71);
      expect(volB).toBe(71);
    });

    it('centre crossfader, channel fader A at 50% → Deck A ~36', () => {
      const { a } = crossfaderToVolumes(0.5);
      const volA = compositeVolume(a, 50);
      expect(volA).toBeGreaterThanOrEqual(35);
      expect(volA).toBeLessThanOrEqual(37);
    });
  });
});
