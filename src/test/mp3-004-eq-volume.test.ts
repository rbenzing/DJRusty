/**
 * mp3-004-eq-volume.test.ts — Volume + EQ wiring via useAudioEngine.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { usePlaylistStore } from '../store/playlistStore';

// ── Mocks ─────────────────────────────────────────────────────────────────

type MockEngine = { setVolume: ReturnType<typeof vi.fn>; setEQ: ReturnType<typeof vi.fn>; loadBuffer: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; seekTo: ReturnType<typeof vi.fn>; setPlaybackRate: ReturnType<typeof vi.fn>; onEnded: ReturnType<typeof vi.fn>; destroy: ReturnType<typeof vi.fn>; getCurrentTime: ReturnType<typeof vi.fn>; isReady: ReturnType<typeof vi.fn>; isPlaying: ReturnType<typeof vi.fn>; getAnalyser: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; };
const mockEngineInstances: MockEngine[] = [];

vi.mock('../services/audioEngine', () => ({
  AudioEngineImpl: vi.fn().mockImplementation(() => {
    const e: MockEngine = {
      setVolume: vi.fn(), setEQ: vi.fn(), loadBuffer: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), seekTo: vi.fn(),
      setPlaybackRate: vi.fn(), stop: vi.fn(), onEnded: vi.fn(), destroy: vi.fn(),
      getCurrentTime: vi.fn().mockReturnValue(0), isReady: vi.fn().mockReturnValue(true),
      isPlaying: vi.fn().mockReturnValue(false), getAnalyser: vi.fn(),
    };
    mockEngineInstances.push(e);
    return e;
  }),
}));
vi.mock('../services/playerRegistry', () => ({ playerRegistry: { register: vi.fn(), unregister: vi.fn(), get: vi.fn() } }));
const fakeBuffer = { duration: 120, length: 5292000, numberOfChannels: 1, sampleRate: 44100, getChannelData: vi.fn().mockReturnValue(new Float32Array(0)), copyFromChannel: vi.fn(), copyToChannel: vi.fn() } as unknown as AudioBuffer;
const mockDecode = vi.fn().mockResolvedValue(fakeBuffer);
vi.mock('../services/audioDecoder', () => ({ decodeAudioFile: (...a: unknown[]) => mockDecode(...a) }));
vi.mock('../utils/extractWaveformPeaks', () => ({ extractWaveformPeaks: vi.fn().mockReturnValue(new Float32Array(0)) }));
vi.stubGlobal('Worker', vi.fn().mockImplementation(() => ({ onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() })));

import { useAudioEngine } from '../hooks/useAudioEngine';

// ── Helpers ───────────────────────────────────────────────────────────────

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

// ── Volume tests ──────────────────────────────────────────────────────────

describe('MP3-004 — volume: mp3 deck', () => {
  beforeEach(() => { resetStores(); mockEngineInstances.length = 0; vi.clearAllMocks(); mockDecode.mockResolvedValue(fakeBuffer); });
  afterEach(() => { vi.clearAllMocks(); });

  it('calls engine.setVolume(vol/100) when volume changes', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3Track('A');
    act(() => { useDeckStore.getState().setVolume('A', 60); });
    expect(mockEngineInstances[0]!.setVolume).toHaveBeenCalledWith(0.6);
  });

  it('converts volume 0 → 0 and 100 → 1', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3Track('A');
    act(() => { useDeckStore.getState().setVolume('A', 0); });
    expect(mockEngineInstances[0]!.setVolume).toHaveBeenCalledWith(0);
    act(() => { useDeckStore.getState().setVolume('A', 100); });
    expect(mockEngineInstances[0]!.setVolume).toHaveBeenCalledWith(1);
  });

  it('does NOT call setVolume for youtube source', async () => {
    renderHook(() => useAudioEngine('A'));
    await act(async () => { useDeckStore.getState().loadTrack('A', 'yt1', { sourceType: 'youtube', title: '', artist: '', duration: 0, thumbnailUrl: null }); await Promise.resolve(); });
    act(() => { useDeckStore.getState().setVolume('A', 50); });
    expect(mockEngineInstances[0]!.setVolume).not.toHaveBeenCalled();
  });

  it('does NOT call setVolume after unmount', async () => {
    const { unmount } = renderHook(() => useAudioEngine('A'));
    await loadMp3Track('A');
    unmount();
    mockEngineInstances[0]!.setVolume.mockClear();
    act(() => { useDeckStore.getState().setVolume('A', 40); });
    expect(mockEngineInstances[0]!.setVolume).not.toHaveBeenCalled();
  });
});

// ── EQ tests ──────────────────────────────────────────────────────────────

describe('MP3-004 — EQ: mp3 deck', () => {
  beforeEach(() => { resetStores(); mockEngineInstances.length = 0; vi.clearAllMocks(); mockDecode.mockResolvedValue(fakeBuffer); });
  afterEach(() => { vi.clearAllMocks(); });

  it('calls engine.setEQ("low", value) when eqLow changes', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3Track('A');
    act(() => { useDeckStore.getState().setEq('A', 'eqLow', -6); });
    expect(mockEngineInstances[0]!.setEQ).toHaveBeenCalledWith('low', -6);
  });

  it('calls engine.setEQ("mid", value) when eqMid changes', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3Track('A');
    act(() => { useDeckStore.getState().setEq('A', 'eqMid', 3); });
    expect(mockEngineInstances[0]!.setEQ).toHaveBeenCalledWith('mid', 3);
  });

  it('calls engine.setEQ("high", value) when eqHigh changes', async () => {
    renderHook(() => useAudioEngine('A'));
    await loadMp3Track('A');
    act(() => { useDeckStore.getState().setEq('A', 'eqHigh', 6); });
    expect(mockEngineInstances[0]!.setEQ).toHaveBeenCalledWith('high', 6);
  });

  it('does NOT call setEQ for youtube source', async () => {
    renderHook(() => useAudioEngine('A'));
    await act(async () => { useDeckStore.getState().loadTrack('A', 'yt1', { sourceType: 'youtube', title: '', artist: '', duration: 0, thumbnailUrl: null }); await Promise.resolve(); });
    act(() => { useDeckStore.getState().setEq('A', 'eqLow', -3); });
    expect(mockEngineInstances[0]!.setEQ).not.toHaveBeenCalled();
  });

  it('does NOT call setEQ after unmount', async () => {
    const { unmount } = renderHook(() => useAudioEngine('A'));
    await loadMp3Track('A');
    unmount();
    mockEngineInstances[0]!.setEQ.mockClear();
    act(() => { useDeckStore.getState().setEq('A', 'eqHigh', 2); });
    expect(mockEngineInstances[0]!.setEQ).not.toHaveBeenCalled();
  });
});
