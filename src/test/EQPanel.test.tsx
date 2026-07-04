import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EQPanel } from '../components/Mixer/EQPanel';
import { useDeckStore } from '../store/deckStore';

beforeEach(() => {
  useDeckStore.setState({
    decks: {
      ...useDeckStore.getState().decks,
      A: { ...useDeckStore.getState().decks['A'], eqLow: 0, eqMid: 0, eqHigh: 0, eqKillLow: false, eqKillMid: false, eqKillHigh: false, filterSweep: 0 },
    },
  });
});

describe('EQPanel (Mixer-hosted)', () => {
  it('renders BASS, MID, TREBLE, and FILTER controls for the given deck', () => {
    render(<EQPanel deckId="A" />);
    expect(screen.getByLabelText('Deck A BASS EQ: 0 dB')).toBeInTheDocument();
    expect(screen.getByLabelText('Deck A MID EQ: 0 dB')).toBeInTheDocument();
    expect(screen.getByLabelText('Deck A TREBLE EQ: 0 dB')).toBeInTheDocument();
    expect(screen.getByLabelText('Deck A filter sweep: FLAT')).toBeInTheDocument();
  });

  it('renders independently for deck B without cross-talk', () => {
    render(<EQPanel deckId="B" />);
    expect(screen.getByLabelText('Deck B BASS EQ: 0 dB')).toBeInTheDocument();
    expect(screen.queryByLabelText('Deck A BASS EQ: 0 dB')).not.toBeInTheDocument();
  });
});
