import { describe, it, expect, beforeEach } from 'vitest';
import { useDeckStore } from '../store/deckStore';

describe('deck FX beat', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('defaults effectBeat to 0.5', () => {
    expect(useDeckStore.getState().decks.A.effectBeat).toBe(0.5);
  });

  it('setEffectBeat updates and clamps to [0,1]', () => {
    useDeckStore.getState().setEffectBeat('A', 0.9);
    expect(useDeckStore.getState().decks.A.effectBeat).toBe(0.9);
    useDeckStore.getState().setEffectBeat('A', 5);
    expect(useDeckStore.getState().decks.A.effectBeat).toBe(1);
    useDeckStore.getState().setEffectBeat('A', -5);
    expect(useDeckStore.getState().decks.A.effectBeat).toBe(0);
  });
});
