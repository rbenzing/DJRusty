/**
 * mp3-005-pitch.test.ts — TDD test specs for MP3-005: Pitch Rate for AudioEngine.
 *
 * These are RED-PHASE tests written before the feature implementation exists.
 * All tests are expected to FAIL until the Developer adds the pitchRate subscription
 * to useAudioEngine.
 *
 * Coverage:
 *  - Pitch rate change: engine.setPlaybackRate called with correct value (mp3)
 *  - Multiple valid PitchRate values (1, 1.25, 0.75)
 *  - Source-type guard: setPlaybackRate NOT called when sourceType is 'youtube'
 *  - Initial pitch rate applied on mount when sourceType is 'mp3'
 *  - After unmount: pitch changes do not call setPlaybackRate
 *  - pitchRateLocked is set to false after an MP3 track load
 *  - Deck isolation: pitch changes on deck B do not affect deck A engine
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { usePlaylistStore } from '../store/playlistStore';
import { playerRegistry } from '../services/playerRegistry';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before the hook import
// ---------------------------------------------------------------------------

// Mock AudioEngineImpl — capture instances so tests can inspect calls.
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

// Mock playerRegistry.
vi.mock('../services/playerRegistry', () => ({
  playerRegistry: {
    register: vi.fn(),
    unregister: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock audioDecoder — decodeAudioFile returns a fake AudioBuffer.
const fakeAudioBuffer: AudioBuffer = {
  duration: 180,
  length: 180 * 44100,
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
// Late import — hook must be imported AFTER vi.mock() declarations.
// ---------------------------------------------------------------------------

import { useAudioEngine } from '../hooks/useAudioEngine';

// ---------------------------------------------------------------------------
// Store reset helpers
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

/**
 * Set sourceType to 'mp3' on a deck without triggering a trackId change.
 * Used to prime the source-type guard tests before calling setPitchRate.
 */
function setSourceTypeMp3(deckId: 'A' | 'B') {
  useDeckStore.setState((state) => ({
    decks: {
      ...state.decks,
      [deckId]: { ...state.decks[deckId], sourceType: 'mp3' as const },
    },
  }));
}

/**
 * Set sourceType to 'youtube' on a deck without triggering a trackId change.
 */
function setSourceTypeYoutube(deckId: 'A' | 'B') {
  useDeckStore.setState((state) => ({
    decks: {
      ...state.decks,
      [deckId]: { ...state.decks[deckId], sourceType: 'youtube' as const },
    },
  }));
}

