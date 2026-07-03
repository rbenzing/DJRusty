import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PadGridSlicer } from '../components/Deck/PadGridSlicer';
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

describe('PadGridSlicer', () => {
  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    playerRegistry.unregister('A');
  });

  it('renders the window-size row and 8 slice pads', () => {
    render(<PadGridSlicer deckId="A" />);
    expect(screen.getByRole('button', { name: /set slicer window to 8 beats on deck a/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /slice 1 on deck a/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /slice 8 on deck a/i })).toBeInTheDocument();
  });

  it('clicking a window-size button updates sliceWindowBeats', () => {
    render(<PadGridSlicer deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /set slicer window to 16 beats on deck a/i }));
    expect(useDeckStore.getState().decks.A.sliceWindowBeats).toBe(16);
  });

  it('all pads and the size row are disabled without a confirmed grid', () => {
    render(<PadGridSlicer deckId="A" />);
    expect(screen.getByRole('button', { name: /slice 1 on deck a/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /set slicer window to 8 beats on deck a/i })).toBeDisabled();
  });

  it('holding a pad calls startSlice, releasing calls endRoll', () => {
    const eng = mockEngine();
    playerRegistry.register('A', eng as never);
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: { ...useDeckStore.getState().decks.A, bpm: 120, anchor: 0, currentTime: 0, duration: 300 },
      },
    });
    render(<PadGridSlicer deckId="A" />);
    const pad = screen.getByRole('button', { name: /slice 3 on deck a/i });
    fireEvent.mouseDown(pad);
    expect(eng.setLoop).toHaveBeenCalled();
    expect(useDeckStore.getState().decks.A.loopActive).toBe(true);
    fireEvent.mouseUp(pad);
    expect(eng.seekTo).toHaveBeenCalled();
    expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
  });
});
