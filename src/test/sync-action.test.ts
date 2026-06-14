import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';
import { PITCH_RATES } from '../constants/pitchRates';

function mockPlayer(pos = 0) { return { seekTo: vi.fn(), getCurrentTime: () => pos, getDuration: () => 180 }; }

describe('syncToDeck — exact tempo + phase align', () => {
  beforeEach(() => {
    useDeckStore.getState().clearTrack('A'); useDeckStore.getState().clearTrack('B');
    playerRegistry.unregister('A', 'audio'); playerRegistry.unregister('B', 'audio');
    playerRegistry.unregister('A', 'youtube'); playerRegistry.unregister('B', 'youtube');
  });

  it('sets this deck pitch to the EXACT continuous ratio (not snapped) and marks synced', () => {
    playerRegistry.register('A', 'audio', mockPlayer(1.0) as never);
    playerRegistry.register('B', 'audio', mockPlayer(1.0) as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'a', { sourceType: 'mp3', title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.loadTrack('B', 'b', { sourceType: 'mp3', title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setGrid('A', 100, 0.0); // this deck
    s.setGrid('B', 120, 0.0); // other deck, pitch 1.0 → effective 120
    s.syncToDeck('A', 'B');
    const d = useDeckStore.getState().decks.A;
    expect(d.pitchRate).toBeCloseTo(1.2, 6); // exact 120/100, NOT snapped to 1.25
    expect(d.synced).toBe(true);
  });

  it('is a no-op when either deck lacks a grid (bpm or anchor null)', () => {
    playerRegistry.register('A', 'audio', mockPlayer() as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'a', { sourceType: 'mp3', title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setGrid('A', 100, 0.0);
    // B has no grid
    s.syncToDeck('A', 'B');
    expect(useDeckStore.getState().decks.A.synced).toBe(false);
  });

  it('clamps the phase seek target to >= 0 when phaseDelta would push it negative', () => {
    // myPos is near 0 and anchor is offset so phaseDelta pushes target below 0.
    // With bpm=100, spb = 0.6s. Anchor = 0.5 means phase(thisGrid, 0.05) = (0.05 - 0.5)/0.6 = -0.75 → wraps.
    // Other grid anchor=0, so phase(otherGrid, 0.05) = 0.05/0.6 = 0.083.
    // We just need seekTo to be called with a value >= 0.
    const playerA = mockPlayer(0.05); // myPos very near start
    playerRegistry.register('A', 'audio', playerA as never);
    playerRegistry.register('B', 'audio', mockPlayer(0.05) as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'a', { sourceType: 'mp3', title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.loadTrack('B', 'b', { sourceType: 'mp3', title: '', artist: '', duration: 180, thumbnailUrl: null });
    // Use an anchor offset that guarantees phaseDelta would produce a negative target
    // from myPos=0.05: anchor=0.55 gives phase offset near -half-beat from near-0 position.
    s.setGrid('A', 100, 0.55); // shifted anchor
    s.setGrid('B', 100, 0.0);  // same bpm, different anchor
    s.syncToDeck('A', 'B');
    expect(playerA.seekTo).toHaveBeenCalled();
    const calledWith = (playerA.seekTo as ReturnType<typeof vi.fn>).mock.calls[0][0] as number;
    expect(calledWith).toBeGreaterThanOrEqual(0);
  });

  it('snaps pitch to a discrete PITCH_RATES value for a YouTube deck', () => {
    const playerA = mockPlayer(1.0);
    playerRegistry.register('A', 'youtube', playerA as never);
    playerRegistry.register('B', 'youtube', mockPlayer(1.0) as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'a', { sourceType: 'youtube', title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.loadTrack('B', 'b', { sourceType: 'youtube', title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setGrid('A', 100, 0.0);
    s.setGrid('B', 120, 0.0); // exactSyncRate = 1.2, nearest discrete = 1.25
    s.syncToDeck('A', 'B');
    const d = useDeckStore.getState().decks.A;
    // Rate must be a member of PITCH_RATES (discrete), not the exact 1.2
    expect(PITCH_RATES).toContain(d.pitchRate);
    expect(d.pitchRate).toBe(1.25); // nearest discrete to 1.2
  });

  it('nudgeGrid clears synced on that deck', () => {
    playerRegistry.register('A', 'audio', mockPlayer(1.0) as never);
    playerRegistry.register('B', 'audio', mockPlayer(1.0) as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'a', { sourceType: 'mp3', title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.loadTrack('B', 'b', { sourceType: 'mp3', title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setGrid('A', 100, 0.0);
    s.setGrid('B', 120, 0.0);
    s.syncToDeck('A', 'B');
    expect(useDeckStore.getState().decks.A.synced).toBe(true);
    s.nudgeGrid('A', 0.01);
    expect(useDeckStore.getState().decks.A.synced).toBe(false);
  });
});
