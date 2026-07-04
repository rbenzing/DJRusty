import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeckWaveform } from '../components/Deck/DeckWaveform';
import { useDeckStore } from '../store/deckStore';

function resetDeck(deckId: 'A' | 'B'): void {
  useDeckStore.setState({
    decks: {
      ...useDeckStore.getState().decks,
      [deckId]: {
        ...useDeckStore.getState().decks[deckId],
        waveformColoredPeaks: null,
        waveformPeaks: null,
        duration: 0,
        hotCues: {},
      },
    },
  });
}

beforeEach(() => {
  resetDeck('A');
  resetDeck('B');
});

describe('DeckWaveform', () => {
  it('renders a canvas with the correct deck-scoped aria-label', () => {
    render(<DeckWaveform deckId="A" />);
    expect(screen.getByLabelText('Deck A waveform')).toBeInTheDocument();
  });

  it('renders a canvas element (not some other tag) so drawing can attach', () => {
    render(<DeckWaveform deckId="B" />);
    const el = screen.getByLabelText('Deck B waveform');
    expect(el.tagName).toBe('CANVAS');
  });

  it('does not throw when no waveform data is available yet (still decoding)', () => {
    resetDeck('A');
    expect(() => render(<DeckWaveform deckId="A" />)).not.toThrow();
  });

  it('does not throw once colored peaks are present', () => {
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: {
          ...useDeckStore.getState().decks['A'],
          waveformColoredPeaks: Array.from({ length: 1000 }, () => ({ amp: 0.5, bass: 0.3, mid: 0.3, high: 0.3 })),
          duration: 120,
        },
      },
    });
    expect(() => render(<DeckWaveform deckId="A" />)).not.toThrow();
  });
});
