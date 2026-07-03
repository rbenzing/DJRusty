import { describe, it, expect, beforeEach } from 'vitest';
import { useDeckStore } from '../store/deckStore';

describe('deck Slicer window size', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('defaults sliceWindowBeats to 8', () => {
    expect(useDeckStore.getState().decks.A.sliceWindowBeats).toBe(8);
  });

  it('setSliceWindowBeats updates it', () => {
    useDeckStore.getState().setSliceWindowBeats('A', 16);
    expect(useDeckStore.getState().decks.A.sliceWindowBeats).toBe(16);
  });

  it('survives loadTrack', () => {
    useDeckStore.getState().setSliceWindowBeats('A', 32);
    useDeckStore.getState().loadTrack('A', 'trk1', { title: '', artist: '', duration: 100, thumbnailUrl: null });
    expect(useDeckStore.getState().decks.A.sliceWindowBeats).toBe(32);
  });

  it('resets to 8 on clearTrack', () => {
    useDeckStore.getState().setSliceWindowBeats('A', 32);
    useDeckStore.getState().clearTrack('A');
    expect(useDeckStore.getState().decks.A.sliceWindowBeats).toBe(8);
  });
});
