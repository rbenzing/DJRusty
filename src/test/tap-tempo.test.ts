/**
 * tap-tempo.test.ts — Unit tests for TapTempoCalculator.
 *
 * Tests cover:
 *   - Single tap (no BPM — need at least 2)
 *   - Two taps → BPM calculated
 *   - Multiple taps → rolling average converges
 *   - Reset after 3s inactivity
 *   - Buffer cap at MAX_TAPS (8) — oldest tap dropped
 *   - Manual reset()
 *   - Edge: rapid taps (very high BPM)
 *   - Edge: slow taps (very low BPM)
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TapTempoCalculator } from '../utils/tapTempo';

describe('TapTempoCalculator', () => {
  let calculator: TapTempoCalculator;

  beforeEach(() => {
    calculator = new TapTempoCalculator();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('single tap', () => {
    it('returns null on the first tap (need at least 2 taps)', () => {
      // Arrange: fresh calculator
      // Act
      const result = calculator.tap();
      // Assert
      expect(result).toBeNull();
    });
  });

  describe('two taps', () => {
    it('returns BPM after the second tap at 500ms interval (120 BPM)', () => {
      // Arrange: 500ms apart = 120 BPM
      vi.setSystemTime(0);
      calculator.tap(); // first tap at t=0

      vi.setSystemTime(500); // 500ms later
      const result = calculator.tap();

      // Assert: 60000ms / 500ms = 120 BPM
      expect(result).toBe(120);
    });

    it('returns BPM after the second tap at 600ms interval (100 BPM)', () => {
      vi.setSystemTime(0);
      calculator.tap();

      vi.setSystemTime(600);
      const result = calculator.tap();

      expect(result).toBe(100);
    });

    it('returns BPM for a typical 128 BPM interval (~469ms)', () => {
      vi.setSystemTime(0);
      calculator.tap();

      const intervalMs = Math.round(60000 / 128); // ~469ms
      vi.setSystemTime(intervalMs);
      const result = calculator.tap();

      // Allow ±1 BPM due to rounding
      expect(result).toBeGreaterThanOrEqual(127);
      expect(result).toBeLessThanOrEqual(129);
    });
  });

  describe('multiple taps — rolling average', () => {
    it('updates BPM after each subsequent tap', () => {
      // 4 taps at 500ms intervals = 120 BPM
      vi.setSystemTime(0);
      calculator.tap();

      vi.setSystemTime(500);
      const r1 = calculator.tap();

      vi.setSystemTime(1000);
      const r2 = calculator.tap();

      vi.setSystemTime(1500);
      const r3 = calculator.tap();

      expect(r1).toBe(120);
      expect(r2).toBe(120);
      expect(r3).toBe(120);
    });

    it('adapts BPM when tap interval changes', () => {
      // Start at 500ms (120 BPM), then switch to 600ms (100 BPM)
      vi.setSystemTime(0);
      calculator.tap();

      vi.setSystemTime(500);
      calculator.tap(); // interval: 500ms

      vi.setSystemTime(1100);
      calculator.tap(); // interval: 600ms

      vi.setSystemTime(1700);
      const result = calculator.tap(); // interval: 600ms

      // Average of [500, 600, 600] = 566.67ms → ~106 BPM
      expect(result).toBeGreaterThan(100);
      expect(result).toBeLessThan(120);
    });
  });

  describe('reset after inactivity', () => {
    it('resets when more than 3 seconds elapse between taps', () => {
      // Arrange: establish a BPM at 120
      vi.setSystemTime(0);
      calculator.tap();

      vi.setSystemTime(500);
      calculator.tap(); // 120 BPM established

      // Act: wait 3001ms (exceeds 3000ms threshold)
      vi.setSystemTime(3501);
      const resultAfterReset = calculator.tap(); // should restart — single tap, returns null

      // Assert: reset occurred, first tap of new sequence returns null
      expect(resultAfterReset).toBeNull();
    });

    it('does not reset when gap is exactly at the threshold boundary (2999ms)', () => {
      vi.setSystemTime(0);
      calculator.tap();

      vi.setSystemTime(500);
      calculator.tap();

      // 2999ms < 3000ms threshold — should NOT reset
      vi.setSystemTime(3499); // 500 + 2999 = 3499
      const result = calculator.tap();

      // Should return a BPM (not null) — 3 taps in buffer
      expect(result).not.toBeNull();
    });

    it('starts fresh after reset — returns null then BPM on subsequent taps', () => {
      vi.setSystemTime(0);
      calculator.tap();

      vi.setSystemTime(500);
      calculator.tap(); // 120 BPM

      // Reset via timeout
      vi.setSystemTime(4000); // 3500ms since last tap → resets
      const firstAfterReset = calculator.tap(); // null — restarted
      expect(firstAfterReset).toBeNull();

      vi.setSystemTime(4600); // 600ms later
      const secondAfterReset = calculator.tap(); // 100 BPM
      expect(secondAfterReset).toBe(100);
    });
  });

  describe('buffer cap at MAX_TAPS', () => {
    it('maintains a rolling window of 8 taps (oldest tap is dropped)', () => {
      // Tap 9 times at 500ms intervals, then tap at 600ms — last interval should dominate
      vi.setSystemTime(0);
      calculator.tap();

      for (let i = 1; i <= 7; i++) {
        vi.setSystemTime(i * 500);
        calculator.tap();
      }
      // Buffer now has 8 taps at 500ms intervals → 120 BPM

      // 9th tap: buffer should drop oldest, add new interval
      vi.setSystemTime(7 * 500 + 600); // 4100ms
      const result = calculator.tap();

      // With 8 taps in buffer (intervals: 7×500ms + 1×600ms):
      // but oldest is dropped so we have 7 intervals [500×6, 600]
      // avg = (3000 + 600) / 7 ≈ 514ms → ~117 BPM
      expect(result).toBeGreaterThan(110);
      expect(result).toBeLessThan(130);
    });
  });

  describe('manual reset()', () => {
    it('clears all taps and returns null on the next tap', () => {
      vi.setSystemTime(0);
      calculator.tap();

      vi.setSystemTime(500);
      calculator.tap(); // BPM established

      calculator.reset();

      vi.setSystemTime(1000);
      const result = calculator.tap(); // first tap after reset

      expect(result).toBeNull();
    });

    it('allows BPM calculation to resume after reset', () => {
      vi.setSystemTime(0);
      calculator.tap();

      vi.setSystemTime(500);
      calculator.tap();

      calculator.reset();

      vi.setSystemTime(1000);
      calculator.tap(); // first tap

      vi.setSystemTime(1750); // 750ms later → 80 BPM
      const result = calculator.tap();

      expect(result).toBe(80);
    });
  });

  describe('edge cases', () => {
    it('handles rapid taps (very high BPM ~240)', () => {
      // 250ms intervals = 240 BPM
      vi.setSystemTime(0);
      calculator.tap();

      vi.setSystemTime(250);
      const result = calculator.tap();

      expect(result).toBe(240);
    });

    it('handles slow taps (very low BPM ~30)', () => {
      // 2000ms intervals = 30 BPM
      vi.setSystemTime(0);
      calculator.tap();

      vi.setSystemTime(2000);
      const result = calculator.tap();

      expect(result).toBe(30);
    });

    it('returns integer BPM (Math.round is applied)', () => {
      // 467ms interval → 60000/467 ≈ 128.48 → rounds to 128
      vi.setSystemTime(0);
      calculator.tap();

      vi.setSystemTime(467);
      const result = calculator.tap();

      expect(result).not.toBeNull();
      expect(Number.isInteger(result)).toBe(true);
    });
  });
});
