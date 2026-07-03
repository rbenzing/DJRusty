import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';

function mockEngine() {
  return {
    seekTo: vi.fn(),
    getCurrentTime: () => 0,
    getDuration: () => 300,
    setLoop: vi.fn(),
    clearLoop: vi.fn(),
    isLooping: () => false,
  };
}

describe('startSlice', () => {
  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    playerRegistry.unregister('A');
  });

  it('arms the loop over the pressed slice and records roll-catch-up fields', () => {
    const eng = mockEngine();
    playerRegistry.register('A', eng as never);
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: { ...useDeckStore.getState().decks.A, bpm: 120, anchor: 0, currentTime: 0.3, duration: 300, sliceWindowBeats: 8 },
      },
    });

    const before = Date.now();
    act(() => {
      useDeckStore.getState().startSlice('A', 2);
    });
    const after = Date.now();

    const d = useDeckStore.getState().decks.A;
    // windowBeats=8 -> 4s window, sliceLength=0.5s; slice 2 = [1.0, 1.5)
    expect(eng.setLoop).toHaveBeenCalledWith(1.0, 1.5);
    expect(d.loopActive).toBe(true);
    expect(d.loopStart).toBeCloseTo(1.0, 6);
    expect(d.loopEnd).toBeCloseTo(1.5, 6);
    expect(d.loopBeatCount).toBeNull();
    expect(d.rollStartPosition).toBe(0.3);
    expect(d.rollStartWallClock).toBeGreaterThanOrEqual(before);
    expect(d.rollStartWallClock).toBeLessThanOrEqual(after);
  });

  it('clears a pending manualLoopIn', () => {
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: { ...useDeckStore.getState().decks.A, bpm: 120, anchor: 0, currentTime: 0.3, duration: 300, manualLoopIn: 5 },
      },
    });
    act(() => {
      useDeckStore.getState().startSlice('A', 0);
    });
    expect(useDeckStore.getState().decks.A.manualLoopIn).toBeNull();
  });

  it('triggers startSlipTracking when slipMode is on', () => {
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: { ...useDeckStore.getState().decks.A, bpm: 120, anchor: 0, currentTime: 0.3, duration: 300, slipMode: true },
      },
    });
    act(() => {
      useDeckStore.getState().startSlice('A', 0);
    });
    const d = useDeckStore.getState().decks.A;
    expect(d.slipStartPosition).toBe(0.3);
    expect(d.slipStartTime).not.toBeNull();
  });

  it('is a no-op when there is no confirmed grid', () => {
    act(() => {
      useDeckStore.getState().startSlice('A', 0);
    });
    expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
  });

  it('releasing via the existing endRoll seeks to the catch-up position', () => {
    const eng = mockEngine();
    playerRegistry.register('A', eng as never);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1000000);
      useDeckStore.setState({
        decks: {
          ...useDeckStore.getState().decks,
          A: { ...useDeckStore.getState().decks.A, bpm: 120, anchor: 0, currentTime: 0, pitchRate: 1, duration: 300 },
        },
      });
      act(() => {
        useDeckStore.getState().startSlice('A', 0);
      });
      vi.setSystemTime(1002000); // 2s later
      act(() => {
        useDeckStore.getState().endRoll('A');
      });
      expect(eng.seekTo).toHaveBeenCalledWith(2, true);
      expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
