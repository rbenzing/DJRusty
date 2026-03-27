/**
 * tapTempo.ts — BPM calculation from tap timestamps.
 * Full implementation here for STORY-001 (required by constants).
 * Used by useTapTempo hook in STORY-010.
 */

const MAX_TAPS = 8;
const RESET_THRESHOLD_MS = 3000;

/**
 * Calculates BPM from a series of tap timestamps.
 *
 * Usage:
 *   const calculator = new TapTempoCalculator();
 *   calculator.tap(); // First tap — returns null (need at least 2)
 *   calculator.tap(); // Second tap — returns BPM
 */
export class TapTempoCalculator {
  private taps: number[] = [];

  /**
   * Record a tap at the current time. Returns the calculated BPM if 2+ taps
   * have been recorded, or null if only one tap has been made.
   *
   * Resets the internal buffer if more than RESET_THRESHOLD_MS (3 seconds)
   * has elapsed since the last tap.
   */
  tap(): number | null {
    const now = Date.now();

    if (this.taps.length > 0) {
      const lastTap = this.taps[this.taps.length - 1];
      if (lastTap !== undefined && now - lastTap > RESET_THRESHOLD_MS) {
        this.taps = [];
      }
    }

    this.taps.push(now);

    if (this.taps.length > MAX_TAPS) {
      this.taps.shift();
    }

    if (this.taps.length < 2) {
      return null;
    }

    const intervals = this.taps.slice(1).map((t, i) => {
      const prev = this.taps[i];
      return prev !== undefined ? t - prev : 0;
    });

    const totalInterval = intervals.reduce((sum, interval) => sum + interval, 0);
    const avgInterval = totalInterval / intervals.length;

    return Math.round(60000 / avgInterval);
  }

  /**
   * Reset all recorded taps.
   */
  reset(): void {
    this.taps = [];
  }

  /**
   * Returns the number of taps recorded in the current session.
   */
  getTapCount(): number {
    return this.taps.length;
  }
}
