/**
 * Scaffold validation tests for STORY-001.
 *
 * These tests verify the project structure and constants are correctly set up.
 * They serve as a smoke test to confirm `npm test` runs without errors.
 */
import { describe, it, expect } from 'vitest';
import { PITCH_RATES, DEFAULT_PITCH_RATE, nearestPitchRate } from '../constants/pitchRates';
import { YOUTUBE_API_BASE, YOUTUBE_SEARCH_MAX_RESULTS } from '../constants/api';

describe('PITCH_RATES constant', () => {
  it('contains exactly 8 discrete values', () => {
    expect(PITCH_RATES).toHaveLength(8);
  });

  it('includes the expected rate values', () => {
    expect(PITCH_RATES).toContain(0.25);
    expect(PITCH_RATES).toContain(0.5);
    expect(PITCH_RATES).toContain(0.75);
    expect(PITCH_RATES).toContain(1);
    expect(PITCH_RATES).toContain(1.25);
    expect(PITCH_RATES).toContain(1.5);
    expect(PITCH_RATES).toContain(1.75);
    expect(PITCH_RATES).toContain(2);
  });

  it('is sorted in ascending order', () => {
    const sorted = [...PITCH_RATES].sort((a, b) => a - b);
    expect([...PITCH_RATES]).toEqual(sorted);
  });
});

describe('DEFAULT_PITCH_RATE', () => {
  it('is 1 (normal playback speed)', () => {
    expect(DEFAULT_PITCH_RATE).toBe(1);
  });
});

describe('nearestPitchRate', () => {
  it('returns exact match when value is already a valid rate', () => {
    expect(nearestPitchRate(1)).toBe(1);
    expect(nearestPitchRate(0.5)).toBe(0.5);
    expect(nearestPitchRate(2)).toBe(2);
  });

  it('rounds to nearest rate for values between steps', () => {
    // 0.6 is between 0.5 and 0.75 — closer to 0.5
    expect(nearestPitchRate(0.6)).toBe(0.5);
    // 0.65 is between 0.5 and 0.75 — equidistant; picks either (implementation-defined)
    // 1.1 is closer to 1 than to 1.25
    expect(nearestPitchRate(1.1)).toBe(1);
    // 1.15 is closer to 1.25
    expect(nearestPitchRate(1.15)).toBe(1.25);
  });

  it('clamps to lowest rate for values below minimum', () => {
    expect(nearestPitchRate(0)).toBe(0.25);
    expect(nearestPitchRate(0.1)).toBe(0.25);
  });

  it('clamps to highest rate for values above maximum', () => {
    expect(nearestPitchRate(3)).toBe(2);
    expect(nearestPitchRate(10)).toBe(2);
  });
});

describe('API constants', () => {
  it('YOUTUBE_API_BASE points to the correct base URL', () => {
    expect(YOUTUBE_API_BASE).toBe('https://www.googleapis.com/youtube/v3');
  });

  it('YOUTUBE_SEARCH_MAX_RESULTS is the API ceiling of 50', () => {
    expect(YOUTUBE_SEARCH_MAX_RESULTS).toBe(50);
  });
});
