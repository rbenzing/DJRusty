import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';

function mockPlayer(pos = 0) {
  return { seekTo: vi.fn(), getCurrentTime: () => pos, getDuration: () => 180 };
}

describe('dispatchTransport', () => {
  beforeEach(() => { useDeckStore.getState().clearTrack('A'); playerRegistry.unregister('A'); });

  it('PAUSED + CUE_PRESS sets the cue at the playhead, seeks there, → CUED', () => {
    const p = mockPlayer(25);
    playerRegistry.register('A', p as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setPlaybackState('A', 'paused'); // → transportState PAUSED
    s.dispatchTransport('A', { type: 'CUE_PRESS' });
    const d = useDeckStore.getState().decks.A;
    expect(d.cuePoint).toBeCloseTo(25, 3);
    expect(p.seekTo).toHaveBeenCalledWith(25, true);
    expect(d.transportState).toBe('CUED');
  });

  it('PLAYING + CUE_PRESS jumps back to the cue and pauses → CUED', () => {
    const p = mockPlayer(40);
    playerRegistry.register('A', p as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setCuePoint('A', 10);
    s.setPlaybackState('A', 'playing'); // → PLAYING
    s.dispatchTransport('A', { type: 'CUE_PRESS' });
    const d = useDeckStore.getState().decks.A;
    expect(p.seekTo).toHaveBeenCalledWith(10, true);
    expect(d.transportState).toBe('CUED');
    expect(d.playbackState).toBe('paused');
  });

  it('CUED + PLAY → PLAYING', () => {
    playerRegistry.register('A', mockPlayer() as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    // fresh deck transportState is 'CUED'
    s.dispatchTransport('A', { type: 'PLAY' });
    const d = useDeckStore.getState().decks.A;
    expect(d.transportState).toBe('PLAYING');
    expect(d.playbackState).toBe('playing');
  });
});
