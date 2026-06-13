import { describe, it, expect, beforeEach } from 'vitest';
import { useDeckStore } from '../store/deckStore';

describe('deck grid state', () => {
  beforeEach(() => { useDeckStore.getState().clearTrack('A'); });

  it('fresh deck has null anchor, unconfirmed grid, null cuePoint, CUED transport', () => {
    const d = useDeckStore.getState().decks.A;
    expect(d.anchor).toBeNull();
    expect(d.gridConfirmed).toBe(false);
    expect(d.cuePoint).toBeNull();
    expect(d.transportState).toBe('CUED');
  });

  it('setGrid sets bpm + anchor and marks confirmed', () => {
    useDeckStore.getState().setGrid('A', 128, 0.25);
    const d = useDeckStore.getState().decks.A;
    expect(d.bpm).toBe(128);
    expect(d.anchor).toBeCloseTo(0.25, 6);
    expect(d.gridConfirmed).toBe(true);
  });

  it('nudgeGrid shifts the anchor by the delta', () => {
    useDeckStore.getState().setGrid('A', 120, 1.0);
    useDeckStore.getState().nudgeGrid('A', 0.005);
    expect(useDeckStore.getState().decks.A.anchor).toBeCloseTo(1.005, 6);
  });

  it('clearTrack resets grid + cue + transport', () => {
    useDeckStore.getState().setGrid('A', 128, 0.25);
    useDeckStore.getState().setCuePoint('A', 12);
    useDeckStore.getState().clearTrack('A');
    const d = useDeckStore.getState().decks.A;
    expect(d.anchor).toBeNull();
    expect(d.gridConfirmed).toBe(false);
    expect(d.cuePoint).toBeNull();
    expect(d.transportState).toBe('CUED');
  });
});
