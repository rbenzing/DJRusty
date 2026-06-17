import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PitchSlider } from '../components/Deck/PitchSlider';
import { useDeckStore } from '../store/deckStore';

// Mock playerRegistry to avoid module-level side effects.
vi.mock('../services/playerRegistry', () => ({
  playerRegistry: { register: vi.fn(), unregister: vi.fn(), get: vi.fn() },
  getActivePlayer: vi.fn().mockReturnValue(null),
}));

describe('PitchSlider — continuous on MP3, discrete on YouTube', () => {
  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
  });

  it('MP3: slider emits a continuous (non-discrete) pitch value', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    render(<PitchSlider deckId="A" />);
    const slider = screen.getByRole('slider', { name: /pitch/i });
    // A continuous range input accepts non-discrete values.
    fireEvent.change(slider, { target: { value: '1.123' } });
    expect(useDeckStore.getState().decks.A.pitchRate).toBeCloseTo(1.123, 3); // NOT snapped to a PITCH_RATES step
  });

  it('MP3: can represent a sync rate like 1.2 (within range 0.5–2.0)', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setPitchRate('A', 1.2);
    render(<PitchSlider deckId="A" />);
    const slider = screen.getByRole('slider', { name: /pitch/i }) as HTMLInputElement;
    expect(parseFloat(slider.value)).toBeCloseTo(1.2, 3); // thumb reflects the continuous rate, not snapped to 1.25
  });

  it('MP3: reset button restores pitch to 1×', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setPitchRate('A', 1.5);
    render(<PitchSlider deckId="A" />);
    const resetBtn = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(resetBtn);
    expect(useDeckStore.getState().decks.A.pitchRate).toBe(1);
  });
});
