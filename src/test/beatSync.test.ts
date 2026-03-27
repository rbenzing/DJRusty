/**
 * beatSync.test.ts — Unit tests for beat-sync utility functions.
 *
 * Tests cover:
 *   - findClosestPitchRate: exact match, nearest rounding, boundary values
 *   - calculateSyncRate: null/zero BPM inputs, matching BPMs, real-world scenarios
 */
import { describe, it, expect } from 'vitest';
import { findClosestPitchRate, calculateSyncRate } from '../utils/beatSync';
import { PITCH_RATES } from '../constants/pitchRates';

// ---------------------------------------------------------------------------
// findClosestPitchRate
// ---------------------------------------------------------------------------

describe('findClosestPitchRate', () => {
  it('returns exact match when ratio is a PITCH_RATES value', () => {
    expect(findClosestPitchRate(1.0, PITCH_RATES)).toBe(1);
    expect(findClosestPitchRate(0.5, PITCH_RATES)).toBe(0.5);
    expect(findClosestPitchRate(2.0, PITCH_RATES)).toBe(2);
    expect(findClosestPitchRate(1.25, PITCH_RATES)).toBe(1.25);
  });

  it('rounds to nearest PITCH_RATES value for fractional ratios', () => {
    // 1.1 is closer to 1.0 (diff 0.1) than 1.25 (diff 0.15)
    expect(findClosestPitchRate(1.1, PITCH_RATES)).toBe(1);
    // 1.13 is closer to 1.25 (diff 0.12) than 1.0 (diff 0.13)
    expect(findClosestPitchRate(1.13, PITCH_RATES)).toBe(1.25);
    // 0.3 is closer to 0.25 (diff 0.05) than 0.5 (diff 0.2)
    expect(findClosestPitchRate(0.3, PITCH_RATES)).toBe(0.25);
    // 0.6 is closer to 0.5 (diff 0.1) than 0.75 (diff 0.15)
    expect(findClosestPitchRate(0.6, PITCH_RATES)).toBe(0.5);
    // 1.6 is closer to 1.5 (diff 0.1) than 1.75 (diff 0.15)
    expect(findClosestPitchRate(1.6, PITCH_RATES)).toBe(1.5);
  });

  it('handles values below the minimum PITCH_RATES entry', () => {
    // 0.1 is closest to 0.25 (the minimum)
    expect(findClosestPitchRate(0.1, PITCH_RATES)).toBe(0.25);
  });

  it('handles values above the maximum PITCH_RATES entry', () => {
    // 3.0 is closest to 2 (the maximum)
    expect(findClosestPitchRate(3.0, PITCH_RATES)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// calculateSyncRate
// ---------------------------------------------------------------------------

describe('calculateSyncRate', () => {
  it('returns null when thisBpm is 0', () => {
    expect(calculateSyncRate(0, 140)).toBeNull();
  });

  it('returns null when otherBpm is 0', () => {
    expect(calculateSyncRate(128, 0)).toBeNull();
  });

  it('returns null when thisBpm is null', () => {
    expect(calculateSyncRate(null, 140)).toBeNull();
  });

  it('returns null when otherBpm is null', () => {
    expect(calculateSyncRate(128, null)).toBeNull();
  });

  it('returns null when both BPMs are null', () => {
    expect(calculateSyncRate(null, null)).toBeNull();
  });

  it('returns 1.0 when BPMs are identical', () => {
    expect(calculateSyncRate(128, 128)).toBe(1);
    expect(calculateSyncRate(140, 140)).toBe(1);
  });

  it('returns correct rate for 128bpm syncing to 140bpm', () => {
    // ratio = 140 / 128 = 1.09375, closest to 1.0 (diff 0.09375) vs 1.25 (diff 0.15625)
    expect(calculateSyncRate(128, 140)).toBe(1);
  });

  it('returns correct rate for 140bpm syncing to 128bpm', () => {
    // ratio = 128 / 140 ≈ 0.9143, closest to 1.0 (diff 0.086) vs 0.75 (diff 0.164)
    expect(calculateSyncRate(140, 128)).toBe(1);
  });

  it('returns 2.0 for double-time scenario (70bpm syncing to 140bpm)', () => {
    // ratio = 140 / 70 = 2.0, exact match
    expect(calculateSyncRate(70, 140)).toBe(2);
  });

  it('returns 0.5 for half-time scenario (140bpm syncing to 70bpm)', () => {
    // ratio = 70 / 140 = 0.5, exact match
    expect(calculateSyncRate(140, 70)).toBe(0.5);
  });

  it('returns 1.25 for a scenario that maps to 1.25x', () => {
    // ratio = 150 / 120 = 1.25, exact match
    expect(calculateSyncRate(120, 150)).toBe(1.25);
  });

  it('returns 0.75 for a scenario that maps to 0.75x', () => {
    // ratio = 90 / 120 = 0.75, exact match
    expect(calculateSyncRate(120, 90)).toBe(0.75);
  });
});
