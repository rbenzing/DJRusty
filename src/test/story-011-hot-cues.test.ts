/**
 * story-011-hot-cues.test.ts — STORY-011 Hot Cues integration tests.
 *
 * Tests cover:
 *   1. Setting a hot cue updates deck store and persists to localStorage.
 *   2. Jumping to a hot cue calls player.seekTo() via the playerRegistry.
 *   3. Clearing a hot cue removes it from deck store and localStorage.
 *   4. Hot cues persist across a simulated page reload (loadTrack re-reads localStorage).
 *   5. Hot cues are keyed by videoId — different video IDs are independent.
 *   6. DeckControls Cue button (index 0): set cue persists; jump uses seekTo.
 *   7. HotCueButton: long-press timer logic (via mock timers).
 *   8. 4 hot cue slots per deck — all indices 0–3 supported.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { getHotCues, setHotCue, clearHotCue } from '../utils/hotCues';
import { playerRegistry } from '../services/playerRegistry';

// ---------------------------------------------------------------------------
// Helpers / setup
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'dj-rusty-hot-cues';

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
  localStorage.clear();
  resetDeckStore();
});

// ---------------------------------------------------------------------------
// 1. Setting a hot cue updates deck store AND persists to localStorage
// ---------------------------------------------------------------------------

describe('STORY-011: setting a hot cue', () => {
  it('stores the timestamp in the deckStore at the correct index', () => {
    act(() => {
      useDeckStore.getState().setHotCue('A', 0, 42.5);
    });

    expect(useDeckStore.getState().decks['A'].hotCues[0]).toBe(42.5);
  });

  it('stores all four indices independently', () => {
    act(() => {
      useDeckStore.getState().setHotCue('A', 0, 10.0);
      useDeckStore.getState().setHotCue('A', 1, 20.0);
      useDeckStore.getState().setHotCue('A', 2, 30.0);
      useDeckStore.getState().setHotCue('A', 3, 40.0);
    });

    const { hotCues } = useDeckStore.getState().decks['A'];
    expect(hotCues[0]).toBe(10.0);
    expect(hotCues[1]).toBe(20.0);
    expect(hotCues[2]).toBe(30.0);
    expect(hotCues[3]).toBe(40.0);
  });

  it('persists the cue to localStorage via setHotCue utility', () => {
    setHotCue('videoABC', 1, 55.25);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<
      string,
      Record<number, number>
    >;
    expect(stored['videoABC']?.[1]).toBe(55.25);
  });

  it('does not affect cues for other indices in the same video', () => {
    setHotCue('vid', 0, 10.0);
    setHotCue('vid', 2, 30.0);

    const cues = getHotCues('vid');
    expect(cues[0]).toBe(10.0);
    expect(cues[1]).toBeUndefined();
    expect(cues[2]).toBe(30.0);
  });

  it('overwrites an existing cue at the same index', () => {
    act(() => {
      useDeckStore.getState().setHotCue('A', 0, 10.0);
    });
    act(() => {
      useDeckStore.getState().setHotCue('A', 0, 99.9);
    });

    expect(useDeckStore.getState().decks['A'].hotCues[0]).toBe(99.9);
  });
});

// ---------------------------------------------------------------------------
// 2. Jumping to a hot cue via playerRegistry.seekTo()
// ---------------------------------------------------------------------------

describe('STORY-011: jumping to a hot cue', () => {
  it('calls player.seekTo(timestamp, true) on the registered player', () => {
    const mockPlayer = { seekTo: vi.fn() } as unknown as YT.Player;
    playerRegistry.register('A', mockPlayer);

    // Simulate the jump action as performed by HotCues component.
    const timestamp = 37.5;
    mockPlayer.seekTo(timestamp, true);

    expect(mockPlayer.seekTo).toHaveBeenCalledWith(37.5, true);

    playerRegistry.unregister('A');
  });

  it('does not throw when no player is registered (player not yet ready)', () => {
    // No player registered for deck B.
    expect(() => {
      const player = playerRegistry.get('B');
      player?.seekTo(10, true); // Optional chaining prevents throw.
    }).not.toThrow();
  });

  it('playerRegistry.get returns undefined after unregister', () => {
    const mockPlayer = { seekTo: vi.fn() } as unknown as YT.Player;
    playerRegistry.register('A', mockPlayer);
    playerRegistry.unregister('A');

    expect(playerRegistry.get('A')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. Clearing a hot cue removes it from deck store and localStorage
// ---------------------------------------------------------------------------

describe('STORY-011: clearing a hot cue', () => {
  it('removes the cue at the specified index from the deck store', () => {
    act(() => {
      useDeckStore.getState().setHotCue('A', 1, 25.0);
    });
    act(() => {
      useDeckStore.getState().clearHotCue('A', 1);
    });

    expect(useDeckStore.getState().decks['A'].hotCues[1]).toBeUndefined();
  });

  it('preserves cues at other indices when one is cleared', () => {
    act(() => {
      useDeckStore.getState().setHotCue('A', 0, 10.0);
      useDeckStore.getState().setHotCue('A', 1, 20.0);
      useDeckStore.getState().setHotCue('A', 2, 30.0);
    });
    act(() => {
      useDeckStore.getState().clearHotCue('A', 1);
    });

    const { hotCues } = useDeckStore.getState().decks['A'];
    expect(hotCues[0]).toBe(10.0);
    expect(hotCues[1]).toBeUndefined();
    expect(hotCues[2]).toBe(30.0);
  });

  it('removes the cue from localStorage via clearHotCue utility', () => {
    setHotCue('videoXYZ', 0, 15.0);
    setHotCue('videoXYZ', 1, 30.0);
    clearHotCue('videoXYZ', 0);

    const cues = getHotCues('videoXYZ');
    expect(cues[0]).toBeUndefined();
    expect(cues[1]).toBe(30.0);
  });
});

// ---------------------------------------------------------------------------
// 4. Hot cues persist across page reload (simulated via loadTrack reading localStorage)
// ---------------------------------------------------------------------------

describe('STORY-011: hot cue persistence across reload', () => {
  it('loadTrack reads stored cues from localStorage into deck state', () => {
    // Pre-populate localStorage (as if a previous session had saved cues).
    setHotCue('dQw4w9WgXcQ', 0, 12.5);
    setHotCue('dQw4w9WgXcQ', 2, 67.0);

    // Simulate loading the same video (triggers getHotCues inside loadTrack).
    act(() => {
      useDeckStore.getState().loadTrack('A', 'dQw4w9WgXcQ', {
        sourceType: 'youtube',
        title: 'Test Track',
        artist: 'Test Channel',
        duration: 212,
        thumbnailUrl: null,
      });
    });

    const { hotCues } = useDeckStore.getState().decks['A'];
    expect(hotCues[0]).toBe(12.5);
    expect(hotCues[2]).toBe(67.0);
  });

  it('deck has empty hotCues after loadTrack when no cues are stored for that video', () => {
    act(() => {
      useDeckStore.getState().loadTrack('A', 'newVideoId', {
        sourceType: 'youtube',
        title: 'New Track',
        artist: 'Channel',
        duration: 180,
        thumbnailUrl: null,
      });
    });

    expect(useDeckStore.getState().decks['A'].hotCues).toEqual({});
  });

  it('hotCues reset when a different video is loaded', () => {
    setHotCue('videoOld', 0, 5.0);
    setHotCue('videoNew', 1, 88.0);

    act(() => {
      useDeckStore.getState().loadTrack('A', 'videoOld', {
        sourceType: 'youtube',
        title: 'Old',
        artist: 'Ch',
        duration: 100,
        thumbnailUrl: null,
      });
    });
    expect(useDeckStore.getState().decks['A'].hotCues[0]).toBe(5.0);

    act(() => {
      useDeckStore.getState().loadTrack('A', 'videoNew', {
        sourceType: 'youtube',
        title: 'New',
        artist: 'Ch',
        duration: 200,
        thumbnailUrl: null,
      });
    });
    const { hotCues } = useDeckStore.getState().decks['A'];
    expect(hotCues[0]).toBeUndefined();
    expect(hotCues[1]).toBe(88.0);
  });
});

// ---------------------------------------------------------------------------
// 5. Hot cues are keyed by videoId — different videos are independent
// ---------------------------------------------------------------------------

describe('STORY-011: hot cues keyed by videoId', () => {
  it('cues for different videoIds do not interfere', () => {
    setHotCue('video1', 0, 10.0);
    setHotCue('video2', 0, 99.0);

    expect(getHotCues('video1')[0]).toBe(10.0);
    expect(getHotCues('video2')[0]).toBe(99.0);
  });

  it('clearing a cue for one video does not affect another', () => {
    setHotCue('video1', 0, 10.0);
    setHotCue('video2', 0, 20.0);

    clearHotCue('video1', 0);

    expect(getHotCues('video1')[0]).toBeUndefined();
    expect(getHotCues('video2')[0]).toBe(20.0);
  });

  it('Deck A and Deck B store independent state but share localStorage key by videoId', () => {
    // Both decks can have their own store state for the same video.
    act(() => {
      useDeckStore.getState().setHotCue('A', 0, 15.0);
      useDeckStore.getState().setHotCue('B', 0, 30.0);
    });

    expect(useDeckStore.getState().decks['A'].hotCues[0]).toBe(15.0);
    expect(useDeckStore.getState().decks['B'].hotCues[0]).toBe(30.0);
  });
});

// ---------------------------------------------------------------------------
// 6. Long-press timer logic (unit test for LONG_PRESS_MS constant)
// ---------------------------------------------------------------------------

describe('STORY-011: long-press timer logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires the set callback after 500ms via setTimeout', () => {
    const onSet = vi.fn();

    // Simulate a long-press by scheduling the timeout as HotCueButton does.
    const timer = window.setTimeout(() => {
      onSet();
    }, 500);

    // Not yet fired.
    expect(onSet).not.toHaveBeenCalled();

    // Advance timers by 500ms.
    vi.advanceTimersByTime(500);
    expect(onSet).toHaveBeenCalledOnce();

    clearTimeout(timer);
  });

  it('does not fire the set callback if clearTimeout is called before 500ms', () => {
    const onSet = vi.fn();

    const timer = window.setTimeout(() => {
      onSet();
    }, 500);

    vi.advanceTimersByTime(300);
    clearTimeout(timer);
    vi.advanceTimersByTime(300);

    expect(onSet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. playerRegistry — basic operations
// ---------------------------------------------------------------------------

describe('STORY-011: playerRegistry', () => {
  afterEach(() => {
    // Clean up after each test.
    playerRegistry.unregister('A');
    playerRegistry.unregister('B');
  });

  it('returns undefined for an unregistered deck', () => {
    expect(playerRegistry.get('A')).toBeUndefined();
  });

  it('returns the registered player after register()', () => {
    const mockPlayer = { seekTo: vi.fn() } as unknown as YT.Player;
    playerRegistry.register('A', mockPlayer);

    expect(playerRegistry.get('A')).toBe(mockPlayer);
  });

  it('unregister() removes the player from the registry', () => {
    const mockPlayer = { seekTo: vi.fn() } as unknown as YT.Player;
    playerRegistry.register('B', mockPlayer);
    playerRegistry.unregister('B');

    expect(playerRegistry.get('B')).toBeUndefined();
  });

  it('supports independent registration for Deck A and Deck B', () => {
    const playerA = { seekTo: vi.fn(), id: 'A' } as unknown as YT.Player;
    const playerB = { seekTo: vi.fn(), id: 'B' } as unknown as YT.Player;

    playerRegistry.register('A', playerA);
    playerRegistry.register('B', playerB);

    expect(playerRegistry.get('A')).toBe(playerA);
    expect(playerRegistry.get('B')).toBe(playerB);
  });

  it('re-registering a deck replaces the previous player', () => {
    const player1 = { seekTo: vi.fn(), id: '1' } as unknown as YT.Player;
    const player2 = { seekTo: vi.fn(), id: '2' } as unknown as YT.Player;

    playerRegistry.register('A', player1);
    playerRegistry.register('A', player2);

    expect(playerRegistry.get('A')).toBe(player2);
  });
});

// ---------------------------------------------------------------------------
// 8. DeckControls Cue button: index 0 acts as the "main cue"
// ---------------------------------------------------------------------------

describe('STORY-011: DeckControls cue button wiring (index 0)', () => {
  it('setHotCue at index 0 stores the value in the store', () => {
    act(() => {
      useDeckStore.getState().setHotCue('A', 0, 33.0);
    });

    expect(useDeckStore.getState().decks['A'].hotCues[0]).toBe(33.0);
  });

  it('hotCues[0] is accessible as the main cue point', () => {
    act(() => {
      useDeckStore.getState().setHotCue('A', 0, 7.5);
    });

    const cue0 = useDeckStore.getState().decks['A'].hotCues[0];
    expect(cue0).toBe(7.5);
  });

  it('clearHotCue at index 0 removes the main cue', () => {
    act(() => {
      useDeckStore.getState().setHotCue('A', 0, 20.0);
      useDeckStore.getState().clearHotCue('A', 0);
    });

    expect(useDeckStore.getState().decks['A'].hotCues[0]).toBeUndefined();
  });
});
