import { describe, it, expect, beforeEach } from 'vitest';
import { useDeckStore } from '../store/deckStore';

describe('deck modifiers (quantize + shift)', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('quantize defaults to true', () => {
    expect(useDeckStore.getState().decks.A.quantize).toBe(true);
  });

  it('shift defaults to false', () => {
    expect(useDeckStore.getState().decks.A.shift).toBe(false);
  });

  it('setQuantize toggles the flag', () => {
    useDeckStore.getState().setQuantize('A', false);
    expect(useDeckStore.getState().decks.A.quantize).toBe(false);
  });

  it('setShift toggles the flag', () => {
    useDeckStore.getState().setShift('A', true);
    expect(useDeckStore.getState().decks.A.shift).toBe(true);
  });
});
