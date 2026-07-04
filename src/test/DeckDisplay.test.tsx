import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeckDisplay } from '../components/Deck/DeckDisplay';
import { useDeckStore } from '../store/deckStore';

beforeEach(() => {
  useDeckStore.setState({
    decks: {
      ...useDeckStore.getState().decks,
      A: {
        ...useDeckStore.getState().decks['A'],
        trackId: 'track-1',
        title: 'Test Track',
        artist: 'Test Artist',
        bpm: 128,
        currentTime: 30,
        duration: 200,
        pitchRate: 1,
      },
    },
  });
});

describe('DeckDisplay', () => {
  it('renders the deck label and BPM header row', () => {
    render(<DeckDisplay deckId="A" />);
    expect(screen.getByText('DECK A')).toBeInTheDocument();
    expect(screen.getByText('128 BPM')).toBeInTheDocument();
  });

  it('renders the per-deck waveform between the header and the track title', () => {
    render(<DeckDisplay deckId="A" />);
    // DeckWaveform's canvas has this exact aria-label (Task 3).
    expect(screen.getByLabelText('Deck A waveform')).toBeInTheDocument();
  });

  it('still renders track title, artist, and time/rate row', () => {
    render(<DeckDisplay deckId="A" />);
    expect(screen.getByText('Test Track')).toBeInTheDocument();
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
    expect(screen.getByText('0:30 / 3:20')).toBeInTheDocument();
    expect(screen.getByText('×1.00')).toBeInTheDocument();
  });
});
