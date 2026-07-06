# Waveform Zoom Controls + Platter Spin Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-deck waveform zoom +/- buttons and a rotating spin-marker line on the vinyl platter.

**Architecture:** Waveform zoom is a new `waveformZoomIndex` field on `DeckState`, driving `DeckWaveform.tsx`'s existing (currently hardcoded) visible-bar-window math; two new store actions step through five preset levels. The platter marker is a pure CSS/JSX addition — one new child element inside `VinylPlatter.tsx`'s existing `.platter` div, which is already the thing being rotated (via CSS animation or an inline `transform`), so it needs no new state at all.

**Tech Stack:** React 18 + TypeScript (strict: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Zustand, CSS Modules, Vitest + Testing Library.

## Global Constraints

- Zoom levels (bars visible each side of the playhead — "VISIBLE_HALF"): `[20, 60, 180, 300, 500]`, giving visible-bar totals of 41, 121, 361 (today's fixed default), 601, and 1001 (the whole 1000-bar track). Default index: `2` (361 bars, unchanged from today's behavior).
- Zoom is discrete steps (click = move one level), clamped at both ends (no wraparound).
- `waveformZoomIndex` persists across `loadTrack`/`clearTrack` — same convention as `vinylMode` (never reset by either action).
- Zoom buttons render in a row directly above each deck's waveform, left-aligned ("+"= zoom in / fewer bars / more detail, first "−" then "+" reading left to right, matching common zoom-control ordering).
- Platter marker: a single vertical bar from the platter's rim inward to the edge of the center label, at the platter's fixed 12-o'clock position in its own (rotating) coordinate frame, colored with the existing `--color-accent-primary` custom property. No new component props, no new store state.
- `DeckState` is a strict, exhaustively-typed interface (`noUncheckedIndexedAccess` is on elsewhere in the codebase too) — only 3 test files construct a full `DeckState` object literal typed exactly as `DeckState` (checked via `grep -rn ": DeckState\b" src`): `src/test/deck-vinylmode.test.ts`, `src/test/keyboardShortcuts.test.ts`, `src/test/slip-mode.test.ts`. None of these three currently include the already-existing `cueEnabled` field either (a pre-existing gap — `src/test` is outside the `tsc -b` build's type-checked scope and Vitest itself doesn't type-check `.ts` files by default, so this has never caused a build or test failure). Do **not** update these 3 files to add `waveformZoomIndex` — this matches the established, harmless precedent of `cueEnabled`'s omission and is intentionally out of scope for this plan.

---

### Task 1: Store layer — zoom levels, state field, and actions

**Files:**
- Create: `src/utils/waveformZoom.ts`
- Modify: `src/types/deck.ts`
- Modify: `src/store/deckStore.ts`
- Test: `src/test/waveform-zoom.test.ts` (new)

**Interfaces:**
- Produces: `WAVEFORM_ZOOM_LEVELS: readonly [20, 60, 180, 300, 500]` and `DEFAULT_WAVEFORM_ZOOM_INDEX: 2` (exported from `src/utils/waveformZoom.ts`); `DeckState.waveformZoomIndex: number`; `deckStore` actions `zoomWaveformIn(deckId: 'A' | 'B'): void` and `zoomWaveformOut(deckId: 'A' | 'B'): void`.

- [ ] **Step 1: Create the zoom-level constants file**

Create `src/utils/waveformZoom.ts`:

```ts
/**
 * waveformZoom.ts — shared zoom-level constants for the per-deck waveform display.
 */

/**
 * VISIBLE_HALF values (bars each side of the playhead) for each zoom level,
 * narrowest/most-zoomed-in first, widest/whole-track last. Visible bar totals
 * are (value * 2 + 1): 41, 121, 361, 601, 1001 — out of the fixed 1000-bar
 * TOTAL_BARS in DeckWaveform.tsx (so the last level shows the entire track).
 */
export const WAVEFORM_ZOOM_LEVELS = [20, 60, 180, 300, 500] as const;

/** Index into WAVEFORM_ZOOM_LEVELS matching today's fixed 180-bar-half default. */
export const DEFAULT_WAVEFORM_ZOOM_INDEX = 2;
```

- [ ] **Step 2: Add the `waveformZoomIndex` field to `DeckState`**

In `src/types/deck.ts`, find this existing field (it's the field directly after `padMode`):

```ts
  /**
   * VINYL scratch mode for the jog wheel. true (default, matches real
   * hardware): dragging the platter stops the track and scratches it.
   * false: dragging only applies a temporary pitch bend, never stopping
   * the track. Persists across track loads (like padMode) — this is a
   * per-deck hardware-style setting, not track state.
   */
  vinylMode: boolean;
```

Add the new field directly after it:

```ts

  /**
   * Index into WAVEFORM_ZOOM_LEVELS (src/utils/waveformZoom.ts) controlling
   * how many bars are visible around the playhead in DeckWaveform. Persists
   * across track loads/ejects (like vinylMode) — a per-deck display
   * preference, not track state.
   */
  waveformZoomIndex: number;
```

- [ ] **Step 3: Write the failing tests for the default value and the two actions**

Create `src/test/waveform-zoom.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useDeckStore } from '../store/deckStore';
import { WAVEFORM_ZOOM_LEVELS, DEFAULT_WAVEFORM_ZOOM_INDEX } from '../utils/waveformZoom';

describe('waveform zoom', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('defaults to DEFAULT_WAVEFORM_ZOOM_INDEX', () => {
    expect(useDeckStore.getState().decks.A.waveformZoomIndex).toBe(DEFAULT_WAVEFORM_ZOOM_INDEX);
  });

  it('zoomWaveformIn moves to the previous (narrower) index', () => {
    useDeckStore.getState().zoomWaveformIn('A');
    expect(useDeckStore.getState().decks.A.waveformZoomIndex).toBe(DEFAULT_WAVEFORM_ZOOM_INDEX - 1);
  });

  it('zoomWaveformOut moves to the next (wider) index', () => {
    useDeckStore.getState().zoomWaveformOut('A');
    expect(useDeckStore.getState().decks.A.waveformZoomIndex).toBe(DEFAULT_WAVEFORM_ZOOM_INDEX + 1);
  });

  it('zoomWaveformIn clamps at 0 (does not go below the narrowest level)', () => {
    for (let i = 0; i < WAVEFORM_ZOOM_LEVELS.length + 2; i++) {
      useDeckStore.getState().zoomWaveformIn('A');
    }
    expect(useDeckStore.getState().decks.A.waveformZoomIndex).toBe(0);
  });

  it('zoomWaveformOut clamps at the last index (does not exceed the whole-track level)', () => {
    for (let i = 0; i < WAVEFORM_ZOOM_LEVELS.length + 2; i++) {
      useDeckStore.getState().zoomWaveformOut('A');
    }
    expect(useDeckStore.getState().decks.A.waveformZoomIndex).toBe(WAVEFORM_ZOOM_LEVELS.length - 1);
  });

  it('does not affect the other deck', () => {
    useDeckStore.getState().zoomWaveformOut('A');
    expect(useDeckStore.getState().decks.B.waveformZoomIndex).toBe(DEFAULT_WAVEFORM_ZOOM_INDEX);
  });

  it('survives loadTrack (persists like vinylMode)', () => {
    useDeckStore.getState().zoomWaveformOut('A');
    useDeckStore.getState().loadTrack('A', 't1', { title: 'T', artist: 'A', duration: 100, thumbnailUrl: null });
    expect(useDeckStore.getState().decks.A.waveformZoomIndex).toBe(DEFAULT_WAVEFORM_ZOOM_INDEX + 1);
  });

  it('survives clearTrack (persists like vinylMode)', () => {
    useDeckStore.getState().zoomWaveformOut('A');
    useDeckStore.getState().clearTrack('A');
    expect(useDeckStore.getState().decks.A.waveformZoomIndex).toBe(DEFAULT_WAVEFORM_ZOOM_INDEX + 1);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/test/waveform-zoom.test.ts`
Expected: FAIL — `waveformZoomIndex` is `undefined` and `zoomWaveformIn`/`zoomWaveformOut` don't exist on the store yet (TypeError: `useDeckStore.getState().zoomWaveformIn is not a function`).

- [ ] **Step 5: Add the default value to `createInitialDeckState`**

In `src/store/deckStore.ts`, add this import near the top (alongside the other util imports, e.g. right after the `cueEngine` import):

```ts
import { WAVEFORM_ZOOM_LEVELS, DEFAULT_WAVEFORM_ZOOM_INDEX } from '../utils/waveformZoom';
```

Find this line inside `createInitialDeckState`:

```ts
    vinylMode: true,
```

Add the new field directly after it:

```ts
    vinylMode: true,
    waveformZoomIndex: DEFAULT_WAVEFORM_ZOOM_INDEX,
```

- [ ] **Step 6: Add the two action declarations to the `DeckStoreActions` interface**

Find this existing declaration:

```ts
  /** Enable or disable VINYL scratch mode for the specified deck's jog wheel. Persists across track loads (like padMode); forces any in-progress scratch to end when disabled. */
  setVinylMode: (deckId: 'A' | 'B', enabled: boolean) => void;
```

Add the two new declarations directly after it:

```ts
  /** Enable or disable VINYL scratch mode for the specified deck's jog wheel. Persists across track loads (like padMode); forces any in-progress scratch to end when disabled. */
  setVinylMode: (deckId: 'A' | 'B', enabled: boolean) => void;

  /** Move to a narrower waveform view (fewer bars visible, more detail), clamped at the most-zoomed-in level (index 0). */
  zoomWaveformIn: (deckId: 'A' | 'B') => void;

  /** Move to a wider waveform view (more bars visible), clamped at the last level (the whole track at once). */
  zoomWaveformOut: (deckId: 'A' | 'B') => void;
```

- [ ] **Step 7: Implement the two actions**

Find the `setVinylMode` implementation:

```ts
  setVinylMode: (deckId, enabled) => {
    if (!enabled && get().decks[deckId].scratching) {
      get().endScratch(deckId);
    }
    updateDeck(set, deckId, { vinylMode: enabled });
  },

  toggleCue: (deckId) => {
```

Replace with (inserting the two new actions between `setVinylMode` and `toggleCue`):

```ts
  setVinylMode: (deckId, enabled) => {
    if (!enabled && get().decks[deckId].scratching) {
      get().endScratch(deckId);
    }
    updateDeck(set, deckId, { vinylMode: enabled });
  },

  zoomWaveformIn: (deckId) => {
    const deck = get().decks[deckId];
    const nextIndex = Math.max(0, deck.waveformZoomIndex - 1);
    updateDeck(set, deckId, { waveformZoomIndex: nextIndex });
  },

  zoomWaveformOut: (deckId) => {
    const deck = get().decks[deckId];
    const nextIndex = Math.min(WAVEFORM_ZOOM_LEVELS.length - 1, deck.waveformZoomIndex + 1);
    updateDeck(set, deckId, { waveformZoomIndex: nextIndex });
  },

  toggleCue: (deckId) => {
```

Do **not** add `waveformZoomIndex` to the `loadTrack` or `clearTrack` update objects — omitting it there is what makes it persist (see Global Constraints).

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/test/waveform-zoom.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 9: Run the full suite, build, and lint**

Run: `npx vitest run`
Expected: all tests pass (868 pre-existing + 9 new = 877)

Run: `npm run build`
Expected: clean, no TypeScript errors

Run: `npm run lint`
Expected: clean, 0 warnings

- [ ] **Step 10: Commit**

```bash
git add src/utils/waveformZoom.ts src/types/deck.ts src/store/deckStore.ts src/test/waveform-zoom.test.ts
git commit -m "feat: add waveformZoomIndex state + zoomWaveformIn/zoomWaveformOut actions"
```

---

### Task 2: Wire zoom into `DeckWaveform.tsx`'s rendering

**Files:**
- Modify: `src/components/Deck/DeckWaveform.tsx`
- Test: `src/test/DeckWaveform.test.tsx`

**Interfaces:**
- Consumes: `DeckState.waveformZoomIndex` (Task 1); `WAVEFORM_ZOOM_LEVELS`, `DEFAULT_WAVEFORM_ZOOM_INDEX` from `src/utils/waveformZoom.ts` (Task 1).
- Produces: no new exports — `DeckWaveform`'s rendered bar count now varies with `waveformZoomIndex` instead of being fixed at 361.

- [ ] **Step 1: Write the failing test**

Open `src/test/DeckWaveform.test.tsx`. Add this new test at the end of the `describe('DeckWaveform', ...)` block, directly before the closing `});` of the describe block (after the last existing test, "draws the flat-line-plus-playhead fallback..."):

```ts

  it('draws fewer bars at a narrower zoom level (waveformZoomIndex 0 = 41 bars vs. default 361)', async () => {
    playerRegistry.register('A', {
      seekTo: vi.fn(),
      getCurrentTime: () => 60,
      getDuration: () => 120,
    });
    const peaks = Array.from({ length: 1000 }, () => ({ amp: 0.5, bass: 0.3, mid: 0.3, high: 0.3 }));

    // First render at the default zoom (361 bars) and record the fillRect count.
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: { ...useDeckStore.getState().decks['A'], waveformColoredPeaks: peaks, duration: 120 },
      },
    });
    const { unmount } = render(<DeckWaveform deckId="A" />);
    await flushRaf();
    const defaultZoomCallCount = mockCtx.fillRect.mock.calls.length;
    unmount();

    // Now render at the narrowest zoom (index 0 = 41 bars) and compare.
    vi.clearAllMocks();
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: { ...useDeckStore.getState().decks['A'], waveformZoomIndex: 0 },
      },
    });
    render(<DeckWaveform deckId="A" />);
    await flushRaf();
    const narrowZoomCallCount = mockCtx.fillRect.mock.calls.length;

    expect(narrowZoomCallCount).toBeLessThan(defaultZoomCallCount);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/DeckWaveform.test.tsx`
Expected: FAIL — `waveformZoomIndex` has no effect yet, so both call counts are identical (`narrowZoomCallCount` is not less than `defaultZoomCallCount`).

- [ ] **Step 3: Make `VISIBLE_HALF`/`VISIBLE_BARS` dynamic**

In `src/components/Deck/DeckWaveform.tsx`, find these module-level constants near the top:

```ts
const TOTAL_BARS = 1000; // must match WAVEFORM_PEAKS in useAudioEngine.ts
const VISIBLE_HALF = 180;
const VISIBLE_BARS = VISIBLE_HALF * 2 + 1;
const CANVAS_HEIGHT = 48;
const FALLBACK_WIDTH = 300; // used until ResizeObserver reports a real width
```

Replace with (removing the two zoom-dependent constants, they become per-render values below):

```ts
const TOTAL_BARS = 1000; // must match WAVEFORM_PEAKS in useAudioEngine.ts
const CANVAS_HEIGHT = 48;
const FALLBACK_WIDTH = 300; // used until ResizeObserver reports a real width
```

Add this import near the top (alongside the other imports):

```ts
import { WAVEFORM_ZOOM_LEVELS, DEFAULT_WAVEFORM_ZOOM_INDEX } from '../../utils/waveformZoom';
```

Find this line inside the component body:

```ts
  const { waveformColoredPeaks, waveformPeaks, duration, hotCues } = useDeck(deckId);
  const playhead = usePlayhead(deckId);
```

Replace with:

```ts
  const { waveformColoredPeaks, waveformPeaks, duration, hotCues, waveformZoomIndex } = useDeck(deckId);
  const playhead = usePlayhead(deckId);
  const visibleHalf = WAVEFORM_ZOOM_LEVELS[waveformZoomIndex] ?? WAVEFORM_ZOOM_LEVELS[DEFAULT_WAVEFORM_ZOOM_INDEX];
  const visibleBars = visibleHalf * 2 + 1;
```

- [ ] **Step 4: Use the new per-render values inside `drawFrame`**

Inside the `drawFrame` callback, find:

```ts
    const playheadBar = duration > 0
      ? Math.round((currentTime / duration) * (TOTAL_BARS - 1))
      : 0;

    const barWidth = width / VISIBLE_BARS;
    const centerX = width / 2;

    for (let i = 0; i < VISIBLE_BARS; i++) {
      const barIndex = playheadBar - VISIBLE_HALF + i;
```

Replace with:

```ts
    const playheadBar = duration > 0
      ? Math.round((currentTime / duration) * (TOTAL_BARS - 1))
      : 0;

    const barWidth = width / visibleBars;
    const centerX = width / 2;

    for (let i = 0; i < visibleBars; i++) {
      const barIndex = playheadBar - visibleHalf + i;
```

Further down, find the hot-cue marker's range check:

```ts
      const offsetBars = cueBar - playheadBar;
      if (offsetBars < -VISIBLE_HALF || offsetBars > VISIBLE_HALF) return;
```

Replace with:

```ts
      const offsetBars = cueBar - playheadBar;
      if (offsetBars < -visibleHalf || offsetBars > visibleHalf) return;
```

Finally, find the `useCallback` dependency array at the end of `drawFrame`:

```ts
  }, [waveformColoredPeaks, waveformPeaks, duration, hotCues, deckColor, playedColor]);
```

Replace with:

```ts
  }, [waveformColoredPeaks, waveformPeaks, duration, hotCues, deckColor, playedColor, visibleHalf, visibleBars]);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/DeckWaveform.test.tsx`
Expected: PASS (all tests in the file, including the new one)

- [ ] **Step 6: Run the full suite, build, and lint**

Run: `npx vitest run`
Expected: all tests pass

Run: `npm run build`
Expected: clean

Run: `npm run lint`
Expected: clean, 0 warnings

- [ ] **Step 7: Commit**

```bash
git add src/components/Deck/DeckWaveform.tsx src/test/DeckWaveform.test.tsx
git commit -m "feat: drive DeckWaveform's visible-bar window from waveformZoomIndex"
```

---

### Task 3: `WaveformZoomControls` component + wire into `DeckDisplay`

**Files:**
- Create: `src/components/Deck/WaveformZoomControls.tsx`
- Create: `src/components/Deck/WaveformZoomControls.module.css`
- Modify: `src/components/Deck/DeckDisplay.tsx`
- Test: `src/test/WaveformZoomControls.test.tsx` (new)

**Interfaces:**
- Consumes: `deckStore.zoomWaveformIn`/`zoomWaveformOut` actions and `DeckState.waveformZoomIndex` (Task 1); `WAVEFORM_ZOOM_LEVELS` (Task 1).
- Produces: `WaveformZoomControls({ deckId }: { deckId: 'A' | 'B' })` component, default-exported, rendered inside `DeckDisplay.tsx`'s existing `waveformRow` div directly above `DeckWaveform`.

- [ ] **Step 1: Write the failing component test**

Create `src/test/WaveformZoomControls.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WaveformZoomControls } from '../components/Deck/WaveformZoomControls';
import { useDeckStore } from '../store/deckStore';
import { WAVEFORM_ZOOM_LEVELS, DEFAULT_WAVEFORM_ZOOM_INDEX } from '../utils/waveformZoom';

beforeEach(() => {
  useDeckStore.getState().clearTrack('A');
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/WaveformZoomControls.test.tsx`
Expected: FAIL — `../components/Deck/WaveformZoomControls` does not exist yet.

- [ ] **Step 3: Create the component**

Create `src/components/Deck/WaveformZoomControls.tsx`:

```tsx
/**
 * WaveformZoomControls.tsx — Zoom in/out buttons for one deck's waveform.
 *
 * Steps deckStore's waveformZoomIndex through WAVEFORM_ZOOM_LEVELS (narrowest/
 * most-detailed first, widest/whole-track last). Disabled at each end.
 */
import { useDeck, useDeckStore } from '../../store/deckStore';
import { WAVEFORM_ZOOM_LEVELS } from '../../utils/waveformZoom';
import styles from './WaveformZoomControls.module.css';

interface WaveformZoomControlsProps {
  deckId: 'A' | 'B';
}

export function WaveformZoomControls({ deckId }: WaveformZoomControlsProps) {
  const { waveformZoomIndex } = useDeck(deckId);
  const atNarrowest = waveformZoomIndex <= 0;
  const atWidest = waveformZoomIndex >= WAVEFORM_ZOOM_LEVELS.length - 1;

  return (
    <div className={styles.zoomControls}>
      <button
        type="button"
        className={styles.zoomBtn}
        onClick={() => useDeckStore.getState().zoomWaveformOut(deckId)}
        disabled={atWidest}
        aria-label={`Zoom out Deck ${deckId} waveform`}
        title="Zoom out"
      >
        &#x2212;
      </button>
      <button
        type="button"
        className={styles.zoomBtn}
        onClick={() => useDeckStore.getState().zoomWaveformIn(deckId)}
        disabled={atNarrowest}
        aria-label={`Zoom in Deck ${deckId} waveform`}
        title="Zoom in"
      >
        &#x2b;
      </button>
    </div>
  );
}

export default WaveformZoomControls;
```

- [ ] **Step 4: Create the CSS module**

Create `src/components/Deck/WaveformZoomControls.module.css`:

```css
/**
 * WaveformZoomControls.module.css — Zoom +/- button row above the waveform.
 */

.zoomControls {
  display: flex;
  gap: var(--space-1);
  margin-bottom: var(--space-1);
}

.zoomBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-sm);
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    border-color var(--transition-fast);
}

.zoomBtn:hover:not(:disabled) {
  background: var(--color-bg-overlay);
  color: var(--color-accent-primary);
  border-color: var(--color-accent-primary);
}

.zoomBtn:focus-visible {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: var(--shadow-focus);
}

.zoomBtn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/WaveformZoomControls.test.tsx`
Expected: PASS (5 tests). `@testing-library/user-event` is already a project dependency (also used in `src/test/FileImportZone.test.tsx`), so no new dependency is needed.

- [ ] **Step 6: Wire the component into `DeckDisplay.tsx`**

In `src/components/Deck/DeckDisplay.tsx`, add this import alongside the existing ones:

```tsx
import { WaveformZoomControls } from './WaveformZoomControls';
```

Find:

```tsx
      {/* Per-deck frequency-colored waveform — moved to the top of the deck,
          replacing the formerly shared CenterWaveform */}
      <div className={styles.waveformRow}>
        <DeckWaveform deckId={deckId} />
      </div>
```

Replace with:

```tsx
      {/* Per-deck frequency-colored waveform — moved to the top of the deck,
          replacing the formerly shared CenterWaveform */}
      <div className={styles.waveformRow}>
        <WaveformZoomControls deckId={deckId} />
        <DeckWaveform deckId={deckId} />
      </div>
```

- [ ] **Step 7: Run the full suite, build, and lint**

Run: `npx vitest run`
Expected: all tests pass (existing `DeckDisplay.test.tsx` tests still pass unchanged — they don't assert exact child count/order, only that specific labeled elements exist)

Run: `npm run build`
Expected: clean

Run: `npm run lint`
Expected: clean, 0 warnings

- [ ] **Step 8: Commit**

```bash
git add src/components/Deck/WaveformZoomControls.tsx src/components/Deck/WaveformZoomControls.module.css src/components/Deck/DeckDisplay.tsx src/test/WaveformZoomControls.test.tsx
git commit -m "feat: add WaveformZoomControls (+/- buttons) above each deck's waveform"
```

---

### Task 4: Platter spin marker

**Files:**
- Modify: `src/components/Deck/VinylPlatter.tsx`
- Modify: `src/components/Deck/VinylPlatter.module.css`
- Test: `src/test/VinylPlatter.test.tsx` (new)

**Interfaces:**
- Consumes: nothing new — no prop or store changes.
- Produces: nothing new exported — purely a rendered child element + CSS class.

- [ ] **Step 1: Write the failing test**

Create `src/test/VinylPlatter.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { VinylPlatter } from '../components/Deck/VinylPlatter';
import styles from '../components/Deck/VinylPlatter.module.css';

describe('VinylPlatter', () => {
  it('renders a spin marker element inside the platter', () => {
    const { container } = render(
      <VinylPlatter isPlaying={false} isBuffering={false} pitchRate={1} thumbnailUrl={null} />,
    );
    expect(container.querySelector(`.${styles.spinMarker}`)).toBeInTheDocument();
  });

  it('renders the spin marker as a child of the platter (so it inherits the platter\'s rotation transform)', () => {
    const { container } = render(
      <VinylPlatter isPlaying={false} isBuffering={false} pitchRate={1} thumbnailUrl={null} />,
    );
    const platter = container.querySelector(`.${styles.platter}`);
    const marker = container.querySelector(`.${styles.spinMarker}`);
    expect(platter).toContainElement(marker as HTMLElement);
  });

  it('does not throw when rendered mid-scratch with a rotation override', () => {
    expect(() =>
      render(
        <VinylPlatter isPlaying={false} isBuffering={false} pitchRate={1} thumbnailUrl={null} rotationOverrideDeg={57} />,
      ),
    ).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/test/VinylPlatter.test.tsx`
Expected: FAIL — no element matches `.${styles.spinMarker}` (class doesn't exist yet) on the first two tests; the third test passes already (rendering without the marker doesn't throw) — that's expected, it's a safety-net test, not the one driving this task's implementation.

- [ ] **Step 3: Add the marker element to the component**

In `src/components/Deck/VinylPlatter.tsx`, find:

```tsx
        {/* Buffering overlay — shown during buffering state */}
        {isBuffering && (
          <div className={styles.bufferingOverlay} aria-hidden="true">
            <div className={styles.spinner} />
          </div>
        )}
      </div>
    </div>
  );
}
```

Replace with (adding the marker as a sibling of `.label`, before the buffering overlay):

```tsx
        {/* Spin marker — a fixed reference line in the platter's own rotating
            frame, so it sweeps past the tonearm notch once per revolution and
            makes rotation (and full spins) visible at a glance. */}
        <div className={styles.spinMarker} aria-hidden="true" />

        {/* Buffering overlay — shown during buffering state */}
        {isBuffering && (
          <div className={styles.bufferingOverlay} aria-hidden="true">
            <div className={styles.spinner} />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the CSS**

In `src/components/Deck/VinylPlatter.module.css`, find:

```css
/* Buffering spinner overlay */
.bufferingOverlay {
```

Add the new rule directly before it:

```css
/* Spin marker: a fixed reference line in the platter's own rotating frame —
   spans the outer band from the rim in to the center label's edge (platter
   radius 50% minus the label's radius 19%, i.e. its 38%-diameter / 2). */
.spinMarker {
  position: absolute;
  top: 0;
  left: 50%;
  width: 3px;
  height: 31%;
  transform: translateX(-50%);
  background: var(--color-accent-primary);
  border-radius: 2px;
}

/* Buffering spinner overlay */
.bufferingOverlay {
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/test/VinylPlatter.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Run the full suite, build, and lint**

Run: `npx vitest run`
Expected: all tests pass

Run: `npm run build`
Expected: clean

Run: `npm run lint`
Expected: clean, 0 warnings

- [ ] **Step 7: Commit**

```bash
git add src/components/Deck/VinylPlatter.tsx src/components/Deck/VinylPlatter.module.css src/test/VinylPlatter.test.tsx
git commit -m "feat: add rotating spin marker to the vinyl platter"
```

---

### Task 5: Full verification + Playwright visual check

**Files:** none modified — verification only.

**Interfaces:** none.

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (868 pre-existing + 9 from Task 1 + 1 from Task 2 + 5 from Task 3 + 3 from Task 4 = 886 total; exact count may differ slightly if the base suite grew in the meantime — the important thing is 0 failures)

- [ ] **Step 2: Run build and lint**

Run: `npm run build`
Expected: clean

Run: `npm run lint`
Expected: clean, 0 warnings

- [ ] **Step 3: Manual/Playwright visual check**

Start the dev server (`npm run dev`), open the app, import any local audio file into Deck A, and verify:

1. A small "−" and "+" row appears above Deck A's waveform, top-left.
2. Clicking "+" several times visibly narrows the waveform's time window (fewer, wider bars); clicking "−" widens it back out, eventually showing the whole track. Both buttons disable at their respective ends.
3. With a track loaded (playing or paused), the vinyl platter shows a visible line/spoke from its rim toward the center label, at a fixed angle within the disc — confirm it visibly sweeps around during playback (or during a jog-wheel drag in VINYL mode) and passes the fixed tonearm notch (▲) once per revolution.
4. No console errors in either check.

- [ ] **Step 4: Report**

No commit for this task (verification only). If all checks pass, the feature is complete and ready to merge per `superpowers:finishing-a-development-branch`.
