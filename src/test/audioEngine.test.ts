/**
 * audioEngine.test.ts — Unit tests for AudioEngine implementation.
 *
 * Tests cover: play/pause/resume cycle, seek operations, volume/playback rate/EQ,
 * position accuracy, and onEnded callback behavior.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AudioEngineImpl } from '../services/audioEngine';
import * as audioContext from '../services/audioContext';

// ── Mock Web Audio API ────────────────────────────────────────────────────

const mockContext = {
  createGain: vi.fn(),
  createBiquadFilter: vi.fn(),
  createAnalyser: vi.fn(),
  createBufferSource: vi.fn(),
  createDelay: vi.fn(),
  createConvolver: vi.fn(),
  currentTime: 0,
  state: 'running',
  destination: {},
  sampleRate: 44100,
};

function makeMockGain() {
  return { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1.0, setTargetAtTime: vi.fn() } };
}

function makeMockFilter(type: string, freq: number) {
  return { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 0 }, frequency: { value: freq }, Q: { value: 0.7 }, type };
}

// Named mocks for the signal chain nodes (in constructor order)
let mockTrimGain: ReturnType<typeof makeMockGain>;
let mockGainNode: ReturnType<typeof makeMockGain>;
let mockLowKillGain: ReturnType<typeof makeMockGain>;
let mockMidKillGain: ReturnType<typeof makeMockGain>;
let mockHighKillGain: ReturnType<typeof makeMockGain>;
let mockDryGain: ReturnType<typeof makeMockGain>;
let mockWetGain: ReturnType<typeof makeMockGain>;
let mockLowFilter: ReturnType<typeof makeMockFilter>;
let mockMidFilter: ReturnType<typeof makeMockFilter>;
let mockHighFilter: ReturnType<typeof makeMockFilter>;
let mockSweepFilter: ReturnType<typeof makeMockFilter>;

const mockAnalyser = { connect: vi.fn(), disconnect: vi.fn() };

const mockSourceNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  buffer: null as AudioBuffer | null,
  playbackRate: { value: 1.0 },
  onended: null as (() => void) | null,
};

// Mock the audio context module
vi.mock('../services/audioContext', () => ({
  getAudioContext: () => mockContext,
  ensureAudioContextResumed: vi.fn().mockResolvedValue(undefined),
}));

/** Set up createGain/createBiquadFilter mocks for one AudioEngineImpl construction. */
function setupConstructorMocks() {
  mockTrimGain     = makeMockGain();
  mockGainNode     = makeMockGain();
  mockLowKillGain  = makeMockGain();
  mockMidKillGain  = makeMockGain();
  mockHighKillGain = makeMockGain();
  mockDryGain      = makeMockGain();
  mockWetGain      = makeMockGain();
  mockLowFilter    = makeMockFilter('lowshelf',  320);
  mockMidFilter    = makeMockFilter('peaking',  1000);
  mockHighFilter   = makeMockFilter('highshelf', 3200);
  mockSweepFilter  = makeMockFilter('allpass',  20000);

  // createGain order: trimGain, gainNode, lowKill, midKill, highKill, dryGain, wetGain
  mockContext.createGain
    .mockReturnValueOnce(mockTrimGain)
    .mockReturnValueOnce(mockGainNode)
    .mockReturnValueOnce(mockLowKillGain)
    .mockReturnValueOnce(mockMidKillGain)
    .mockReturnValueOnce(mockHighKillGain)
    .mockReturnValueOnce(mockDryGain)
    .mockReturnValueOnce(mockWetGain);

  // createBiquadFilter order: low, mid, high, sweep
  mockContext.createBiquadFilter
    .mockReturnValueOnce(mockLowFilter)
    .mockReturnValueOnce(mockMidFilter)
    .mockReturnValueOnce(mockHighFilter)
    .mockReturnValueOnce(mockSweepFilter);

  mockContext.createAnalyser.mockReturnValue(mockAnalyser);
  mockContext.createBufferSource.mockReturnValue(mockSourceNode);
}

