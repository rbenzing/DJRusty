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
    // setLoopOut consumes manualLoopIn; it must not linger and re-arm stale state
    // on a second OUT press (also keeps the IN button from staying visually "armed").
    expect(d.manualLoopIn).toBeNull();
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
    const d = useDeckStore.getState().decks.A;
    expect(d.loopActive).toBe(true);
    expect(eng.setLoop).toHaveBeenCalledWith(1.0, 2.0);
    s.reloop('A'); // toggle off
    expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
  });

  it('loadTrack resets manualLoopIn and lastManualLoop for a fresh track (no stale state carries over)', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'track1', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setCurrentTime('A', 1.0); s.setLoopIn('A');
    s.setCurrentTime('A', 2.0); s.setLoopOut('A');
    let d = useDeckStore.getState().decks.A;
    // setLoopOut consumes manualLoopIn (Fix 3): already null right after arming the loop.
    expect(d.manualLoopIn).toBeNull();
    expect(d.lastManualLoop).toEqual({ start: 1.0, end: 2.0 });

    // Arm a fresh, uncommitted manual IN (no OUT yet) so loadTrack has stale
    // pending state to clear too, not just the already-consumed one above.
    s.setCurrentTime('A', 3.0); s.setLoopIn('A');
    expect(useDeckStore.getState().decks.A.manualLoopIn).toBeCloseTo(3.0, 6);

    // Load a new track onto the same deck without ejecting first.
    s.loadTrack('A', 'track2', { title: 'New Track', artist: 'New Artist', duration: 200, thumbnailUrl: null });
    d = useDeckStore.getState().decks.A;
    expect(d.manualLoopIn).toBeNull();
    expect(d.lastManualLoop).toBeNull();
  });

  it('activateLoopBeat clears a pending (not-yet-OUT) manualLoopIn but preserves lastManualLoop', () => {
    const eng = mockEngine();
    playerRegistry.register('A', eng as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    // Establish a completed manual loop first, so lastManualLoop is set.
    s.setCurrentTime('A', 1.0); s.setLoopIn('A');
    s.setCurrentTime('A', 2.0); s.setLoopOut('A');
    const lastManualLoopBefore = useDeckStore.getState().decks.A.lastManualLoop;
    expect(lastManualLoopBefore).toEqual({ start: 1.0, end: 2.0 });

    // Now arm a pending manual IN (no OUT yet) and engage a beat loop instead.
    s.setGrid('A', 120, 0.5);
    s.setCurrentTime('A', 3.0); s.setLoopIn('A');
    expect(useDeckStore.getState().decks.A.manualLoopIn).not.toBeNull();
    s.activateLoopBeat('A', 4);
    const d = useDeckStore.getState().decks.A;
    expect(d.manualLoopIn).toBeNull();
    expect(d.lastManualLoop).toEqual(lastManualLoopBefore);
  });
});
