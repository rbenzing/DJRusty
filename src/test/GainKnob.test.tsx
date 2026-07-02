import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GainKnob } from '../components/Mixer/GainKnob';
import { useDeckStore } from '../store/deckStore';

describe('GainKnob', () => {
  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    useDeckStore.getState().setGain('A', 0);
  });

  it('renders the current gain as a slider role', () => {
    useDeckStore.getState().setGain('A', 3);
    render(<GainKnob deckId="A" />);
    expect(screen.getByRole('slider', { name: /gain/i })).toHaveAttribute('aria-valuenow', '3');
  });

  it('ArrowUp increases gain by 1 dB', () => {
    render(<GainKnob deckId="A" />);
    const knob = screen.getByRole('slider', { name: /gain/i });
    fireEvent.keyDown(knob, { key: 'ArrowUp' });
    expect(useDeckStore.getState().decks.A.gainDb).toBe(1);
  });

  it('double-click resets gain to 0', () => {
    useDeckStore.getState().setGain('A', 8);
    render(<GainKnob deckId="A" />);
    fireEvent.doubleClick(screen.getByRole('slider', { name: /gain/i }));
    expect(useDeckStore.getState().decks.A.gainDb).toBe(0);
  });
});
