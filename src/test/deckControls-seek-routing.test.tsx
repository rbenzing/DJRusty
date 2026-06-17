import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeckControls } from '../components/Deck/DeckControls';
import { playerRegistry } from '../services/playerRegistry';
import type { DeckPlayer } from '../services/playerRegistry';
import { useDeckStore } from '../store/deckStore';

function makePlayer(): DeckPlayer {
  return { seekTo: vi.fn(), getCurrentTime: vi.fn(() => 0), getDuration: vi.fn(() => 180) };
}

describe('DeckControls — seek routes to the active backend', () => {
  let audio: DeckPlayer;

  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    playerRegistry.unregister('A');
    audio = makePlayer();
    playerRegistry.register('A', audio);
  });

  it('CUE while PLAYING seeks the registered player back to the cue point', () => {
    const store = useDeckStore.getState();
    store.loadTrack('A', 'entry1', { title: 't', artist: 'a', duration: 180, thumbnailUrl: null });
    store.setPlayerReady('A', true);
    // Set the CDJ cue point and put the machine in PLAYING state.
    store.setCuePoint('A', 42);
    store.dispatchTransport('A', { type: 'PLAY' }); // CUED → PLAYING
    render(<DeckControls deckId="A" />);
    // pointerDown on CUE button fires CUE_PRESS — from PLAYING state: seeks to cue & pauses
    fireEvent.pointerDown(screen.getByLabelText('Cue Deck A'));
    expect(audio.seekTo).toHaveBeenCalledWith(42, true);
  });

  it('Restart seeks the audio player to position 0', () => {
    const store = useDeckStore.getState();
    store.loadTrack('A', 'entry1', { title: 't', artist: 'a', duration: 180, thumbnailUrl: null });
    store.setPlayerReady('A', true);
    render(<DeckControls deckId="A" />);
    fireEvent.click(screen.getByLabelText('Restart Deck A'));
    expect(audio.seekTo).toHaveBeenCalledWith(0, true);
  });
});
