import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSamplerStore } from '../store/samplerStore';
import * as audioDecoder from '../services/audioDecoder';

describe('samplerStore', () => {
  beforeEach(() => {
    useSamplerStore.setState({ slots: { A: Array(8).fill(null), B: Array(8).fill(null) } });
    vi.restoreAllMocks();
  });

  it('starts with 8 empty slots per deck', () => {
    expect(useSamplerStore.getState().slots.A).toHaveLength(8);
    expect(useSamplerStore.getState().slots.A.every((s) => s === null)).toBe(true);
    expect(useSamplerStore.getState().slots.B).toHaveLength(8);
  });

  it('loadFile decodes and stores the buffer', async () => {
    const mockBuffer = { duration: 2 } as AudioBuffer;
    vi.spyOn(audioDecoder, 'decodeAudioFile').mockResolvedValue(mockBuffer);
    const file = new File([new Uint8Array([1, 2, 3])], 'kick.wav', { type: 'audio/wav' });

    const promise = useSamplerStore.getState().loadFile('A', 2, file);
    expect(useSamplerStore.getState().slots.A[2]?.decoding).toBe(true);

    await promise;

    const slot = useSamplerStore.getState().slots.A[2];
    expect(slot?.decoding).toBe(false);
    expect(slot?.buffer).toBe(mockBuffer);
    expect(slot?.fileName).toBe('kick.wav');
    expect(slot?.decodeError).toBeNull();
  });

  it('sets decodeError when decoding fails', async () => {
    vi.spyOn(audioDecoder, 'decodeAudioFile').mockRejectedValue(new Error('bad file'));
    const file = new File([new Uint8Array([1])], 'broken.mp3', { type: 'audio/mpeg' });

    await useSamplerStore.getState().loadFile('B', 0, file);

    const slot = useSamplerStore.getState().slots.B[0];
    expect(slot?.decoding).toBe(false);
    expect(slot?.buffer).toBeNull();
    expect(slot?.decodeError).toBe("Couldn't decode — this format may be unsupported in your browser");
  });

  it('clearSlot empties a slot', async () => {
    const mockBuffer = { duration: 2 } as AudioBuffer;
    vi.spyOn(audioDecoder, 'decodeAudioFile').mockResolvedValue(mockBuffer);
    await useSamplerStore.getState().loadFile('A', 5, new File([new Uint8Array([1])], 'snare.wav', { type: 'audio/wav' }));
    expect(useSamplerStore.getState().slots.A[5]).not.toBeNull();

    useSamplerStore.getState().clearSlot('A', 5);
    expect(useSamplerStore.getState().slots.A[5]).toBeNull();
  });

  it('restoreSlot accepts an already-decoded slot directly', () => {
    const mockBuffer = { duration: 3 } as AudioBuffer;
    const slot = { fileName: 'clap.wav', file: new File([], 'clap.wav'), buffer: mockBuffer, decoding: false, decodeError: null };
    useSamplerStore.getState().restoreSlot('B', 4, slot);
    expect(useSamplerStore.getState().slots.B[4]).toEqual(slot);
  });

  it('slots for deck A and B are independent', async () => {
    const mockBuffer = { duration: 1 } as AudioBuffer;
    vi.spyOn(audioDecoder, 'decodeAudioFile').mockResolvedValue(mockBuffer);
    await useSamplerStore.getState().loadFile('A', 0, new File([new Uint8Array([1])], 'a.wav', { type: 'audio/wav' }));
    expect(useSamplerStore.getState().slots.B[0]).toBeNull();
  });

  it('discards a stale decode resolution when the same slot is re-loaded before the first decode finishes', async () => {
    let resolveFirst: (buf: AudioBuffer) => void = () => {};
    let resolveSecond: (buf: AudioBuffer) => void = () => {};
    const firstPromise = new Promise<AudioBuffer>((res) => { resolveFirst = res; });
    const secondPromise = new Promise<AudioBuffer>((res) => { resolveSecond = res; });
    vi.spyOn(audioDecoder, 'decodeAudioFile')
      .mockReturnValueOnce(firstPromise)
      .mockReturnValueOnce(secondPromise);

    const fileX = new File([new Uint8Array([1])], 'x.wav', { type: 'audio/wav' });
    const fileY = new File([new Uint8Array([2])], 'y.wav', { type: 'audio/wav' });
    const bufferX = { duration: 1 } as AudioBuffer;
    const bufferY = { duration: 2 } as AudioBuffer;

    const p1 = useSamplerStore.getState().loadFile('A', 0, fileX);
    const p2 = useSamplerStore.getState().loadFile('A', 0, fileY);

    // Resolve the FIRST (now-stale) call's decode AFTER the second one, simulating out-of-order completion.
    resolveSecond(bufferY);
    await p2;
    resolveFirst(bufferX);
    await p1;

    const slot = useSamplerStore.getState().slots.A[0];
    expect(slot?.fileName).toBe('y.wav');
    expect(slot?.buffer).toBe(bufferY);
  });

  it('clearSlot invalidates an in-flight decode so it cannot resurrect after being cleared', async () => {
    let resolveDecode: (buf: AudioBuffer) => void = () => {};
    const decodePromise = new Promise<AudioBuffer>((res) => { resolveDecode = res; });
    vi.spyOn(audioDecoder, 'decodeAudioFile').mockReturnValueOnce(decodePromise);

    const file = new File([new Uint8Array([1])], 'ghost.wav', { type: 'audio/wav' });
    const promise = useSamplerStore.getState().loadFile('A', 1, file);

    useSamplerStore.getState().clearSlot('A', 1);

    resolveDecode({ duration: 1 } as AudioBuffer);
    await promise;

    expect(useSamplerStore.getState().slots.A[1]).toBeNull();
  });
});
