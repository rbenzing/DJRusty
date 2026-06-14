import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { DeckControls } from '../components/Deck/DeckControls';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';

function mockPlayer(pos = 0) { return { seekTo: vi.fn(), getCurrentTime: () => pos, getDuration: () => 180 }; }

describe('DeckControls — Pioneer-CDJ cue/play', () => {
  beforeEach(() => { useDeckStore.getState().clearTrack('A'); playerRegistry.unregister('A', 'audio'); });
  afterEach(() => { cleanup(); });

  function setup(pos = 0) {
    playerRegistry.register('A', 'audio', mockPlayer(pos) as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'vid12345678', { sourceType: 'mp3', title: 't', artist: 'a', duration: 180, thumbnailUrl: null });
    s.setPlayerReady('A', true);
    return s;
  }

  it('PLAY toggles play/pause via the transport machine', () => {
    setup();
    render(<DeckControls deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /^(Play|Pause) Deck A$/i }));
    expect(useDeckStore.getState().decks.A.transportState).toBe('PLAYING');
  });

  it('CUE pointer-down/up fires CUE_PRESS then CUE_RELEASE (momentary preview)', () => {
    const s = setup(10);
    s.setCuePoint('A', 5);
    s.dispatchTransport('A', { type: 'PLAY' }); // → PLAYING
    s.dispatchTransport('A', { type: 'CUE_PRESS' }); // PLAYING+CUE → CUED (back to cue, pause)
    render(<DeckControls deckId="A" />);
    const cue = screen.getByRole('button', { name: /^Cue Deck A$/i });
    // From CUED: press = preview (play), release = back to cue
    fireEvent.pointerDown(cue);
    expect(useDeckStore.getState().decks.A.transportState).toBe('PREVIEW');
    fireEvent.pointerUp(cue);
    expect(useDeckStore.getState().decks.A.transportState).toBe('CUED');
  });
});
