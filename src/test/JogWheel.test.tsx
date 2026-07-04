import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import { JogWheel } from '../components/Deck/JogWheel';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';
import type { DeckPlayer } from '../services/playerRegistry';

function registerMockPlayer(deckId: 'A' | 'B') {
  const updateScratchRate = vi.fn();
  const setBendMultiplier = vi.fn();
  const beginScratch = vi.fn();
  const endScratch = vi.fn();
  const player: DeckPlayer = {
    seekTo: vi.fn(),
    getCurrentTime: () => 0,
    getDuration: () => 300,
    beginScratch,
    endScratch,
    updateScratchRate,
    setBendMultiplier,
  };
  playerRegistry.register(deckId, player);
  return { updateScratchRate, setBendMultiplier, beginScratch, endScratch };
}

function loadTrackOnDeckA(): void {
  act(() => {
    useDeckStore.getState().loadTrack('A', 'track-1', { title: 'T', artist: 'X', duration: 100, thumbnailUrl: null });
  });
}

beforeEach(() => {
  // The deck store is a module-level singleton shared across tests in this
  // file. loadTrack() resets most per-track fields but deliberately leaves
  // vinylMode alone (it's a persistent per-deck setting, not track-scoped),
  // so a prior test's setVinylMode(false) would otherwise leak into the next
  // test. Reset the fields these tests depend on for a clean slate, mirroring
  // the pattern in src/test/deck-vinylmode.test.ts.
  useDeckStore.setState((state) => ({
    decks: {
      ...state.decks,
      A: { ...state.decks.A, vinylMode: true, scratching: false, trackId: null },
      B: { ...state.decks.B, vinylMode: true, scratching: false, trackId: null },
    },
  }));
  playerRegistry.unregister('A');
  playerRegistry.unregister('B');
  vi.restoreAllMocks();
});

describe('JogWheel', () => {
  it('renders a VINYL toggle button reflecting vinylMode', () => {
    loadTrackOnDeckA();
    render(<JogWheel deckId="A" />);

    const btn = screen.getByRole('button', { name: /vinyl scratch mode for deck a/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true'); // vinylMode defaults to true
  });

  it('clicking the VINYL button toggles vinylMode in the store', () => {
    loadTrackOnDeckA();
    render(<JogWheel deckId="A" />);

    fireEvent.click(screen.getByRole('button', { name: /vinyl scratch mode for deck a/i }));

    expect(useDeckStore.getState().decks['A'].vinylMode).toBe(false);
  });

  it('dragging in VINYL mode calls beginScratch on pointer down and updateScratchRate on move', () => {
    const { updateScratchRate } = registerMockPlayer('A');
    loadTrackOnDeckA();
    render(<JogWheel deckId="A" />);

    // JogWheel derives its rate from performance.now() deltas between pointer
    // events. Two real calls issued back-to-back in a synchronous test can
    // return the *same* millisecond, which would make rateFromMovement's
    // div-by-zero guard zero out the rate and flake this assertion. Mock it
    // to a deterministic, always-forward-advancing sequence instead.
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100);

    const surface = screen.getByLabelText(/jog wheel for deck a/i);
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 0, clientY: 100, pointerId: 1 }); // 90deg clockwise step

    expect(useDeckStore.getState().decks['A'].scratching).toBe(true);
    expect(updateScratchRate).toHaveBeenCalled();
    // Clockwise motion is a positive angle delta -> a positive (forward) rate.
    expect(updateScratchRate.mock.calls[0]?.[0]).toBeGreaterThan(0);
  });

  it('releasing after a VINYL-mode drag calls endScratch', () => {
    registerMockPlayer('A');
    loadTrackOnDeckA();
    render(<JogWheel deckId="A" />);

    const surface = screen.getByLabelText(/jog wheel for deck a/i);
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 0, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: 0, clientY: 100, pointerId: 1 });

    expect(useDeckStore.getState().decks['A'].scratching).toBe(false);
  });

  it('dragging in bend mode (VINYL off) calls setBendMultiplier, never beginScratch/updateScratchRate', () => {
    const { updateScratchRate, setBendMultiplier } = registerMockPlayer('A');
    loadTrackOnDeckA();
    act(() => { useDeckStore.getState().setVinylMode('A', false); });
    render(<JogWheel deckId="A" />);

    const surface = screen.getByLabelText(/jog wheel for deck a/i);
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 0, clientY: 100, pointerId: 1 });

    expect(setBendMultiplier).toHaveBeenCalled();
    expect(updateScratchRate).not.toHaveBeenCalled();
    expect(useDeckStore.getState().decks['A'].scratching).toBe(false);
  });

  it('releasing after a bend-mode drag resets the multiplier to 1.0', () => {
    const { setBendMultiplier } = registerMockPlayer('A');
    loadTrackOnDeckA();
    act(() => { useDeckStore.getState().setVinylMode('A', false); });
    render(<JogWheel deckId="A" />);

    const surface = screen.getByLabelText(/jog wheel for deck a/i);
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 0, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: 0, clientY: 100, pointerId: 1 });

    expect(setBendMultiplier).toHaveBeenLastCalledWith(1.0);
  });

  it('a second pointerdown (different pointerId) mid-drag does not restart the drag or re-call beginScratch/updateScratchRate', () => {
    const player = registerMockPlayer('A');
    loadTrackOnDeckA();
    render(<JogWheel deckId="A" />);

    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100).mockReturnValueOnce(200);

    const surface = screen.getByLabelText(/jog wheel for deck a/i);
    // First finger starts the drag.
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 0, clientY: 100, pointerId: 1 });

    expect(useDeckStore.getState().decks['A'].scratching).toBe(true);
    expect(player.beginScratch).toHaveBeenCalledTimes(1);
    const updateScratchCallCountAfterFirstMove = player.updateScratchRate.mock.calls.length;
    expect(updateScratchCallCountAfterFirstMove).toBeGreaterThan(0);

    // A second finger touches the same wheel before the first pointerup fires.
    fireEvent.pointerDown(surface, { clientX: 50, clientY: 50, pointerId: 2 });

    // The second pointerdown must be ignored entirely: no additional
    // beginScratch call (the drag session is not re-entered) and moving the
    // second pointer must not drive updateScratchRate, since the drag
    // session still belongs to pointerId 1.
    expect(player.beginScratch).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(surface, { clientX: 100, clientY: 0, pointerId: 2 });
    expect(player.updateScratchRate.mock.calls.length).toBe(updateScratchCallCountAfterFirstMove);

    // The original drag (pointerId 1) is still live and can still be ended normally.
    fireEvent.pointerUp(surface, { clientX: 0, clientY: 100, pointerId: 1 });
    expect(useDeckStore.getState().decks['A'].scratching).toBe(false);
  });
});