/** Helper: add an MP3 entry to the playlist and trigger loadTrack to simulate loading. */
function loadMp3Track(deckId: 'A' | 'B', file: File, autoPlay = false) {
  const entry = {
    id: 'mp3-005-entry-1',
    sourceType: 'mp3' as const,
    title: 'Pitch Test Track',
    artist: 'Local File',
    duration: 180,
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

describe('MP3-005: pitchRate subscription — calls setPlaybackRate on mp3', () => {
  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
    mockDecodeAudioFile.mockResolvedValue(fakeAudioBuffer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls engine.setPlaybackRate(1) when setPitchRate(deckId, 1) and sourceType is mp3', () => {
    renderHook(() => useAudioEngine('A'));
    act(() => { setSourceTypeMp3('A'); });

    act(() => { useDeckStore.getState().setPitchRate('A', 1); });

    expect(mockEngineInstances[0]!.setPlaybackRate).toHaveBeenCalledWith(1);
  });

  it('calls engine.setPlaybackRate(1.25) when setPitchRate(deckId, 1.25) and sourceType is mp3', () => {
    renderHook(() => useAudioEngine('A'));
    act(() => { setSourceTypeMp3('A'); });

    act(() => { useDeckStore.getState().setPitchRate('A', 1.25); });

    expect(mockEngineInstances[0]!.setPlaybackRate).toHaveBeenCalledWith(1.25);
  });

  it('calls engine.setPlaybackRate(0.75) when setPitchRate(deckId, 0.75) and sourceType is mp3', () => {
    renderHook(() => useAudioEngine('A'));
    act(() => { setSourceTypeMp3('A'); });

    act(() => { useDeckStore.getState().setPitchRate('A', 0.75); });

    expect(mockEngineInstances[0]!.setPlaybackRate).toHaveBeenCalledWith(0.75);
  });

  it('calls engine.setPlaybackRate with the exact value passed to setPitchRate', () => {
    renderHook(() => useAudioEngine('A'));
    act(() => { setSourceTypeMp3('A'); });

    act(() => { useDeckStore.getState().setPitchRate('A', 0.5); });

    expect(mockEngineInstances[0]!.setPlaybackRate).toHaveBeenCalledWith(0.5);
  });

  it('calls engine.setPlaybackRate(2) when setPitchRate(deckId, 2) and sourceType is mp3', () => {
    renderHook(() => useAudioEngine('A'));
    act(() => { setSourceTypeMp3('A'); });

    act(() => { useDeckStore.getState().setPitchRate('A', 2); });

    expect(mockEngineInstances[0]!.setPlaybackRate).toHaveBeenCalledWith(2);
  });
});

// ---------------------------------------------------------------------------

describe('MP3-005: pitchRate subscription — sourceType guard: youtube', () => {
  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT call engine.setPlaybackRate when sourceType is youtube and pitchRate changes', () => {
    renderHook(() => useAudioEngine('A'));
    act(() => { setSourceTypeYoutube('A'); });

    act(() => { useDeckStore.getState().setPitchRate('A', 1.25); });

    expect(mockEngineInstances[0]!.setPlaybackRate).not.toHaveBeenCalled();
  });

  it('does NOT call engine.setPlaybackRate when sourceType is null (no track loaded)', () => {
    renderHook(() => useAudioEngine('A'));
    // sourceType is null by default from resetStores

    act(() => { useDeckStore.getState().setPitchRate('A', 0.75); });

    expect(mockEngineInstances[0]!.setPlaybackRate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('MP3-005: pitchRate subscription — initial pitch rate applied on mount', () => {
  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
    mockDecodeAudioFile.mockResolvedValue(fakeAudioBuffer);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calls engine.setPlaybackRate with the stored pitchRate when sourceType changes to mp3', () => {
    // Pre-set pitchRate to non-default before hook mounts.
    useDeckStore.setState((state) => ({
      decks: {
        ...state.decks,
        A: { ...state.decks.A, pitchRate: 1.25 as const },
      },
    }));

    renderHook(() => useAudioEngine('A'));

    // Now set sourceType to mp3, which should cause the subscription to apply
    // the stored pitchRate to the engine.
    act(() => { setSourceTypeMp3('A'); });

    expect(mockEngineInstances[0]!.setPlaybackRate).toHaveBeenCalledWith(1.25);
  });

  it('applies stored pitchRate to the engine when a track is loaded with sourceType mp3', async () => {
    const fakeFile = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });

    // Pre-set pitchRate to a non-default value before loading the track.
    useDeckStore.setState((state) => ({
      decks: {
        ...state.decks,
        A: { ...state.decks.A, pitchRate: 0.75 as const },
      },
    }));

    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile);
      await Promise.resolve();
    });

    // After the track is loaded and sourceType becomes 'mp3', the stored
    // pitchRate should have been applied to the engine.
    expect(mockEngineInstances[0]!.setPlaybackRate).toHaveBeenCalledWith(0.75);
  });
});

// ---------------------------------------------------------------------------

