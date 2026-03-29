/**
 * mp3-003-transport.test.ts — TDD test specs for MP3-003: Play/Pause/Seek transport subscriptions.
 *
 * RED-PHASE tests written before the hook changes exist.
 * All tests are expected to FAIL until the Developer adds transport subscriptions to useAudioEngine.
 *
 * Coverage:
 *  - Transport subscriptions: play/pause/seek delegated to engine when sourceType === 'mp3'
 *  - Source-type guard: transport actions do NOT call engine when sourceType === 'youtube'
 *  - Pre-load guard: engine methods not called before a track is loaded
 *  - Unmount cleanup: transport actions do NOT call engine after unmount
 *  - Playback state synchronisation: play resolves -> 'playing', pause -> 'paused'
 *  - Seek clamping: negative -> 0, beyond duration -> duration
 *  - CurrentTime poll: updates from engine while playing, stops while paused
 *  - Loop enforcement: seekTo(loopStart) called when currentTime >= loopEnd during poll
 *  - Slip tracking: updateSlipPosition called in poll when slipMode active with loop
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { usePlaylistStore } from '../store/playlistStore';
import { playerRegistry } from '../services/playerRegistry';

// ---------------------------------------------------------------------------
// Module mocks — declared before hook import (same pattern as useAudioEngine.test.ts)
// ---------------------------------------------------------------------------

const mockEngineInstances: MockAudioEngine[] = [];

interface MockAudioEngine {
  loadBuffer: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  seekTo: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  setVolume: ReturnType<typeof vi.fn>;
  setPlaybackRate: ReturnType<typeof vi.fn>;
  setEQ: ReturnType<typeof vi.fn>;
  getAnalyser: ReturnType<typeof vi.fn>;
  isReady: ReturnType<typeof vi.fn>;
  isPlaying: ReturnType<typeof vi.fn>;
  onEnded: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  getCurrentTime: ReturnType<typeof vi.fn>;
  getDuration: ReturnType<typeof vi.fn>;
  _endedCallback: (() => void) | null;
}

function makeMockEngine(): MockAudioEngine {
  const engine: MockAudioEngine = {
    loadBuffer: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    seekTo: vi.fn(),
    stop: vi.fn(),
    setVolume: vi.fn(),
    setPlaybackRate: vi.fn(),
    setEQ: vi.fn(),
    getAnalyser: vi.fn(),
    isReady: vi.fn().mockReturnValue(true),
    isPlaying: vi.fn().mockReturnValue(false),
    onEnded: vi.fn().mockImplementation((cb: () => void) => {
      engine._endedCallback = cb;
    }),
    destroy: vi.fn(),
    getCurrentTime: vi.fn().mockReturnValue(0),
    getDuration: vi.fn().mockReturnValue(0),
    _endedCallback: null,
  };
  return engine;
}

vi.mock('../services/audioEngine', () => ({
  AudioEngineImpl: vi.fn().mockImplementation(() => {
    const instance = makeMockEngine();
    mockEngineInstances.push(instance);
    return instance;
  }),
}));

vi.mock('../services/playerRegistry', () => ({
  playerRegistry: {
    register: vi.fn(),
    unregister: vi.fn(),
    get: vi.fn(),
  },
}));

const fakeAudioBuffer: AudioBuffer = {
  duration: 240,
  length: 240 * 44100,
  numberOfChannels: 2,
  sampleRate: 44100,
  getChannelData: vi.fn().mockReturnValue(new Float32Array(0)),
  copyFromChannel: vi.fn(),
  copyToChannel: vi.fn(),
} as unknown as AudioBuffer;

const mockDecodeAudioFile = vi.fn().mockResolvedValue(fakeAudioBuffer);

vi.mock('../services/audioDecoder', () => ({
  decodeAudioFile: (...args: unknown[]) => mockDecodeAudioFile(...args),
}));

// ---------------------------------------------------------------------------
// Late import: must come AFTER vi.mock() declarations.
// ---------------------------------------------------------------------------

import { useAudioEngine } from '../hooks/useAudioEngine';

// ---------------------------------------------------------------------------
// Store reset helpers — mirrors useAudioEngine.test.ts exactly
// ---------------------------------------------------------------------------

function initialDeckState(deckId: 'A' | 'B') {
  return {
    deckId,
    trackId: null,
    sourceType: null as null,
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

function resetStores() {
  useDeckStore.setState({
    decks: { A: initialDeckState('A'), B: initialDeckState('B') },
  });
  usePlaylistStore.setState({
    playlists: { A: [], B: [] },
    currentIndex: { A: -1, B: -1 },
  });
}

/** Load an MP3 track into the deck store + playlist store and wait for decode to settle. */
async function loadMp3TrackAndWait(deckId: 'A' | 'B', file: File) {
  const entry = {
    id: 'test-entry-1',
    sourceType: 'mp3' as const,
    title: 'Test Track',
    artist: 'Local File',
    duration: 240,
    thumbnailUrl: null,
    file,
  };
  act(() => {
    usePlaylistStore.setState({
      playlists: { ...usePlaylistStore.getState().playlists, [deckId]: [entry] },
      currentIndex: { ...usePlaylistStore.getState().currentIndex, [deckId]: 0 },
    });
  });
  await act(async () => {
    useDeckStore.getState().loadTrack(
      deckId,
      entry.id,
      { sourceType: 'mp3', title: entry.title, artist: entry.artist, duration: entry.duration, thumbnailUrl: null },
      false,
    );
    await Promise.resolve();
  });
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('MP3-003 — play subscription: sourceType mp3', () => {
  const fakeFile = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });

  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
    mockDecodeAudioFile.mockResolvedValue(fakeAudioBuffer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls engine.play() when playbackState changes to playing after a track is loaded', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    // play() is called once during autoPlay = false path — reset count before transport test
    mockEngineInstances[0]!.play.mockClear();

    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    expect(mockEngineInstances[0]!.play).toHaveBeenCalledOnce();
  });

  it('sets playbackState to playing in the store after engine.play() resolves', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    expect(useDeckStore.getState().decks['A'].playbackState).toBe('playing');
  });

  it('does NOT call engine.play() a second time when an unrelated store change occurs while playing', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    mockEngineInstances[0]!.play.mockClear();

    // Unrelated state change — should NOT re-trigger play
    act(() => {
      useDeckStore.getState().setVolume('A', 50);
    });

    expect(mockEngineInstances[0]!.play).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('MP3-003 — pause subscription: sourceType mp3', () => {
  const fakeFile = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });

  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
    mockDecodeAudioFile.mockResolvedValue(fakeAudioBuffer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls engine.pause() when playbackState changes to paused after a track is loaded', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    // Transition to playing first, then pause
    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    act(() => {
      useDeckStore.getState().setPlaybackState('A', 'paused');
    });

    expect(mockEngineInstances[0]!.pause).toHaveBeenCalledOnce();
  });

  it('sets playbackState to paused in the store after engine.pause() is called', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    act(() => {
      useDeckStore.getState().setPlaybackState('A', 'paused');
    });

    expect(useDeckStore.getState().decks['A'].playbackState).toBe('paused');
  });

  it('does NOT call engine.pause() a second time when an unrelated store change occurs while paused', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    act(() => {
      useDeckStore.getState().setPlaybackState('A', 'paused');
    });

    mockEngineInstances[0]!.pause.mockClear();

    // Unrelated state change — should NOT re-trigger pause
    act(() => {
      useDeckStore.getState().setVolume('A', 30);
    });

    expect(mockEngineInstances[0]!.pause).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('MP3-003 — source type guard: youtube decks do not call engine transport', () => {
  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT call engine.play() when playbackState changes to playing and sourceType is youtube', async () => {
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      useDeckStore.getState().loadTrack('A', 'yt-video-id', {
        sourceType: 'youtube',
        title: 'YouTube Track',
        artist: 'Artist',
        duration: 180,
        thumbnailUrl: null,
      });
      await Promise.resolve();
    });

    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    expect(mockEngineInstances[0]!.play).not.toHaveBeenCalled();
  });

  it('does NOT call engine.pause() when playbackState changes to paused and sourceType is youtube', async () => {
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      useDeckStore.getState().loadTrack('A', 'yt-video-id', {
        sourceType: 'youtube',
        title: 'YouTube Track',
        artist: 'Artist',
        duration: 180,
        thumbnailUrl: null,
      });
      await Promise.resolve();
    });

    act(() => {
      useDeckStore.getState().setPlaybackState('A', 'paused');
    });

    expect(mockEngineInstances[0]!.pause).not.toHaveBeenCalled();
  });

  it('does NOT call engine.seekTo() when seekTo is invoked and sourceType is youtube', async () => {
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      useDeckStore.getState().loadTrack('A', 'yt-video-id', {
        sourceType: 'youtube',
        title: 'YouTube Track',
        artist: 'Artist',
        duration: 180,
        thumbnailUrl: null,
      });
      await Promise.resolve();
    });

    // Simulate a seek action via store currentTime write from external caller
    act(() => {
      useDeckStore.getState().setCurrentTime('A', 60);
    });

    expect(mockEngineInstances[0]!.seekTo).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('MP3-003 — pre-load guard: no engine calls before track is loaded', () => {
  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT call engine.play() when playbackState changes to playing before any track is loaded', async () => {
    renderHook(() => useAudioEngine('A'));
    // No track loaded — deck is in unstarted state with sourceType null

    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    expect(mockEngineInstances[0]!.play).not.toHaveBeenCalled();
  });

  it('does NOT call engine.pause() when playbackState changes to paused before any track is loaded', async () => {
    renderHook(() => useAudioEngine('A'));

    act(() => {
      useDeckStore.getState().setPlaybackState('A', 'paused');
    });

    expect(mockEngineInstances[0]!.pause).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('MP3-003 — unmount cleanup: transport actions do not call engine after unmount', () => {
  const fakeFile = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });

  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
    mockDecodeAudioFile.mockResolvedValue(fakeAudioBuffer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT call engine.play() after the hook is unmounted', async () => {
    const { unmount } = renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    unmount();
    mockEngineInstances[0]!.play.mockClear();

    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    expect(mockEngineInstances[0]!.play).not.toHaveBeenCalled();
  });

  it('does NOT call engine.pause() after the hook is unmounted', async () => {
    const { unmount } = renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    // Start playing first
    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    unmount();
    mockEngineInstances[0]!.pause.mockClear();

    act(() => {
      useDeckStore.getState().setPlaybackState('A', 'paused');
    });

    expect(mockEngineInstances[0]!.pause).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('MP3-003 — seek boundary clamping', () => {
  const fakeFile = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });

  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
    // Override fakeAudioBuffer to have duration 200 for clamping tests
    mockDecodeAudioFile.mockResolvedValue({
      ...fakeAudioBuffer,
      duration: 200,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('clamps a negative seekTo value to 0 before calling engine.seekTo', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    // The hook subscribes to playbackState. To test seek clamping the hook
    // must expose a way to handle seeks — either via deckStore or playerRegistry.
    // The spec (AC7) routes seeks via playerRegistry.get(deckId).seekTo().
    // We retrieve the registered engine and call seekTo directly to simulate
    // DeckControls issuing a clamped seek.
    //
    // The clamping contract: useAudioEngine wraps engine.seekTo calls so that
    // negative values are clamped to 0 before being forwarded to the engine.
    // This is tested by triggering the hook's seekTo pathway with -5.
    act(() => {
      // Simulate a seek command that the hook should clamp
      useDeckStore.getState().setCurrentTime('A', -5);
    });

    // The hook must call engine.seekTo(0) when it receives a negative seek
    expect(mockEngineInstances[0]!.seekTo).toHaveBeenCalledWith(0);
  });

  it('clamps a seekTo value beyond duration to the track duration', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    // Duration is 200 from fakeAudioBuffer. Seeking to 999 should clamp to 200.
    act(() => {
      useDeckStore.getState().setCurrentTime('A', 999);
    });

    expect(mockEngineInstances[0]!.seekTo).toHaveBeenCalledWith(200);
  });
});

// ---------------------------------------------------------------------------

describe('MP3-003 — currentTime poll: updates from engine while playing', () => {
  const fakeFile = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });

  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
    mockDecodeAudioFile.mockResolvedValue(fakeAudioBuffer);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('polls engine.getCurrentTime() every 250ms while playbackState is playing', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    mockEngineInstances[0]!.getCurrentTime
      .mockReturnValueOnce(1.0)
      .mockReturnValueOnce(1.25)
      .mockReturnValueOnce(1.5);

    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    act(() => { vi.advanceTimersByTime(250); });
    const timeAfterFirst = useDeckStore.getState().decks['A'].currentTime;

    act(() => { vi.advanceTimersByTime(250); });
    const timeAfterSecond = useDeckStore.getState().decks['A'].currentTime;

    // currentTime should advance with each poll tick
    expect(timeAfterSecond).toBeGreaterThan(timeAfterFirst);
  });

  it('writes engine.getCurrentTime() value to deckStore.currentTime on each poll tick', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    mockEngineInstances[0]!.getCurrentTime.mockReturnValue(42.5);

    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    act(() => { vi.advanceTimersByTime(250); });

    expect(useDeckStore.getState().decks['A'].currentTime).toBe(42.5);
  });

  it('does NOT advance currentTime poll while playbackState is paused', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    act(() => {
      useDeckStore.getState().setPlaybackState('A', 'paused');
    });

    const timeBeforeTick = useDeckStore.getState().decks['A'].currentTime;

    act(() => { vi.advanceTimersByTime(750); });

    expect(useDeckStore.getState().decks['A'].currentTime).toBe(timeBeforeTick);
  });

  it('stops polling after playbackState transitions from playing to paused', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    mockEngineInstances[0]!.getCurrentTime.mockReturnValue(10.0);

    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    // Advance once to confirm poll is running
    act(() => { vi.advanceTimersByTime(250); });
    expect(useDeckStore.getState().decks['A'].currentTime).toBe(10.0);

    // Now pause and change mock so we can detect if poll fires
    act(() => {
      useDeckStore.getState().setPlaybackState('A', 'paused');
    });

    mockEngineInstances[0]!.getCurrentTime.mockReturnValue(99.0);

    act(() => { vi.advanceTimersByTime(750); });

    // Poll must have stopped — currentTime should still be 10.0, not 99.0
    expect(useDeckStore.getState().decks['A'].currentTime).toBe(10.0);
  });
});

