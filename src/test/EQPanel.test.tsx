import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EQPanel } from '../components/Mixer/EQPanel';
import { useDeckStore } from '../store/deckStore';

vi.mock('../services/cueEngine', () => ({
  cueEngine: {
    setDeckCueEnabled: vi.fn(),
    registerDeckCueSend: vi.fn(),
    registerDeckProgramTap: vi.fn(),
    unregisterDeck: vi.fn(),
    setHeadphoneMix: vi.fn(),
    setHeadphoneDeviceId: vi.fn(),
    isOutputDeviceSelectionSupported: vi.fn(),
  },
}));

beforeEach(() => {
  useDeckStore.setState({
    decks: {
      ...useDeckStore.getState().decks,
      A: { ...useDeckStore.getState().decks['A'], eqLow: 0, eqMid: 0, eqHigh: 0, eqKillLow: false, eqKillMid: false, eqKillHigh: false, filterSweep: 0, cueEnabled: false },
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

describe('EQPanel — CUE toggle', () => {
  it('renders the CUE button unpressed by default', () => {
    render(<EQPanel deckId="A" />);
    expect(screen.getByRole('button', { name: /headphone cue for deck a/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('toggles cueEnabled in the store when clicked', () => {
    render(<EQPanel deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /headphone cue for deck a/i }));
    expect(useDeckStore.getState().decks.A.cueEnabled).toBe(true);
  });

  it('reflects aria-pressed after toggling on', () => {
    render(<EQPanel deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /headphone cue for deck a/i }));
    expect(screen.getByRole('button', { name: /headphone cue for deck a/i })).toHaveAttribute('aria-pressed', 'true');
  });
});
