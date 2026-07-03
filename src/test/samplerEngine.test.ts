import { describe, it, expect, beforeEach, vi } from 'vitest';
import { playSample, setSamplerVolume } from '../services/samplerEngine';
import { useSettingsStore } from '../store/settingsStore';

const mockContext = {
  createGain: vi.fn(),
  createBufferSource: vi.fn(),
  destination: {},
  currentTime: 0,
  state: 'running',
  sampleRate: 44100,
};

function makeMockGain() {
  return { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
}

function makeMockSource() {
  return { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null as AudioBuffer | null, onended: null as (() => void) | null };
}

vi.mock('../services/audioContext', () => ({
  getAudioContext: () => mockContext,
}));

describe('samplerEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ masterVolume: 100 });
  });

  it('creates a dedicated bus per deck, connected to destination', () => {
    const mockGain = makeMockGain();
    mockContext.createGain.mockReturnValueOnce(mockGain);
    const mockSource = makeMockSource();
    mockContext.createBufferSource.mockReturnValueOnce(mockSource);
    const buffer = { duration: 1 } as AudioBuffer;

    playSample('A', 0, buffer);

    expect(mockGain.connect).toHaveBeenCalledWith(mockContext.destination);
    expect(mockSource.connect).toHaveBeenCalledWith(mockGain);
    expect(mockSource.buffer).toBe(buffer);
    expect(mockSource.start).toHaveBeenCalledWith(0);
  });

  it('retriggering the same slot stops the previous instance', () => {
    const mockSource1 = makeMockSource();
    const mockSource2 = makeMockSource();
    mockContext.createBufferSource.mockReturnValueOnce(mockSource1).mockReturnValueOnce(mockSource2);
    const buffer = { duration: 1 } as AudioBuffer;

    playSample('A', 1, buffer);
    playSample('A', 1, buffer);

    expect(mockSource1.stop).toHaveBeenCalled();
    expect(mockSource2.stop).not.toHaveBeenCalled();
  });

  it('different slots do not stop each other', () => {
    const mockSource1 = makeMockSource();
    const mockSource2 = makeMockSource();
    mockContext.createBufferSource.mockReturnValueOnce(mockSource1).mockReturnValueOnce(mockSource2);
    const buffer = { duration: 1 } as AudioBuffer;

    playSample('A', 2, buffer);
    playSample('A', 3, buffer);

    expect(mockSource1.stop).not.toHaveBeenCalled();
  });

  it('setSamplerVolume and master volume both scale the bus gain', () => {
    const mockGain = makeMockGain();
    mockContext.createGain.mockReturnValueOnce(mockGain);
    mockContext.createBufferSource.mockReturnValueOnce(makeMockSource());
    playSample('B', 4, { duration: 1 } as AudioBuffer); // creates B's bus

    setSamplerVolume('B', 50);
    expect(mockGain.gain.value).toBeCloseTo(0.5, 6); // 50% volume * 100% master

    useSettingsStore.setState({ masterVolume: 50 });
    expect(mockGain.gain.value).toBeCloseTo(0.25, 6); // 50% volume * 50% master
  });
});
