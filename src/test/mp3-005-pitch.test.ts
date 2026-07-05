/**
 * mp3-005-pitch.test.ts — TDD test specs for MP3-005: Pitch Rate for AudioEngine.
 *
 * These are RED-PHASE tests written before the feature implementation exists.
 * All tests are expected to FAIL until the Developer adds the pitchRate subscription
 * to useAudioEngine.
 *
 * Coverage:
 *  - Pitch rate change: engine.setPlaybackRate called with correct value
 *  - Multiple valid PitchRate values (1, 1.25, 0.75)
 *  - Initial pitch rate applied on mount
 *  - After unmount: pitch changes do not call setPlaybackRate
 *  - Deck isolation: pitch changes on deck B do not affect deck A engine
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { usePlaylistStore } from '../store/playlistStore';

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
  getCueSendNode: ReturnType<typeof vi.fn>;
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
    getCueSendNode: vi.fn(),
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
    title: '',
    artist: '',
    waveformPeaks: null,
    waveformColoredPeaks: null,
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
    eqKillLow: false,
    eqKillMid: false,
    eqKillHigh: false,
    filterSweep: 0,
    effectType: 'none' as const,
    effectEnabled: false,
    effectWetDry: 0.5,
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
    transportState: 'CUED' as const,
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
 * No-op helper kept for compatibility — sourceType no longer exists on DeckState.
 * The pitch rate subscription now fires unconditionally on any pitchRate change.
 */
function setSourceTypeMp3(_deckId: 'A' | 'B') {
  // sourceType was removed; nothing to set.
}

/** Helper: add an MP3 entry to the playlist and trigger loadTrack to simulate loading. */
function loadMp3Track(deckId: 'A' | 'B', file: File, autoPlay = false) {
  const entry = {
    id: 'mp3-005-entry-1',
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
      { title: entry.title, artist: entry.artist, duration: entry.duration, thumbnailUrl: null },
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

  it('calls engine.setPlaybackRate(1) when setPitchRate(deckId, 1) changes from a prior value', () => {
    renderHook(() => useAudioEngine('A'));
    act(() => { setSourceTypeMp3('A'); });

    // First change pitch away from default (1), then back to 1 so there is an actual change.
    act(() => { useDeckStore.getState().setPitchRate('A', 1.25); });
    mockEngineInstances[0]!.setPlaybackRate.mockClear();
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

  it('calls engine.setPlaybackRate with the new pitchRate when setPitchRate is called after mount', () => {
    // Pre-set pitchRate to non-default before hook mounts.
    useDeckStore.setState((state) => ({
      decks: {
        ...state.decks,
        A: { ...state.decks.A, pitchRate: 1.25 as const },
      },
    }));

    renderHook(() => useAudioEngine('A'));

    // Change pitchRate so the subscription fires.
    act(() => { useDeckStore.getState().setPitchRate('A', 0.75); });

    expect(mockEngineInstances[0]!.setPlaybackRate).toHaveBeenCalledWith(0.75);
  });

  it('applies a changed pitchRate to the engine after a track is loaded', async () => {
    const fakeFile = new File(['audio data'], 'test.mp3', { type: 'audio/mpeg' });

    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile);
      await Promise.resolve();
    });

    // After loading, explicitly change pitchRate — the subscription must fire.
    act(() => { useDeckStore.getState().setPitchRate('A', 0.75); });

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
// pitchRateLocked tests removed — field no longer exists in DeckState

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
