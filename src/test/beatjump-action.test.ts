import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';

function mockPlayer() { return { seekTo: vi.fn(), getCurrentTime: () => 0, getDuration: () => 180 }; }

describe('beatJump action', () => {
  beforeEach(() => { useDeckStore.getState().clearTrack('A'); playerRegistry.unregister('A'); });

  it('seeks to a grid-snapped target', () => {
    const p = mockPlayer();
    playerRegistry.register('A', p as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setGrid('A', 120, 0.5);
    s.setCurrentTime('A', 1.7);
    // beatJumpSize default is 4
    s.beatJump('A', 1);
    expect(p.seekTo).toHaveBeenCalledWith(3.5, true); // nearestBeat(1.5)+4 beats
  });

  it('is a no-op without a grid (bpm or anchor null)', () => {
    const p = mockPlayer();
    playerRegistry.register('A', p as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setBpm('A', 120); // anchor still null
    s.beatJump('A', 1);
    expect(p.seekTo).not.toHaveBeenCalled();
  });

  it('SHIFT: uses the next-larger BEAT_JUMP_SIZES entry for a one-shot bigger jump', () => {
    const p = mockPlayer();
    playerRegistry.register('A', p as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setGrid('A', 120, 0);
    s.setCurrentTime('A', 0);
    s.setBeatJumpSize('A', 1);

    // shift=false: jump uses size 1 (0.5s at 120bpm)
    s.beatJump('A', 1);
    expect(p.seekTo).toHaveBeenLastCalledWith(0.5, true);

    // shift=true: jump uses the next size up (2), without changing beatJumpSize.
    s.setShift('A', true);
    s.beatJump('A', 1);
    expect(p.seekTo).toHaveBeenLastCalledWith(1, true);
    expect(useDeckStore.getState().decks.A.beatJumpSize).toBe(1);
  });

  it('SHIFT clamps to the largest available size when beatJumpSize is already the max', () => {
    const p = mockPlayer();
    playerRegistry.register('A', p as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setGrid('A', 120, 0);
    s.setCurrentTime('A', 0);
    s.setBeatJumpSize('A', 16); // largest entry in BEAT_JUMP_SIZES
    s.setShift('A', true);
    s.beatJump('A', 1);
    // 16 beats at 120bpm = 8s/beat*16 = 8s
    expect(p.seekTo).toHaveBeenLastCalledWith(8, true);
    expect(useDeckStore.getState().decks.A.beatJumpSize).toBe(16);
  });
});
