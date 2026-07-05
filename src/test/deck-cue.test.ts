/**
 * deck-cue.test.ts — Phase 4: per-deck headphone CUE toggle.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDeckStore } from '../store/deckStore';

vi.mock('../services/cueEngine', () => ({
  cueEngine: {
    setDeckCueEnabled: vi.fn(),
    registerDeckCueSend: vi.fn(),
    registerDeckProgramTap: vi.fn(),
    unregisterDeck: vi.fn(),
    setHeadphoneMix: vi.fn(),
    setHeadphoneDeviceId: vi.fn().mockResolvedValue(undefined),
    isOutputDeviceSelectionSupported: vi.fn(),
  },
}));

import { cueEngine } from '../services/cueEngine';

beforeEach(() => {
  vi.clearAllMocks();
  useDeckStore.getState().clearTrack('A');
  useDeckStore.getState().clearTrack('B');
});

describe('deckStore — cueEnabled default', () => {
  it('defaults to false for both decks', () => {
    expect(useDeckStore.getState().decks.A.cueEnabled).toBe(false);
    expect(useDeckStore.getState().decks.B.cueEnabled).toBe(false);
  });
});

describe('deckStore — toggleCue', () => {
  it('flips cueEnabled from false to true', () => {
    useDeckStore.getState().toggleCue('A');
    expect(useDeckStore.getState().decks.A.cueEnabled).toBe(true);
  });

  it('flips cueEnabled from true back to false', () => {
    useDeckStore.getState().toggleCue('A');
    useDeckStore.getState().toggleCue('A');
    expect(useDeckStore.getState().decks.A.cueEnabled).toBe(false);
  });

  it('calls cueEngine.setDeckCueEnabled with the new value', () => {
    useDeckStore.getState().toggleCue('A');
    expect(cueEngine.setDeckCueEnabled).toHaveBeenCalledWith('A', true);
    useDeckStore.getState().toggleCue('A');
    expect(cueEngine.setDeckCueEnabled).toHaveBeenCalledWith('A', false);
  });

  it('does not affect the other deck', () => {
    useDeckStore.getState().toggleCue('A');
    expect(useDeckStore.getState().decks.B.cueEnabled).toBe(false);
  });
});

describe('deckStore — cueEnabled resets on loadTrack/clearTrack', () => {
  it('resets to false on loadTrack when it was previously true', () => {
    useDeckStore.getState().toggleCue('A');
    expect(useDeckStore.getState().decks.A.cueEnabled).toBe(true);

    useDeckStore.getState().loadTrack('A', 't1', { title: 'T', artist: 'A', duration: 100, thumbnailUrl: null });
    expect(useDeckStore.getState().decks.A.cueEnabled).toBe(false);
  });

  it('does NOT call cueEngine.setDeckCueEnabled on loadTrack when cueEnabled was already false', () => {
    useDeckStore.getState().loadTrack('A', 't1', { title: 'T', artist: 'A', duration: 100, thumbnailUrl: null });
    expect(cueEngine.setDeckCueEnabled).not.toHaveBeenCalled();
  });

  it('calls cueEngine.setDeckCueEnabled(false) on loadTrack when cueEnabled was true', () => {
    useDeckStore.getState().toggleCue('A');
    vi.clearAllMocks();
    useDeckStore.getState().loadTrack('A', 't2', { title: 'T2', artist: 'A', duration: 100, thumbnailUrl: null });
    expect(cueEngine.setDeckCueEnabled).toHaveBeenCalledWith('A', false);
  });

  it('resets to false on clearTrack when it was previously true', () => {
    useDeckStore.getState().toggleCue('A');
    useDeckStore.getState().clearTrack('A');
    expect(useDeckStore.getState().decks.A.cueEnabled).toBe(false);
  });
});
