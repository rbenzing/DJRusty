/**
 * keyboardShortcuts.test.ts — Unit tests for useKeyboardShortcuts hook.
 *
 * Covers STORY-DJ-004 acceptance criteria:
 * - All shortcut bindings dispatch the correct actions
 * - Input/textarea focus suppresses shortcuts
 * - Space and Enter call preventDefault
 * - Beat jump math (including clamp and no-op for null BPM)
 * - Hot cue jump only when cue is set (never sets cues from keyboard)
 * - Tap tempo accumulates and calls setBpm
 * - Listener is cleaned up on unmount
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import type { DeckState } from '../types/deck';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Dispatch a keydown event on document and return it (so callers can check defaultPrevented). */
function pressKey(key: string, options?: Partial<KeyboardEventInit>): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  document.dispatchEvent(event);
  return event;
}

/** Build a minimal mock YT.Player with a vi.fn() seekTo. */
function makeMockPlayer(): YT.Player {
  return {
    seekTo: vi.fn(),
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    stopVideo: vi.fn(),
    setVolume: vi.fn(),
    getVolume: vi.fn(() => 100),
    mute: vi.fn(),
    unMute: vi.fn(),
    isMuted: vi.fn(() => false),
    setPlaybackRate: vi.fn(),
    getPlaybackRate: vi.fn(() => 1),
    getAvailablePlaybackRates: vi.fn(() => [1]),
    getCurrentTime: vi.fn(() => 0),
    getDuration: vi.fn(() => 0),
    cueVideoById: vi.fn(),
    loadVideoById: vi.fn(),
    getPlayerState: vi.fn(() => -1),
    destroy: vi.fn(),
  } as unknown as YT.Player;
}

