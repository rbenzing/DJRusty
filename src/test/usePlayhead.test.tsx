import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePlayhead } from '../hooks/usePlayhead';
import { playerRegistry } from '../services/playerRegistry';
import { useDeckStore } from '../store/deckStore';

describe('usePlayhead', () => {
  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    playerRegistry.unregister('A', 'youtube'); playerRegistry.unregister('A', 'audio');
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number);
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reads the active player clock into the ref without touching the store', async () => {
    let t = 0;
    playerRegistry.register('A', 'audio', { seekTo: vi.fn(), getCurrentTime: () => t, getDuration: () => 180 });
    useDeckStore.getState().loadTrack('A', 'x', { sourceType: 'mp3', title: '', artist: '', duration: 180, thumbnailUrl: null });
    const spy = vi.spyOn(useDeckStore.getState(), 'setCurrentTime');
    const { result } = renderHook(() => usePlayhead('A'));
    t = 12.34;
    await new Promise((r) => setTimeout(r, 5));
    expect(result.current.current).toBeCloseTo(12.34, 2);
    expect(spy).not.toHaveBeenCalled(); // never writes the store per frame
  });
});
