import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeckWaveform } from '../components/Deck/DeckWaveform';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';

// ── Canvas mock ───────────────────────────────────────────────────────────
//
// jsdom's HTMLCanvasElement.prototype.getContext('2d') returns null by
// default, so without this mock every drawFrame call bails at its
// `if (!ctx) return;` guard before any of the real drawing logic (bar
// coloring, hot-cue markers, playhead line, center glow) ever runs. Mirrors
// the established pattern in mp3-007-waveform-display.test.tsx, extended to
// cover every 2D context method/property DeckWaveform.tsx actually calls.
const mockGradient = { addColorStop: vi.fn() };

const mockCtx = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  createLinearGradient: vi.fn().mockReturnValue(mockGradient),
  fillStyle: '',
};

HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);

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

/**
 * drawFrame only runs inside a requestAnimationFrame loop (both DeckWaveform's
 * own draw loop and the usePlayhead hook's clock-reading loop) — never
 * synchronously on render. Stub rAF/cAF onto a real macrotask (setTimeout 0),
 * mirroring usePlayhead.test.tsx, then await a short real delay to let that
 * macrotask queue drain before asserting on mockCtx calls.
 */
async function flushRaf(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

beforeEach(() => {
  resetDeck('A');
  resetDeck('B');
  vi.clearAllMocks();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
});

afterEach(() => {
  vi.unstubAllGlobals();
  playerRegistry.unregister('A');
  playerRegistry.unregister('B');
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

  it('calls ctx.clearRect once drawFrame runs, proving it executes past the null-context guard', async () => {
    render(<DeckWaveform deckId="A" />);
    await flushRaf();
    expect(mockCtx.clearRect).toHaveBeenCalled();
  });

  it('draws colored bars when colored peaks are present (many fillRect calls, not just background/fallback)', async () => {
    // Position the playhead mid-track (bar ~500 of 1000) so the whole
    // ±180-bar visible window falls inside the peaks array. At playhead bar 0
    // (the default, no player registered) half the visible bars would land
    // in the "out of range" placeholder branch, which itself calls fillRect
    // and would mask a broken bar-drawing loop.
    playerRegistry.register('A', {
      seekTo: vi.fn(),
      getCurrentTime: () => 60,
      getDuration: () => 120,
    });
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
    render(<DeckWaveform deckId="A" />);
    await flushRaf();
    // With every visible bar in range, a frame that only draws the
    // background + playhead line + center glow (no bars) totals 3 fillRect
    // calls; 361 in-range bars pushes a real draw well past that.
    expect(mockCtx.fillRect.mock.calls.length).toBeGreaterThan(100);
  });

  it('draws a hot-cue marker triangle (beginPath) when a cue falls within the visible bar range', async () => {
    playerRegistry.register('A', {
      seekTo: vi.fn(),
      getCurrentTime: () => 60,
      getDuration: () => 120,
    });
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: {
          ...useDeckStore.getState().decks['A'],
          waveformColoredPeaks: Array.from({ length: 1000 }, () => ({ amp: 0.5, bass: 0.3, mid: 0.3, high: 0.3 })),
          duration: 120,
          hotCues: { 0: 65 }, // 5s ahead of the playhead — well within ±180 bars
        },
      },
    });
    render(<DeckWaveform deckId="A" />);
    await flushRaf();
    // beginPath is only ever called by the hot-cue triangle marker in
    // DeckWaveform.tsx — nothing else in drawFrame calls it.
    expect(mockCtx.beginPath).toHaveBeenCalled();
  });

  it('draws the flat-line-plus-playhead fallback when no waveform data is available', async () => {
    resetDeck('A');
    render(<DeckWaveform deckId="A" />);
    await flushRaf();
    // These exact rects (flat center line, then the vertical playhead line)
    // are only drawn in the `!hasColored && !hasMono` fallback branch.
    // canvasWidth stays at the FALLBACK_WIDTH (300) default because the
    // ResizeObserver polyfill in test/setup.ts never actually fires.
    expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 23, 300, 2);
    expect(mockCtx.fillRect).toHaveBeenCalledWith(149, 0, 2, 48);
  });
});
