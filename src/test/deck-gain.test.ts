import { describe, it, expect, beforeEach } from 'vitest';
import { useDeckStore } from '../store/deckStore';

describe('deck gain (input trim)', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('defaults gainDb to 0', () => {
    expect(useDeckStore.getState().decks.A.gainDb).toBe(0);
  });

  it('setGain updates gainDb', () => {
    useDeckStore.getState().setGain('A', 6);
    expect(useDeckStore.getState().decks.A.gainDb).toBe(6);
  });

  it('clamps gainDb to [-24, 12]', () => {
    useDeckStore.getState().setGain('A', 99);
    expect(useDeckStore.getState().decks.A.gainDb).toBe(12);
    useDeckStore.getState().setGain('A', -99);
    expect(useDeckStore.getState().decks.A.gainDb).toBe(-24);
  });
});
