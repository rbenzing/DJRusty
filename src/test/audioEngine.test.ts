/**
 * audioEngine.test.ts — Unit tests for AudioEngine implementation.
 *
 * Tests cover: play/pause/resume cycle, seek operations, volume/playback rate/EQ,
 * position accuracy, and onEnded callback behavior.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AudioEngineImpl } from '../services/audioEngine';

// Mock Web Audio API
const mockContext = {
  createGain: vi.fn(),
  createBiquadFilter: vi.fn(),
  createAnalyser: vi.fn(),
  createBufferSource: vi.fn(),
  currentTime: 0,
  state: 'running',
  destination: {},
};

const mockGainNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: { value: 1.0 },
};

const mockLowFilter = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: { value: 0 },
  frequency: { value: 320 },
  Q: { value: 0.7 },
  type: 'lowshelf',
};

const mockMidFilter = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: { value: 0 },
  frequency: { value: 1000 },
  Q: { value: 0.7 },
  type: 'peaking',
};

const mockHighFilter = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: { value: 0 },
  frequency: { value: 3200 },
  Q: { value: 0.7 },
  type: 'highshelf',
};

const mockAnalyser = {
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockSourceNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  buffer: null,
  playbackRate: { value: 1.0 },
  onended: null as (() => void) | null,
};

// Mock the audio context module
vi.mock('../services/audioContext', () => ({
  getAudioContext: () => mockContext,
  ensureAudioContextResumed: vi.fn().mockResolvedValue(undefined),
}));

describe('AudioEngine', () => {
  let engine: AudioEngineImpl;

  beforeEach(() => {
    // Set up mock returns
    mockContext.createGain.mockReturnValue(mockGainNode);
    mockContext.createBiquadFilter.mockReturnValueOnce(mockLowFilter);
    mockContext.createBiquadFilter.mockReturnValueOnce(mockMidFilter);
    mockContext.createBiquadFilter.mockReturnValueOnce(mockHighFilter);
    mockContext.createAnalyser.mockReturnValue(mockAnalyser);
    mockContext.createBufferSource.mockReturnValue(mockSourceNode);

    engine = new AudioEngineImpl();
  });

  afterEach(() => {
    engine.destroy();
  });

  describe('initialization', () => {
    it('creates the signal chain correctly', () => {
      expect(mockContext.createGain).toHaveBeenCalled();
      expect(mockContext.createBiquadFilter).toHaveBeenCalledTimes(3);
      expect(mockContext.createAnalyser).toHaveBeenCalled();

      // Verify connections: Gain -> Low -> Mid -> High -> Analyser -> Destination
      expect(mockGainNode.connect).toHaveBeenCalledWith(mockLowFilter);
      expect(mockLowFilter.connect).toHaveBeenCalledWith(mockMidFilter);
      expect(mockMidFilter.connect).toHaveBeenCalledWith(mockHighFilter);
      expect(mockHighFilter.connect).toHaveBeenCalledWith(mockAnalyser);
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
      // Create a new engine with mocks set up
      mockContext.createGain.mockReturnValue(mockGainNode);
      mockContext.createBiquadFilter.mockReturnValueOnce(mockLowFilter);
      mockContext.createBiquadFilter.mockReturnValueOnce(mockMidFilter);
      mockContext.createBiquadFilter.mockReturnValueOnce(mockHighFilter);
      mockContext.createAnalyser.mockReturnValue(mockAnalyser);
      mockContext.createBufferSource.mockReturnValue(mockSourceNode);

      const emptyEngine = new AudioEngineImpl();
      await expect(emptyEngine.play()).rejects.toThrow('No audio buffer loaded');
    });

    it('starts playback correctly', async () => {
      await engine.play();

      expect(mockSourceNode.buffer).toBe(mockBuffer);
      expect(mockSourceNode.playbackRate.value).toBe(1.0);
      expect(mockSourceNode.connect).toHaveBeenCalledWith(mockGainNode);
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
    });
  });
});