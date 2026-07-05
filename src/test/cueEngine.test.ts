/**
 * cueEngine.test.ts — Unit tests for the headphone CUE/PFL routing service.
 *
 * registerDeckCueSend/registerDeckProgramTap/unregisterDeck are pure
 * bookkeeping and must never touch the AudioContext — every Deck-mounting
 * test in this codebase calls the register path unconditionally, so if it
 * touched getAudioContext() eagerly, it would break in jsdom (no real
 * AudioContext) for dozens of unrelated test files. Only setDeckCueEnabled /
 * setHeadphoneMix / setHeadphoneDeviceId — real user actions — trigger the
 * lazy graph creation.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockContext = {
  createGain: vi.fn(),
  createMediaStreamDestination: vi.fn(),
  currentTime: 0,
};

function makeMockGain() {
  return { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1, setTargetAtTime: vi.fn() } };
}

let mockCueBusGain: ReturnType<typeof makeMockGain>;
let mockProgramBusGain: ReturnType<typeof makeMockGain>;
let mockCueMixGain: ReturnType<typeof makeMockGain>;
let mockProgramMixGain: ReturnType<typeof makeMockGain>;
let mockHeadphoneOutGain: ReturnType<typeof makeMockGain>;
const mockMediaStreamDestination = { stream: {} };

function setupAudioContextMocks() {
  mockCueBusGain = makeMockGain();
  mockProgramBusGain = makeMockGain();
  mockCueMixGain = makeMockGain();
  mockProgramMixGain = makeMockGain();
  mockHeadphoneOutGain = makeMockGain();

  // createGain order inside ensureInitialized(): cueBus, programBus, cueMix, programMix, headphoneOut
  mockContext.createGain
    .mockReturnValueOnce(mockCueBusGain)
    .mockReturnValueOnce(mockProgramBusGain)
    .mockReturnValueOnce(mockCueMixGain)
    .mockReturnValueOnce(mockProgramMixGain)
    .mockReturnValueOnce(mockHeadphoneOutGain);

  mockContext.createMediaStreamDestination.mockReturnValue(mockMediaStreamDestination);
}

vi.mock('../services/audioContext', () => ({
  getAudioContext: () => mockContext,
}));

import { cueEngine, __resetCueEngineForTests } from '../services/cueEngine';

function makeFakeGainNode() {
  return { connect: vi.fn(), disconnect: vi.fn() } as unknown as GainNode;
}
function makeFakeAnalyser() {
  return { connect: vi.fn(), disconnect: vi.fn() } as unknown as AnalyserNode;
}

beforeEach(() => {
  vi.resetAllMocks();
  __resetCueEngineForTests();
  mockContext.currentTime = 0;
  setupAudioContextMocks();
});

afterEach(() => {
  delete (HTMLMediaElement.prototype as unknown as Record<string, unknown>).setSinkId;
});

describe('cueEngine — registration is pure bookkeeping', () => {
  it('registerDeckCueSend does not touch the AudioContext', () => {
    cueEngine.registerDeckCueSend('A', makeFakeGainNode());
    expect(mockContext.createGain).not.toHaveBeenCalled();
  });

  it('registerDeckProgramTap does not touch the AudioContext', () => {
    cueEngine.registerDeckProgramTap('A', makeFakeAnalyser());
    expect(mockContext.createGain).not.toHaveBeenCalled();
  });

  it('unregisterDeck is safe to call for a deck that was never registered', () => {
    expect(() => cueEngine.unregisterDeck('A')).not.toThrow();
  });
});

describe('cueEngine — setDeckCueEnabled', () => {
  it('lazily creates the bus graph on first call', () => {
    cueEngine.setDeckCueEnabled('A', true);
    expect(mockContext.createGain).toHaveBeenCalledTimes(5);
    expect(mockContext.createMediaStreamDestination).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — does not recreate the graph on a second call', () => {
    cueEngine.setDeckCueEnabled('A', true);
    cueEngine.setDeckCueEnabled('B', true);
    expect(mockContext.createGain).toHaveBeenCalledTimes(5);
  });

  it('connects a registered deck send to the cue bus when enabled', () => {
    const send = makeFakeGainNode();
    cueEngine.registerDeckCueSend('A', send);
    cueEngine.setDeckCueEnabled('A', true);
    expect(send.connect).toHaveBeenCalledWith(mockCueBusGain);
  });

  it('disconnects the deck send from the cue bus when disabled', () => {
    const send = makeFakeGainNode();
    cueEngine.registerDeckCueSend('A', send);
    cueEngine.setDeckCueEnabled('A', true);
    cueEngine.setDeckCueEnabled('A', false);
    expect(send.disconnect).toHaveBeenCalledWith(mockCueBusGain);
  });

  it('supports both decks cued simultaneously (summed into one bus)', () => {
    const sendA = makeFakeGainNode();
    const sendB = makeFakeGainNode();
    cueEngine.registerDeckCueSend('A', sendA);
    cueEngine.registerDeckCueSend('B', sendB);
    cueEngine.setDeckCueEnabled('A', true);
    cueEngine.setDeckCueEnabled('B', true);
    expect(sendA.connect).toHaveBeenCalledWith(mockCueBusGain);
    expect(sendB.connect).toHaveBeenCalledWith(mockCueBusGain);
  });

  it('does nothing (no throw) when the deck was never registered', () => {
    expect(() => cueEngine.setDeckCueEnabled('A', true)).not.toThrow();
  });
});

describe('cueEngine — registerDeckProgramTap catch-up on lazy init', () => {
  it('connects a program tap registered BEFORE init once any deck triggers init', () => {
    const analyser = makeFakeAnalyser();
    cueEngine.registerDeckProgramTap('A', analyser);
    expect(analyser.connect).not.toHaveBeenCalled();

    cueEngine.setDeckCueEnabled('B', true); // triggers lazy init via any deck's toggle
    expect(analyser.connect).toHaveBeenCalledWith(mockProgramBusGain);
  });

  it('connects a program tap registered AFTER init immediately', () => {
    cueEngine.setDeckCueEnabled('A', true); // triggers lazy init
    const analyser = makeFakeAnalyser();
    cueEngine.registerDeckProgramTap('B', analyser);
    expect(analyser.connect).toHaveBeenCalledWith(mockProgramBusGain);
  });

  it('does not auto-connect a cue send for a deck registered but never toggled on', () => {
    const sendA = makeFakeGainNode();
    const sendB = makeFakeGainNode();
    cueEngine.registerDeckCueSend('A', sendA);
    cueEngine.setDeckCueEnabled('A', true);
    cueEngine.registerDeckCueSend('B', sendB);
    expect(sendB.connect).not.toHaveBeenCalled();
  });
});

describe('cueEngine — unregisterDeck', () => {
  it('disconnects a currently cue-enabled deck and forgets it', () => {
    const send = makeFakeGainNode();
    cueEngine.registerDeckCueSend('A', send);
    cueEngine.setDeckCueEnabled('A', true);
    cueEngine.unregisterDeck('A');
    expect(send.disconnect).toHaveBeenCalledWith(mockCueBusGain);
  });

  it('is a no-op disconnect for a deck that was registered but never enabled', () => {
    const send = makeFakeGainNode();
    cueEngine.registerDeckCueSend('A', send);
    expect(() => cueEngine.unregisterDeck('A')).not.toThrow();
    expect(send.disconnect).not.toHaveBeenCalled();
  });
});

describe('cueEngine — setHeadphoneMix', () => {
  it('sets cueMixGain to (1 - mix) and programMixGain to mix', () => {
    cueEngine.setHeadphoneMix(0.3);
    expect(mockCueMixGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.7, 0, 0.01);
    expect(mockProgramMixGain.gain.setTargetAtTime).toHaveBeenCalledWith(0.3, 0, 0.01);
  });

  it('clamps values below 0 to 0', () => {
    cueEngine.setHeadphoneMix(-1);
    expect(mockProgramMixGain.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.01);
    expect(mockCueMixGain.gain.setTargetAtTime).toHaveBeenCalledWith(1, 0, 0.01);
  });

  it('clamps values above 1 to 1', () => {
    cueEngine.setHeadphoneMix(2);
    expect(mockProgramMixGain.gain.setTargetAtTime).toHaveBeenCalledWith(1, 0, 0.01);
    expect(mockCueMixGain.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.01);
  });

  it('triggers lazy init if called before any deck is cued', () => {
    cueEngine.setHeadphoneMix(0.5);
    expect(mockContext.createGain).toHaveBeenCalledTimes(5);
  });
});

describe('cueEngine — setHeadphoneDeviceId', () => {
  it('calls setSinkId on the hidden audio element when supported', async () => {
    const mockSetSinkId = vi.fn().mockResolvedValue(undefined);
    (HTMLMediaElement.prototype as unknown as Record<string, unknown>).setSinkId = mockSetSinkId;

    await cueEngine.setHeadphoneDeviceId('device-123');

    expect(mockSetSinkId).toHaveBeenCalledWith('device-123');
  });

  it('passes an empty string to reset to the default device', async () => {
    const mockSetSinkId = vi.fn().mockResolvedValue(undefined);
    (HTMLMediaElement.prototype as unknown as Record<string, unknown>).setSinkId = mockSetSinkId;

    await cueEngine.setHeadphoneDeviceId(null);

    expect(mockSetSinkId).toHaveBeenCalledWith('');
  });

  it('does nothing when setSinkId is unsupported (jsdom default)', async () => {
    await expect(cueEngine.setHeadphoneDeviceId('device-123')).resolves.toBeUndefined();
  });
});

describe('cueEngine — isOutputDeviceSelectionSupported', () => {
  it('returns false when HTMLMediaElement.prototype has no setSinkId (jsdom default)', () => {
    expect(cueEngine.isOutputDeviceSelectionSupported()).toBe(false);
  });

  it('returns true when setSinkId exists on HTMLMediaElement.prototype', () => {
    (HTMLMediaElement.prototype as unknown as Record<string, unknown>).setSinkId = vi.fn();
    expect(cueEngine.isOutputDeviceSelectionSupported()).toBe(true);
  });
});
