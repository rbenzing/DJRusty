# Viewport-Fit Layout Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the deck and mixer layouts to fit within a 1366×768 viewport floor: one frequency-colored waveform per deck (replacing the shared `CenterWaveform`), EQ controls relocated into vertical columns flanking the Mixer's channel strip, and two rows of deck controls consolidated from five stacked rows into two.

**Architecture:** Extract `CenterWaveform`'s per-deck drawing logic into a new standalone `DeckWaveform` component rendered inside each deck's own `DeckDisplay` header; relocate `EQPanel` from `Deck.tsx` into `Mixer.tsx` as flanking columns; consolidate `TapTempo`/`EffectsPanel`/`GridControl` into one row and the volume fader/`PitchSlider` into another, by moving each component's outer padding/border chrome to a new shared wrapper class.

**Tech Stack:** React 18, CSS Modules, Canvas 2D (waveform rendering), `ResizeObserver` (new to this codebase), Vitest + jsdom, Playwright (end-of-phase visual verification).

## Global Constraints

- Minimum viewport floor: 1366×768. This is a firm floor, not a new responsive breakpoint — no mobile/tablet reflow is added below it.
- Top-level `App.tsx` column proportions (`.app-deck-col` 38%, `.app-mixer-col` 24%) do not change.
- Zero-warnings lint policy (`npm run lint` → `eslint . --max-warnings 0`).
- CSS Modules co-located per component; reuse existing `index.css` design tokens (spacing, color, typography) — no new ad-hoc values.
- Per project CLAUDE.md: run `npm run build` and `npm run lint` after implementation.
- jsdom has no `ResizeObserver` and no real `HTMLCanvasElement.getContext('2d')` (pre-existing limitation, confirmed via this project's prior test runs) — new component tests must account for both, following the established pattern of adding a minimal jsdom polyfill in `src/test/setup.ts` when a new browser API is needed (see the `PointerEvent` polyfill added in the jog-wheel phase for precedent).

---

### Task 1: Add the minimum-viewport CSS token

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Produces: `--min-viewport-width` custom property, documented for reference only (not enforced by any media query in this phase).

- [ ] **Step 1: Add the token**

In `src/index.css`, add to the `:root` block, right after the existing `/* Buttons */` block (currently lines 93-96):

```css
  /* Buttons */
  --btn-height-sm: 28px;
  --btn-height-md: 36px;
  --btn-height-lg: 44px;

  /* Viewport — design-time reference only, not enforced by a media query.
     This layout (deck/mixer proportions, consolidated control rows) is
     designed and tested against this floor; there is no further reflow
     below it. */
  --min-viewport-width: 1366px;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: no errors (this is a pure CSS addition, nothing consumes the token yet).

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add --min-viewport-width design token (1366px floor)"
```

---

### Task 2: `ResizeObserver` jsdom polyfill

**Files:**
- Modify: `src/test/setup.ts`

**Interfaces:**
- Produces: a global `ResizeObserver` constructor available in the jsdom test environment — consumed by Task 3's `DeckWaveform` component and its tests.

- [ ] **Step 1: Add the polyfill**

In `src/test/setup.ts`, add after the existing `DataTransfer` polyfill block (before the `window.YT` mock), mirroring that block's established style:

```ts
/**
 * ResizeObserver polyfill for jsdom.
 *
 * jsdom does not implement ResizeObserver — needed by DeckWaveform's
 * canvas-resizes-to-container-width logic. This is a minimal no-op stub:
 * `observe()` never actually fires the callback (jsdom performs no real
 * layout), so components using it fall back to their initial width state
 * in tests — real resize behavior is verified visually via Playwright.
 */
if (typeof ResizeObserver === 'undefined') {
  class ResizeObserverPolyfill {
    constructor(_callback: ResizeObserverCallback) { /* callback intentionally unused in the stub */ }
    observe(): void { /* no-op in jsdom */ }
    unobserve(): void { /* no-op */ }
    disconnect(): void { /* no-op */ }
  }
  (globalThis as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverPolyfill;
}
```

- [ ] **Step 2: Verify existing tests still pass**

Run: `npm run test`
Expected: all existing test files still pass (this is an additive polyfill; nothing existing depends on `ResizeObserver`'s absence).

- [ ] **Step 3: Commit**

```bash
git add src/test/setup.ts
git commit -m "test: add ResizeObserver jsdom polyfill"
```

---

### Task 3: `DeckWaveform` — extracted per-deck colored waveform

**Files:**
- Create: `src/components/Deck/DeckWaveform.tsx`
- Create: `src/components/Deck/DeckWaveform.module.css`
- Test: `src/test/DeckWaveform.test.tsx`

**Interfaces:**
- Consumes: `useDeck(deckId)` (existing, for `waveformColoredPeaks`/`waveformPeaks`/`duration`/`hotCues`), `usePlayhead(deckId)` (existing, `src/hooks/usePlayhead.ts`), `ColoredPeak` type (existing, `src/utils/extractColoredPeaks.ts`).
- Produces: `<DeckWaveform deckId="A" />` — consumed by Task 4's `DeckDisplay.tsx`.

This component's drawing logic is extracted from `CenterWaveform.tsx`'s `WaveformRow` (to be deleted in Task 5), with the `mirrored` prop removed entirely (no longer paired with another deck) and canvas width driven by a `ResizeObserver` instead of a fixed bitmap size.

- [ ] **Step 1: Write the failing tests**

Create `src/test/DeckWaveform.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeckWaveform } from '../components/Deck/DeckWaveform';
import { useDeckStore } from '../store/deckStore';

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

beforeEach(() => {
  resetDeck('A');
  resetDeck('B');
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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/test/DeckWaveform.test.tsx`
Expected: FAIL — `Cannot find module '../components/Deck/DeckWaveform'`

- [ ] **Step 3: Implement DeckWaveform.module.css**

Create `src/components/Deck/DeckWaveform.module.css`:

```css
/**
 * DeckWaveform.module.css — full-width per-deck waveform canvas wrapper.
 */
.wrapper {
  width: 100%;
}

.canvas {
  display: block;
  width: 100%;
  height: 48px;
}
```

- [ ] **Step 4: Implement DeckWaveform.tsx**

Create `src/components/Deck/DeckWaveform.tsx`:

```tsx
/**
 * DeckWaveform.tsx — Frequency-colored waveform canvas for a single deck.
 *
 * Extracted from the former shared CenterWaveform component (which stacked
 * both decks' waveforms above the deck row) — this renders exactly one
 * deck's waveform, sized to whatever width its container (DeckDisplay's
 * header) provides via a ResizeObserver, since that width is no longer the
 * full app width.
 *
 * Rendering: each bar is colored by frequency content (bass=red, mid=green,
 * high=cyan blend); falls back to a flat monochrome bar from waveformPeaks
 * if colored peaks aren't available yet (still decoding). Draws hot cue
 * markers and a center-following playhead line.
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import { useDeck } from '../../store/deckStore';
import { usePlayhead } from '../../hooks/usePlayhead';
import type { ColoredPeak } from '../../utils/extractColoredPeaks';
import styles from './DeckWaveform.module.css';

const TOTAL_BARS = 1000; // must match WAVEFORM_PEAKS in useAudioEngine.ts
const VISIBLE_HALF = 180;
const VISIBLE_BARS = VISIBLE_HALF * 2 + 1;
const CANVAS_HEIGHT = 48;
const FALLBACK_WIDTH = 300; // used until ResizeObserver reports a real width

const BASS_R = 220, BASS_G = 60,  BASS_B = 40;
const MID_R  = 80,  MID_G  = 200, MID_B  = 80;
const HIGH_R = 60,  HIGH_G = 160, HIGH_B = 255;

interface DeckWaveformProps {
  deckId: 'A' | 'B';
}

export function DeckWaveform({ deckId }: DeckWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(FALLBACK_WIDTH);
  const { waveformColoredPeaks, waveformPeaks, duration, hotCues } = useDeck(deckId);
  const playhead = usePlayhead(deckId);

  const deckColor = deckId === 'A' ? '#4af5ff' : '#ff8c42';
  const playedColor = deckId === 'A' ? 'rgba(74,245,255,0.3)' : 'rgba(255,140,66,0.3)';

  // Resize the canvas's drawing buffer to match its rendered width, so bars
  // stay crisp instead of stretching/blurring at whatever column width this
  // deck's header ends up being (previously always the full app width).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setCanvasWidth(Math.round(width));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const drawFrame = useCallback((currentTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, width, height);

    const hasColored = waveformColoredPeaks && waveformColoredPeaks.length > 0;
    const hasMono = waveformPeaks && waveformPeaks.length > 0;
    if (!hasColored && !hasMono) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(0, height / 2 - 1, width, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(width / 2 - 1, 0, 2, height);
      return;
    }

    const playheadBar = duration > 0
      ? Math.round((currentTime / duration) * (TOTAL_BARS - 1))
      : 0;

    const barWidth = width / VISIBLE_BARS;
    const centerX = width / 2;

    for (let i = 0; i < VISIBLE_BARS; i++) {
      const barIndex = playheadBar - VISIBLE_HALF + i;
      const x = i * barWidth;

      if (barIndex < 0 || barIndex >= TOTAL_BARS) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(x, height / 2 - 1, barWidth, 2);
        continue;
      }

      let barHeight: number;
      let r: number, g: number, b: number;

      if (hasColored) {
        const peak = (waveformColoredPeaks as ColoredPeak[])[barIndex]!;
        barHeight = Math.max(2, peak.amp * height * 0.9);
        r = Math.round(BASS_R * peak.bass + MID_R * peak.mid * 0.5 + HIGH_R * peak.high * 0.2);
        g = Math.round(BASS_G * peak.bass * 0.2 + MID_G * peak.mid + HIGH_G * peak.high * 0.5);
        b = Math.round(BASS_B * peak.bass * 0.1 + MID_B * peak.mid * 0.3 + HIGH_B * peak.high);
        const isFuture = barIndex > playheadBar;
        const factor = isFuture ? 1.0 : 0.55;
        r = Math.min(255, Math.round(r * factor));
        g = Math.min(255, Math.round(g * factor));
        b = Math.min(255, Math.round(b * factor));
      } else {
        const amp = (waveformPeaks as Float32Array)[barIndex] ?? 0;
        barHeight = Math.max(2, amp * height * 0.9);
        const isFuture = barIndex > playheadBar;
        ctx.fillStyle = isFuture ? deckColor : playedColor;
        const y = (height - barHeight) / 2;
        ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
        continue;
      }

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      const y = (height - barHeight) / 2;
      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    }

    // Hot cue markers
    Object.values(hotCues).forEach((cueSec) => {
      if (typeof cueSec !== 'number') return;
      const cueBar = Math.round((cueSec / duration) * (TOTAL_BARS - 1));
      const offsetBars = cueBar - playheadBar;
      if (offsetBars < -VISIBLE_HALF || offsetBars > VISIBLE_HALF) return;
      const cueX = centerX + offsetBars * barWidth;
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(cueX - 1, 0, 2, height);
      ctx.beginPath();
      ctx.moveTo(cueX - 5, 0);
      ctx.lineTo(cueX + 5, 0);
      ctx.lineTo(cueX, 8);
      ctx.closePath();
      ctx.fill();
    });

    // Center playhead line
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(centerX - 1, 0, 2, height);

    // Subtle center glow
    const grd = ctx.createLinearGradient(centerX - 20, 0, centerX + 20, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(centerX - 20, 0, 40, height);
  }, [waveformColoredPeaks, waveformPeaks, duration, hotCues, deckColor, playedColor]);

  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      drawFrame(playhead.current);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [drawFrame, playhead]);

  return (
    <div ref={containerRef} className={styles.wrapper}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={canvasWidth}
        height={CANVAS_HEIGHT}
        aria-label={`Deck ${deckId} waveform`}
      />
    </div>
  );
}

export default DeckWaveform;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/test/DeckWaveform.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/Deck/DeckWaveform.tsx src/components/Deck/DeckWaveform.module.css src/test/DeckWaveform.test.tsx
git commit -m "feat: add DeckWaveform — per-deck frequency-colored waveform canvas"
```

---

### Task 4: Restructure `DeckDisplay` to render the waveform at the top

**Files:**
- Modify: `src/components/Deck/DeckDisplay.tsx`
- Modify: `src/components/Deck/DeckDisplay.module.css`
- Test: `src/test/DeckDisplay.test.tsx` (new file — none existed before)

**Interfaces:**
- Consumes: `<DeckWaveform deckId={deckId} />` (Task 3).

- [ ] **Step 1: Write the failing tests**

Create `src/test/DeckDisplay.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/test/DeckDisplay.test.tsx`
Expected: FAIL — the waveform aria-label test fails (`DeckWaveform` not yet rendered inside `DeckDisplay`); the other two tests pass already since they test unchanged behavior.

- [ ] **Step 3: Restructure DeckDisplay.tsx**

In `src/components/Deck/DeckDisplay.tsx`, add the import and insert the waveform between the header row and the track title:

```tsx
import { useDeck } from '../../store/deckStore';
import { formatTime } from '../../utils/formatTime';
import { DeckWaveform } from './DeckWaveform';
import styles from './DeckDisplay.module.css';

interface DeckDisplayProps {
  deckId: 'A' | 'B';
}

export function DeckDisplay({ deckId }: DeckDisplayProps) {
  const deck = useDeck(deckId);
  const { title, artist, bpm, currentTime, duration, pitchRate, trackId } = deck;

  const hasTrack = trackId !== null;
  const bpmSet = bpm !== null;
  const bpmLabel = bpmSet ? `${bpm} BPM` : '-- BPM';
  const timeLabel = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  const rateLabel = `×${pitchRate.toFixed(2)}`;

  return (
    <div className={styles.display}>
      {/* Deck label + BPM row */}
      <div className={styles.headerRow}>
        <span className={styles.deckLabel}>DECK {deckId}</span>
        <span
          className={`${styles.bpmValue} ${bpmSet ? '' : styles.bpmValueUnset}`}
          aria-live="polite"
          aria-label={`BPM: ${bpmLabel}`}
        >
          {bpmLabel}
        </span>
      </div>

      {/* Per-deck frequency-colored waveform — moved to the top of the deck,
          replacing the formerly shared CenterWaveform */}
      <div className={styles.waveformRow}>
        <DeckWaveform deckId={deckId} />
      </div>

      {/* Track title */}
      <div
        className={`${styles.trackTitle} ${hasTrack ? '' : styles.trackTitleEmpty}`}
        title={hasTrack ? title : undefined}
      >
        {hasTrack ? title || 'Untitled' : 'No track loaded'}
      </div>

      {/* Channel name */}
      {hasTrack && (
        <div className={styles.channelName} title={artist}>
          {artist}
        </div>
      )}

      {/* Time / pitch rate row */}
      <div className={styles.timeRow}>
        <span className={styles.timeDisplay} aria-label={`Time: ${timeLabel}`}>
          {timeLabel}
        </span>
        <span className={styles.pitchRate} aria-label={`Pitch rate: ${rateLabel}`}>
          {rateLabel}
        </span>
      </div>
    </div>
  );
}

export default DeckDisplay;
```

- [ ] **Step 4: Add the waveformRow spacing rule**

In `src/components/Deck/DeckDisplay.module.css`, add after the existing `.headerRow` block (currently lines 11-16):

```css
.waveformRow {
  margin-bottom: var(--space-2);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/test/DeckDisplay.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/components/Deck/DeckDisplay.tsx src/components/Deck/DeckDisplay.module.css src/test/DeckDisplay.test.tsx
git commit -m "feat: render DeckWaveform at the top of DeckDisplay"
```

---

### Task 5: Remove the shared `CenterWaveform` and the old per-deck `WaveformDisplay`

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Deck/Deck.tsx`
- Delete: `src/components/CenterWaveform/CenterWaveform.tsx`
- Delete: `src/components/CenterWaveform/CenterWaveform.module.css`
- Delete: `src/components/Deck/WaveformDisplay.tsx`
- Delete: `src/components/Deck/WaveformDisplay.module.css`

**Interfaces:**
- Consumes: nothing new (Task 3/4 already provide the replacement waveform).

- [ ] **Step 1: Remove CenterWaveform from App.tsx**

In `src/App.tsx`, remove the import (currently line 3):

```tsx
import { CenterWaveform } from './components/CenterWaveform/CenterWaveform';
```

Remove the render (currently lines 86-88):

```tsx
      <main className="app-main">
        {/* Serato-style dual scrolling waveform — full width above deck columns */}
        <CenterWaveform />

        <div className="app-deck-row">
```

becomes:

```tsx
      <main className="app-main">
        <div className="app-deck-row">
```

- [ ] **Step 2: Remove WaveformDisplay from Deck.tsx**

In `src/components/Deck/Deck.tsx`, remove the import (currently line 41):

```tsx
import { WaveformDisplay } from './WaveformDisplay';
```

Remove the render (currently lines 145-146):

```tsx
      {/* Waveform display — shown when peaks are available */}
      <WaveformDisplay deckId={deckId} />

      {/* File import — only shown when no track is loaded */}
```

becomes:

```tsx
      {/* File import — only shown when no track is loaded */}
```

- [ ] **Step 3: Delete the four obsolete files**

```bash
git rm src/components/CenterWaveform/CenterWaveform.tsx
git rm src/components/CenterWaveform/CenterWaveform.module.css
git rm src/components/Deck/WaveformDisplay.tsx
git rm src/components/Deck/WaveformDisplay.module.css
```

- [ ] **Step 4: Run the full test suite**

Run: `npm run test`
Expected: all remaining test files pass (no test files existed for `CenterWaveform` or `WaveformDisplay` prior to this plan, per this project's existing test coverage — confirm this with `git status` after the `git rm` calls above: no `src/test/CenterWaveform*` or `src/test/WaveformDisplay*` files should appear as deleted, since none existed).

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: no errors (confirms no other file still imports either deleted component).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: remove shared CenterWaveform and old per-deck WaveformDisplay"
```

---

### Task 6: Relocate `EQPanel` into `Mixer` as flanking columns

**Files:**
- Move: `src/components/Deck/EQPanel.tsx` → `src/components/Mixer/EQPanel.tsx`
- Move: `src/components/Deck/EQPanel.module.css` → `src/components/Mixer/EQPanel.module.css`
- Modify: `src/components/Mixer/Mixer.tsx`
- Modify: `src/components/Mixer/Mixer.module.css`
- Modify: `src/components/Deck/Deck.tsx`
- Test: `src/test/EQPanel.test.tsx` (new file — none existed before)

**Interfaces:**
- Produces: `<EQPanel deckId="A" />` now rendered from `src/components/Mixer/Mixer.tsx` (same component, same props, new home and new internal `flex-direction`).

- [ ] **Step 1: Write the failing test (against the new post-move location)**

Create `src/test/EQPanel.test.tsx`, importing from where `EQPanel` will live after this task's move (Step 3) — this import will fail to resolve until then, giving a genuine RED state:

```tsx
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/EQPanel.test.tsx`
Expected: FAIL — `Cannot find module '../components/Mixer/EQPanel'` (the file doesn't exist at that path yet).

- [ ] **Step 3: Move the files**

```bash
git mv src/components/Deck/EQPanel.tsx src/components/Mixer/EQPanel.tsx
git mv src/components/Deck/EQPanel.module.css src/components/Mixer/EQPanel.module.css
```

(Both files' own internal imports are relative — `EQPanel.tsx`'s `import styles from './EQPanel.module.css'` and its store imports `from '../../store/deckStore'` — remain correct after the move since `src/components/Mixer/` is at the same directory depth as `src/components/Deck/`; no import paths inside the moved files need to change.)

- [ ] **Step 4: Change EQPanel's knob row to a vertical column**

In `src/components/Mixer/EQPanel.module.css`, change `.knobsRow` (currently lines 26-30) from:

```css
.knobsRow {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
}
```

to:

```css
.knobsRow {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
}
```

Change `.panel` (currently lines 5-8) from:

```css
.panel {
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
}
```

to (no border — this is now a vertical column beside the mixer, not a horizontal row inside a deck's stack; padding tightened since the column is narrow):

```css
.panel {
  padding: var(--space-2);
}
```

At this point, running `npx vitest run src/test/EQPanel.test.tsx` should already PASS (2 tests) — the module now resolves and `EQPanel`'s rendering logic itself is unchanged, only its CSS. This confirms the move + CSS edit didn't break the component; the remaining steps wire it into `Mixer.tsx` and remove it from `Deck.tsx`.

- [ ] **Step 5: Restructure Mixer.tsx**

In `src/components/Mixer/Mixer.tsx`, add the import and wrap the existing content:

```tsx
import { VUMeter } from './VUMeter';
import { Crossfader } from './Crossfader';
import { ChannelFader } from './ChannelFader';
import { CrossfaderCurveSelector } from './CrossfaderCurveSelector';
import { MasterVolumeKnob } from './MasterVolumeKnob';
import { GainKnob } from './GainKnob';
import { BeatmatchGuide } from './BeatmatchGuide';
import { EQPanel } from './EQPanel';
import styles from './Mixer.module.css';

/**
 * Mixer — center column mixer strip between Deck A and Deck B.
 *
 * Layout: EQPanel (Deck A) | vertical mixer stack | EQPanel (Deck B).
 * The vertical stack itself contains (top to bottom):
 *   - "MIXER" section label
 *   - Per-deck channel volume faders (CH A / CH B)
 *   - VU meters (visual-only, animated from volume level)
 *   - Crossfader (with crossfader curve selector)
 *   - Master volume control
 *
 * Volume application pattern:
 *   mixerStore.setCrossfaderPosition / setChannelFaderA / setChannelFaderB
 *   → recalculates composite volumes
 *   → calls deckStore.setVolume(deckId, compositeVol)
 *   → audio engine subscription picks up the store change and calls player.setVolume()
 *
 * This satisfies the <50ms response requirement because the entire chain is
 * synchronous within the React state update triggered by the input event.
 */
export function Mixer() {
  return (
    <div className={styles.mixer}>
      <div className={styles.eqColumn}>
        <EQPanel deckId="A" />
      </div>

      <div className={styles.mixerCenter}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>MIXER</span>
        </div>

        {/* Master volume — global output level above channel faders */}
        <section className={styles.section} aria-label="Master volume">
          <MasterVolumeKnob />
        </section>

        {/* Channel input trim (GAIN) — top of the controller's mixer column */}
        <section className={styles.section} aria-label="Channel gain">
          <div className={styles.sectionLabel}>GAIN</div>
          <div className={styles.channelRow}>
            <GainKnob deckId="A" />
            <GainKnob deckId="B" />
          </div>
        </section>

        {/* Channel faders — per-deck volume controls in the mixer strip */}
        <section className={styles.section} aria-label="Channel faders">
          <div className={styles.sectionLabel}>CH FADERS</div>
          <div className={styles.channelRow}>
            <ChannelFader deckId="A" />
            <ChannelFader deckId="B" />
          </div>
        </section>

        {/* VU Meters */}
        <section className={styles.section} aria-label="Level meters">
          <div className={styles.sectionLabel}>LEVELS</div>
          <div className={styles.vuRow}>
            <div className={styles.vuChannel}>
              <span className={styles.vuLabel} style={{ color: 'var(--color-deck-a-text)' }}>A</span>
              <VUMeter deckId="A" />
            </div>
            <div className={styles.vuChannel}>
              <span className={styles.vuLabel} style={{ color: 'var(--color-deck-b-text)' }}>B</span>
              <VUMeter deckId="B" />
            </div>
          </div>
        </section>

        {/* Beatmatch guide — tempo + phase alignment between decks */}
        <section className={styles.section}>
          <BeatmatchGuide />
        </section>

        {/* Crossfader */}
        <section className={styles.section} aria-label="Crossfader">
          <div className={styles.sectionLabel}>CROSSFADER</div>
          <Crossfader />
          <CrossfaderCurveSelector />
        </section>
      </div>

      <div className={styles.eqColumn}>
        <EQPanel deckId="B" />
      </div>
    </div>
  );
}

export default Mixer;
```

- [ ] **Step 6: Update Mixer.module.css**

In `src/components/Mixer/Mixer.module.css`, change `.mixer` (currently lines 3-11) from:

```css
.mixer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-surface);
  padding: var(--space-3);
  gap: var(--space-3);
  overflow-y: auto;
}
```

to:

```css
.mixer {
  display: flex;
  flex-direction: row;
  height: 100%;
  background: var(--color-bg-surface);
  overflow: hidden;
}

/* The former .mixer vertical stack — now the center of a 3-column row */
.mixerCenter {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  padding: var(--space-3);
  gap: var(--space-3);
  overflow-y: auto;
}

/* EQ columns flanking the mixer center */
.eqColumn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: var(--space-1) 0;
}

.eqColumn:first-child {
  border-right: 1px solid var(--color-border-default);
}

.eqColumn:last-child {
  border-left: 1px solid var(--color-border-default);
}
```

- [ ] **Step 7: Remove EQPanel from Deck.tsx**

In `src/components/Deck/Deck.tsx`, remove the import (currently line 32):

```tsx
import { EQPanel } from './EQPanel';
```

Remove the render (currently lines 175-176):

```tsx
      {/* EQ knobs with kill switches and filter sweep */}
      <EQPanel deckId={deckId} />

```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/test/EQPanel.test.tsx`
Expected: PASS (2 tests)

Run: `npm run test`
Expected: all test files pass.

- [ ] **Step 9: Verify build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: relocate EQPanel into Mixer as flanking vertical columns"
```

---

### Task 7: Consolidate Tap BPM / FX / Grid Control into one row

**Files:**
- Modify: `src/components/Deck/Deck.tsx`
- Modify: `src/components/Deck/Deck.module.css`
- Modify: `src/components/Deck/TapTempo.module.css`
- Modify: `src/components/Deck/EffectsPanel.module.css`
- Modify: `src/components/Deck/GridControl.module.css`
- Test: `src/test/deck-consolidated-rows.test.tsx` (new file)

**Interfaces:**
- Consumes: `TapTempo`, `EffectsPanel`, `GridControl` (all existing, unchanged props/behavior — only their own outer padding/border move to the new shared wrapper).

- [ ] **Step 1: Strip each component's own outer padding/border**

In `src/components/Deck/TapTempo.module.css`, change `.wrapper` (currently lines 5-12) from:

```css
.wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
  gap: var(--space-3);
}
```

to:

```css
.wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
```

In `src/components/Deck/EffectsPanel.module.css`, change `.panel` (currently lines 3-6) from:

```css
.panel {
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
}
```

to:

```css
.panel {
}
```

In `src/components/Deck/GridControl.module.css`, change `.grid` (currently lines 10-16) from:

```css
.grid {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
}
```

to:

```css
.grid {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
```

Also add `white-space: nowrap` to `.status` (currently lines 99-106) so the status text never wraps in its narrower column:

```css
.status {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-primary);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  margin-left: var(--space-1);
  white-space: nowrap;
}
```

- [ ] **Step 2: Add the shared row wrapper to Deck.module.css**

In `src/components/Deck/Deck.module.css`, add after the existing `.volumeSection` block (currently lines 28-32):

```css
/* Tap BPM / FX / Grid Control — consolidated row. FX gets the most room
   (5 controls); Tap BPM and Grid Control take only the width their content
   needs. Targets the 3 direct children by position since each of
   TapTempo/EffectsPanel/GridControl renders its own single root element. */
.tapFxGridRow {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
}

.tapFxGridRow > *:nth-child(1) {
  flex-shrink: 0;
}

.tapFxGridRow > *:nth-child(2) {
  flex: 1;
  min-width: 0;
}

.tapFxGridRow > *:nth-child(3) {
  flex-shrink: 0;
}
```

- [ ] **Step 3: Write the failing test**

Create `src/test/deck-consolidated-rows.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Deck } from '../components/Deck/Deck';
import { useDeckStore } from '../store/deckStore';
import styles from '../components/Deck/Deck.module.css';

describe('Deck — Tap BPM / FX / Grid Control consolidated row', () => {
  it('renders TapTempo, EffectsPanel, and GridControl as siblings inside one row wrapper, in that order', () => {
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], trackId: null } },
    });
    const { container } = render(<Deck deckId="A" />);

    const row = container.querySelector(`.${styles.tapFxGridRow}`);
    expect(row).not.toBeNull();
    expect(row?.children.length).toBe(3);

    // TapTempo's own root has the "TAP BPM" label; GridControl's root has an
    // aria-label containing "beat grid"; EffectsPanel's root contains "FX".
    expect(row?.children[0]?.textContent).toContain('TAP BPM');
    expect(row?.children[1]?.textContent).toContain('FX');
    expect(row?.children[2]?.getAttribute('aria-label')).toContain('beat grid');
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx vitest run src/test/deck-consolidated-rows.test.tsx`
Expected: FAIL at `expect(row).not.toBeNull()` — `styles.tapFxGridRow` itself resolves fine (the CSS rule already exists from Step 2), but no element in `Deck.tsx`'s current JSX has that class yet, so `container.querySelector` finds nothing until `Deck.tsx` is restructured below.

- [ ] **Step 5: Restructure Deck.tsx**

In `src/components/Deck/Deck.tsx`, replace the three separate render lines (currently the `TapTempo`, `GridControl`, `PitchSlider`, `EQPanel` (already removed in Task 6), `EffectsPanel` block, lines 166-179 as of before this task) — specifically replace:

```tsx
      {/* Tap BPM */}
      <TapTempo deckId={deckId} />

      {/* Beat grid: tap downbeat + nudge */}
      <GridControl deckId={deckId} />

      {/* Pitch slider */}
      <PitchSlider deckId={deckId} />

      {/* Effects — Echo / Reverb */}
      <EffectsPanel deckId={deckId} />
```

with:

```tsx
      {/* Tap BPM / FX / Grid Control — consolidated 3-column row */}
      <div className={styles.tapFxGridRow}>
        <TapTempo deckId={deckId} />
        <EffectsPanel deckId={deckId} />
        <GridControl deckId={deckId} />
      </div>

      {/* Pitch slider */}
      <PitchSlider deckId={deckId} />
```

(`PitchSlider`'s render stays where it is for now — Task 8 moves it into the volume row.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/test/deck-consolidated-rows.test.tsx`
Expected: PASS (1 test)

Run: `npm run test`
Expected: all test files pass.

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: consolidate Tap BPM / FX / Grid Control into one row"
```

---

### Task 8: Consolidate Volume + Pitch into one row

**Files:**
- Modify: `src/components/Deck/Deck.tsx`
- Modify: `src/components/Deck/Deck.module.css`
- Modify: `src/components/Deck/PitchSlider.module.css`
- Test: `src/test/deck-consolidated-rows.test.tsx` (extend — same file created in Task 7)

**Interfaces:**
- Consumes: `PitchSlider` (existing, unchanged props/behavior).

- [ ] **Step 1: Strip PitchSlider's own outer padding/border**

In `src/components/Deck/PitchSlider.module.css`, change `.wrapper` (currently lines 5-8) from:

```css
.wrapper {
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
}
```

to:

```css
.wrapper {
}
```

- [ ] **Step 2: Strip the deck volume fader's own outer padding/border**

In `src/components/Deck/Deck.module.css`, change `.volumeSection` (currently lines 29-32) from:

```css
.volumeSection {
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
}
```

to:

```css
.volumeSection {
}
```

- [ ] **Step 3: Add the shared pitch/volume row wrapper**

In `src/components/Deck/Deck.module.css`, add after the `.tapFxGridRow` rules added in Task 7:

```css
/* Volume fader + Pitch slider — consolidated 2-column row, equal halves. */
.pitchVolumeRow {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
}

.pitchVolumeRow > * {
  flex: 1;
  min-width: 0;
}
```

- [ ] **Step 4: Write the failing test (extend the Task 7 file)**

In `src/test/deck-consolidated-rows.test.tsx`, add a new `describe` block after the existing one:

```tsx
describe('Deck — Volume / Pitch consolidated row', () => {
  it('renders the volume fader and PitchSlider as siblings inside one row wrapper', () => {
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], trackId: null } },
    });
    const { container } = render(<Deck deckId="A" />);

    const row = container.querySelector(`.${styles.pitchVolumeRow}`);
    expect(row).not.toBeNull();
    expect(row?.children.length).toBe(2);
    expect(row?.children[0]?.textContent).toContain('VOL');
    expect(row?.children[1]?.textContent).toContain('PITCH');
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run src/test/deck-consolidated-rows.test.tsx`
Expected: FAIL at `expect(row).not.toBeNull()` in the new test — `styles.pitchVolumeRow` resolves fine (the CSS rule already exists from Step 3), but no element in `Deck.tsx`'s current JSX has that class yet; the Task 7 test still passes.

- [ ] **Step 6: Restructure Deck.tsx**

In `src/components/Deck/Deck.tsx`, replace the `PitchSlider` render (now sitting alone, from Task 7's Step 5) and the volume fader block — specifically replace:

```tsx
      {/* Pitch slider */}
      <PitchSlider deckId={deckId} />

      {/* Volume fader */}
      <div className={styles.volumeSection}>
        <span className={styles.volumeLabel}>VOL</span>
        <input
          type="range"
          className={styles.volumeSlider}
          min={0}
          max={100}
          step={1}
          value={channelFader}
          onChange={handleVolumeChange}
          aria-label={`Deck ${deckId} volume`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={channelFader}
          aria-valuetext={`${channelFader}%`}
        />
        <div className={styles.volumeEndLabels}>
          <span>0</span>
          <span>100</span>
        </div>
      </div>
```

with:

```tsx
      {/* Volume fader + Pitch slider — consolidated 2-column row */}
      <div className={styles.pitchVolumeRow}>
        <div className={styles.volumeSection}>
          <span className={styles.volumeLabel}>VOL</span>
          <input
            type="range"
            className={styles.volumeSlider}
            min={0}
            max={100}
            step={1}
            value={channelFader}
            onChange={handleVolumeChange}
            aria-label={`Deck ${deckId} volume`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={channelFader}
            aria-valuetext={`${channelFader}%`}
          />
          <div className={styles.volumeEndLabels}>
            <span>0</span>
            <span>100</span>
          </div>
        </div>
        <PitchSlider deckId={deckId} />
      </div>
```

- [ ] **Step 7: Update the Deck.tsx docstring**

Also in `src/components/Deck/Deck.tsx`, update the file header docstring (currently lines 1-21) to reflect the final render order after this whole plan's changes:

```tsx
/**
 * Deck.tsx — Main deck container component.
 *
 * Reads all state from deckStore via the deckId prop.
 *
 * Layout (top to bottom):
 *   DeckDisplay        — deck label, BPM, per-deck waveform, track title, channel, time/rate
 *   JogWheel           — animated vinyl platter + scratch/bend drag surface
 *   DeckControls       — Play/Pause, Cue, Set Cue
 *   DeckModifiers      — SHIFT / QUANTIZE / ROLL
 *   PadGrid            — HOT CUE / LOOP / SLICER / SAMPLER
 *   SlipButton, BeatJump
 *   Tap BPM / FX / Grid Control — consolidated row
 *   Volume fader / Pitch slider — consolidated row
 *
 * EQ controls now live in Mixer.tsx, flanking the mixer's channel strip —
 * not rendered here.
 *
 * States handled:
 *   - Empty: no track loaded, shows "No Track Loaded" message
 *   - Buffering: spinner overlay on platter
 *   - Error: error message banner beneath platter
 *   - Playing/Paused/Ended: platter spin controlled by JogWheel (reads playbackState internally)
 */
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/test/deck-consolidated-rows.test.tsx`
Expected: PASS (2 tests)

Run: `npm run test`
Expected: all test files pass.

- [ ] **Step 9: Verify build and lint**

Run: `npm run build`
Expected: no errors.

Run: `npm run lint`
Expected: zero warnings.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: consolidate Volume fader / Pitch slider into one row"
```

---

### Task 9: Full verification (build, lint, tests, Playwright visual check at 1366×768)

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: all test files pass, 0 failures.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: clean, no type errors, no warnings.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: zero warnings/errors.

- [ ] **Step 4: Playwright visual check at the 1366×768 floor**

This is a manual/ad-hoc verification pass (not a committed test file), matching how every prior phase of this project verified layout-sensitive work end-to-end before merge.

1. Start the dev server: `npm run dev`.
2. Using Playwright (headless Chromium), set the viewport to exactly `{ width: 1366, height: 768 }` and navigate to the app.
3. Load a track onto each deck (via the real file-import flow, mirroring the technique used in prior phases' smoke tests) so the waveform, EQ knobs, and all consolidated rows have real content to render.
4. Take a full-page screenshot and visually inspect it for:
   - No unwanted horizontal scrollbar.
   - Each deck's waveform renders at the top of `DeckDisplay`, full-width, with visible frequency coloring (not blank/broken).
   - The Mixer shows EQ columns flanking the existing gain/fader/levels/crossfader stack, with all 4 EQ controls (BASS/MID/TREBLE/FILTER) visible and not clipped or overlapping the center stack.
   - The Tap BPM / FX / Grid Control row shows all three components on one line, with FX visibly wider than the other two and none of its 5 controls wrapped or clipped.
   - The Volume / Pitch row shows both sliders side by side, each keeping its own label + end-labels.
5. Note whether vertical scroll is still needed within either deck column at this viewport size (best-effort goal per the design spec, not a hard pass/fail gate).
6. Confirm no console errors were logged during the whole session (`page.on('console', ...)` filtered to `error`-level messages).

If any visual check reveals a genuine layout defect (overlapping controls, clipped content, a blank waveform, a broken EQ column), treat it as a real implementation defect to fix before considering this phase complete.

- [ ] **Step 5: Final report**

Summarize: test count, build status, lint status, and the Playwright visual-check outcome (pass/fail per the numbered checks above, plus whether vertical scroll was eliminated or still needed). This is the final task in the plan — once it passes, the layout overhaul is ready for the whole-branch review and merge (via `superpowers:finishing-a-development-branch`, matching every prior phase).
