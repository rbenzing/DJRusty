/**
 * mp3-006-waveform.test.ts — Waveform peak extraction utility + hook integration.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { extractWaveformPeaks } from '../utils/extractWaveformPeaks';
import { useDeckStore } from '../store/deckStore';
import { usePlaylistStore } from '../store/playlistStore';

// ── Pure utility tests ────────────────────────────────────────────────────

function makeBuffer(samples: Float32Array, channels = 1, sampleRate = 44100): AudioBuffer {
  return {
    duration: samples.length / sampleRate,
    length: samples.length,
    numberOfChannels: channels,
    sampleRate,
    getChannelData: vi.fn().mockReturnValue(samples),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

describe('extractWaveformPeaks — pure function', () => {
  it('returns Float32Array of requested length', () => {
    const buf = makeBuffer(new Float32Array(44100));
    expect(extractWaveformPeaks(buf, 500)).toHaveLength(500);
  });

  it('returns all zeros for a silent buffer', () => {
    const buf = makeBuffer(new Float32Array(44100).fill(0));
    const peaks = extractWaveformPeaks(buf, 100);
    expect(Array.from(peaks).every((v) => v === 0)).toBe(true);
  });

  it('returns all ones for a full-amplitude buffer', () => {
    const buf = makeBuffer(new Float32Array(44100).fill(1));
    const peaks = extractWaveformPeaks(buf, 100);
    expect(Array.from(peaks).every((v) => v === 1)).toBe(true);
  });

  it('all values are in range [0, 1]', () => {
    const data = new Float32Array(44100).map(() => Math.random() * 2 - 1);
    const peaks = extractWaveformPeaks(makeBuffer(data), 1000);
    expect(Array.from(peaks).every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  it('handles numPeaks > buffer.length without throwing', () => {
    const buf = makeBuffer(new Float32Array(10).fill(0.5));
    expect(() => extractWaveformPeaks(buf, 1000)).not.toThrow();
    expect(extractWaveformPeaks(buf, 1000)).toHaveLength(1000);
  });

  it('returns empty array when numPeaks is 0', () => {
    const buf = makeBuffer(new Float32Array(44100).fill(1));
    expect(extractWaveformPeaks(buf, 0)).toHaveLength(0);
  });
});

// ── Hook integration tests ────────────────────────────────────────────────

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
const fakePeaks = new Float32Array([0.5, 0.8, 0.3]);
vi.mock('../utils/extractWaveformPeaks', { spy: true });
import * as waveformModule from '../utils/extractWaveformPeaks';

const fakeBuffer = { duration: 120, length: 5292000, numberOfChannels: 1, sampleRate: 44100, getChannelData: vi.fn().mockReturnValue(new Float32Array(0)), copyFromChannel: vi.fn(), copyToChannel: vi.fn() } as unknown as AudioBuffer;
const mockDecode = vi.fn().mockResolvedValue(fakeBuffer);
vi.mock('../services/audioDecoder', () => ({ decodeAudioFile: (...a: unknown[]) => mockDecode(...a) }));
vi.stubGlobal('Worker', vi.fn().mockImplementation(() => ({ onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() })));

import { useAudioEngine } from '../hooks/useAudioEngine';

function resetStores() {
  useDeckStore.setState({
    decks: {
      A: { deckId: 'A', trackId: null, sourceType: null, title: '', artist: '', waveformPeaks: null, decoding: false, bpmDetecting: false, duration: 0, currentTime: 0, thumbnailUrl: null, playbackState: 'unstarted', pitchRate: 1 as const, bpm: null, volume: 80, loopActive: false, loopStart: null, loopEnd: null, loopBeatCount: null, beatJumpSize: 4, playerReady: false, hotCues: {}, eqLow: 0, eqMid: 0, eqHigh: 0, error: null, pitchRateLocked: false, synced: false, slipMode: false, slipPosition: null, slipStartTime: null, slipStartPosition: null, rollMode: false, rollStartWallClock: null, rollStartPosition: null, autoPlayOnLoad: false },
      B: { deckId: 'B', trackId: null, sourceType: null, title: '', artist: '', waveformPeaks: null, decoding: false, bpmDetecting: false, duration: 0, currentTime: 0, thumbnailUrl: null, playbackState: 'unstarted', pitchRate: 1 as const, bpm: null, volume: 80, loopActive: false, loopStart: null, loopEnd: null, loopBeatCount: null, beatJumpSize: 4, playerReady: false, hotCues: {}, eqLow: 0, eqMid: 0, eqHigh: 0, error: null, pitchRateLocked: false, synced: false, slipMode: false, slipPosition: null, slipStartTime: null, slipStartPosition: null, rollMode: false, rollStartWallClock: null, rollStartPosition: null, autoPlayOnLoad: false },
    },
  } as never);
  usePlaylistStore.setState({ playlists: { A: [], B: [] }, currentIndex: { A: -1, B: -1 } });
}

describe('MP3-006 — waveform hook integration', () => {
  beforeEach(() => {
    resetStores(); mockEngineInstances.length = 0; vi.clearAllMocks();
    vi.spyOn(waveformModule, 'extractWaveformPeaks').mockReturnValue(fakePeaks);
    mockDecode.mockResolvedValue(fakeBuffer);
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('clears waveformPeaks to null when new track starts loading', async () => {
    renderHook(() => useAudioEngine('A'));
    // Set some existing peaks first
    act(() => { useDeckStore.getState().setWaveformPeaks('A', new Float32Array([1, 2, 3])); });

    const file = new File(['x'], 'test.mp3', { type: 'audio/mpeg' });
    const entry = { id: 'e1', sourceType: 'mp3' as const, title: 'T', artist: 'A', duration: 120, thumbnailUrl: null, file };
    act(() => { usePlaylistStore.setState({ playlists: { A: [entry], B: [] }, currentIndex: { A: 0, B: -1 } }); });
    act(() => { useDeckStore.getState().loadTrack('A', entry.id, { sourceType: 'mp3', title: 'T', artist: 'A', duration: 120, thumbnailUrl: null }); });
    // At this point peaks should be cleared (before decode resolves)
    expect(useDeckStore.getState().decks['A'].waveformPeaks).toBeNull();
  });

  it('calls extractWaveformPeaks with decoded buffer after load', async () => {
    renderHook(() => useAudioEngine('A'));
    const file = new File(['x'], 'test.mp3', { type: 'audio/mpeg' });
    const entry = { id: 'e1', sourceType: 'mp3' as const, title: 'T', artist: 'A', duration: 120, thumbnailUrl: null, file };
    act(() => { usePlaylistStore.setState({ playlists: { A: [entry], B: [] }, currentIndex: { A: 0, B: -1 } }); });
    await act(async () => {
      useDeckStore.getState().loadTrack('A', entry.id, { sourceType: 'mp3', title: 'T', artist: 'A', duration: 120, thumbnailUrl: null });
      await Promise.resolve();
    });
    expect(waveformModule.extractWaveformPeaks).toHaveBeenCalledWith(fakeBuffer, expect.any(Number));
  });

  it('stores extracted peaks in deckStore.waveformPeaks', async () => {
    renderHook(() => useAudioEngine('A'));
    const file = new File(['x'], 'test.mp3', { type: 'audio/mpeg' });
    const entry = { id: 'e1', sourceType: 'mp3' as const, title: 'T', artist: 'A', duration: 120, thumbnailUrl: null, file };
    act(() => { usePlaylistStore.setState({ playlists: { A: [entry], B: [] }, currentIndex: { A: 0, B: -1 } }); });
    await act(async () => {
      useDeckStore.getState().loadTrack('A', entry.id, { sourceType: 'mp3', title: 'T', artist: 'A', duration: 120, thumbnailUrl: null });
      await Promise.resolve();
    });
    expect(useDeckStore.getState().decks['A'].waveformPeaks).toBe(fakePeaks);
  });

  it('does NOT set waveformPeaks for youtube source', async () => {
    renderHook(() => useAudioEngine('A'));
    await act(async () => { useDeckStore.getState().loadTrack('A', 'yt1', { sourceType: 'youtube', title: '', artist: '', duration: 0, thumbnailUrl: null }); await Promise.resolve(); });
    expect(waveformModule.extractWaveformPeaks).not.toHaveBeenCalled();
    expect(useDeckStore.getState().decks['A'].waveformPeaks).toBeNull();
  });
});
