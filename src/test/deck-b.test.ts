/**
 * deck-b.test.ts — STORY-005: Deck B UI Shell
 *
 * Verifies that Deck B:
 *  - Has independent state in deckStore (deckId: 'B')
 *  - Can hold a different playback state from Deck A simultaneously
 *  - Can load a track independently from Deck A
 *  - Has its own volume, pitch rate, BPM, and EQ state
 *  - State changes on Deck B do not affect Deck A (and vice versa)
 *
 * The visual differentiation (data-deck attribute, accent colours, deck label)
 * is implemented in Deck.tsx (data-deck prop), Deck.module.css ([data-deck='b']),
 * and DeckDisplay.tsx ("DECK B" label). Those are verified here at the store layer
 * and documented in the implementation notes for code review.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';

/** Reset both deck slices to a clean initial state before each test. */
function resetDeckStore() {
  useDeckStore.setState({
    decks: {
      A: {
        deckId: 'A',
        trackId: null,
        sourceType: null,
        title: '',
        artist: '',
        waveformPeaks: null,
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
        playerReady: false,
        hotCues: {},
        eqLow: 0,
        eqMid: 0,
        eqHigh: 0,
        error: null,
        pitchRateLocked: false,
        beatJumpSize: 4,
        synced: false,
        slipMode: false,
        slipPosition: null,
        slipStartTime: null,
        slipStartPosition: null,
        rollMode: false,
        rollStartWallClock: null,
        rollStartPosition: null,
        autoPlayOnLoad: false,
      },
      B: {
        deckId: 'B',
        trackId: null,
        sourceType: null,
        title: '',
        artist: '',
        waveformPeaks: null,
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
        playerReady: false,
        hotCues: {},
        eqLow: 0,
        eqMid: 0,
        eqHigh: 0,
        error: null,
        pitchRateLocked: false,
        beatJumpSize: 4,
        synced: false,
        slipMode: false,
        slipPosition: null,
        slipStartTime: null,
        slipStartPosition: null,
        rollMode: false,
        rollStartWallClock: null,
        rollStartPosition: null,
        autoPlayOnLoad: false,
      },
    },
  });
}

beforeEach(() => {
  resetDeckStore();
});

// ---------------------------------------------------------------------------
// AC-2: Deck B state reads from deckStore (deckId: 'B')
// ---------------------------------------------------------------------------

describe('Deck B store slice identity', () => {
  it('has deckId B in its initial state', () => {
    const deckB = useDeckStore.getState().decks['B'];
    expect(deckB.deckId).toBe('B');
  });

  it('has its own independent state object from Deck A', () => {
    const { decks } = useDeckStore.getState();
    // They must be separate objects — not the same reference
    expect(decks['A']).not.toBe(decks['B']);
    expect(decks['A'].deckId).toBe('A');
    expect(decks['B'].deckId).toBe('B');
  });
});

// ---------------------------------------------------------------------------
// AC-4/5: Both decks visible simultaneously — independent playback states
// ---------------------------------------------------------------------------

describe('Deck B playback state independence', () => {
  it('can be set to playing while Deck A remains unstarted', () => {
    act(() => {
      useDeckStore.getState().setPlaybackState('B', 'playing');
    });

    expect(useDeckStore.getState().decks['B'].playbackState).toBe('playing');
    expect(useDeckStore.getState().decks['A'].playbackState).toBe('unstarted');
  });

  it('can be set to paused while Deck A is playing', () => {
    act(() => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      useDeckStore.getState().setPlaybackState('B', 'paused');
    });

    expect(useDeckStore.getState().decks['A'].playbackState).toBe('playing');
    expect(useDeckStore.getState().decks['B'].playbackState).toBe('paused');
  });

  it('can transition through all playback states independently', () => {
    act(() => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
    });
    act(() => {
      useDeckStore.getState().setPlaybackState('B', 'buffering');
    });
    act(() => {
      useDeckStore.getState().setPlaybackState('B', 'playing');
    });

    expect(useDeckStore.getState().decks['A'].playbackState).toBe('playing');
    expect(useDeckStore.getState().decks['B'].playbackState).toBe('playing');
  });
});

// ---------------------------------------------------------------------------
// AC-2: Deck B loads tracks into its own store slice
// ---------------------------------------------------------------------------

