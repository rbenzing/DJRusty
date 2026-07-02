import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BeatmatchGuide } from '../components/Mixer/BeatmatchGuide';
import { useDeckStore } from '../store/deckStore';

describe('BeatmatchGuide', () => {
  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    useDeckStore.getState().clearTrack('B');
  });

  it('shows a no-grid state when decks lack grids', () => {
    render(<BeatmatchGuide />);
    expect(screen.getByLabelText(/beatmatch/i).getAttribute('data-has-grids')).toBe('false');
  });

  it('shows an active state when both decks have grids', () => {
    const s = useDeckStore.getState();
    s.setGrid('A', 120, 0);
    s.setGrid('B', 126, 0);
    render(<BeatmatchGuide />);
    expect(screen.getByLabelText(/beatmatch/i).getAttribute('data-has-grids')).toBe('true');
  });
});
