import { describe, it, expect, beforeEach } from 'vitest';
import { useDeckStore } from '../store/deckStore';

describe('deck pad mode', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('defaults padMode to hotcue', () => {
    expect(useDeckStore.getState().decks.A.padMode).toBe('hotcue');
  });

  it('setPadMode updates padMode', () => {
    useDeckStore.getState().setPadMode('A', 'loop');
    expect(useDeckStore.getState().decks.A.padMode).toBe('loop');
  });

  it('padMode is not reset by loadTrack', () => {
    useDeckStore.getState().setPadMode('A', 'loop');
    useDeckStore.getState().loadTrack('A', 'trk1', { title: '', artist: '', duration: 100, thumbnailUrl: null });
    expect(useDeckStore.getState().decks.A.padMode).toBe('loop');
  });

  it('padMode is not reset by clearTrack', () => {
    useDeckStore.getState().setPadMode('A', 'loop');
    useDeckStore.getState().clearTrack('A');
    expect(useDeckStore.getState().decks.A.padMode).toBe('loop');
  });
});
