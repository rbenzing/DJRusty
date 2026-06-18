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
});
