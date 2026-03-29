/**
 * mp3-008-bpm.test.ts — BPM detection via Web Worker integration in useAudioEngine.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { usePlaylistStore } from '../store/playlistStore';

// ── Worker mock ──────────────────────────────────────────────────────────

type MockWorkerInstance = {
  onmessage: ((e: MessageEvent) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
};
const workerInstances: MockWorkerInstance[] = [];

const MockWorkerClass = vi.fn().mockImplementation(() => {
  const w: MockWorkerInstance = { onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() };
  workerInstances.push(w);
  return w;
});
vi.stubGlobal('Worker', MockWorkerClass);

// ── Engine mock ──────────────────────────────────────────────────────────

type MockEngine = { loadBuffer: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; seekTo: ReturnType<typeof vi.fn>; setVolume: ReturnType<typeof vi.fn>; setEQ: ReturnType<typeof vi.fn>; setPlaybackRate: ReturnType<typeof vi.fn>; onEnded: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; getCurrentTime: ReturnType<typeof vi.fn>; isReady: ReturnType<typeof vi.fn>; isPlaying: ReturnType<typeof vi.fn>; getAnalyser: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; };
const mockEngineInstances: MockEngine[] = [];

vi.mock('../services/audioEngine', () => ({
  AudioEngineImpl: vi.fn().mockImplementation(() => {
    const e: MockEngine = {
      loadBuffer: vi.fn(), play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(),
      seekTo: vi.fn(), setVolume: vi.fn(), setEQ: vi.fn(), setPlaybackRate: vi.fn(),
      stop: vi.fn(), onEnded: vi.fn(), destroy: vi.fn(),
      getCurrentTime: vi.fn().mockReturnValue(0), isReady: vi.fn().mockReturnValue(true),
      isPlaying: vi.fn().mockReturnValue(false), getAnalyser: vi.fn(),
    };
    mockEngineInstances.push(e);
    return e;
  }),
}));
vi.mock('../services/playerRegistry', () => ({ playerRegistry: { register: vi.fn(), unregister: vi.fn(), get: vi.fn() } }));
vi.mock('../utils/extractWaveformPeaks', () => ({ extractWaveformPeaks: vi.fn().mockReturnValue(new Float32Array(0)) }));

const fakeBuffer = { duration: 120, length: 5292000, numberOfChannels: 1, sampleRate: 44100, getChannelData: vi.fn().mockReturnValue(new Float32Array(0)), copyFromChannel: vi.fn(), copyToChannel: vi.fn() } as unknown as AudioBuffer;
const mockDecode = vi.fn().mockResolvedValue(fakeBuffer);
vi.mock('../services/audioDecoder', () => ({ decodeAudioFile: (...a: unknown[]) => mockDecode(...a) }));

import { useAudioEngine } from '../hooks/useAudioEngine';

// ── Helpers ──────────────────────────────────────────────────────────────

function resetStores() {
  useDeckStore.setState({
    decks: {
      A: { deckId: 'A', trackId: null, sourceType: null, title: '', artist: '', waveformPeaks: null, decoding: false, bpmDetecting: false, duration: 0, currentTime: 0, thumbnailUrl: null, playbackState: 'unstarted', pitchRate: 1 as const, bpm: null, volume: 80, loopActive: false, loopStart: null, loopEnd: null, loopBeatCount: null, beatJumpSize: 4, playerReady: false, hotCues: {}, eqLow: 0, eqMid: 0, eqHigh: 0, error: null, pitchRateLocked: false, synced: false, slipMode: false, slipPosition: null, slipStartTime: null, slipStartPosition: null, rollMode: false, rollStartWallClock: null, rollStartPosition: null, autoPlayOnLoad: false },
      B: { deckId: 'B', trackId: null, sourceType: null, title: '', artist: '', waveformPeaks: null, decoding: false, bpmDetecting: false, duration: 0, currentTime: 0, thumbnailUrl: null, playbackState: 'unstarted', pitchRate: 1 as const, bpm: null, volume: 80, loopActive: false, loopStart: null, loopEnd: null, loopBeatCount: null, beatJumpSize: 4, playerReady: false, hotCues: {}, eqLow: 0, eqMid: 0, eqHigh: 0, error: null, pitchRateLocked: false, synced: false, slipMode: false, slipPosition: null, slipStartTime: null, slipStartPosition: null, rollMode: false, rollStartWallClock: null, rollStartPosition: null, autoPlayOnLoad: false },
    },
  } as never);
  usePlaylistStore.setState({ playlists: { A: [], B: [] }, currentIndex: { A: -1, B: -1 } });
}

async function loadMp3Track(deckId: 'A' | 'B') {
  const file = new File(['x'], 'test.mp3', { type: 'audio/mpeg' });
  const entry = { id: 'e1', sourceType: 'mp3' as const, title: 'T', artist: 'A', duration: 120, thumbnailUrl: null, file };
  act(() => { usePlaylistStore.setState({ playlists: { A: [], B: [], ...{ [deckId]: [entry] } }, currentIndex: { A: -1, B: -1, ...{ [deckId]: 0 } } }); });
  await act(async () => {
    useDeckStore.getState().loadTrack(deckId, entry.id, { sourceType: 'mp3', title: 'T', artist: 'A', duration: 120, thumbnailUrl: null });
    await Promise.resolve();
  });
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('MP3-008 — BPM detection: worker lifecycle', () => {
  beforeEach(() => { resetStores(); mockEngineInstances.length = 0; workerInstances.length = 0; vi.clearAllMocks(); mockDecode.mockResolvedValue(fakeBuffer); });
  afterEach(() => { vi.clearAllMocks(); });

  it('creates a Worker after mp3 track loads', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3Track('A');
    expect(MockWorkerClass).toHaveBeenCalled();
  });

  it('sets bpmDetecting to true before worker responds', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3Track('A');
    expect(useDeckStore.getState().decks['A'].bpmDetecting).toBe(true);
  });

  it('sets bpm and clears bpmDetecting when worker posts result', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3Track('A');
    act(() => {
      workerInstances[0]!.onmessage?.({ data: { bpm: 128 } } as MessageEvent);
    });
    expect(useDeckStore.getState().decks['A'].bpm).toBe(128);
    expect(useDeckStore.getState().decks['A'].bpmDetecting).toBe(false);
  });

  it('clears bpmDetecting on worker error without setting bpm', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3Track('A');
    const prevBpm = useDeckStore.getState().decks['A'].bpm;
    act(() => {
      workerInstances[0]!.onerror?.({} as ErrorEvent);
    });
    expect(useDeckStore.getState().decks['A'].bpmDetecting).toBe(false);
    expect(useDeckStore.getState().decks['A'].bpm).toBe(prevBpm);
  });

  it('terminates the worker after receiving a result', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3Track('A');
    act(() => { workerInstances[0]!.onmessage?.({ data: { bpm: 140 } } as MessageEvent); });
    expect(workerInstances[0]!.terminate).toHaveBeenCalled();
  });

  it('does NOT create a Worker for youtube source', async () => {
    renderHook(() => useAudioEngine('A'));
    await act(async () => { useDeckStore.getState().loadTrack('A', 'yt1', { sourceType: 'youtube', title: '', artist: '', duration: 0, thumbnailUrl: null }); await Promise.resolve(); });
    expect(MockWorkerClass).not.toHaveBeenCalled();
  });
});
