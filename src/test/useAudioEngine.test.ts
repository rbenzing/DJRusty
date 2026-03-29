/**
 * useAudioEngine.test.ts — TDD test specs for MP3-002: useAudioEngine hook.
 *
 * These are RED-PHASE tests written before the hook implementation exists.
 * All tests are expected to FAIL until the Developer implements the hook.
 *
 * Coverage:
 *  - Lifecycle: engine creation, playerRegistry registration, destroy on unmount
 *  - Source-type guard: no-op when sourceType === 'youtube'
 *  - Track loading: decodeAudioFile called, loadBuffer called, setDecoding lifecycle
 *  - setPlayerReady after buffer load
 *  - autoPlayOnLoad: engine.play() called, playbackState set, flag cleared
 *  - Decode error: setError called, setDecoding(false) called
 *  - onEnded: playbackState set to 'ended', skipToNext called when tracks remain
 *  - Contract: hook accepts 'A' | 'B', returns void
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { usePlaylistStore } from '../store/playlistStore';
import { playerRegistry } from '../services/playerRegistry';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before imports of the hook under test
// ---------------------------------------------------------------------------

// Mock AudioEngineImpl. Capture instances so tests can inspect calls.
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
  // Expose the registered onEnded callback so tests can fire it.
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

// Mock playerRegistry — spy on register and unregister.
vi.mock('../services/playerRegistry', () => ({
  playerRegistry: {
    register: vi.fn(),
    unregister: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock audioDecoder — decodeAudioFile returns a fake AudioBuffer.
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
// Late import: hook must be imported AFTER vi.mock() declarations.
// ---------------------------------------------------------------------------

// NOTE: The hook does not exist yet. This import will fail in the RED phase.
// That is expected behaviour for TDD.
import { useAudioEngine } from '../hooks/useAudioEngine';

// ---------------------------------------------------------------------------
// Store reset helper — mirrors the pattern used in stores.test.ts
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

/** Helper: add an MP3 entry to the playlist and set deck trackId to trigger the hook subscription. */
function loadMp3Track(deckId: 'A' | 'B', file: File, autoPlay = false) {
  const entry = {
    id: 'test-entry-1',
    sourceType: 'mp3' as const,
    title: 'Test Track',
    artist: 'Local File',
    duration: 240,
    thumbnailUrl: null,
    file,
  };
  usePlaylistStore.setState({
    playlists: { ...usePlaylistStore.getState().playlists, [deckId]: [entry] },
    currentIndex: { ...usePlaylistStore.getState().currentIndex, [deckId]: 0 },
  });
  act(() => {
    useDeckStore.getState().loadTrack(
      deckId,
      entry.id,
      { sourceType: 'mp3', title: entry.title, artist: entry.artist, duration: entry.duration, thumbnailUrl: null },
      autoPlay,
    );
  });
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('useAudioEngine — contract', () => {
  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
  });

  it('accepts deckId A and returns void', () => {
    const { result } = renderHook(() => useAudioEngine('A'));
    expect(result.current).toBeUndefined();
  });

  it('accepts deckId B and returns void', () => {
    const { result } = renderHook(() => useAudioEngine('B'));
    expect(result.current).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe('useAudioEngine — lifecycle: mount', () => {
  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates an AudioEngineImpl instance on mount', () => {
    renderHook(() => useAudioEngine('A'));
    expect(mockEngineInstances).toHaveLength(1);
  });

  it('registers the engine in playerRegistry with the correct deckId on mount', () => {
    renderHook(() => useAudioEngine('A'));
    expect(playerRegistry.register).toHaveBeenCalledWith('A', mockEngineInstances[0]);
  });

  it('registers with deckId B when called with B', () => {
    renderHook(() => useAudioEngine('B'));
    expect(playerRegistry.register).toHaveBeenCalledWith('B', mockEngineInstances[0]);
  });

  it('registers exactly once on mount (no double registration)', () => {
    renderHook(() => useAudioEngine('A'));
    expect(playerRegistry.register).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------

describe('useAudioEngine — lifecycle: unmount', () => {
  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls engine.destroy() on unmount', () => {
    const { unmount } = renderHook(() => useAudioEngine('A'));
    unmount();
    expect(mockEngineInstances[0]!.destroy).toHaveBeenCalledOnce();
  });

  it('unregisters from playerRegistry on unmount with the correct deckId', () => {
    const { unmount } = renderHook(() => useAudioEngine('A'));
    unmount();
    expect(playerRegistry.unregister).toHaveBeenCalledWith('A');
  });

  it('unregisters deck B from playerRegistry on unmount', () => {
    const { unmount } = renderHook(() => useAudioEngine('B'));
    unmount();
    expect(playerRegistry.unregister).toHaveBeenCalledWith('B');
  });

  it('does not call destroy before unmount', () => {
    renderHook(() => useAudioEngine('A'));
    expect(mockEngineInstances[0]!.destroy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('useAudioEngine — source type guard: youtube', () => {
  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT call decodeAudioFile when sourceType is youtube', async () => {
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      useDeckStore.getState().loadTrack('A', 'yt-video-id', {
        sourceType: 'youtube',
        title: 'YouTube Track',
        artist: 'Artist',
        duration: 180,
        thumbnailUrl: null,
      });
    });

    expect(mockDecodeAudioFile).not.toHaveBeenCalled();
  });

  it('does NOT call engine.loadBuffer when sourceType is youtube', async () => {
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      useDeckStore.getState().loadTrack('A', 'yt-video-id', {
        sourceType: 'youtube',
        title: 'YouTube Track',
        artist: 'Artist',
        duration: 180,
        thumbnailUrl: null,
      });
    });

    expect(mockEngineInstances[0]!.loadBuffer).not.toHaveBeenCalled();
  });

  it('does NOT call setDecoding when sourceType is youtube', async () => {
    renderHook(() => useAudioEngine('A'));
    const setDecodingSpy = vi.spyOn(useDeckStore.getState(), 'setDecoding');

    await act(async () => {
      useDeckStore.getState().loadTrack('A', 'yt-video-id', {
        sourceType: 'youtube',
        title: 'YouTube Track',
        artist: 'Artist',
        duration: 180,
        thumbnailUrl: null,
      });
    });

    expect(setDecodingSpy).not.toHaveBeenCalledWith('A', true);
  });
});

// ---------------------------------------------------------------------------

describe('useAudioEngine — track loading: mp3', () => {
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

  it('calls decodeAudioFile with the File from the playlist entry', async () => {
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile);
      // Allow microtask queue to flush so the async decode resolves.
      await Promise.resolve();
    });

    expect(mockDecodeAudioFile).toHaveBeenCalledWith(fakeFile);
  });

  it('calls engine.loadBuffer with the decoded AudioBuffer', async () => {
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile);
      await Promise.resolve();
    });

    expect(mockEngineInstances[0]!.loadBuffer).toHaveBeenCalledWith(fakeAudioBuffer);
  });

  it('calls setDecoding(deckId, true) before decode starts', async () => {
    // Capture the sequence of setDecoding calls via a spy.
    const calls: [string, boolean][] = [];
    const origSetDecoding = useDeckStore.getState().setDecoding;
    vi.spyOn(useDeckStore.getState(), 'setDecoding').mockImplementation((id, val) => {
      calls.push([id, val]);
      origSetDecoding(id, val);
    });

    // Make decode wait so we can check the flag is true before it resolves.
    let resolveDecodePromise!: (buf: AudioBuffer) => void;
    mockDecodeAudioFile.mockReturnValue(
      new Promise<AudioBuffer>((resolve) => { resolveDecodePromise = resolve; }),
    );

    renderHook(() => useAudioEngine('A'));

    act(() => { loadMp3Track('A', fakeFile); });

    // At this point decode is in-flight; setDecoding(true) must have been called.
    const trueCallIndex = calls.findIndex(([id, val]) => id === 'A' && val === true);
    expect(trueCallIndex).toBeGreaterThanOrEqual(0);

    // Resolve and clean up.
    await act(async () => {
      resolveDecodePromise(fakeAudioBuffer);
      await Promise.resolve();
    });
  });

  it('calls setDecoding(deckId, false) after decode completes', async () => {
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile);
      await Promise.resolve();
    });

    expect(useDeckStore.getState().decks['A'].decoding).toBe(false);
  });

  it('calls setPlayerReady(deckId, true) after buffer is loaded', async () => {
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile);
      await Promise.resolve();
    });

    expect(useDeckStore.getState().decks['A'].playerReady).toBe(true);
  });

  it('sets currentTime to 0 after buffer is loaded', async () => {
    // Prime currentTime to non-zero to verify it resets.
    act(() => { useDeckStore.getState().setCurrentTime('A', 99); });

    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile);
      await Promise.resolve();
    });

    expect(useDeckStore.getState().decks['A'].currentTime).toBe(0);
  });

  it('does NOT react to a trackId change for the other deck', async () => {
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('B', fakeFile);
      await Promise.resolve();
    });

    // Hook for deck A should not have called decode.
    expect(mockDecodeAudioFile).not.toHaveBeenCalled();
    expect(mockEngineInstances[0]!.loadBuffer).not.toHaveBeenCalled();
  });

  it('does NOT call decodeAudioFile when trackId changes but playlist entry has no file', async () => {
    renderHook(() => useAudioEngine('A'));

    // Set up a playlist entry with no file field.
    const entryWithoutFile = {
      id: 'no-file-entry',
      sourceType: 'mp3' as const,
      title: 'No File',
      artist: 'Local File',
      duration: 0,
      thumbnailUrl: null,
      // file is intentionally absent
    };
    usePlaylistStore.setState({
      playlists: { ...usePlaylistStore.getState().playlists, A: [entryWithoutFile] },
      currentIndex: { ...usePlaylistStore.getState().currentIndex, A: 0 },
    });

    await act(async () => {
      useDeckStore.getState().loadTrack('A', 'no-file-entry', {
        sourceType: 'mp3', title: 'No File', artist: 'Local File', duration: 0, thumbnailUrl: null,
      });
      await Promise.resolve();
    });

    expect(mockDecodeAudioFile).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('useAudioEngine — track loading: autoPlayOnLoad', () => {
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

  it('calls engine.play() when autoPlayOnLoad is true after decode', async () => {
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile, /* autoPlay= */ true);
      await Promise.resolve();
    });

    expect(mockEngineInstances[0]!.play).toHaveBeenCalledOnce();
  });

  it('sets playbackState to playing when autoPlayOnLoad is true after decode', async () => {
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile, /* autoPlay= */ true);
      await Promise.resolve();
    });

    expect(useDeckStore.getState().decks['A'].playbackState).toBe('playing');
  });

  it('clears autoPlayOnLoad flag after auto-playing', async () => {
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile, /* autoPlay= */ true);
      await Promise.resolve();
    });

    expect(useDeckStore.getState().decks['A'].autoPlayOnLoad).toBe(false);
  });

  it('does NOT call engine.play() when autoPlayOnLoad is false', async () => {
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile, /* autoPlay= */ false);
      await Promise.resolve();
    });

    expect(mockEngineInstances[0]!.play).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('useAudioEngine — track loading: decode error', () => {
  const fakeFile = new File(['bad data'], 'corrupt.mp3', { type: 'audio/mpeg' });

  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls setError with an error message when decodeAudioFile rejects', async () => {
    mockDecodeAudioFile.mockRejectedValue(new Error('Corrupt audio file'));

    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile);
      await Promise.resolve();
    });

    const error = useDeckStore.getState().decks['A'].error;
    expect(error).not.toBeNull();
    expect(typeof error).toBe('string');
    expect((error as string).length).toBeGreaterThan(0);
  });

  it('sets decoding to false after a decode error', async () => {
    mockDecodeAudioFile.mockRejectedValue(new Error('Corrupt audio file'));

    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile);
      await Promise.resolve();
    });

    expect(useDeckStore.getState().decks['A'].decoding).toBe(false);
  });

  it('does NOT call engine.loadBuffer when decode fails', async () => {
    mockDecodeAudioFile.mockRejectedValue(new Error('Corrupt audio file'));

    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile);
      await Promise.resolve();
    });

    expect(mockEngineInstances[0]!.loadBuffer).not.toHaveBeenCalled();
  });

  it('does NOT call setPlayerReady when decode fails', async () => {
    mockDecodeAudioFile.mockRejectedValue(new Error('Corrupt audio file'));

    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile);
      await Promise.resolve();
    });

    expect(useDeckStore.getState().decks['A'].playerReady).toBe(false);
  });

  it('includes error message text from the thrown Error in the setError call', async () => {
    mockDecodeAudioFile.mockRejectedValue(new Error('Unsupported format'));

    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile);
      await Promise.resolve();
    });

    const error = useDeckStore.getState().decks['A'].error ?? '';
    expect(error).toContain('Unsupported format');
  });
});

