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
  let yt: DeckPlayer;
  let audio: DeckPlayer;

  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    playerRegistry.unregister('A', 'youtube');
    playerRegistry.unregister('A', 'audio');
    yt = makePlayer();
    audio = makePlayer();
    playerRegistry.register('A', 'youtube', yt);
    playerRegistry.register('A', 'audio', audio);
  });

  it('CUE on a YouTube track seeks the YouTube backend, not the audio engine', () => {
    const store = useDeckStore.getState();
    store.loadTrack('A', 'vid123', { sourceType: 'youtube', title: 't', artist: 'a', duration: 180, thumbnailUrl: null });
    store.setPlayerReady('A', true);
    store.setHotCue('A', 0, 42);
    render(<DeckControls deckId="A" />);
    fireEvent.click(screen.getByLabelText('Jump to cue point on Deck A'));
    expect(yt.seekTo).toHaveBeenCalledWith(42, true);
    expect(audio.seekTo).not.toHaveBeenCalled();
  });

  it('Restart on an MP3 track seeks the audio engine, not the YouTube backend', () => {
    const store = useDeckStore.getState();
    store.loadTrack('A', 'entry1', { sourceType: 'mp3', title: 't', artist: 'a', duration: 180, thumbnailUrl: null });
    store.setPlayerReady('A', true);
    render(<DeckControls deckId="A" />);
    fireEvent.click(screen.getByLabelText('Restart Deck A'));
    expect(audio.seekTo).toHaveBeenCalledWith(0, true);
    expect(yt.seekTo).not.toHaveBeenCalled();
  });
});
