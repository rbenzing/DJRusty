/**
 * decode-error.test.ts — Task C4: per-file decode-error handling.
 *
 * Verifies that when decodeAudioFile rejects:
 *  1. The deck does not crash (no thrown error).
 *  2. The matching library track is flagged with a non-empty decodeError string.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { usePlaylistStore } from '../store/playlistStore';
import { useLibraryStore } from '../store/libraryStore';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before imports of the hook under test
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
  setEQKill: ReturnType<typeof vi.fn>;
  setFilterSweep: ReturnType<typeof vi.fn>;
  setEffect: ReturnType<typeof vi.fn>;
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
    setEQKill: vi.fn(),
    setFilterSweep: vi.fn(),
    setEffect: vi.fn(),
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

const mockDecodeAudioFile = vi.fn();

vi.mock('../services/audioDecoder', () => ({
  decodeAudioFile: (...args: unknown[]) => mockDecodeAudioFile(...args),
}));

// Late import — after vi.mock() declarations
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
  useLibraryStore.setState({ tracks: [] });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('decode-error: library track flagging', () => {
  const fakeFile = new File(['bad data'], 'corrupt.mp3', { type: 'audio/mpeg' });

  beforeEach(() => {
    resetStores();
    mockEngineInstances.length = 0;
    vi.clearAllMocks();
    mockDecodeAudioFile.mockRejectedValue(new Error('decode fail'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('flags the library track with a non-empty decodeError when decodeAudioFile rejects', async () => {
    // Add the track to the library store — this is the track that will be loaded onto the deck.
    const trackId = 'lib-track-1';
    useLibraryStore.setState({
      tracks: [
        {
          id: trackId,
          title: 'Corrupt Track',
          artist: 'Local File',
          duration: 0,
          format: 'mp3',
          file: fakeFile,
          audioUrl: 'blob:fake',
        },
      ],
    });

    // Set up playlist entry using the library track id.
    const entry = {
      id: trackId,
      title: 'Corrupt Track',
      artist: 'Local File',
      duration: 0,
      thumbnailUrl: null,
      file: fakeFile,
    };
    usePlaylistStore.setState({
      playlists: { A: [entry], B: [] },
      currentIndex: { A: 0, B: -1 },
    });

    renderHook(() => useAudioEngine('A'));

    // Load the track onto deck A — triggers the hook subscription.
    await act(async () => {
      useDeckStore.getState().loadTrack(
        'A',
        trackId,
        { title: 'Corrupt Track', artist: 'Local File', duration: 0, thumbnailUrl: null },
        false,
      );
      // Flush microtask queue so the async catch block runs.
      await Promise.resolve();
      await Promise.resolve();
    });

    const track = useLibraryStore.getState().tracks.find((t) => t.id === trackId);
    expect(track).toBeDefined();
    expect(track?.decodeError).toBeTruthy();
    expect(typeof track?.decodeError).toBe('string');
    expect((track?.decodeError ?? '').length).toBeGreaterThan(0);
  });

  it('does not crash the deck when decodeAudioFile rejects', async () => {
    const trackId = 'lib-track-2';
    useLibraryStore.setState({
      tracks: [
        {
          id: trackId,
          title: 'Bad Track',
          artist: 'Local File',
          duration: 0,
          format: 'mp3',
          file: fakeFile,
          audioUrl: 'blob:fake2',
        },
      ],
    });

    const entry = {
      id: trackId,
      title: 'Bad Track',
      artist: 'Local File',
      duration: 0,
      thumbnailUrl: null,
      file: fakeFile,
    };
    usePlaylistStore.setState({
      playlists: { A: [entry], B: [] },
      currentIndex: { A: 0, B: -1 },
    });

    // Should not throw.
    let caughtError: unknown = null;
    try {
      renderHook(() => useAudioEngine('A'));

      await act(async () => {
        useDeckStore.getState().loadTrack(
          'A',
          trackId,
          { title: 'Bad Track', artist: 'Local File', duration: 0, thumbnailUrl: null },
          false,
        );
        await Promise.resolve();
        await Promise.resolve();
      });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeNull();
    // Deck should not be in a crashed state — decoding flag cleared.
    expect(useDeckStore.getState().decks['A'].decoding).toBe(false);
    expect(useDeckStore.getState().decks['A'].playerReady).toBe(false);
  });
});