// ---------------------------------------------------------------------------

describe('useAudioEngine — onEnded callback: playlist auto-advance', () => {
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

  it('registers an onEnded callback on the engine instance at mount', () => {
    renderHook(() => useAudioEngine('A'));
    expect(mockEngineInstances[0]!.onEnded).toHaveBeenCalledOnce();
  });

  it('sets playbackState to ended when the engine fires onEnded', async () => {
    renderHook(() => useAudioEngine('A'));

    // Load a track so the engine is active.
    await act(async () => {
      loadMp3Track('A', fakeFile);
      await Promise.resolve();
    });

    // Fire the onEnded callback (simulates track finishing naturally).
    act(() => {
      mockEngineInstances[0]!._endedCallback?.();
    });

    expect(useDeckStore.getState().decks['A'].playbackState).toBe('ended');
  });

  it('calls playlistStore.skipToNext when more tracks exist in the playlist', async () => {
    renderHook(() => useAudioEngine('A'));

    // Set up two tracks in the playlist so skipToNext has somewhere to go.
    const entry1 = { id: 'e1', sourceType: 'mp3' as const, title: 'Track 1', artist: 'Local File', duration: 120, thumbnailUrl: null, file: fakeFile };
    const entry2 = { id: 'e2', sourceType: 'mp3' as const, title: 'Track 2', artist: 'Local File', duration: 180, thumbnailUrl: null, file: fakeFile };
    usePlaylistStore.setState({
      playlists: { ...usePlaylistStore.getState().playlists, A: [entry1, entry2] },
      currentIndex: { ...usePlaylistStore.getState().currentIndex, A: 0 },
    });

    const skipToNextSpy = vi.spyOn(usePlaylistStore.getState(), 'skipToNext');

    // Fire the onEnded callback.
    act(() => {
      mockEngineInstances[0]!._endedCallback?.();
    });

    expect(skipToNextSpy).toHaveBeenCalledWith('A');
  });

  it('does NOT call playlistStore.skipToNext when already at the last track', async () => {
    renderHook(() => useAudioEngine('A'));

    // Single track playlist — already at the end.
    const entry = { id: 'e1', sourceType: 'mp3' as const, title: 'Track 1', artist: 'Local File', duration: 120, thumbnailUrl: null, file: fakeFile };
    usePlaylistStore.setState({
      playlists: { ...usePlaylistStore.getState().playlists, A: [entry] },
      currentIndex: { ...usePlaylistStore.getState().currentIndex, A: 0 },
    });

    const skipToNextSpy = vi.spyOn(usePlaylistStore.getState(), 'skipToNext');

    act(() => {
      mockEngineInstances[0]!._endedCallback?.();
    });

    expect(skipToNextSpy).not.toHaveBeenCalled();
  });

  it('does NOT call skipToNext when playlist is empty', async () => {
    renderHook(() => useAudioEngine('A'));
    // Playlist is already empty from resetStores.

    const skipToNextSpy = vi.spyOn(usePlaylistStore.getState(), 'skipToNext');

    act(() => {
      mockEngineInstances[0]!._endedCallback?.();
    });

    expect(skipToNextSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('useAudioEngine — trackId subscription does not fire on unrelated state changes', () => {
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

  it('does NOT call decodeAudioFile again when same trackId is set twice', async () => {
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile);
      await Promise.resolve();
    });

    const callCountAfterFirst = mockDecodeAudioFile.mock.calls.length;

    // Set the same trackId again — should be a no-op.
    await act(async () => {
      useDeckStore.getState().loadTrack('A', 'test-entry-1', {
        sourceType: 'mp3', title: 'Test Track', artist: 'Local File', duration: 240, thumbnailUrl: null,
      });
      await Promise.resolve();
    });

    expect(mockDecodeAudioFile.mock.calls.length).toBe(callCountAfterFirst);
  });

  it('does NOT call decodeAudioFile when volume changes', async () => {
    renderHook(() => useAudioEngine('A'));

    act(() => { useDeckStore.getState().setVolume('A', 50); });

    expect(mockDecodeAudioFile).not.toHaveBeenCalled();
  });

  it('does NOT call decodeAudioFile when playbackState changes', async () => {
    renderHook(() => useAudioEngine('A'));

    act(() => { useDeckStore.getState().setPlaybackState('A', 'playing'); });

    expect(mockDecodeAudioFile).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('useAudioEngine — deck isolation', () => {
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

  it('creates separate engine instances for deck A and deck B', () => {
    renderHook(() => useAudioEngine('A'));
    renderHook(() => useAudioEngine('B'));
    expect(mockEngineInstances).toHaveLength(2);
    expect(mockEngineInstances[0]).not.toBe(mockEngineInstances[1]!);
  });

  it('registers separate players for deck A and deck B', () => {
    renderHook(() => useAudioEngine('A'));
    renderHook(() => useAudioEngine('B'));
    expect(playerRegistry.register).toHaveBeenCalledWith('A', mockEngineInstances[0]);
    expect(playerRegistry.register).toHaveBeenCalledWith('B', mockEngineInstances[1]!);
  });

  it('does not decode deck A track when deck B trackId changes', async () => {
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('B', fakeFile);
      await Promise.resolve();
    });

    expect(mockDecodeAudioFile).not.toHaveBeenCalled();
    expect(mockEngineInstances[0]!.loadBuffer).not.toHaveBeenCalled();
  });

  it('unmounting deck A engine does not unregister deck B', () => {
    const { unmount: unmountA } = renderHook(() => useAudioEngine('A'));
    renderHook(() => useAudioEngine('B'));

    unmountA();

    expect(playerRegistry.unregister).toHaveBeenCalledWith('A');
    expect(playerRegistry.unregister).not.toHaveBeenCalledWith('B');
  });
});
