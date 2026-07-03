import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PadGridLoop } from '../components/Deck/PadGridLoop';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';

function mockEngine() {
  return { seekTo: vi.fn(), getCurrentTime: () => 0, getDuration: () => 180, setLoop: vi.fn(), clearLoop: vi.fn(), isLooping: () => false };
}

function loopButton(deckId: 'A' | 'B', beatCount: 1 | 2 | 4 | 8) {
  return screen.getByRole('button', { name: `${beatCount}-beat loop on Deck ${deckId}` });
}

describe('SHIFT + loop-length button: halve/double the active loop', () => {
  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    playerRegistry.unregister('A');
  });

  function setup(activeBeatCount: 1 | 2 | 4 | 8 | null) {
    const eng = mockEngine();
    playerRegistry.register('A', eng as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setGrid('A', 120, 0);
    s.setCurrentTime('A', 0);
    if (activeBeatCount !== null) s.activateLoopBeat('A', activeBeatCount);
    s.setShift('A', true);
    render(<PadGridLoop deckId="A" />);
  }

  it('shift + smaller button halves a 4-beat loop to 2', () => {
    setup(4);
    fireEvent.click(loopButton('A', 2));
    const d = useDeckStore.getState().decks.A;
    expect(d.loopActive).toBe(true);
    expect(d.loopBeatCount).toBe(2);
  });

  it('shift + larger button doubles a 2-beat loop to 4', () => {
    setup(2);
    fireEvent.click(loopButton('A', 4));
    const d = useDeckStore.getState().decks.A;
    expect(d.loopActive).toBe(true);
    expect(d.loopBeatCount).toBe(4);
  });

  it('shift + same button still deactivates the loop', () => {
    setup(4);
    fireEvent.click(loopButton('A', 4));
    expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
  });

  it('shift with NO active loop still does a normal absolute activate (not halve/double)', () => {
    setup(null);
    fireEvent.click(loopButton('A', 2));
    const d = useDeckStore.getState().decks.A;
    expect(d.loopActive).toBe(true);
    expect(d.loopBeatCount).toBe(2);
  });
});
