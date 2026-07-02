import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeckModifiers } from '../components/Deck/DeckModifiers';
import { useDeckStore } from '../store/deckStore';

describe('DeckModifiers', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('SHIFT button toggles shift state and reflects aria-pressed', () => {
    render(<DeckModifiers deckId="A" />);
    const shift = screen.getByRole('button', { name: /shift/i });
    expect(shift).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(shift);
    expect(useDeckStore.getState().decks.A.shift).toBe(true);
    expect(shift).toHaveAttribute('aria-pressed', 'true');
  });

  it('Q button toggles quantize (default on)', () => {
    render(<DeckModifiers deckId="A" />);
    const q = screen.getByRole('button', { name: /quantize/i });
    expect(q).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(q);
    expect(useDeckStore.getState().decks.A.quantize).toBe(false);
  });
});
