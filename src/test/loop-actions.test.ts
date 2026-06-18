import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';

function mockEngine() {
  return { seekTo: vi.fn(), getCurrentTime: () => 0, getDuration: () => 180, setLoop: vi.fn(), clearLoop: vi.fn(), isLooping: () => false };
}

describe('grid-snapped loop actions', () => {
  beforeEach(() => { useDeckStore.getState().clearTrack('A'); playerRegistry.unregister('A'); });

  it('activateLoopBeat snaps loopStart to the grid and arms the engine loop', () => {
    const eng = mockEngine();
    playerRegistry.register('A', eng as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setGrid('A', 120, 0.5);   // beats at .5,1,1.5,...
    s.setCurrentTime('A', 1.7);
    s.activateLoopBeat('A', 4);
    const d = useDeckStore.getState().decks.A;
    expect(d.loopActive).toBe(true);
    expect(d.loopStart).toBeCloseTo(1.5, 6);   // snapped to beat at/before 1.7
    expect(d.loopEnd).toBeCloseTo(3.5, 6);     // +4 beats (2.0s)
    expect(eng.setLoop).toHaveBeenCalledWith(1.5, 3.5);
  });

  it('deactivateLoop clears the engine loop', () => {
    const eng = mockEngine();
    playerRegistry.register('A', eng as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setGrid('A', 120, 0.5); s.setCurrentTime('A', 1.7); s.activateLoopBeat('A', 4);
    s.deactivateLoop('A');
    expect(eng.clearLoop).toHaveBeenCalled();
    expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
  });

  it('activateLoopBeat is a no-op when there is no confirmed grid (anchor null)', () => {
    const eng = mockEngine();
    playerRegistry.register('A', eng as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setBpm('A', 120); // bpm set but anchor still null
    s.activateLoopBeat('A', 4);
    expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
    expect(eng.setLoop).not.toHaveBeenCalled();
  });
});
