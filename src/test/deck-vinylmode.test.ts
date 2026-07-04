/**
 * Unit tests for Phase 3: VINYL mode and scratch begin/end store actions.
 * Mirrors the existing style of src/test/slip-mode.test.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';
import type { DeckPlayer } from '../services/playerRegistry';
import type { DeckState } from '../types/deck';

function makeDeckState(deckId: 'A' | 'B'): DeckState {
  return {
    deckId,
    trackId: null,
    title: '',
    artist: '',
    waveformPeaks: null,
    waveformColoredPeaks: null,
    filterSweep: 0,
    eqKillLow: false,
    eqKillMid: false,
    eqKillHigh: false,
    effectType: 'none',
    effectEnabled: false,
    effectWetDry: 0.5,
    effectBeat: 0.5,
    decoding: false,
    bpmDetecting: false,
    duration: 0,
    currentTime: 0,
    thumbnailUrl: null,
    playbackState: 'unstarted',
    pitchRate: 1,
    bpm: null,
    volume: 80,
    loopActive: false,
    loopStart: null,
    loopEnd: null,
    loopBeatCount: null,
    manualLoopIn: null,
    lastManualLoop: null,
    beatJumpSize: 4,
    playerReady: false,
    hotCues: {},
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    gainDb: 0,
    quantize: true,
    shift: false,
    padMode: 'hotcue',
    sliceWindowBeats: 8,
    vinylMode: true,
    scratching: false,
    error: null,
    synced: false,
    slipMode: false,
    slipPosition: null,
    slipStartTime: null,
    slipStartPosition: null,
    rollMode: false,
    rollStartWallClock: null,
    rollStartPosition: null,
    autoPlayOnLoad: false,
    anchor: null,
    gridConfirmed: false,
    cuePoint: null,
    transportState: 'CUED',
  };
}

/** Register a mock backend with spy-able beginScratch/endScratch. */
function registerMockBackend(deckId: 'A' | 'B') {
  const beginScratch = vi.fn();
  const endScratch = vi.fn();
  const player: DeckPlayer = {
    seekTo: vi.fn(),
    getCurrentTime: () => 0,
    getDuration: () => 300,
    beginScratch,
    endScratch,
  };
  playerRegistry.register(deckId, player);
  return { beginScratch, endScratch };
}

beforeEach(() => {
  useDeckStore.setState({
    decks: { A: makeDeckState('A'), B: makeDeckState('B') },
  });
  playerRegistry.unregister('A');
  playerRegistry.unregister('B');
  vi.restoreAllMocks();
});

describe('VINYL mode', () => {
  it('setVinylMode(false) disables vinyl mode', () => {
    act(() => { useDeckStore.getState().setVinylMode('A', false); });
    expect(useDeckStore.getState().decks['A'].vinylMode).toBe(false);
  });

  it('setVinylMode(true) enables vinyl mode', () => {
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], vinylMode: false } },
    });
    act(() => { useDeckStore.getState().setVinylMode('A', true); });
    expect(useDeckStore.getState().decks['A'].vinylMode).toBe(true);
  });

  it('setVinylMode(false) force-ends an in-progress scratch', () => {
    const { endScratch } = registerMockBackend('A');
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], vinylMode: true, scratching: true } },
    });

    act(() => { useDeckStore.getState().setVinylMode('A', false); });

    expect(endScratch).toHaveBeenCalled();
    expect(useDeckStore.getState().decks['A'].scratching).toBe(false);
  });
});

describe('beginScratch', () => {
  it('is a no-op when vinylMode is false', () => {
    const { beginScratch } = registerMockBackend('A');
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], trackId: 't1', vinylMode: false } },
    });

    act(() => { useDeckStore.getState().beginScratch('A'); });

    expect(beginScratch).not.toHaveBeenCalled();
    expect(useDeckStore.getState().decks['A'].scratching).toBe(false);
  });

  it('is a no-op when no track is loaded', () => {
    const { beginScratch } = registerMockBackend('A');
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], trackId: null, vinylMode: true } },
    });

    act(() => { useDeckStore.getState().beginScratch('A'); });

    expect(beginScratch).not.toHaveBeenCalled();
  });

  it('calls player.beginScratch and sets scratching true', () => {
    const { beginScratch } = registerMockBackend('A');
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], trackId: 't1', vinylMode: true } },
    });

    act(() => { useDeckStore.getState().beginScratch('A'); });

    expect(beginScratch).toHaveBeenCalledTimes(1);
    expect(useDeckStore.getState().decks['A'].scratching).toBe(true);
  });

  it('starts slip tracking when slipMode is on', () => {
    registerMockBackend('A');
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], trackId: 't1', vinylMode: true, slipMode: true, currentTime: 15 } },
    });

    act(() => { useDeckStore.getState().beginScratch('A'); });

    expect(useDeckStore.getState().decks['A'].slipStartPosition).toBe(15);
    expect(useDeckStore.getState().decks['A'].slipStartTime).not.toBeNull();
  });
});

describe('endScratch', () => {
  it('is a no-op when not currently scratching', () => {
    const { endScratch } = registerMockBackend('A');
    act(() => { useDeckStore.getState().endScratch('A'); });
    expect(endScratch).not.toHaveBeenCalled();
  });

  it('calls player.endScratch with undefined resumeAt when slipMode is off', () => {
    const { endScratch } = registerMockBackend('A');
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], scratching: true, slipMode: false } },
    });

    act(() => { useDeckStore.getState().endScratch('A'); });

    expect(endScratch).toHaveBeenCalledWith(undefined);
  });

  it('calls player.endScratch with the slip shadow position when slipMode is on and set', () => {
    const { endScratch } = registerMockBackend('A');
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], scratching: true, slipMode: true, slipPosition: 77 } },
    });

    act(() => { useDeckStore.getState().endScratch('A'); });

    expect(endScratch).toHaveBeenCalledWith(77);
  });

  it('clears scratching and slip tracking fields', () => {
    registerMockBackend('A');
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: { ...useDeckStore.getState().decks['A'], scratching: true, slipMode: true, slipPosition: 77, slipStartTime: 1000, slipStartPosition: 50 },
      },
    });

    act(() => { useDeckStore.getState().endScratch('A'); });

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.scratching).toBe(false);
    expect(deck.slipPosition).toBeNull();
    expect(deck.slipStartTime).toBeNull();
    expect(deck.slipStartPosition).toBeNull();
  });
});

describe('State reset', () => {
  it('loadTrack resets scratching but preserves vinylMode', () => {
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], vinylMode: false, scratching: true } },
    });

    act(() => {
      useDeckStore.getState().loadTrack('A', 'track-1', { title: 'T', artist: 'X', duration: 100, thumbnailUrl: null });
    });

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.scratching).toBe(false);
    expect(deck.vinylMode).toBe(false); // preserved, not reset
  });

  it('clearTrack resets scratching but preserves vinylMode', () => {
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], vinylMode: false, scratching: true } },
    });

    act(() => { useDeckStore.getState().clearTrack('A'); });

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.scratching).toBe(false);
    expect(deck.vinylMode).toBe(false); // preserved, not reset
  });
});
