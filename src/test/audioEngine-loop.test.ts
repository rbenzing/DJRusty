/**
 * audioEngine-loop.test.ts — Tests for native sample-accurate loop points.
 *
 * Uses the same Web Audio mock setup as audioEngine.test.ts.
 * Tests setLoop / clearLoop / isLooping and getCurrentTime loop folding.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AudioEngineImpl } from '../services/audioEngine';

// ── Mock Web Audio API (mirrors audioEngine.test.ts) ──────────────────────

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
  return { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1.0 } };
}

function makeMockFilter(type: string, freq: number) {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    gain: { value: 0 },
    frequency: { value: freq },
    Q: { value: 0.7 },
    type,
  };
}

const mockAnalyser = { connect: vi.fn(), disconnect: vi.fn() };

// Factory for fresh source node mocks — each call to createBufferSource returns a new object
function makeMockSourceNode() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    buffer: null as AudioBuffer | null,
    playbackRate: { value: 1.0 },
    onended: null as (() => void) | null,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
  };
}

// Keep a reference to the latest source node for per-test assertions
let lastSourceNode: ReturnType<typeof makeMockSourceNode>;

vi.mock('../services/audioContext', () => ({
  getAudioContext: () => mockContext,
  ensureAudioContextResumed: vi.fn().mockResolvedValue(undefined),
}));

function setupConstructorMocks() {
  mockContext.createGain
    .mockReturnValueOnce(makeMockGain())  // gainNode
    .mockReturnValueOnce(makeMockGain())  // lowKillGain
    .mockReturnValueOnce(makeMockGain())  // midKillGain
    .mockReturnValueOnce(makeMockGain())  // highKillGain
    .mockReturnValueOnce(makeMockGain())  // dryGain
    .mockReturnValueOnce(makeMockGain()); // wetGain

  mockContext.createBiquadFilter
    .mockReturnValueOnce(makeMockFilter('lowshelf',  320))
    .mockReturnValueOnce(makeMockFilter('peaking',  1000))
    .mockReturnValueOnce(makeMockFilter('highshelf', 3200))
    .mockReturnValueOnce(makeMockFilter('allpass',  20000));

  mockContext.createAnalyser.mockReturnValue(mockAnalyser);
  // Return a fresh node each time so tests can verify a NEW node was created
  mockContext.createBufferSource.mockImplementation(() => {
    lastSourceNode = makeMockSourceNode();
    return lastSourceNode;
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AudioEngineImpl loop points', () => {
  let engine: AudioEngineImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext.currentTime = 0;

    setupConstructorMocks();
    engine = new AudioEngineImpl();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('setLoop turns on native looping with the given bounds; clearLoop turns it off', async () => {
    const mockBuffer = { duration: 120 } as AudioBuffer;
    engine.loadBuffer(mockBuffer);

    await engine.play(0);
    engine.setLoop(2, 4);

    expect(engine.isLooping()).toBe(true);
    // Assert native Web Audio loop properties on the live source node
    expect(lastSourceNode.loop).toBe(true);
    expect(lastSourceNode.loopStart).toBe(2);
    expect(lastSourceNode.loopEnd).toBe(4);

    engine.clearLoop();
    expect(engine.isLooping()).toBe(false);
    expect(lastSourceNode.loop).toBe(false);
  });

  it('getCurrentTime folds the position into the active loop window', async () => {
    const mockBuffer = { duration: 120 } as AudioBuffer;
    engine.loadBuffer(mockBuffer);

    // Play from loopStart=2, set loop [2, 4) — a 2-second window
    await engine.play(2);
    engine.setLoop(2, 4);

    // Advance mock clock by 5 seconds at 1x playback rate.
    // Raw position = 2 + 5 = 7, which is 5s past loopStart=2.
    // 5 mod 2 = 1 → folded position = 2 + 1 = 3
    mockContext.currentTime = 5;

    const t = engine.getCurrentTime();
    // base = 2 + (5 - 0) * 1.0 = 7; fold = 2 + ((7 - 2) % 2) = 2 + 1 = 3
    expect(t).toBeCloseTo(3, 6);
  });

  it('rejects an out-of-order loop (end <= start)', async () => {
    const mockBuffer = { duration: 120 } as AudioBuffer;
    engine.loadBuffer(mockBuffer);

    await engine.play(0);
    engine.setLoop(4, 2); // invalid: end < start

    expect(engine.isLooping()).toBe(false);
    expect(lastSourceNode.loop).toBe(false);
  });

  it('a new source node created by play() inherits an active loop', async () => {
    const mockBuffer = { duration: 120 } as AudioBuffer;
    engine.loadBuffer(mockBuffer);

    await engine.play(0);
    engine.setLoop(1, 3);

    // Capture the node that was used for the initial play()
    const firstNode = lastSourceNode;
    const callCountAfterFirstPlay = mockContext.createBufferSource.mock.calls.length;

    // seekTo while playing triggers a new play() internally, creating a NEW source node
    engine.seekTo(1);
    // Let the async play() settle
    await new Promise(resolve => setTimeout(resolve, 0));

    // Prove a new node was created (call count increased)
    expect(mockContext.createBufferSource.mock.calls.length).toBeGreaterThan(callCountAfterFirstPlay);
    // Prove it is a genuinely different object from the first one
    expect(lastSourceNode).not.toBe(firstNode);
    // Prove the NEW node has the loop armed
    expect(lastSourceNode.loop).toBe(true);
    expect(lastSourceNode.loopStart).toBe(1);
    expect(lastSourceNode.loopEnd).toBe(3);
  });
});

describe('AudioEngineImpl — playing state across seek-restart (ghost-player regression)', () => {
  let engine: AudioEngineImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext.currentTime = 0;
    setupConstructorMocks();
    engine = new AudioEngineImpl();
  });

  afterEach(() => engine.destroy());

  it('a superseded source ending does NOT clobber the live playing state, and pause() still stops it', async () => {
    engine.loadBuffer({ duration: 120 } as AudioBuffer);

    await engine.play(0);
    const sourceA = lastSourceNode; // source from the first play()

    // Seek while playing — what CUE / loops / beat-jump / SYNC all do — re-triggers
    // play() internally, creating a NEW source B and stopping source A.
    engine.seekTo(10);
    await new Promise((r) => setTimeout(r, 0)); // let the async play() settle
    const sourceB = lastSourceNode;
    expect(sourceB).not.toBe(sourceA);

    // The browser now delivers the OLD (superseded) source's ended event, asynchronously.
    sourceA.onended?.();

    // The engine must still know it is playing (source B is live) — else it's a ghost.
    expect(engine.isPlaying()).toBe(true);

    // pause() must actually stop the live source.
    engine.pause();
    expect(engine.isPlaying()).toBe(false);
    expect(sourceB.stop).toHaveBeenCalled();
  });

  it('natural end of the current source fires onEnded and clears the playing state', async () => {
    engine.loadBuffer({ duration: 120 } as AudioBuffer);
    const onEnded = vi.fn();
    engine.onEnded(onEnded);

    await engine.play(0);
    const source = lastSourceNode;

    // The current source reaches its natural end (no intervening seek/pause/stop).
    source.onended?.();

    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(engine.isPlaying()).toBe(false);
  });

  it('pause() clears the playing state deterministically (not via the source onended)', async () => {
    engine.loadBuffer({ duration: 120 } as AudioBuffer);
    await engine.play(0);
    expect(engine.isPlaying()).toBe(true);

    engine.pause();
    // isPlaying must be false immediately — without relying on the mock to fire onended.
    expect(engine.isPlaying()).toBe(false);
  });
});
