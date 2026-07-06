import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WaveformZoomControls } from '../components/Deck/WaveformZoomControls';
import { useDeckStore } from '../store/deckStore';
import { WAVEFORM_ZOOM_LEVELS, DEFAULT_WAVEFORM_ZOOM_INDEX } from '../utils/waveformZoom';

beforeEach(() => {
  useDeckStore.getState().clearTrack('A');
  const state = useDeckStore.getState();
  useDeckStore.setState({
    decks: {
      ...state.decks,
      A: { ...state.decks['A'], waveformZoomIndex: DEFAULT_WAVEFORM_ZOOM_INDEX },
    },
  });
});

describe('WaveformZoomControls', () => {
  it('renders zoom-in and zoom-out buttons with deck-scoped aria-labels', () => {
    render(<WaveformZoomControls deckId="A" />);
    expect(screen.getByLabelText('Zoom in Deck A waveform')).toBeInTheDocument();
    expect(screen.getByLabelText('Zoom out Deck A waveform')).toBeInTheDocument();
  });

  it('clicking zoom in decreases waveformZoomIndex', async () => {
    const user = userEvent.setup();
    render(<WaveformZoomControls deckId="A" />);
    await user.click(screen.getByLabelText('Zoom in Deck A waveform'));
    expect(useDeckStore.getState().decks.A.waveformZoomIndex).toBe(DEFAULT_WAVEFORM_ZOOM_INDEX - 1);
  });

  it('clicking zoom out increases waveformZoomIndex', async () => {
    const user = userEvent.setup();
    render(<WaveformZoomControls deckId="A" />);
    await user.click(screen.getByLabelText('Zoom out Deck A waveform'));
    expect(useDeckStore.getState().decks.A.waveformZoomIndex).toBe(DEFAULT_WAVEFORM_ZOOM_INDEX + 1);
  });

  it('disables zoom in at the narrowest level', () => {
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: { ...useDeckStore.getState().decks['A'], waveformZoomIndex: 0 },
      },
    });
    render(<WaveformZoomControls deckId="A" />);
    expect(screen.getByLabelText('Zoom in Deck A waveform')).toBeDisabled();
    expect(screen.getByLabelText('Zoom out Deck A waveform')).not.toBeDisabled();
  });

  it('disables zoom out at the widest level', () => {
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: { ...useDeckStore.getState().decks['A'], waveformZoomIndex: WAVEFORM_ZOOM_LEVELS.length - 1 },
      },
    });
    render(<WaveformZoomControls deckId="A" />);
    expect(screen.getByLabelText('Zoom out Deck A waveform')).toBeDisabled();
    expect(screen.getByLabelText('Zoom in Deck A waveform')).not.toBeDisabled();
  });
});
