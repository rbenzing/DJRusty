import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';

function mockEngine() {
  return { seekTo: vi.fn(), getCurrentTime: () => NaN, getDuration: () => 180, setLoop: vi.fn(), clearLoop: vi.fn(), isLooping: () => false };
}

describe('manual loop IN/OUT/RELOOP', () => {
  beforeEach(() => { useDeckStore.getState().clearTrack('A'); playerRegistry.unregister('A'); });

  it('IN then OUT arms a manual loop (no grid, quantize skipped)', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setCurrentTime('A', 1.0);
    s.setLoopIn('A');
    expect(useDeckStore.getState().decks.A.manualLoopIn).toBeCloseTo(1.0, 6);
    s.setCurrentTime('A', 2.0);
    s.setLoopOut('A');
    const d = useDeckStore.getState().decks.A;
    expect(d.loopActive).toBe(true);
    expect(d.loopStart).toBeCloseTo(1.0, 6);
    expect(d.loopEnd).toBeCloseTo(2.0, 6);
    expect(d.loopBeatCount).toBeNull();
    expect(d.lastManualLoop).toEqual({ start: 1.0, end: 2.0 });
  });

  it('OUT with no IN is a no-op', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setCurrentTime('A', 2.0);
    s.setLoopOut('A');
    expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
  });

  it('OUT before IN position is ignored', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setCurrentTime('A', 2.0); s.setLoopIn('A');
    s.setCurrentTime('A', 1.0); s.setLoopOut('A');
    expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
  });

  it('RELOOP re-arms the last manual loop after EXIT, and toggles off', () => {
    const eng = mockEngine();
    playerRegistry.register('A', eng as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setCurrentTime('A', 1.0); s.setLoopIn('A');
    s.setCurrentTime('A', 2.0); s.setLoopOut('A');
    s.deactivateLoop('A');
    expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
    s.reloop('A');
    let d = useDeckStore.getState().decks.A;
    expect(d.loopActive).toBe(true);
    expect(eng.setLoop).toHaveBeenCalledWith(1.0, 2.0);
    s.reloop('A'); // toggle off
    expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
  });
});
