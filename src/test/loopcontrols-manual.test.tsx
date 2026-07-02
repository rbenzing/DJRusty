import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoopControls } from '../components/Deck/LoopControls';
import { useDeckStore } from '../store/deckStore';

describe('LoopControls manual loop buttons', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('IN then OUT activates a manual loop', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setCurrentTime('A', 1.0);
    render(<LoopControls deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /set loop in/i }));
    useDeckStore.getState().setCurrentTime('A', 2.0);
    fireEvent.click(screen.getByRole('button', { name: /set loop out/i }));
    const d = useDeckStore.getState().decks.A;
    expect(d.loopActive).toBe(true);
    expect(d.loopStart).toBeCloseTo(1.0, 6);
    expect(d.loopEnd).toBeCloseTo(2.0, 6);
  });
});
