/**
 * youtube-player.test.ts — Unit tests for STORY-003.
 *
 * Tests cover:
 *  - loadYouTubeIframeApi() singleton behaviour (returns same promise on repeat calls)
 *  - loadYouTubeIframeApi() resolves immediately when YT.Player is already available
 *  - loadYouTubeIframeApi() injects the script tag exactly once
 *  - deckStore actions used by the hook: setPlayerReady, setPlaybackState,
 *    setCurrentTime, setError, loadTrack (state reset), setVolume, setPitchRate
 *
 * The window.YT global is mocked in src/test/setup.ts.
 * The _resetApiPromise() helper is used to restore singleton state between tests.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { loadYouTubeIframeApi, _resetApiPromise } from '../services/youtubeIframeApi';
import { useDeckStore } from '../store/deckStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a fresh initial deck state matching the store's createInitialDeckState. */
function initialDeckState(deckId: 'A' | 'B') {
  return {
    deckId,
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
    playbackState: 'unstarted' as const,
    pitchRate: 1 as const,
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
  };
}

/** Removes the IFrame API script tag if it was injected during a test. */
function removeIframeApiScript() {
  const scriptTag = document.querySelector(
    'script[src="https://www.youtube.com/iframe_api"]',
  );
  scriptTag?.remove();
}

// ---------------------------------------------------------------------------
// loadYouTubeIframeApi() — singleton loader
// ---------------------------------------------------------------------------

