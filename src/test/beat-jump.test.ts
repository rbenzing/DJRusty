/**
 * beat-jump.test.ts — Unit tests for the beat jump utility module.
 *
 * Covers STORY-DJ-002 acceptance criteria:
 * - calculateJumpSeconds returns correct duration for various beats/BPM combos
 * - clampTime clamps correctly at lower bound, upper bound, and within range
 * - BEAT_JUMP_SIZES constant has expected values
 * - DEFAULT_BEAT_JUMP_SIZE is 4
 */
import { describe, it, expect } from 'vitest';
import {
  BEAT_JUMP_SIZES,
  DEFAULT_BEAT_JUMP_SIZE,
  calculateJumpSeconds,
  clampTime,
} from '../utils/beatJump';

// ---------------------------------------------------------------------------
// calculateJumpSeconds
// ---------------------------------------------------------------------------

describe('calculateJumpSeconds', () => {
  it('returns 2.0 for 4 beats at 120 BPM', () => {
    expect(calculateJumpSeconds(4, 120)).toBe(2.0);
  });

  it('returns 0.25 for half a beat at 120 BPM', () => {
    expect(calculateJumpSeconds(0.5, 120)).toBe(0.25);
  });

  it('returns 7.5 for 16 beats at 128 BPM', () => {
    expect(calculateJumpSeconds(16, 128)).toBe(7.5);
  });

  it('returns 1.0 for 1 beat at 60 BPM', () => {
    expect(calculateJumpSeconds(1, 60)).toBe(1.0);
  });

  it('returns approximately 3.4285714 for 8 beats at 140 BPM', () => {
    expect(calculateJumpSeconds(8, 140)).toBeCloseTo(3.4285714285714284, 10);
  });
});

// ---------------------------------------------------------------------------
// clampTime
// ---------------------------------------------------------------------------

describe('clampTime', () => {
  it('clamps a negative time to 0', () => {
    expect(clampTime(-5, 300)).toBe(0);
  });

  it('clamps a time past the duration to the duration', () => {
    expect(clampTime(400, 300)).toBe(300);
  });

  it('passes through an in-range time unchanged', () => {
    expect(clampTime(150, 300)).toBe(150);
  });

  it('passes through 0 unchanged', () => {
    expect(clampTime(0, 300)).toBe(0);
  });

  it('passes through a time equal to the duration unchanged', () => {
    expect(clampTime(300, 300)).toBe(300);
  });

  it('clamps -1 to 0 for duration 300', () => {
    expect(clampTime(-1, 300)).toBe(0);
  });

  it('clamps 301 to 300 for duration 300', () => {
    expect(clampTime(301, 300)).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('BEAT_JUMP_SIZES', () => {
  it('contains exactly 6 entries', () => {
    expect(BEAT_JUMP_SIZES.length).toBe(6);
  });

  it('contains [0.5, 1, 2, 4, 8, 16] in order', () => {
    expect([...BEAT_JUMP_SIZES]).toEqual([0.5, 1, 2, 4, 8, 16]);
  });
});

describe('DEFAULT_BEAT_JUMP_SIZE', () => {
  it('is 4', () => {
    expect(DEFAULT_BEAT_JUMP_SIZE).toBe(4);
  });
});
