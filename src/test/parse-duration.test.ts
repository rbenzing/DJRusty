/**
 * parse-duration.test.ts — Unit tests for parseDuration() in formatTime.ts.
 *
 * Covers:
 *   - Full ISO 8601 duration strings (hours + minutes + seconds)
 *   - Partial strings (minutes only, seconds only, hours only)
 *   - Edge cases (zero duration, invalid strings)
 */
import { describe, it, expect } from 'vitest';
import { parseDuration, formatTime } from '../utils/formatTime';

describe('parseDuration', () => {
  // --- Happy paths ---

  it('parses a full hours+minutes+seconds string', () => {
    // PT1H23M45S → 1*3600 + 23*60 + 45 = 5025
    expect(parseDuration('PT1H23M45S')).toBe(5025);
  });

  it('parses minutes and seconds only', () => {
    // PT3M30S → 3*60 + 30 = 210
    expect(parseDuration('PT3M30S')).toBe(210);
  });

  it('parses seconds only', () => {
    expect(parseDuration('PT45S')).toBe(45);
  });

  it('parses hours only', () => {
    // PT2H → 2*3600 = 7200
    expect(parseDuration('PT2H')).toBe(7200);
  });

  it('parses hours and minutes without seconds', () => {
    // PT1H30M → 1*3600 + 30*60 = 5400
    expect(parseDuration('PT1H30M')).toBe(5400);
  });

  it('parses a typical 4-minute track', () => {
    // PT4M33S → 4*60 + 33 = 273
    expect(parseDuration('PT4M33S')).toBe(273);
  });

  it('parses a zero-second duration', () => {
    expect(parseDuration('PT0S')).toBe(0);
  });

  it('parses exactly one hour', () => {
    expect(parseDuration('PT1H')).toBe(3600);
  });

  it('parses large hour counts', () => {
    // PT10H → 36000
    expect(parseDuration('PT10H')).toBe(36000);
  });

  it('handles double-digit minutes and seconds', () => {
    // PT12M34S → 12*60 + 34 = 754
    expect(parseDuration('PT12M34S')).toBe(754);
  });

  // --- Edge cases ---

  it('returns 0 for an empty string', () => {
    expect(parseDuration('')).toBe(0);
  });

  it('returns 0 for a completely invalid string', () => {
    expect(parseDuration('not-a-duration')).toBe(0);
  });

  it('returns 0 for a string with no time components after PT', () => {
    // PT with no H/M/S — regex finds no groups so all default to 0
    expect(parseDuration('PT')).toBe(0);
  });

  it('handles very large second values', () => {
    // PT90S → 90 seconds (YouTube sometimes emits values > 59 for seconds)
    expect(parseDuration('PT90S')).toBe(90);
  });
});

describe('formatTime', () => {
  it('formats seconds only (< 1 minute)', () => {
    expect(formatTime(45)).toBe('0:45');
  });

  it('formats exactly 1 minute 30 seconds', () => {
    expect(formatTime(90)).toBe('1:30');
  });

  it('formats zero', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('pads single-digit seconds', () => {
    expect(formatTime(61)).toBe('1:01');
  });

  it('formats exactly 1 hour', () => {
    expect(formatTime(3600)).toBe('1:00:00');
  });

  it('formats hours + minutes + seconds', () => {
    expect(formatTime(3661)).toBe('1:01:01');
  });

  it('pads minutes when hours are present', () => {
    expect(formatTime(3660)).toBe('1:01:00');
  });

  it('floors fractional seconds', () => {
    expect(formatTime(90.9)).toBe('1:30');
  });

  it('treats negative input as 0', () => {
    expect(formatTime(-5)).toBe('0:00');
  });
});