describe('AudioEngine', () => {
  let engine: AudioEngineImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext.currentTime = 0;
    mockSourceNode.onended = null;
    mockSourceNode.buffer = null;
    mockSourceNode.playbackRate.value = 1.0;

    setupConstructorMocks();
    engine = new AudioEngineImpl();
  });

  afterEach(() => {
    engine.destroy();
  });

  describe('initialization', () => {
    it('creates the signal chain correctly', () => {
      expect(mockContext.createGain).toHaveBeenCalledTimes(7);        // trim + gain + 3 kills + dry + wet
      expect(mockContext.createBiquadFilter).toHaveBeenCalledTimes(4); // low + mid + high + sweep
      expect(mockContext.createAnalyser).toHaveBeenCalled();

      // Key connections
      expect(mockTrimGain.connect).toHaveBeenCalledWith(mockGainNode);
      expect(mockGainNode.connect).toHaveBeenCalledWith(mockLowFilter);
      expect(mockLowFilter.connect).toHaveBeenCalledWith(mockLowKillGain);
      expect(mockLowKillGain.connect).toHaveBeenCalledWith(mockMidFilter);
      expect(mockMidFilter.connect).toHaveBeenCalledWith(mockMidKillGain);
      expect(mockMidKillGain.connect).toHaveBeenCalledWith(mockHighFilter);
      expect(mockHighFilter.connect).toHaveBeenCalledWith(mockHighKillGain);
      expect(mockHighKillGain.connect).toHaveBeenCalledWith(mockSweepFilter);
      expect(mockSweepFilter.connect).toHaveBeenCalledWith(mockDryGain);
      expect(mockDryGain.connect).toHaveBeenCalledWith(mockAnalyser);
      expect(mockAnalyser.connect).toHaveBeenCalledWith(mockContext.destination);
    });

    it('configures EQ filters correctly', () => {
      expect(mockLowFilter.type).toBe('lowshelf');
      expect(mockLowFilter.frequency.value).toBe(320);

      expect(mockMidFilter.type).toBe('peaking');
      expect(mockMidFilter.frequency.value).toBe(1000);
      expect(mockMidFilter.Q.value).toBe(0.7);

      expect(mockHighFilter.type).toBe('highshelf');
      expect(mockHighFilter.frequency.value).toBe(3200);
    });
  });

  describe('buffer management', () => {
    it('loads buffer correctly', () => {
      const mockBuffer = { duration: 120 } as AudioBuffer;
      engine.loadBuffer(mockBuffer);
      expect(engine.isReady()).toBe(true);
      expect(engine.getDuration()).toBe(120);
    });

    it('is not ready without buffer', () => {
      expect(engine.isReady()).toBe(false);
      expect(engine.getDuration()).toBe(0);
    });
  });

  describe('playback controls', () => {
    const mockBuffer = { duration: 120 } as AudioBuffer;

    beforeEach(() => {
      engine.loadBuffer(mockBuffer);
    });

    it('throws when playing without buffer', async () => {
      setupConstructorMocks();
      const emptyEngine = new AudioEngineImpl();
      await expect(emptyEngine.play()).rejects.toThrow('No audio buffer loaded');
      emptyEngine.destroy();
    });

    it('starts playback correctly', async () => {
      await engine.play();

      expect(mockSourceNode.buffer).toBe(mockBuffer);
      expect(mockSourceNode.playbackRate.value).toBe(1.0);
      expect(mockSourceNode.connect).toHaveBeenCalledWith(mockTrimGain);
      expect(mockSourceNode.start).toHaveBeenCalledWith(0, 0);
      expect(engine.isPlaying()).toBe(true);
    });

    it('starts playback from offset', async () => {
      await engine.play(30);

      expect(mockSourceNode.start).toHaveBeenCalledWith(0, 30);
    });

    it('pauses playback', async () => {
      await engine.play();
      engine.pause();

      expect(mockSourceNode.stop).toHaveBeenCalled();
      expect(engine.isPlaying()).toBe(false);
    });

    it('stops playback and resets position', async () => {
      await engine.play(45);
      engine.stop();

      expect(mockSourceNode.stop).toHaveBeenCalled();
      expect(engine.isPlaying()).toBe(false);
      expect(engine.getCurrentTime()).toBe(0);
    });
  });

  describe('seeking', () => {
    const mockBuffer = { duration: 120 } as AudioBuffer;

    beforeEach(() => {
      engine.loadBuffer(mockBuffer);
    });

    it('seeks while paused', () => {
      engine.seekTo(45);
      expect(engine.getCurrentTime()).toBe(45);
    });

    it('seeks while playing', async () => {
      await engine.play();

      engine.seekTo(30);

      // Wait for async play to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should have created a new source node for seeking
      expect(mockContext.createBufferSource).toHaveBeenCalledTimes(2);
    });

    it('clamps seek to valid range', () => {
      engine.seekTo(-10);
      expect(engine.getCurrentTime()).toBe(0);

      engine.seekTo(200);
      expect(engine.getCurrentTime()).toBe(120);
    });

    it('seekTo while playing swallows a rejected play() restart', async () => {
      await engine.play();

      // Force the next ensureAudioContextResumed call to reject, simulating a
      // suspended/failed AudioContext during the seek-triggered play() restart.
      vi.spyOn(audioContext, 'ensureAudioContextResumed').mockRejectedValueOnce(
        new Error('ctx suspended')
      );

      // seekTo must not throw synchronously
      expect(() => engine.seekTo(10)).not.toThrow();

      // Flush microtasks so the rejected promise settles; no unhandled rejection
      // should surface (Vitest treats unhandled rejections as test failures).
      await Promise.resolve();
      await Promise.resolve();
    });
  });

  describe('position tracking', () => {
    const mockBuffer = { duration: 120 } as AudioBuffer;

    beforeEach(() => {
      engine.loadBuffer(mockBuffer);
    });

    it('returns seek offset when paused', () => {
      engine.seekTo(45);
      expect(engine.getCurrentTime()).toBe(45);
    });

    it('calculates position while playing', async () => {
      await engine.play(10);

      // Simulate 3 seconds of playback at 1.5x speed
      mockContext.currentTime = 3;
      engine.setPlaybackRate(1.5);

      expect(engine.getCurrentTime()).toBe(10 + 3 * 1.5); // 10 + 4.5 = 14.5
    });
  });

  describe('volume control', () => {
    it('sets volume correctly', () => {
      engine.setVolume(50);
      expect(mockGainNode.gain.value).toBe(0.5);

      engine.setVolume(0);
      expect(mockGainNode.gain.value).toBe(0);

      engine.setVolume(100);
      expect(mockGainNode.gain.value).toBe(1.0);
    });

    it('clamps volume to valid range', () => {
      engine.setVolume(-10);
      expect(mockGainNode.gain.value).toBe(0);

      engine.setVolume(150);
      expect(mockGainNode.gain.value).toBe(1.0);
    });
  });

  describe('gain / trim', () => {
    it('sets 0 dB as unity via setTargetAtTime', () => {
      engine.setGain(0);
      expect(mockTrimGain.gain.setTargetAtTime).toHaveBeenCalledWith(1, 0, 0.01);
    });

    it('applies +6 dB as ~1.995 linear', () => {
      engine.setGain(6);
      const calls = mockTrimGain.gain.setTargetAtTime.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall?.[0]).toBeCloseTo(1.995, 3);
    });
  });

  describe('playback rate', () => {
    it('sets playback rate while stopped', () => {
      engine.setPlaybackRate(1.25);
      expect(engine.isPlaying()).toBe(false);
    });

    it('sets playback rate while playing', async () => {
      const mockBuffer = { duration: 120 } as AudioBuffer;
      engine.loadBuffer(mockBuffer);

      await engine.play();
      engine.setPlaybackRate(0.75);

      expect(mockSourceNode.playbackRate.value).toBe(0.75);
    });
  });

  describe('EQ control', () => {
    it('sets low EQ gain', () => {
      engine.setEQ('low', -3);
      expect(mockLowFilter.gain.value).toBe(-3);
    });

    it('sets mid EQ gain', () => {
      engine.setEQ('mid', 2);
      expect(mockMidFilter.gain.value).toBe(2);
    });

    it('sets high EQ gain', () => {
      engine.setEQ('high', 4);
      expect(mockHighFilter.gain.value).toBe(4);
    });
  });

  describe('EQ kill', () => {
    it('silences a band when killed', () => {
      engine.setEQKill('low', true);
      expect(mockLowKillGain.gain.value).toBe(0);
    });

    it('restores a band when unkilled', () => {
      engine.setEQKill('mid', true);
      engine.setEQKill('mid', false);
      expect(mockMidKillGain.gain.value).toBe(1);
    });
  });

  describe('analyser access', () => {
    it('returns the analyser node', () => {
      expect(engine.getAnalyser()).toBe(mockAnalyser);
    });
  });

  describe('ended callback', () => {
    it('calls callback when track ends naturally', async () => {
      const mockBuffer = { duration: 10 } as AudioBuffer;
      engine.loadBuffer(mockBuffer);

      const callback = vi.fn();
      engine.onEnded(callback);

      await engine.play();

      // Simulate track ending
      if (mockSourceNode.onended) {
        mockSourceNode.onended();
      }

      expect(callback).toHaveBeenCalled();
    });

    it('does not call callback when stopped manually', async () => {
      const mockBuffer = { duration: 10 } as AudioBuffer;
      engine.loadBuffer(mockBuffer);

      const callback = vi.fn();
      engine.onEnded(callback);

      await engine.play();
      engine.stop();

      // onended should be called but callback should not
      if (mockSourceNode.onended) {
        mockSourceNode.onended();
      }

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('disconnects all nodes', () => {
      engine.destroy();

      expect(mockGainNode.disconnect).toHaveBeenCalled();
      expect(mockLowFilter.disconnect).toHaveBeenCalled();
      expect(mockMidFilter.disconnect).toHaveBeenCalled();
      expect(mockHighFilter.disconnect).toHaveBeenCalled();
      expect(mockAnalyser.disconnect).toHaveBeenCalled();
      expect(mockDryGain.disconnect).toHaveBeenCalled();
    });
  });

  describe('effects', () => {
    it('switching away from echo disconnects all echo nodes (no feedback-gain leak)', () => {
      // Prepare mock nodes that setEffect('echo') will create: delay + feedbackGain
      const mockDelay = { connect: vi.fn(), disconnect: vi.fn(), delayTime: { value: 0 } };
      const mockFeedbackGain = makeMockGain();
      mockContext.createDelay.mockReturnValueOnce(mockDelay);
      mockContext.createGain.mockReturnValueOnce(mockFeedbackGain);

      engine.setEffect('echo', 0.5, 120);

      // Now switch away from echo — both nodes must be disconnected
      engine.setEffect('none', 0, 120);

      expect(mockDelay.disconnect).toHaveBeenCalled();
      expect(mockFeedbackGain.disconnect).toHaveBeenCalled();
    });

    it('destroy() disconnects all echo effect nodes', () => {
      const mockDelay = { connect: vi.fn(), disconnect: vi.fn(), delayTime: { value: 0 } };
      const mockFeedbackGain = makeMockGain();
      mockContext.createDelay.mockReturnValueOnce(mockDelay);
      mockContext.createGain.mockReturnValueOnce(mockFeedbackGain);

      engine.setEffect('echo', 0.5, 120);

      engine.destroy();

      expect(mockDelay.disconnect).toHaveBeenCalled();
      expect(mockFeedbackGain.disconnect).toHaveBeenCalled();
    });

    it('switching echo to reverb disconnects echo nodes first', () => {
      const mockDelay = { connect: vi.fn(), disconnect: vi.fn(), delayTime: { value: 0 } };
      const mockFeedbackGain = makeMockGain();
      mockContext.createDelay.mockReturnValueOnce(mockDelay);
      mockContext.createGain.mockReturnValueOnce(mockFeedbackGain);

      engine.setEffect('echo', 0.5, 120);

      // Prepare reverb mock — createBuffer is needed for the impulse response
      const mockConvolver = { connect: vi.fn(), disconnect: vi.fn(), buffer: null as AudioBuffer | null };
      mockContext.createConvolver.mockReturnValueOnce(mockConvolver);
      const mockImpulseBuffer = { getChannelData: vi.fn().mockReturnValue(new Float32Array(10)) };
      mockContext.createBuffer = vi.fn().mockReturnValue(mockImpulseBuffer);

      engine.setEffect('reverb', 0.5, 120);

      // Echo nodes must have been disconnected when reverb was activated
      expect(mockDelay.disconnect).toHaveBeenCalled();
      expect(mockFeedbackGain.disconnect).toHaveBeenCalled();
    });

    it('echo delay time follows bpm and beat multiplier', () => {
      const mockDelay = { connect: vi.fn(), disconnect: vi.fn(), delayTime: { value: 0 } };
      const mockFeedbackGain = makeMockGain();
      mockContext.createDelay.mockReturnValueOnce(mockDelay);
      mockContext.createGain.mockReturnValueOnce(mockFeedbackGain);

      // 120 bpm → 0.5 s/beat; quarter-beat (0.25) → 0.125 s delay
      engine.setEffect('echo', 0.5, 120, 0.25);

      expect(mockDelay.delayTime.value).toBeCloseTo(0.125, 6);
    });

    it('defaults to a half-beat delay when beatMultiplier omitted', () => {
      const mockDelay = { connect: vi.fn(), disconnect: vi.fn(), delayTime: { value: 0 } };
      const mockFeedbackGain = makeMockGain();
      mockContext.createDelay.mockReturnValueOnce(mockDelay);
      mockContext.createGain.mockReturnValueOnce(mockFeedbackGain);

      engine.setEffect('echo', 0.5, 120);

      expect(mockDelay.delayTime.value).toBeCloseTo(0.25, 6); // 0.5 s/beat * 0.5
    });

    it('clamps echo delay time below the DelayNode max when bpm is very low', () => {
      const mockDelay = { connect: vi.fn(), disconnect: vi.fn(), delayTime: { value: 0 } };
      const mockFeedbackGain = makeMockGain();
      mockContext.createDelay.mockReturnValueOnce(mockDelay);
      mockContext.createGain.mockReturnValueOnce(mockFeedbackGain);

      // bpm=40 -> 1.5s/beat; beatMultiplier=4 -> raw 6.0s, must clamp below 4.0s cap
      engine.setEffect('echo', 0.5, 40, 4);

      expect(mockDelay.delayTime.value).toBeLessThan(4.0);
      expect(mockDelay.delayTime.value).toBeCloseTo(3.9, 6);
    });
  });
});