describe('loadYouTubeIframeApi', () => {
  beforeEach(() => {
    // Reset the singleton promise so each test starts fresh.
    _resetApiPromise();
    removeIframeApiScript();
    // Remove any global callback installed by previous tests.
    delete window.onYouTubeIframeAPIReady;
  });

  afterEach(() => {
    _resetApiPromise();
    removeIframeApiScript();
  });

  it('returns the same Promise instance on multiple calls (singleton)', () => {
    // Hide YT.Player to force the script-injection path.
    const originalPlayer = window.YT.Player;
    // @ts-expect-error — intentionally removing Player to test deferred path
    window.YT.Player = undefined;

    const promise1 = loadYouTubeIframeApi();
    const promise2 = loadYouTubeIframeApi();
    const promise3 = loadYouTubeIframeApi();

    expect(promise1).toBe(promise2);
    expect(promise2).toBe(promise3);

    // Restore
    window.YT.Player = originalPlayer;
  });

  it('resolves immediately when window.YT.Player is already available', async () => {
    expect(window.YT?.Player).toBeDefined();
    const promise = loadYouTubeIframeApi();
    await expect(promise).resolves.toBeUndefined();
  });

  it('does not inject a script tag when YT.Player is already present', () => {
    const before = document.querySelectorAll(
      'script[src="https://www.youtube.com/iframe_api"]',
    ).length;

    loadYouTubeIframeApi();

    const after = document.querySelectorAll(
      'script[src="https://www.youtube.com/iframe_api"]',
    ).length;
    expect(after).toBe(before);
  });

  it('injects the API script tag when YT.Player is not yet available', () => {
    const originalPlayer = window.YT.Player;
    // @ts-expect-error — intentionally removing Player
    window.YT.Player = undefined;

    loadYouTubeIframeApi();

    const scriptTag = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    expect(scriptTag).not.toBeNull();

    window.YT.Player = originalPlayer;
  });

  it('injects the script tag only once even when called multiple times', () => {
    const originalPlayer = window.YT.Player;
    // @ts-expect-error — intentionally removing Player
    window.YT.Player = undefined;

    loadYouTubeIframeApi();
    loadYouTubeIframeApi();
    loadYouTubeIframeApi();

    const scriptTags = document.querySelectorAll(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    expect(scriptTags).toHaveLength(1);

    window.YT.Player = originalPlayer;
  });

  it('resolves when onYouTubeIframeAPIReady is called', async () => {
    const originalPlayer = window.YT.Player;
    // @ts-expect-error — intentionally removing Player
    window.YT.Player = undefined;

    const promise = loadYouTubeIframeApi();

    // Simulate YouTube API calling the global callback.
    expect(typeof window.onYouTubeIframeAPIReady).toBe('function');
    window.onYouTubeIframeAPIReady?.();

    await expect(promise).resolves.toBeUndefined();

    window.YT.Player = originalPlayer;
  });

  it('preserves an existing onYouTubeIframeAPIReady callback via safe append', () => {
    const originalPlayer = window.YT.Player;
    // @ts-expect-error — intentionally removing Player
    window.YT.Player = undefined;

    const existingCallback = vi.fn();
    window.onYouTubeIframeAPIReady = existingCallback;

    loadYouTubeIframeApi();

    // The loader wraps the existing callback — call it.
    window.onYouTubeIframeAPIReady?.();

    // The original callback must have been invoked.
    expect(existingCallback).toHaveBeenCalledOnce();

    window.YT.Player = originalPlayer;
  });
});

// ---------------------------------------------------------------------------
// deckStore actions — used by the hook during player event handling
// ---------------------------------------------------------------------------

describe('deckStore — setPlayerReady', () => {
  beforeEach(() => {
    useDeckStore.setState({
      decks: { A: initialDeckState('A'), B: initialDeckState('B') },
    });
  });

  it('sets playerReady to true for the specified deck', () => {
    act(() => { useDeckStore.getState().setPlayerReady('A', true); });
    expect(useDeckStore.getState().decks['A'].playerReady).toBe(true);
  });

  it('does not affect the other deck', () => {
    act(() => { useDeckStore.getState().setPlayerReady('A', true); });
    expect(useDeckStore.getState().decks['B'].playerReady).toBe(false);
  });

  it('can be set back to false', () => {
    act(() => {
      useDeckStore.getState().setPlayerReady('A', true);
      useDeckStore.getState().setPlayerReady('A', false);
    });
    expect(useDeckStore.getState().decks['A'].playerReady).toBe(false);
  });
});

describe('deckStore — setPlaybackState', () => {
  beforeEach(() => {
    useDeckStore.setState({
      decks: { A: initialDeckState('A'), B: initialDeckState('B') },
    });
  });

  it('transitions to playing', () => {
    act(() => { useDeckStore.getState().setPlaybackState('A', 'playing'); });
    expect(useDeckStore.getState().decks['A'].playbackState).toBe('playing');
  });

  it('transitions to paused', () => {
    act(() => { useDeckStore.getState().setPlaybackState('B', 'paused'); });
    expect(useDeckStore.getState().decks['B'].playbackState).toBe('paused');
  });

  it('transitions to buffering', () => {
    act(() => { useDeckStore.getState().setPlaybackState('A', 'buffering'); });
    expect(useDeckStore.getState().decks['A'].playbackState).toBe('buffering');
  });

  it('transitions to ended', () => {
    act(() => { useDeckStore.getState().setPlaybackState('A', 'ended'); });
    expect(useDeckStore.getState().decks['A'].playbackState).toBe('ended');
  });

  it('transitions to unstarted', () => {
    act(() => { useDeckStore.getState().setPlaybackState('A', 'unstarted'); });
    expect(useDeckStore.getState().decks['A'].playbackState).toBe('unstarted');
  });

  it('does not affect the other deck', () => {
    act(() => { useDeckStore.getState().setPlaybackState('A', 'playing'); });
    expect(useDeckStore.getState().decks['B'].playbackState).toBe('unstarted');
  });
});

describe('deckStore — setCurrentTime', () => {
  beforeEach(() => {
    useDeckStore.setState({
      decks: { A: initialDeckState('A'), B: initialDeckState('B') },
    });
  });

  it('updates currentTime to the given value', () => {
    act(() => { useDeckStore.getState().setCurrentTime('A', 123.456); });
    expect(useDeckStore.getState().decks['A'].currentTime).toBe(123.456);
  });

  it('can update both decks independently', () => {
    act(() => {
      useDeckStore.getState().setCurrentTime('A', 10.0);
      useDeckStore.getState().setCurrentTime('B', 55.5);
    });
    expect(useDeckStore.getState().decks['A'].currentTime).toBe(10.0);
    expect(useDeckStore.getState().decks['B'].currentTime).toBe(55.5);
  });

  it('accepts zero (start position)', () => {
    act(() => {
      useDeckStore.getState().setCurrentTime('A', 60.0);
      useDeckStore.getState().setCurrentTime('A', 0);
    });
    expect(useDeckStore.getState().decks['A'].currentTime).toBe(0);
  });
});

describe('deckStore — setError', () => {
  beforeEach(() => {
    useDeckStore.setState({
      decks: { A: initialDeckState('A'), B: initialDeckState('B') },
    });
  });

  it('stores the error string for the specified deck', () => {
    act(() => { useDeckStore.getState().setError('A', 'Video cannot be embedded'); });
    expect(useDeckStore.getState().decks['A'].error).toBe('Video cannot be embedded');
  });

  it('accepts null to clear the error', () => {
    act(() => {
      useDeckStore.getState().setError('A', 'Some error');
      useDeckStore.getState().setError('A', null);
    });
    expect(useDeckStore.getState().decks['A'].error).toBeNull();
  });

  it('does not affect the other deck', () => {
    act(() => { useDeckStore.getState().setError('A', 'Error on A'); });
    expect(useDeckStore.getState().decks['B'].error).toBeNull();
  });
});

describe('deckStore — loadTrack state reset', () => {
  beforeEach(() => {
    useDeckStore.setState({
      decks: { A: initialDeckState('A'), B: initialDeckState('B') },
    });
  });

  it('sets trackId, title, artist, duration and thumbnailUrl', () => {
    act(() => {
      useDeckStore.getState().loadTrack('A', 'abc123', {
        sourceType: 'youtube',
        title: 'Test Track',
        artist: 'Test Artist',
        duration: 300,
        thumbnailUrl: 'https://example.com/thumb.jpg',
      });
    });
    const deck = useDeckStore.getState().decks['A'];
    expect(deck.trackId).toBe('abc123');
    expect(deck.title).toBe('Test Track');
    expect(deck.artist).toBe('Test Artist');
    expect(deck.duration).toBe(300);
    expect(deck.thumbnailUrl).toBe('https://example.com/thumb.jpg');
  });

  it('resets currentTime to 0', () => {
    act(() => {
      useDeckStore.getState().setCurrentTime('A', 99.0);
      useDeckStore.getState().loadTrack('A', 'abc123', {
        sourceType: 'youtube',
        title: 'T',
        artist: 'A',
        duration: 100,
        thumbnailUrl: null,
      });
    });
    expect(useDeckStore.getState().decks['A'].currentTime).toBe(0);
  });

  it('resets loopActive, loopStart and loopEnd', () => {
    act(() => {
      useDeckStore.getState().activateLoop('A', 10, 20);
      useDeckStore.getState().loadTrack('A', 'abc123', {
        sourceType: 'youtube',
        title: 'T',
        artist: 'A',
        duration: 100,
        thumbnailUrl: null,
      });
    });
    const deck = useDeckStore.getState().decks['A'];
    expect(deck.loopActive).toBe(false);
    expect(deck.loopStart).toBeNull();
    expect(deck.loopEnd).toBeNull();
  });

  it('resets bpm to null', () => {
    act(() => {
      useDeckStore.getState().setBpm('A', 128);
      useDeckStore.getState().loadTrack('A', 'abc123', {
        sourceType: 'youtube',
        title: 'T',
        artist: 'A',
        duration: 100,
        thumbnailUrl: null,
      });
    });
    expect(useDeckStore.getState().decks['A'].bpm).toBeNull();
  });

  it('resets hotCues to empty', () => {
    act(() => {
      useDeckStore.getState().setHotCue('A', 0, 5.0);
      useDeckStore.getState().loadTrack('A', 'abc123', {
        sourceType: 'youtube',
        title: 'T',
        artist: 'A',
        duration: 100,
        thumbnailUrl: null,
      });
    });
    expect(useDeckStore.getState().decks['A'].hotCues).toEqual({});
  });

  it('resets error to null', () => {
    act(() => {
      useDeckStore.getState().setError('A', 'Previous error');
      useDeckStore.getState().loadTrack('A', 'abc123', {
        sourceType: 'youtube',
        title: 'T',
        artist: 'A',
        duration: 100,
        thumbnailUrl: null,
      });
    });
    expect(useDeckStore.getState().decks['A'].error).toBeNull();
  });

  it('does not affect the other deck', () => {
    act(() => {
      useDeckStore.getState().loadTrack('A', 'abc123', {
        sourceType: 'youtube',
        title: 'Track A',
        artist: 'Artist A',
        duration: 200,
        thumbnailUrl: null,
      });
    });
    const deckB = useDeckStore.getState().decks['B'];
    expect(deckB.trackId).toBeNull();
    expect(deckB.title).toBe('');
  });
});

describe('deckStore — setVolume', () => {
  beforeEach(() => {
    useDeckStore.setState({
      decks: { A: initialDeckState('A'), B: initialDeckState('B') },
    });
  });

  it('updates volume for the specified deck', () => {
    act(() => { useDeckStore.getState().setVolume('A', 60); });
    expect(useDeckStore.getState().decks['A'].volume).toBe(60);
  });

  it('accepts 0 (muted)', () => {
    act(() => { useDeckStore.getState().setVolume('B', 0); });
    expect(useDeckStore.getState().decks['B'].volume).toBe(0);
  });

  it('accepts 100 (maximum)', () => {
    act(() => { useDeckStore.getState().setVolume('A', 100); });
    expect(useDeckStore.getState().decks['A'].volume).toBe(100);
  });

  it('does not affect the other deck', () => {
    act(() => { useDeckStore.getState().setVolume('A', 40); });
    expect(useDeckStore.getState().decks['B'].volume).toBe(80);
  });
});

describe('deckStore — setPitchRate', () => {
  beforeEach(() => {
    useDeckStore.setState({
      decks: { A: initialDeckState('A'), B: initialDeckState('B') },
    });
  });

  it('updates pitchRate for the specified deck', () => {
    act(() => { useDeckStore.getState().setPitchRate('A', 1.5); });
    expect(useDeckStore.getState().decks['A'].pitchRate).toBe(1.5);
  });

  it('accepts minimum pitch rate (0.25)', () => {
    act(() => { useDeckStore.getState().setPitchRate('B', 0.25); });
    expect(useDeckStore.getState().decks['B'].pitchRate).toBe(0.25);
  });

  it('accepts maximum pitch rate (2)', () => {
    act(() => { useDeckStore.getState().setPitchRate('A', 2); });
    expect(useDeckStore.getState().decks['A'].pitchRate).toBe(2);
  });

  it('does not affect the other deck', () => {
    act(() => { useDeckStore.getState().setPitchRate('A', 0.75); });
    expect(useDeckStore.getState().decks['B'].pitchRate).toBe(1);
  });
});
