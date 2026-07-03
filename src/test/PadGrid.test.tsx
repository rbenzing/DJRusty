import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PadGrid } from '../components/Deck/PadGrid';
import { useDeckStore } from '../store/deckStore';

describe('PadGrid mode switching', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('defaults to HOT CUE mode and renders 8 hot cue pads', () => {
    render(<PadGrid deckId="A" />);
    expect(screen.getByRole('button', { name: /hot cue pad mode for deck a/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /hot cue 1 on deck a/i })).toBeInTheDocument();
  });

  it('switching to LOOP mode renders the loop pads instead', () => {
    render(<PadGrid deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /loop pad mode for deck a/i }));
    expect(screen.getByRole('button', { name: /set loop in on deck a/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hot cue 1 on deck a/i })).not.toBeInTheDocument();
  });

  it('SAMPLER mode button is disabled', () => {
    render(<PadGrid deckId="A" />);
    expect(screen.getByRole('button', { name: /sampler pad mode for deck a/i })).toBeDisabled();
  });

  it('switching to SLICER mode renders the slice pads', () => {
    render(<PadGrid deckId="A" />);
    const slicerBtn = screen.getByRole('button', { name: /slicer pad mode for deck a/i });
    expect(slicerBtn).not.toBeDisabled();
    fireEvent.click(slicerBtn);
    expect(screen.getByRole('button', { name: /slice 1 on deck a/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hot cue 1 on deck a/i })).not.toBeInTheDocument();
  });
});