// ---------------------------------------------------------------------------

describe('MP3-003 — loop enforcement in poll', () => {
  const fakeFile = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });

  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
    mockDecodeAudioFile.mockResolvedValue(fakeAudioBuffer);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('calls engine.seekTo(loopStart) when currentTime reaches loopEnd during poll', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    // Activate a loop: 10s to 20s
    act(() => {
      useDeckStore.getState().activateLoop('A', 10, 20);
    });

    // Engine reports time AT the loop boundary
    mockEngineInstances[0]!.getCurrentTime.mockReturnValue(20.0);

    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    act(() => { vi.advanceTimersByTime(250); });

    expect(mockEngineInstances[0]!.seekTo).toHaveBeenCalledWith(10);
  });

  it('calls engine.seekTo(loopStart) when currentTime is past loopEnd during poll', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    act(() => {
      useDeckStore.getState().activateLoop('A', 10, 20);
    });

    // Engine reports time PAST the loop boundary
    mockEngineInstances[0]!.getCurrentTime.mockReturnValue(21.5);

    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    act(() => { vi.advanceTimersByTime(250); });

    expect(mockEngineInstances[0]!.seekTo).toHaveBeenCalledWith(10);
  });

  it('does NOT call engine.seekTo when loopActive is false even if currentTime exceeds loopEnd', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    // Loop explicitly inactive
    act(() => {
      useDeckStore.getState().deactivateLoop('A');
    });

    mockEngineInstances[0]!.getCurrentTime.mockReturnValue(50.0);

    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    act(() => { vi.advanceTimersByTime(250); });

    expect(mockEngineInstances[0]!.seekTo).not.toHaveBeenCalled();
  });

  it('does NOT call engine.seekTo during poll when currentTime is before loopEnd', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    act(() => {
      useDeckStore.getState().activateLoop('A', 10, 20);
    });

    // Time is well within the loop range — no seek needed
    mockEngineInstances[0]!.getCurrentTime.mockReturnValue(15.0);

    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    act(() => { vi.advanceTimersByTime(250); });

    expect(mockEngineInstances[0]!.seekTo).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('MP3-003 — slip tracking in poll', () => {
  const fakeFile = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });

  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
    mockDecodeAudioFile.mockResolvedValue(fakeAudioBuffer);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('calls deckStore.updateSlipPosition during poll when slipMode is active with a loop', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    // Set up slip tracking: enable slip mode, activate loop, start tracking
    act(() => {
      useDeckStore.getState().setSlipMode('A', true);
      useDeckStore.getState().activateLoop('A', 5, 15);
      useDeckStore.getState().startSlipTracking('A');
    });

    mockEngineInstances[0]!.getCurrentTime.mockReturnValue(7.0);

    const updateSlipPositionSpy = vi.spyOn(useDeckStore.getState(), 'updateSlipPosition');

    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    act(() => { vi.advanceTimersByTime(250); });

    expect(updateSlipPositionSpy).toHaveBeenCalledWith('A');
  });

  it('does NOT call updateSlipPosition in poll when slipMode is false', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    // slip mode is off by default
    act(() => {
      useDeckStore.getState().activateLoop('A', 5, 15);
    });

    mockEngineInstances[0]!.getCurrentTime.mockReturnValue(7.0);

    const updateSlipPositionSpy = vi.spyOn(useDeckStore.getState(), 'updateSlipPosition');

    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    act(() => { vi.advanceTimersByTime(250); });

    expect(updateSlipPositionSpy).not.toHaveBeenCalled();
  });

  it('does NOT call updateSlipPosition in poll when slipStartTime is null', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3TrackAndWait('A', fakeFile);

    // slip mode on but startSlipTracking never called — slipStartTime remains null
    act(() => {
      useDeckStore.getState().setSlipMode('A', true);
      useDeckStore.getState().activateLoop('A', 5, 15);
    });

    mockEngineInstances[0]!.getCurrentTime.mockReturnValue(7.0);

    const updateSlipPositionSpy = vi.spyOn(useDeckStore.getState(), 'updateSlipPosition');

    await act(async () => {
      useDeckStore.getState().setPlaybackState('A', 'playing');
      await Promise.resolve();
    });

    act(() => { vi.advanceTimersByTime(250); });

    expect(updateSlipPositionSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('MP3-003 — deck isolation: deck B transport does not affect deck A engine', () => {
  const fakeFile = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });

  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
    mockDecodeAudioFile.mockResolvedValue(fakeAudioBuffer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('playing deck B does not call play on deck A engine', async () => {
    // Mount hook for deck A only
    renderHook(() => useAudioEngine('A'));

    // Load track into deck B (different deck)
    const entryB = {
      id: 'entry-b',
      sourceType: 'mp3' as const,
      title: 'Track B',
      artist: 'Local File',
      duration: 120,
      thumbnailUrl: null,
      file: fakeFile,
    };
    await act(async () => {
      usePlaylistStore.setState({
        playlists: { ...usePlaylistStore.getState().playlists, B: [entryB] },
        currentIndex: { ...usePlaylistStore.getState().currentIndex, B: 0 },
      });
      useDeckStore.getState().loadTrack('B', entryB.id, {
        sourceType: 'mp3', title: entryB.title, artist: entryB.artist, duration: entryB.duration, thumbnailUrl: null,
      });
      await Promise.resolve();
    });

    mockEngineInstances[0]!.play.mockClear();

    await act(async () => {
      useDeckStore.getState().setPlaybackState('B', 'playing');
      await Promise.resolve();
    });

    // Deck A engine must not be called
    expect(mockEngineInstances[0]!.play).not.toHaveBeenCalled();
  });
});
