import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PadGridHotCue } from '../components/Deck/PadGridHotCue';
import { playerRegistry } from '../services/playerRegistry';
import type { DeckPlayer } from '../services/playerRegistry';
import { useDeckStore } from '../store/deckStore';

function makePlayer(): DeckPlayer {
  return { seekTo: vi.fn(), getCurrentTime: vi.fn(() => 0), getDuration: vi.fn(() => 180) };
}

describe('HotCues — jump routes to the active backend', () => {
  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    playerRegistry.unregister('A');
  });

  it('hot cue jump seeks the registered player', () => {
    const audio = makePlayer();
    playerRegistry.register('A', audio);
    const store = useDeckStore.getState();
    store.loadTrack('A', 'entry1', { title: 't', artist: 'a', duration: 180, thumbnailUrl: null });
    store.setPlayerReady('A', true);
    store.setHotCue('A', 2, 88);
    render(<PadGridHotCue deckId="A" />);
    // A SET cue (index 2 → "Hot cue 3") fires onJump on a plain left-click.
    fireEvent.click(screen.getByRole('button', { name: /Hot cue 3 on Deck A/ }));
    expect(audio.seekTo).toHaveBeenCalledWith(88, true);
  });

  it('clicking an UNSET hot cue sets it at the current playhead', () => {
    const audio = makePlayer();
    playerRegistry.register('A', audio);
    const store = useDeckStore.getState();
    store.loadTrack('A', 'entry1', { title: 't', artist: 'a', duration: 180, thumbnailUrl: null });
    store.setPlayerReady('A', true);
    store.setCurrentTime('A', 33);
    // cue at index 2 is unset — clicking it should set it at playhead (33s)
    render(<PadGridHotCue deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /hot cue 3 on deck a.*not set/i }));
    expect(useDeckStore.getState().decks.A.hotCues[2]).toBeCloseTo(33, 3);
  });
});