/** Build a full deck reset object with all required DeckState fields. */
function makeDeck(deckId: 'A' | 'B'): DeckState {
  return {
    deckId,
    trackId: null,
    sourceType: null,
    title: '',
    artist: '',
    waveformPeaks: null,
    waveformColoredPeaks: null,
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
    beatJumpSize: 4,
    playerReady: false,
    hotCues: {},
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    eqKillLow: false,
    eqKillMid: false,
    eqKillHigh: false,
    filterSweep: 0,
    effectType: 'none',
    effectEnabled: false,
    effectWetDry: 0.5,
    error: null,
    pitchRateLocked: false,
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

/** Reset both decks to initial state via setState. */
function resetDecks(): void {
  useDeckStore.setState({
    decks: {
      A: makeDeck('A'),
      B: makeDeck('B'),
    },
  });
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('useKeyboardShortcuts', () => {
  let mockPlayerA: YT.Player;
  let mockPlayerB: YT.Player;
  let unmount: () => void;

  beforeEach(() => {
    resetDecks();
    mockPlayerA = makeMockPlayer();
    mockPlayerB = makeMockPlayer();
    playerRegistry.register('A', 'youtube', mockPlayerA);
    playerRegistry.register('B', 'youtube', mockPlayerB);
    const rendered = renderHook(() => useKeyboardShortcuts());
    unmount = rendered.unmount;
  });

  afterEach(() => {
    unmount();
    playerRegistry.unregister('A', 'youtube');
    playerRegistry.unregister('B', 'youtube');
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Play / Pause
  // -------------------------------------------------------------------------

  describe('Play/Pause', () => {
    it('Space toggles Deck A from paused to playing', () => {
      act(() => {
        useDeckStore.getState().loadTrack('A', 'vid-a', {
          sourceType: 'youtube',
          title: 'Test A',
          artist: 'Channel',
          duration: 300,
          thumbnailUrl: null,
        });
        useDeckStore.getState().setPlaybackState('A', 'paused');
      });

      act(() => { pressKey(' '); });

      expect(useDeckStore.getState().decks.A.playbackState).toBe('playing');
    });

    it('Space toggles Deck A from playing to paused', () => {
      act(() => {
        useDeckStore.getState().loadTrack('A', 'vid-a', {
          sourceType: 'youtube',
          title: 'Test A',
          artist: 'Channel',
          duration: 300,
          thumbnailUrl: null,
        });
        useDeckStore.getState().setPlaybackState('A', 'playing');
      });

      act(() => { pressKey(' '); });

      expect(useDeckStore.getState().decks.A.playbackState).toBe('paused');
    });

    it('Enter toggles Deck B from paused to playing', () => {
      act(() => {
        useDeckStore.getState().loadTrack('B', 'vid-b', {
          sourceType: 'youtube',
          title: 'Test B',
          artist: 'Channel',
          duration: 300,
          thumbnailUrl: null,
        });
        useDeckStore.getState().setPlaybackState('B', 'paused');
      });

      act(() => { pressKey('Enter'); });

      expect(useDeckStore.getState().decks.B.playbackState).toBe('playing');
    });

    it('Space calls preventDefault', () => {
      const event = pressKey(' ');
      expect(event.defaultPrevented).toBe(true);
    });

    it('Enter calls preventDefault', () => {
      const event = pressKey('Enter');
      expect(event.defaultPrevented).toBe(true);
    });

    it('Space is no-op when Deck A has no track loaded (videoId null)', () => {
      // videoId remains null from resetDecks
      act(() => { pressKey(' '); });
      expect(useDeckStore.getState().decks.A.playbackState).toBe('unstarted');
    });
  });

  // -------------------------------------------------------------------------
  // Focus Guard
  // -------------------------------------------------------------------------

  describe('Focus Guard', () => {
    it('INPUT focus suppresses Space shortcut', () => {
      act(() => {
        useDeckStore.getState().loadTrack('A', 'vid-a', {
          sourceType: 'youtube',
          title: 'Test A',
          artist: 'Channel',
          duration: 300,
          thumbnailUrl: null,
        });
        useDeckStore.getState().setPlaybackState('A', 'paused');
      });

      // Append to DOM and dispatch the event directly on the input so that
      // e.target inside the handler is the input element (it bubbles to document).
      const input = document.createElement('input');
      document.body.appendChild(input);

      act(() => {
        const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
        input.dispatchEvent(event);
      });

      expect(useDeckStore.getState().decks.A.playbackState).toBe('paused');

      document.body.removeChild(input);
    });

    it('TEXTAREA focus suppresses Space shortcut', () => {
      act(() => {
        useDeckStore.getState().loadTrack('A', 'vid-a', {
          sourceType: 'youtube',
          title: 'Test A',
          artist: 'Channel',
          duration: 300,
          thumbnailUrl: null,
        });
        useDeckStore.getState().setPlaybackState('A', 'paused');
      });

      // Dispatch directly on the textarea so e.target is the textarea element.
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);

      act(() => {
        const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
        textarea.dispatchEvent(event);
      });

      expect(useDeckStore.getState().decks.A.playbackState).toBe('paused');

      document.body.removeChild(textarea);
    });
  });

  // -------------------------------------------------------------------------
  // Cue Controls
  // -------------------------------------------------------------------------

  describe('Cue Controls', () => {
    it('q jumps to cue on Deck A when hotCues[0] is set', () => {
      act(() => {
        useDeckStore.getState().loadTrack('A', 'vid-a', {
          sourceType: 'youtube',
          title: 'Test A',
          artist: 'Channel',
          duration: 300,
          thumbnailUrl: null,
        });
        useDeckStore.getState().setHotCue('A', 0, 42.5);
      });

      act(() => { pressKey('q'); });

      expect(mockPlayerA.seekTo).toHaveBeenCalledWith(42.5, true);
    });

    it('q is no-op when no cue is set on Deck A', () => {
      act(() => { pressKey('q'); });
      expect(mockPlayerA.seekTo).not.toHaveBeenCalled();
    });

    it('a sets hotCues[0] on Deck A to currentTime', () => {
      act(() => {
        useDeckStore.getState().loadTrack('A', 'vid-a', {
          sourceType: 'youtube',
          title: 'Test A',
          artist: 'Channel',
          duration: 300,
          thumbnailUrl: null,
        });
        useDeckStore.getState().setCurrentTime('A', 30.0);
      });

      act(() => { pressKey('a'); });

      expect(useDeckStore.getState().decks.A.hotCues[0]).toBe(30.0);
    });

    it('a is no-op when Deck A has no track loaded', () => {
      act(() => { pressKey('a'); });
      expect(useDeckStore.getState().decks.A.hotCues[0]).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Beat Jump
  // -------------------------------------------------------------------------

  describe('Beat Jump', () => {
    beforeEach(() => {
      act(() => {
        useDeckStore.getState().loadTrack('A', 'vid-a', {
          sourceType: 'youtube',
          title: 'Test A',
          artist: 'Channel',
          duration: 300,
          thumbnailUrl: null,
        });
        // Set a confirmed beat grid: bpm=120 (spb=0.5s), anchor=0.
        // With anchor=0, beat positions are 0, 0.5, 1.0, 1.5, ..., 60.0, 60.5, ...
        // currentTime=60.0 is exactly on a beat, so nearestBeat snaps to 60.0 (no-op).
        // ±4 beats at 120bpm = ±2s, giving 58.0 / 62.0 — same as the old relative math.
        useDeckStore.getState().setGrid('A', 120, 0);
        useDeckStore.getState().setCurrentTime('A', 60.0);
      });
    });

    it('ArrowLeft triggers grid-snapped beat jump backward on Deck A', () => {
      // nearestBeat(60.0)=60.0; backward 4 beats (2s) = 58.0
      act(() => { pressKey('ArrowLeft'); });
      expect(mockPlayerA.seekTo).toHaveBeenCalledWith(58.0, true);
    });

    it('ArrowRight triggers grid-snapped beat jump forward on Deck A', () => {
      // nearestBeat(60.0)=60.0; forward 4 beats (2s) = 62.0
      act(() => { pressKey('ArrowRight'); });
      expect(mockPlayerA.seekTo).toHaveBeenCalledWith(62.0, true);
    });

    it('ArrowLeft calls preventDefault', () => {
      const event = pressKey('ArrowLeft');
      expect(event.defaultPrevented).toBe(true);
    });

    it('ArrowRight calls preventDefault', () => {
      const event = pressKey('ArrowRight');
      expect(event.defaultPrevented).toBe(true);
    });

    it('beat jump is no-op when grid is not set (bpm null, anchor null)', () => {
      act(() => {
        // clearTrack resets bpm and anchor to null
        useDeckStore.getState().setBpm('A', null);
      });
      act(() => { pressKey('ArrowLeft'); });
      expect(mockPlayerA.seekTo).not.toHaveBeenCalled();
    });

    it('beat jump clamps to 0 when result would be negative', () => {
      act(() => {
        // currentTime=1.0 is on a beat (anchor=0, spb=0.5, beatIndex=2 → exact)
        // nearestBeat(1.0)=1.0; backward 4 beats (2s) = -1.0, clamped to 0
        useDeckStore.getState().setCurrentTime('A', 1.0);
      });
      act(() => { pressKey('ArrowLeft'); });
      expect(mockPlayerA.seekTo).toHaveBeenCalledWith(0, true);
    });

    it('beat jump clamps to duration when result would exceed track length', () => {
      act(() => {
        // currentTime=299.0 is on a beat (beatIndex=598 exact); forward 4 beats (2s) = 301.0, clamped to 300
        useDeckStore.getState().setCurrentTime('A', 299.0);
      });
      act(() => { pressKey('ArrowRight'); });
      expect(mockPlayerA.seekTo).toHaveBeenCalledWith(300, true);
    });
  });

  // -------------------------------------------------------------------------
  // Hot Cues
  // -------------------------------------------------------------------------

  describe('Hot Cues', () => {
    it('keys 1-4 map to Deck A hot cues 0-3', () => {
      act(() => {
        useDeckStore.getState().loadTrack('A', 'vid-a', {
          sourceType: 'youtube',
          title: 'Test A',
          artist: 'Channel',
          duration: 300,
          thumbnailUrl: null,
        });
        useDeckStore.getState().setHotCue('A', 0, 10);
        useDeckStore.getState().setHotCue('A', 1, 20);
        useDeckStore.getState().setHotCue('A', 2, 30);
        useDeckStore.getState().setHotCue('A', 3, 40);
      });

      act(() => { pressKey('1'); });
      expect(mockPlayerA.seekTo).toHaveBeenCalledWith(10, true);

      act(() => { pressKey('2'); });
      expect(mockPlayerA.seekTo).toHaveBeenCalledWith(20, true);

      act(() => { pressKey('3'); });
      expect(mockPlayerA.seekTo).toHaveBeenCalledWith(30, true);

      act(() => { pressKey('4'); });
      expect(mockPlayerA.seekTo).toHaveBeenCalledWith(40, true);
    });

    it('keys 5-8 map to Deck B hot cues 0-3', () => {
      act(() => {
        useDeckStore.getState().loadTrack('B', 'vid-b', {
          sourceType: 'youtube',
          title: 'Test B',
          artist: 'Channel',
          duration: 300,
          thumbnailUrl: null,
        });
        useDeckStore.getState().setHotCue('B', 0, 15);
        useDeckStore.getState().setHotCue('B', 1, 25);
        useDeckStore.getState().setHotCue('B', 2, 35);
        useDeckStore.getState().setHotCue('B', 3, 45);
      });

      act(() => { pressKey('5'); });
      expect(mockPlayerB.seekTo).toHaveBeenCalledWith(15, true);

      act(() => { pressKey('8'); });
      expect(mockPlayerB.seekTo).toHaveBeenCalledWith(45, true);
    });

    it('hot cue key is no-op if that cue index is not set', () => {
      act(() => {
        useDeckStore.getState().loadTrack('A', 'vid-a', {
          sourceType: 'youtube',
          title: 'Test A',
          artist: 'Channel',
          duration: 300,
          thumbnailUrl: null,
        });
        useDeckStore.getState().setHotCue('A', 0, 10);
        // index 1 is NOT set
      });

      act(() => { pressKey('2'); }); // index 1 — not set
      expect(mockPlayerA.seekTo).not.toHaveBeenCalled();
    });

    it('Deck B hot cue key is no-op when cue not set', () => {
      act(() => { pressKey('5'); }); // Deck B index 0 — not set
      expect(mockPlayerB.seekTo).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Tap Tempo
  // -------------------------------------------------------------------------

  describe('Tap Tempo', () => {
    it('pressing t twice sets a numeric BPM on Deck A', () => {
      // First tap returns null; second tap returns a BPM.
      act(() => { pressKey('t'); });
      act(() => { pressKey('t'); });

      expect(useDeckStore.getState().decks.A.bpm).toBeTypeOf('number');
      expect(useDeckStore.getState().decks.A.bpm).not.toBeNull();
    });

    it('pressing y twice sets a numeric BPM on Deck B', () => {
      act(() => { pressKey('y'); });
      act(() => { pressKey('y'); });

      expect(useDeckStore.getState().decks.B.bpm).toBeTypeOf('number');
      expect(useDeckStore.getState().decks.B.bpm).not.toBeNull();
    });

    it('single t press does not set BPM (needs 2+ taps)', () => {
      act(() => { pressKey('t'); });
      // First tap returns null — store should remain null
      expect(useDeckStore.getState().decks.A.bpm).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  describe('Cleanup', () => {
    it('listener is removed after unmount — Space no longer toggles Deck A', () => {
      act(() => {
        useDeckStore.getState().loadTrack('A', 'vid-a', {
          sourceType: 'youtube',
          title: 'Test A',
          artist: 'Channel',
          duration: 300,
          thumbnailUrl: null,
        });
        useDeckStore.getState().setPlaybackState('A', 'paused');
      });

      unmount(); // removes listener

      act(() => { pressKey(' '); });

      // State should be unchanged because listener was removed
      expect(useDeckStore.getState().decks.A.playbackState).toBe('paused');
    });
  });
});