describe('MP3-005: pitchRate subscription — after unmount does not call setPlaybackRate', () => {
  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT call engine.setPlaybackRate after the hook unmounts', () => {
    const { unmount } = renderHook(() => useAudioEngine('A'));
    act(() => { setSourceTypeMp3('A'); });

    unmount();

    // After unmount, reset the mock so only post-unmount calls are counted.
    mockEngineInstances[0]!.setPlaybackRate.mockClear();

    act(() => { useDeckStore.getState().setPitchRate('A', 1.25); });

    expect(mockEngineInstances[0]!.setPlaybackRate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('MP3-005: pitchRateLocked set to false after MP3 track load', () => {
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

  it('sets pitchRateLocked to false after an MP3 track buffer is loaded', async () => {
    // Pre-set pitchRateLocked to true to verify it is cleared by the hook.
    useDeckStore.setState((state) => ({
      decks: {
        ...state.decks,
        A: { ...state.decks.A, pitchRateLocked: true },
      },
    }));

    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile);
      await Promise.resolve();
    });

    expect(useDeckStore.getState().decks['A'].pitchRateLocked).toBe(false);
  });

  it('pitchRateLocked remains false when loaded with a fresh deck state', async () => {
    // pitchRateLocked is already false in the initial state.
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile);
      await Promise.resolve();
    });

    expect(useDeckStore.getState().decks['A'].pitchRateLocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('MP3-005: pitchRate subscription — deck isolation', () => {
  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT call deck A engine.setPlaybackRate when pitchRate changes on deck B', () => {
    renderHook(() => useAudioEngine('A'));
    act(() => { setSourceTypeMp3('A'); });
    act(() => { setSourceTypeMp3('B'); });

    // Clear any calls from the mp3 source-type setup on deck A.
    mockEngineInstances[0]!.setPlaybackRate.mockClear();

    // Change pitch on deck B only.
    act(() => { useDeckStore.getState().setPitchRate('B', 1.25); });

    expect(mockEngineInstances[0]!.setPlaybackRate).not.toHaveBeenCalled();
  });

  it('calls deck B engine.setPlaybackRate when pitchRate changes on deck B', () => {
    renderHook(() => useAudioEngine('A'));
    renderHook(() => useAudioEngine('B'));
    act(() => { setSourceTypeMp3('B'); });

    act(() => { useDeckStore.getState().setPitchRate('B', 1.5); });

    // mockEngineInstances[0] is deck A, mockEngineInstances[1] is deck B.
    expect(mockEngineInstances[1]!.setPlaybackRate).toHaveBeenCalledWith(1.5);
  });

  it('deck A engine.setPlaybackRate is not called when only deck B pitch changes', () => {
    renderHook(() => useAudioEngine('A'));
    renderHook(() => useAudioEngine('B'));
    act(() => { setSourceTypeMp3('B'); });

    mockEngineInstances[0]!.setPlaybackRate.mockClear();

    act(() => { useDeckStore.getState().setPitchRate('B', 1.5); });

    expect(mockEngineInstances[0]!.setPlaybackRate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('MP3-005: pitchRate subscription — no call on unrelated state changes', () => {
  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT call engine.setPlaybackRate when volume changes', () => {
    renderHook(() => useAudioEngine('A'));
    act(() => { setSourceTypeMp3('A'); });
    mockEngineInstances[0]!.setPlaybackRate.mockClear();

    act(() => { useDeckStore.getState().setVolume('A', 50); });

    expect(mockEngineInstances[0]!.setPlaybackRate).not.toHaveBeenCalled();
  });

  it('does NOT call engine.setPlaybackRate when playbackState changes', () => {
    renderHook(() => useAudioEngine('A'));
    act(() => { setSourceTypeMp3('A'); });
    mockEngineInstances[0]!.setPlaybackRate.mockClear();

    act(() => { useDeckStore.getState().setPlaybackState('A', 'playing'); });

    expect(mockEngineInstances[0]!.setPlaybackRate).not.toHaveBeenCalled();
  });

  it('does NOT call engine.setPlaybackRate when pitchRate is set to the same value twice', () => {
    renderHook(() => useAudioEngine('A'));
    act(() => { setSourceTypeMp3('A'); });

    // First call — sets pitchRate to 1.25.
    act(() => { useDeckStore.getState().setPitchRate('A', 1.25); });
    mockEngineInstances[0]!.setPlaybackRate.mockClear();

    // Second call with the same value — should not trigger another setPlaybackRate.
    act(() => { useDeckStore.getState().setPitchRate('A', 1.25); });

    expect(mockEngineInstances[0]!.setPlaybackRate).not.toHaveBeenCalled();
  });
});
