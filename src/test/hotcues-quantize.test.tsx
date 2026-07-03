import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PadGridHotCue } from '../components/Deck/PadGridHotCue';
import { useDeckStore } from '../store/deckStore';

describe('hot cue quantize', () => {
  beforeEach(() => {
    localStorage.clear();
    useDeckStore.getState().clearTrack('A');
  });

  it('snaps the SET position to the nearest beat when quantize is on', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'trk', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setGrid('A', 120, 0);      // 0.5 s/beat
    s.setQuantize('A', true);
    s.setCurrentTime('A', 1.26); // nearest beat = 1.5
    render(<PadGridHotCue deckId="A" />);
    // Hot cue 1 (index 0) starts unset — a plain click on an unset cue sets it
    // at the current (quantized) playhead (DDJ-style; see HotCueButton.tsx).
    fireEvent.click(screen.getByRole('button', { name: /hot cue 1/i }));
    expect(useDeckStore.getState().decks.A.hotCues[0]).toBeCloseTo(1.5, 6);
  });

  it('uses the raw position when quantize is off', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'trk', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setGrid('A', 120, 0);
    s.setQuantize('A', false);
    s.setCurrentTime('A', 1.26);
    render(<PadGridHotCue deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /hot cue 1/i }));
    expect(useDeckStore.getState().decks.A.hotCues[0]).toBeCloseTo(1.26, 6);
  });
});
