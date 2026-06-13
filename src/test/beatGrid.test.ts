import { describe, it, expect } from 'vitest';
import {
  secondsPerBeat, beatIndexAt, nearestBeat, beatAtOrBefore, nearestBar, quantize, phase,
} from '../utils/beatGrid';

const grid = { bpm: 120, anchor: 0.5 }; // spb = 0.5s; beats at 0.5,1.0,1.5,...

describe('beatGrid', () => {
  it('secondsPerBeat', () => { expect(secondsPerBeat(120)).toBeCloseTo(0.5, 6); });

  it('beatIndexAt counts fractional beats from the anchor', () => {
    expect(beatIndexAt(grid, 0.5)).toBeCloseTo(0, 6);
    expect(beatIndexAt(grid, 1.5)).toBeCloseTo(2, 6);
    expect(beatIndexAt(grid, 0.25)).toBeCloseTo(-0.5, 6);
  });

  it('nearestBeat snaps to the closest beat time', () => {
    expect(nearestBeat(grid, 1.6)).toBeCloseTo(1.5, 6);
    expect(nearestBeat(grid, 1.8)).toBeCloseTo(2.0, 6);
  });

  it('beatAtOrBefore returns the greatest beat <= t', () => {
    expect(beatAtOrBefore(grid, 1.6)).toBeCloseTo(1.5, 6);
    expect(beatAtOrBefore(grid, 1.5)).toBeCloseTo(1.5, 6);
    expect(beatAtOrBefore(grid, 0.4)).toBeCloseTo(0.0, 6); // beat -1 is 0.0
  });

  it('nearestBar snaps to the nearest downbeat (4 beats = 2.0s here)', () => {
    expect(nearestBar(grid, 0.6)).toBeCloseTo(0.5, 6);   // bar starts at anchor 0.5
    expect(nearestBar(grid, 2.4)).toBeCloseTo(2.5, 6);   // next bar at 0.5 + 2.0
  });

  it('quantize snaps to 1/division beat', () => {
    expect(quantize(grid, 0.62, 2)).toBeCloseTo(0.5, 6);  // half-beat grid: 0.5,0.75,1.0
    expect(quantize(grid, 0.7, 2)).toBeCloseTo(0.75, 6);
  });

  it('phase returns [0,1) within a beat and within a bar', () => {
    expect(phase(grid, 0.75, 'beat')).toBeCloseTo(0.5, 6);
    expect(phase(grid, 1.0, 'beat')).toBeCloseTo(0, 6);
    expect(phase(grid, 1.5, 'bar')).toBeCloseTo(0.5, 6); // 2 beats into a 4-beat bar
    expect(phase(grid, 0.25, 'beat')).toBeCloseTo(0.5, 6); // t < anchor: negative-offset wrap
  });
});
