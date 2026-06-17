import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GridControl } from '../components/Deck/GridControl';
import { useDeckStore } from '../store/deckStore';

describe('GridControl', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('Tap Downbeat stamps the anchor at the current playhead and confirms the grid', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setBpm('A', 120);
    s.setCurrentTime('A', 4.2);
    render(<GridControl deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /tap downbeat/i }));
    const d = useDeckStore.getState().decks.A;
    expect(d.anchor).toBeCloseTo(4.2, 3);
    expect(d.gridConfirmed).toBe(true);
  });

  it('Nudge ▶ shifts the anchor by +5ms', () => {
    const s = useDeckStore.getState();
    s.setGrid('A', 120, 1.0);
    render(<GridControl deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /nudge grid later/i }));
    expect(useDeckStore.getState().decks.A.anchor).toBeCloseTo(1.005, 4);
  });
});