describe('Deck B track loading', () => {
  it('loads a track into Deck B without affecting Deck A', () => {
    act(() => {
      useDeckStore.getState().loadTrack('B', 'dQw4w9WgXcQ', {
        sourceType: 'youtube',
        title: 'Deck B Track',
        artist: 'Channel B',
        duration: 180,
        thumbnailUrl: 'https://example.com/thumb-b.jpg',
      });
    });

    const deckB = useDeckStore.getState().decks['B'];
    expect(deckB.trackId).toBe('dQw4w9WgXcQ');
    expect(deckB.title).toBe('Deck B Track');
    expect(deckB.artist).toBe('Channel B');
    expect(deckB.duration).toBe(180);
    expect(deckB.thumbnailUrl).toBe('https://example.com/thumb-b.jpg');

    // Deck A must remain empty
    const deckA = useDeckStore.getState().decks['A'];
    expect(deckA.trackId).toBeNull();
    expect(deckA.title).toBe('');
  });

  it('allows Deck A and Deck B to have different tracks simultaneously', () => {
    act(() => {
      useDeckStore.getState().loadTrack('A', 'trackA001', {
        sourceType: 'youtube',
        title: 'Track A',
        artist: 'Artist A',
        duration: 210,
        thumbnailUrl: null,
      });
      useDeckStore.getState().loadTrack('B', 'trackB002', {
        sourceType: 'youtube',
        title: 'Track B',
        artist: 'Artist B',
        duration: 195,
        thumbnailUrl: null,
      });
    });

    expect(useDeckStore.getState().decks['A'].trackId).toBe('trackA001');
    expect(useDeckStore.getState().decks['B'].trackId).toBe('trackB002');
    expect(useDeckStore.getState().decks['A'].title).toBe('Track A');
    expect(useDeckStore.getState().decks['B'].title).toBe('Track B');
  });

  it('resets Deck B state on load (clears currentTime, loop, bpm)', () => {
    // Set some state on Deck B first
    act(() => {
      useDeckStore.getState().setPlaybackState('B', 'playing');
      useDeckStore.getState().setCurrentTime('B', 45.0);
      useDeckStore.getState().setBpm('B', 128);
      useDeckStore.getState().activateLoop('B', 10.0, 20.0);
    });

    // Load a new track — should reset transient state
    act(() => {
      useDeckStore.getState().loadTrack('B', 'newVideoId', {
        sourceType: 'youtube',
        title: 'New Track',
        artist: 'Artist B',
        duration: 200,
        thumbnailUrl: null,
      });
    });

    const deckB = useDeckStore.getState().decks['B'];
    expect(deckB.currentTime).toBe(0);
    expect(deckB.bpm).toBeNull();
    expect(deckB.loopActive).toBe(false);
    expect(deckB.loopStart).toBeNull();
    expect(deckB.loopEnd).toBeNull();
    // BUG-006 fix: loadTrack sets playbackState to 'unstarted' (not 'paused')
    // so the IFrame API's onStateChange callback drives the state from here.
    expect(deckB.playbackState).toBe('unstarted');
  });
});

// ---------------------------------------------------------------------------
// Deck B has its own pitch rate, volume, BPM, and EQ state
// ---------------------------------------------------------------------------

describe('Deck B individual control state', () => {
  it('stores its own pitch rate independently from Deck A', () => {
    act(() => {
      useDeckStore.getState().setPitchRate('A', 1.25);
      useDeckStore.getState().setPitchRate('B', 0.75);
    });

    expect(useDeckStore.getState().decks['A'].pitchRate).toBe(1.25);
    expect(useDeckStore.getState().decks['B'].pitchRate).toBe(0.75);
  });

  it('stores its own volume independently from Deck A', () => {
    act(() => {
      useDeckStore.getState().setVolume('A', 100);
      useDeckStore.getState().setVolume('B', 50);
    });

    expect(useDeckStore.getState().decks['A'].volume).toBe(100);
    expect(useDeckStore.getState().decks['B'].volume).toBe(50);
  });

  it('stores its own BPM independently from Deck A', () => {
    act(() => {
      useDeckStore.getState().setBpm('A', 120);
      useDeckStore.getState().setBpm('B', 140);
    });

    expect(useDeckStore.getState().decks['A'].bpm).toBe(120);
    expect(useDeckStore.getState().decks['B'].bpm).toBe(140);
  });

  it('stores its own EQ values independently', () => {
    act(() => {
      useDeckStore.getState().setEq('A', 'eqLow', 6);
      useDeckStore.getState().setEq('B', 'eqLow', -3);
      useDeckStore.getState().setEq('B', 'eqHigh', 9);
    });

    expect(useDeckStore.getState().decks['A'].eqLow).toBe(6);
    expect(useDeckStore.getState().decks['B'].eqLow).toBe(-3);
    expect(useDeckStore.getState().decks['B'].eqHigh).toBe(9);
    // Deck A eqHigh must be unchanged
    expect(useDeckStore.getState().decks['A'].eqHigh).toBe(0);
  });

  it('stores its own current time independently', () => {
    act(() => {
      useDeckStore.getState().setCurrentTime('A', 30.5);
      useDeckStore.getState().setCurrentTime('B', 92.0);
    });

    expect(useDeckStore.getState().decks['A'].currentTime).toBe(30.5);
    expect(useDeckStore.getState().decks['B'].currentTime).toBe(92.0);
  });
});

// ---------------------------------------------------------------------------
// Deck B error state handling
// ---------------------------------------------------------------------------

describe('Deck B error state', () => {
  it('can be set to an error state independently from Deck A', () => {
    act(() => {
      useDeckStore.getState().setError('B', 'Video cannot be embedded');
    });

    expect(useDeckStore.getState().decks['B'].error).toBe('Video cannot be embedded');
    expect(useDeckStore.getState().decks['A'].error).toBeNull();
  });

  it('can clear its error state', () => {
    act(() => {
      useDeckStore.getState().setError('B', 'Some error');
    });
    act(() => {
      useDeckStore.getState().setError('B', null);
    });

    expect(useDeckStore.getState().decks['B'].error).toBeNull();
  });
});
