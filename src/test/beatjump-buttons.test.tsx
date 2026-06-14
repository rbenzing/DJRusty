/**
 * beatjump-buttons.test.tsx — BeatJump component click handlers use the grid-snapped action.
 *
 * Verifies that clicking the back/forward buttons calls the store's beatJump
 * action (grid-snapped) rather than the old relative-seek logic.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BeatJump } from '../components/Deck/BeatJump';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';
import type { DeckPlayer } from '../services/playerRegistry';

function mockPlayer(): DeckPlayer {
  return { seekTo: vi.fn(), getCurrentTime: vi.fn(() => 0), getDuration: vi.fn(() => 180) };
}

describe('BeatJump buttons use the grid-snapped action', () => {
  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    playerRegistry.unregister('A', 'audio');
    playerRegistry.unregister('A', 'youtube');
    vi.clearAllMocks();
  });

  it('forward button seeks to the grid-snapped target', () => {
    const p = mockPlayer();
    playerRegistry.register('A', 'audio', p);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { sourceType: 'mp3', title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setPlayerReady('A', true);
    // anchor=0.5, bpm=120 (spb=0.5s), currentTime=1.7
    // nearestBeat(1.7) = 0.5 + round((1.7-0.5)/0.5) * 0.5 = 0.5 + round(2.4)*0.5 = 0.5 + 2*0.5 = 1.5
    // forward 4 beats: 1.5 + 4*0.5 = 3.5
    s.setGrid('A', 120, 0.5);
    s.setCurrentTime('A', 1.7); // beatJumpSize default 4

    render(<BeatJump deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /jump forward on deck a/i }));
    expect(p.seekTo).toHaveBeenCalledWith(3.5, true);
  });

  it('back button seeks to the grid-snapped target', () => {
    const p = mockPlayer();
    playerRegistry.register('A', 'audio', p);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { sourceType: 'mp3', title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setPlayerReady('A', true);
    // anchor=0, bpm=120 (spb=0.5s), currentTime=60.0
    // nearestBeat(60.0) = 0 + round(120)*0.5 = 60.0
    // backward 4 beats: 60.0 - 4*0.5 = 58.0
    s.setGrid('A', 120, 0);
    s.setCurrentTime('A', 60.0);

    render(<BeatJump deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /jump backward on deck a/i }));
    expect(p.seekTo).toHaveBeenCalledWith(58.0, true);
  });

  it('buttons are disabled when no grid is set (bpm null)', () => {
    const p = mockPlayer();
    playerRegistry.register('A', 'audio', p);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { sourceType: 'mp3', title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setPlayerReady('A', true);
    // bpm remains null — no grid

    render(<BeatJump deckId="A" />);
    const fwdBtn = screen.getByRole('button', { name: /jump forward on deck a/i });
    const backBtn = screen.getByRole('button', { name: /jump backward on deck a/i });
    expect(fwdBtn).toBeDisabled();
    expect(backBtn).toBeDisabled();
  });

  it('both buttons call beatJump (the store action, not a direct seekTo)', () => {
    const p = mockPlayer();
    playerRegistry.register('A', 'audio', p);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { sourceType: 'mp3', title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setPlayerReady('A', true);
    s.setGrid('A', 120, 0);
    s.setCurrentTime('A', 60.0);

    // Spy on the store's beatJump action to verify it's the one being called
    const beatJumpSpy = vi.spyOn(useDeckStore.getState(), 'beatJump');

    render(<BeatJump deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /jump forward on deck a/i }));
    expect(beatJumpSpy).toHaveBeenCalledWith('A', 1);

    fireEvent.click(screen.getByRole('button', { name: /jump backward on deck a/i }));
    expect(beatJumpSpy).toHaveBeenCalledWith('A', -1);

    beatJumpSpy.mockRestore();
  });
});
