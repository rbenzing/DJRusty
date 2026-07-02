import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EffectsPanel } from '../components/Deck/EffectsPanel';
import { useDeckStore } from '../store/deckStore';

describe('EffectsPanel BEAT knob', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('renders a BEAT knob showing the current division', () => {
    render(<EffectsPanel deckId="A" />);
    expect(screen.getByRole('slider', { name: /fx beat/i })).toBeInTheDocument();
  });

  it('ArrowUp raises effectBeat', () => {
    render(<EffectsPanel deckId="A" />);
    const knob = screen.getByRole('slider', { name: /fx beat/i });
    fireEvent.keyDown(knob, { key: 'ArrowUp' });
    expect(useDeckStore.getState().decks.A.effectBeat).toBeGreaterThan(0.5);
  });
});
