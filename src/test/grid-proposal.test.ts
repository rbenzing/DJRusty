import { describe, it, expect } from 'vitest';
import { proposeGrid } from '../utils/beatGrid';

describe('proposeGrid', () => {
  it('proposes the detected bpm with anchor 0, unconfirmed', () => {
    expect(proposeGrid(128)).toEqual({ bpm: 128, anchor: 0, confirmed: false });
  });
});
