/**
 * mp3-007-waveform-display.test.tsx — WaveformDisplay canvas component.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { WaveformDisplay } from '../components/Deck/WaveformDisplay';

// ── Canvas mock ───────────────────────────────────────────────────────────

const mockCtx = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  canvas: { width: 0, height: 0 },
};

HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);

// ── Helpers ───────────────────────────────────────────────────────────────

function resetStore(overrides: Partial<{ waveformPeaks: Float32Array | null; currentTime: number; duration: number }> = {}) {
  useDeckStore.setState((state) => ({
    decks: {
      ...state.decks,
      A: {
        ...state.decks['A']!,
        waveformPeaks: null,
        currentTime: 0,
        duration: 0,
        ...overrides,
      },
    },
  }));
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('WaveformDisplay — rendering', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it('renders a canvas element', () => {
    render(<WaveformDisplay deckId="A" />);
    expect(document.querySelector('canvas')).toBeTruthy();
  });

  it('renders with accessible role and label', () => {
    render(<WaveformDisplay deckId="A" />);
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeTruthy();
    // aria-label should reference deck A
    expect(canvas!.getAttribute('aria-label')).toMatch(/waveform/i);
  });

  it('does not throw when waveformPeaks is null', () => {
    resetStore({ waveformPeaks: null });
    expect(() => render(<WaveformDisplay deckId="A" />)).not.toThrow();
  });

  it('calls getContext("2d") when peaks are available', () => {
    resetStore({ waveformPeaks: new Float32Array([0.5, 0.8, 0.3]), duration: 10 });
    render(<WaveformDisplay deckId="A" />);
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d');
  });

  it('calls clearRect when drawing', () => {
    resetStore({ waveformPeaks: new Float32Array([0.5, 0.8, 0.3]), duration: 10 });
    render(<WaveformDisplay deckId="A" />);
    expect(mockCtx.clearRect).toHaveBeenCalled();
  });
});

describe('WaveformDisplay — playhead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without error when currentTime is 0', () => {
    resetStore({ waveformPeaks: new Float32Array(100).fill(0.5), currentTime: 0, duration: 120 });
    expect(() => render(<WaveformDisplay deckId="A" />)).not.toThrow();
  });

  it('renders without error when currentTime equals duration', () => {
    resetStore({ waveformPeaks: new Float32Array(100).fill(0.5), currentTime: 120, duration: 120 });
    expect(() => render(<WaveformDisplay deckId="A" />)).not.toThrow();
  });

  it('renders without error when duration is 0 (avoids divide-by-zero)', () => {
    resetStore({ waveformPeaks: new Float32Array(100).fill(0.5), currentTime: 0, duration: 0 });
    expect(() => render(<WaveformDisplay deckId="A" />)).not.toThrow();
  });
});

describe('WaveformDisplay — prop contract', () => {
  it('accepts deckId "A"', () => {
    expect(() => render(<WaveformDisplay deckId="A" />)).not.toThrow();
  });

  it('accepts deckId "B"', () => {
    expect(() => render(<WaveformDisplay deckId="B" />)).not.toThrow();
  });
});
