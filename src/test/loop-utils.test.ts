/**
 * loop-utils.test.ts — Unit tests for loop boundary calculation utility.
 *
 * Tests cover: happy paths for all beat counts, BPM edge values, and
 * precision of the formula: loopEnd = currentTime + (beatCount / bpm) * 60.
 */
import { describe, it, expect } from 'vitest';
import { calcLoopEnd } from '../utils/loopUtils';

describe('calcLoopEnd', () => {
  it('calculates 1-beat loop end at 120 BPM starting at 0', () => {
    // 1 beat at 120 BPM = 0.5 seconds
    expect(calcLoopEnd(0, 1, 120)).toBeCloseTo(0.5, 5);
  });

  it('calculates 2-beat loop end at 120 BPM starting at 0', () => {
    // 2 beats at 120 BPM = 1.0 second
    expect(calcLoopEnd(0, 2, 120)).toBeCloseTo(1.0, 5);
  });

  it('calculates 4-beat loop end at 120 BPM starting at 0', () => {
    // 4 beats at 120 BPM = 2.0 seconds
    expect(calcLoopEnd(0, 4, 120)).toBeCloseTo(2.0, 5);
  });

  it('calculates 8-beat loop end at 120 BPM starting at 0', () => {
    // 8 beats at 120 BPM = 4.0 seconds
    expect(calcLoopEnd(0, 8, 120)).toBeCloseTo(4.0, 5);
  });

  it('adds loop length to a non-zero currentTime', () => {
    // 4 beats at 128 BPM = (4/128)*60 = 1.875 seconds; start at 30.0
    expect(calcLoopEnd(30.0, 4, 128)).toBeCloseTo(30.0 + 1.875, 5);
  });

  it('handles 128 BPM correctly (typical house tempo)', () => {
    // 8 beats at 128 BPM = (8/128)*60 = 3.75 seconds
    expect(calcLoopEnd(0, 8, 128)).toBeCloseTo(3.75, 5);
  });

  it('handles 140 BPM correctly (typical drum & bass tempo)', () => {
    // 4 beats at 140 BPM = (4/140)*60 ≈ 1.7143 seconds
    expect(calcLoopEnd(0, 4, 140)).toBeCloseTo((4 / 140) * 60, 5);
  });

  it('handles 60 BPM (1 beat = 1 second)', () => {
    expect(calcLoopEnd(0, 1, 60)).toBeCloseTo(1.0, 5);
    expect(calcLoopEnd(0, 4, 60)).toBeCloseTo(4.0, 5);
  });

  it('preserves currentTime offset accurately', () => {
    const currentTime = 123.456;
    const beatCount = 2;
    const bpm = 130;
    const expected = currentTime + (beatCount / bpm) * 60;
    expect(calcLoopEnd(currentTime, beatCount, bpm)).toBeCloseTo(expected, 5);
  });

  it('returns currentTime when beatCount is 0 (edge case)', () => {
    // (0 / bpm) * 60 = 0; loop end equals loop start
    expect(calcLoopEnd(10, 0, 120)).toBe(10);
  });

  it('scales linearly with beat count', () => {
    const bpm = 120;
    const start = 0;
    const oneBeat = calcLoopEnd(start, 1, bpm);
    const twoBeat = calcLoopEnd(start, 2, bpm);
    const fourBeat = calcLoopEnd(start, 4, bpm);
    const eightBeat = calcLoopEnd(start, 8, bpm);

    // Each doubling of beats should double the loop length
    expect(twoBeat).toBeCloseTo(oneBeat * 2, 5);
    expect(fourBeat).toBeCloseTo(oneBeat * 4, 5);
    expect(eightBeat).toBeCloseTo(oneBeat * 8, 5);
  });

  it('scales inversely with BPM (faster tempo = shorter loop length)', () => {
    const start = 0;
    const beatCount = 4;
    const slow = calcLoopEnd(start, beatCount, 60);
    const fast = calcLoopEnd(start, beatCount, 120);

    // At double the BPM the loop should be half as long
    expect(fast).toBeCloseTo(slow / 2, 5);
  });
});
