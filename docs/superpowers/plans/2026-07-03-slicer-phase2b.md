# SLICER Phase 2b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the SLICER pad mode — 8 pads divide an adjustable upcoming beat window (4/8/16/32 beats) into 8 equal slices; holding a pad loops that slice, releasing catches playback back up to where it would naturally be — replacing the currently-disabled SLICER placeholder button in `PadGrid`.

**Architecture:** A new pure-math module (`slicer.ts`) computes window/slice boundaries from the existing beat grid. A new `sliceWindowBeats` store field (mirroring `beatJumpSize`'s reset convention) selects the window size. A new `startSlice` store action arms an engine loop over the pressed slice using the exact same field shape (`rollStartWallClock`/`rollStartPosition`/`loopActive`/`loopStart`/`loopEnd`/`loopBeatCount: null`) that `startRoll` already uses — so the release side reuses the **existing `endRoll` action completely unchanged**. A new `PadGridSlicer` component renders the pads and wires into `PadGrid`.

**Tech Stack:** React 18 + TypeScript (strict), Zustand, Vitest (jsdom), `@testing-library/react`, CSS Modules.

## Global Constraints

- **Strict TS:** `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` are ON. Indexed access is `T | undefined` (guard/assert). `tsconfig.app.json` excludes `src/test` from type-checking — pre-existing hand-built `DeckState` test fixtures are NOT required to include the new `sliceWindowBeats` field.
- **Lint:** `npm run lint` is zero-warnings (`--max-warnings 0`).
- **Behavior fidelity:** hold-to-loop + catch-up-on-release (not simple jump). The release side MUST reuse the existing `endRoll` action unchanged — do not write a new release action.
- **`sliceWindowBeats` reset convention:** survives `loadTrack`, resets to the default (`8`) on `clearTrack` — mirrors `beatJumpSize`'s existing precedent exactly (NOT the `padMode`/`quantize`/`shift` convention of never resetting).
- **`startSlice` must clear `manualLoopIn: null`** — mirrors the fix `activateLoopBeat` already needed (found in Phase 1's final review): a pending manual loop IN point must not survive as stale state when a different loop mechanic engages.
- Tests live flat in `src/test/`. CSS Modules co-located under `src/components/`.
- After implementation: `npm run build` (`tsc -b && vite build`) and `npm run lint`, per project CLAUDE.md.

---

## File Structure

**New:**
- `src/utils/slicer.ts` — pure functions `sliceWindowStart`, `sliceIndexAt`, `sliceStartFor`, plus exported constants `SLICE_WINDOW_SIZES` (`[4, 8, 16, 32]`) and `DEFAULT_SLICE_WINDOW_BEATS` (`8`).
- `src/components/Deck/PadGridSlicer.tsx` + `PadGridSlicer.module.css` — window-size selector row + 8 slice pads.
- `src/test/slicer-util.test.ts`, `src/test/deck-slicewindow.test.ts`, `src/test/deck-startslice.test.ts`, `src/test/PadGridSlicer.test.tsx` — new tests.

**Modified:**
- `src/types/deck.ts` — add `sliceWindowBeats` field.
- `src/store/deckStore.ts` — add `sliceWindowBeats` init/reset, `setSliceWindowBeats` action, `startSlice` action.
- `src/components/Deck/PadGrid.tsx` — flip SLICER's `disabled: true` → `false`; render `PadGridSlicer` when `padMode === 'slicer'`; update the doc comment.
- `src/test/PadGrid.test.tsx` — SLICER is no longer disabled; add a mode-switch test for it.

---

## Task 1: `slicer.ts` pure functions

**Files:**
- Create: `src/utils/slicer.ts`
- Test: `src/test/slicer-util.test.ts`

**Interfaces:**
- Consumes: `BeatGrid` type + `secondsPerBeat` from `src/utils/beatGrid.ts` (already exist, unchanged).
- Produces: `SLICE_WINDOW_SIZES: readonly [4, 8, 16, 32]`, `DEFAULT_SLICE_WINDOW_BEATS: 8`, `sliceWindowStart(grid, playhead, windowBeats): number`, `sliceIndexAt(grid, playhead, windowBeats): number`, `sliceStartFor(grid, playhead, windowBeats, index): { start: number; end: number }`.

- [ ] **Step 1: Write the failing test**

Create `src/test/slicer-util.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sliceWindowStart, sliceIndexAt, sliceStartFor } from '../utils/slicer';

const grid = { bpm: 120, anchor: 0 }; // secondsPerBeat = 0.5

describe('sliceWindowStart', () => {
  it('returns the current window start for windowBeats=8 (4s window)', () => {
    expect(sliceWindowStart(grid, 0, 8)).toBeCloseTo(0, 6);
    expect(sliceWindowStart(grid, 3.9, 8)).toBeCloseTo(0, 6);
    expect(sliceWindowStart(grid, 4.1, 8)).toBeCloseTo(4, 6);
  });

  it('aligns to a non-zero anchor', () => {
    const offsetGrid = { bpm: 120, anchor: 0.2 };
    expect(sliceWindowStart(offsetGrid, 0.2, 8)).toBeCloseTo(0.2, 6);
    expect(sliceWindowStart(offsetGrid, 4.0, 8)).toBeCloseTo(0.2, 6);
    expect(sliceWindowStart(offsetGrid, 4.3, 8)).toBeCloseTo(4.2, 6);
  });

  it('supports larger window sizes (windowBeats=16 -> 8s window)', () => {
    expect(sliceWindowStart(grid, 9, 16)).toBeCloseTo(8, 6);
  });
});

describe('sliceIndexAt', () => {
  it('maps playhead to the correct slice index within an 8-beat window', () => {
    expect(sliceIndexAt(grid, 0, 8)).toBe(0);
    expect(sliceIndexAt(grid, 0.3, 8)).toBe(0); // slice length 0.5s
    expect(sliceIndexAt(grid, 0.6, 8)).toBe(1);
    expect(sliceIndexAt(grid, 3.9, 8)).toBe(7);
  });

  it('scales slice length with window size (windowBeats=16 -> 1s slices)', () => {
    expect(sliceIndexAt(grid, 8.5, 16)).toBe(0);
    expect(sliceIndexAt(grid, 9.5, 16)).toBe(1);
  });

  it('a playhead exactly on a window boundary belongs to the next window (slice 0), not slice 8', () => {
    expect(sliceIndexAt(grid, 4.0, 8)).toBe(0);
  });
});

describe('sliceStartFor', () => {
  it('computes the [start, end) bounds for a given slice index', () => {
    const { start, end } = sliceStartFor(grid, 0, 8, 3);
    expect(start).toBeCloseTo(1.5, 6);
    expect(end).toBeCloseTo(2.0, 6);
  });

  it('clamps an out-of-range index to [0, 7]', () => {
    const overRange = sliceStartFor(grid, 0, 8, 99);
    const clampedTo7 = sliceStartFor(grid, 0, 8, 7);
    expect(overRange).toEqual(clampedTo7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/slicer-util.test.ts`
Expected: FAIL — cannot find module `../utils/slicer`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/slicer.ts`:

```ts
/**
 * slicer.ts — Pure math for the SLICER pad mode. No React/DOM/store imports.
 *
 * SLICER divides an upcoming window of `windowBeats` beats (aligned to the
 * grid anchor) into 8 equal slices. These functions compute which window a
 * playhead falls in, which slice within that window it's currently in (for
 * the pad-grid "follow" highlight), and a given slice index's [start, end)
 * bounds (for arming a loop when a pad is pressed).
 */
import { type BeatGrid, secondsPerBeat } from './beatGrid';

/** Available Slicer window sizes, in beats. */
export const SLICE_WINDOW_SIZES = [4, 8, 16, 32] as const;

/** Default Slicer window size for a fresh deck. */
export const DEFAULT_SLICE_WINDOW_BEATS: (typeof SLICE_WINDOW_SIZES)[number] = 8;

const SLICE_COUNT = 8;

/** The start (seconds) of the windowBeats-beat window containing playhead, aligned to the grid anchor. */
export function sliceWindowStart(grid: BeatGrid, playhead: number, windowBeats: number): number {
  const windowSeconds = secondsPerBeat(grid.bpm) * windowBeats;
  return grid.anchor + Math.floor((playhead - grid.anchor) / windowSeconds) * windowSeconds;
}

/** Which of the 8 slices (0-7) currently contains playhead, within its window. Clamped defensively. */
export function sliceIndexAt(grid: BeatGrid, playhead: number, windowBeats: number): number {
  const windowStart = sliceWindowStart(grid, playhead, windowBeats);
  const sliceLength = (secondsPerBeat(grid.bpm) * windowBeats) / SLICE_COUNT;
  const idx = Math.floor((playhead - windowStart) / sliceLength);
  return Math.max(0, Math.min(SLICE_COUNT - 1, idx));
}

/** The [start, end) bounds (seconds) of slice `index` within the window containing playhead. */
export function sliceStartFor(
  grid: BeatGrid,
  playhead: number,
  windowBeats: number,
  index: number,
): { start: number; end: number } {
  const windowStart = sliceWindowStart(grid, playhead, windowBeats);
  const sliceLength = (secondsPerBeat(grid.bpm) * windowBeats) / SLICE_COUNT;
  const clampedIndex = Math.max(0, Math.min(SLICE_COUNT - 1, index));
  const start = windowStart + clampedIndex * sliceLength;
  return { start, end: start + sliceLength };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/slicer-util.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/slicer.ts src/test/slicer-util.test.ts
git commit -m "feat: slicer.ts pure math (window/slice boundaries for SLICER mode)"
```

---

## Task 2: `sliceWindowBeats` state field + `setSliceWindowBeats` action

**Files:**
- Modify: `src/types/deck.ts`
- Modify: `src/store/deckStore.ts`
- Test: `src/test/deck-slicewindow.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_SLICE_WINDOW_BEATS` (Task 1).
- Produces: `DeckState.sliceWindowBeats: 4 | 8 | 16 | 32` (default `8`); `deckStore.setSliceWindowBeats(deckId, size)`; exposed on `useDeckActions()` as `setSliceWindowBeats`. Survives `loadTrack`, resets to `8` on `clearTrack`.

- [ ] **Step 1: Write the failing test**

Create `src/test/deck-slicewindow.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useDeckStore } from '../store/deckStore';

describe('deck Slicer window size', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('defaults sliceWindowBeats to 8', () => {
    expect(useDeckStore.getState().decks.A.sliceWindowBeats).toBe(8);
  });

  it('setSliceWindowBeats updates it', () => {
    useDeckStore.getState().setSliceWindowBeats('A', 16);
    expect(useDeckStore.getState().decks.A.sliceWindowBeats).toBe(16);
  });

  it('survives loadTrack', () => {
    useDeckStore.getState().setSliceWindowBeats('A', 32);
    useDeckStore.getState().loadTrack('A', 'trk1', { title: '', artist: '', duration: 100, thumbnailUrl: null });
    expect(useDeckStore.getState().decks.A.sliceWindowBeats).toBe(32);
  });

  it('resets to 8 on clearTrack', () => {
    useDeckStore.getState().setSliceWindowBeats('A', 32);
    useDeckStore.getState().clearTrack('A');
    expect(useDeckStore.getState().decks.A.sliceWindowBeats).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/deck-slicewindow.test.ts`
Expected: FAIL — `sliceWindowBeats` is `undefined` / `setSliceWindowBeats is not a function`.

- [ ] **Step 3: Implement the field and action**

In `src/types/deck.ts`, add to the `DeckState` interface, immediately after the `padMode` field (after the closing `;` of its type):

```ts
  /**
   * Slicer window size in beats — each of the 8 SLICER pads represents
   * sliceWindowBeats / 8 beats. Mirrors beatJumpSize's reset convention:
   * survives loadTrack, resets to the default (8) on clearTrack/eject.
   */
  sliceWindowBeats: 4 | 8 | 16 | 32;
```

In `src/store/deckStore.ts`, add the import (extend the existing `beatJump` import line is NOT where this goes — add a new import line right after the `loopMath`/`quantize` imports, e.g. after `import { snapToGrid } from '../utils/quantize';`):

```ts
import { DEFAULT_SLICE_WINDOW_BEATS, sliceStartFor } from '../utils/slicer';
```

In `createInitialDeckState`, add after `padMode: 'hotcue',`:

```ts
    sliceWindowBeats: DEFAULT_SLICE_WINDOW_BEATS,
```

In `clearTrack`'s reset object, add after `beatJumpSize: DEFAULT_BEAT_JUMP_SIZE,` (mirroring that field's exact reset pattern):

```ts
      sliceWindowBeats: DEFAULT_SLICE_WINDOW_BEATS,
```

Do **not** add `sliceWindowBeats` to `loadTrack`'s reset object — its omission there is intentional (matches `beatJumpSize`) and is exactly what the third test above verifies.

Add the action type to `DeckStoreActions`, after `setPadMode`'s type:

```ts
  /** Set the Slicer window size (4/8/16/32 beats) for the specified deck. */
  setSliceWindowBeats: (deckId: 'A' | 'B', size: 4 | 8 | 16 | 32) => void;
```

Add the implementation, after `setPadMode`'s implementation:

```ts
  setSliceWindowBeats: (deckId, size) => {
    updateDeck(set, deckId, { sliceWindowBeats: size });
  },
```

Add `setSliceWindowBeats` to the `useDeckActions` shallow bag, on the same line as `setPadMode`:

```ts
      setQuantize: s.setQuantize, setShift: s.setShift, setPadMode: s.setPadMode, setSliceWindowBeats: s.setSliceWindowBeats,
```

(Replace the existing `setQuantize: s.setQuantize, setShift: s.setShift, setPadMode: s.setPadMode,` line with the above.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/deck-slicewindow.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/types/deck.ts src/store/deckStore.ts src/test/deck-slicewindow.test.ts
git commit -m "feat: deck sliceWindowBeats state + setSliceWindowBeats action"
```

---

## Task 3: `startSlice` store action

**Files:**
- Modify: `src/store/deckStore.ts`
- Test: `src/test/deck-startslice.test.ts`

**Interfaces:**
- Consumes: `sliceStartFor` (Task 1, already imported in Task 2), `deck.sliceWindowBeats` (Task 2), the pre-existing `startSlipTracking`/`endRoll` actions (unchanged).
- Produces: `deckStore.startSlice(deckId, sliceIndex)` — arms an engine loop over the pressed slice; no-op without a confirmed grid; sets the same field shape `startRoll` uses so release via the pre-existing, UNCHANGED `endRoll` action works correctly. Exposed on `useDeckActions()` as `startSlice`.

- [ ] **Step 1: Write the failing test**

Create `src/test/deck-startslice.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';

function mockEngine() {
  return {
    seekTo: vi.fn(),
    getCurrentTime: () => 0,
    getDuration: () => 300,
    setLoop: vi.fn(),
    clearLoop: vi.fn(),
    isLooping: () => false,
  };
}

describe('startSlice', () => {
  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    playerRegistry.unregister('A');
  });

  it('arms the loop over the pressed slice and records roll-catch-up fields', () => {
    const eng = mockEngine();
    playerRegistry.register('A', eng as never);
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: { ...useDeckStore.getState().decks.A, bpm: 120, anchor: 0, currentTime: 0.3, duration: 300, sliceWindowBeats: 8 },
      },
    });

    const before = Date.now();
    act(() => {
      useDeckStore.getState().startSlice('A', 2);
    });
    const after = Date.now();

    const d = useDeckStore.getState().decks.A;
    // windowBeats=8 -> 4s window, sliceLength=0.5s; slice 2 = [1.0, 1.5)
    expect(eng.setLoop).toHaveBeenCalledWith(1.0, 1.5);
    expect(d.loopActive).toBe(true);
    expect(d.loopStart).toBeCloseTo(1.0, 6);
    expect(d.loopEnd).toBeCloseTo(1.5, 6);
    expect(d.loopBeatCount).toBeNull();
    expect(d.rollStartPosition).toBe(0.3);
    expect(d.rollStartWallClock).toBeGreaterThanOrEqual(before);
    expect(d.rollStartWallClock).toBeLessThanOrEqual(after);
  });

  it('clears a pending manualLoopIn', () => {
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: { ...useDeckStore.getState().decks.A, bpm: 120, anchor: 0, currentTime: 0.3, duration: 300, manualLoopIn: 5 },
      },
    });
    act(() => {
      useDeckStore.getState().startSlice('A', 0);
    });
    expect(useDeckStore.getState().decks.A.manualLoopIn).toBeNull();
  });

  it('triggers startSlipTracking when slipMode is on', () => {
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: { ...useDeckStore.getState().decks.A, bpm: 120, anchor: 0, currentTime: 0.3, duration: 300, slipMode: true },
      },
    });
    act(() => {
      useDeckStore.getState().startSlice('A', 0);
    });
    const d = useDeckStore.getState().decks.A;
    expect(d.slipStartPosition).toBe(0.3);
    expect(d.slipStartTime).not.toBeNull();
  });

  it('is a no-op when there is no confirmed grid', () => {
    act(() => {
      useDeckStore.getState().startSlice('A', 0);
    });
    expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
  });

  it('releasing via the existing endRoll seeks to the catch-up position', () => {
    const eng = mockEngine();
    playerRegistry.register('A', eng as never);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1000000);
      useDeckStore.setState({
        decks: {
          ...useDeckStore.getState().decks,
          A: { ...useDeckStore.getState().decks.A, bpm: 120, anchor: 0, currentTime: 0, pitchRate: 1, duration: 300 },
        },
      });
      act(() => {
        useDeckStore.getState().startSlice('A', 0);
      });
      vi.setSystemTime(1002000); // 2s later
      act(() => {
        useDeckStore.getState().endRoll('A');
      });
      expect(eng.seekTo).toHaveBeenCalledWith(2, true);
      expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/deck-startslice.test.ts`
Expected: FAIL — `startSlice is not a function`.

- [ ] **Step 3: Implement `startSlice`**

In `src/store/deckStore.ts`, add the action type to `DeckStoreActions`, right after `endRoll`'s type:

```ts
  /**
   * Begin a Slicer hold: arm a loop over the pressed slice (computed from the
   * beat grid, deck.sliceWindowBeats, and the live playhead), record the
   * catch-up fields (rollStartWallClock/rollStartPosition) so releasing via
   * the pre-existing endRoll seeks back to where playback would have been.
   * No-op without a confirmed grid.
   */
  startSlice: (deckId: 'A' | 'B', sliceIndex: number) => void;
```

Add the implementation, right after `endRoll`'s implementation (before `setGrid`):

```ts
  startSlice: (deckId, sliceIndex) => {
    const deck = get().decks[deckId];
    if (!deck.bpm || deck.anchor === null) return; // needs a confirmed grid
    const grid = { bpm: deck.bpm, anchor: deck.anchor };
    const { start, end } = sliceStartFor(grid, deck.currentTime, deck.sliceWindowBeats, sliceIndex);
    // Arm the native engine loop (no-op via optional chaining on YouTube).
    getActivePlayer(deckId)?.setLoop?.(start, end);
    updateDeck(set, deckId, {
      rollStartWallClock: Date.now(),
      rollStartPosition: deck.currentTime,
      loopActive: true,
      loopStart: start,
      loopEnd: end,
      loopBeatCount: null,
      manualLoopIn: null,
    });
    // If slip mode is on, start tracking the shadow playhead from now.
    if (deck.slipMode) {
      get().startSlipTracking(deckId);
    }
  },
```

Add `startSlice` to the `useDeckActions` shallow bag, on the same line as `setRollMode`/`startRoll`/`endRoll`:

```ts
      setRollMode: s.setRollMode, startRoll: s.startRoll, endRoll: s.endRoll, startSlice: s.startSlice,
```

(Replace the existing `setRollMode: s.setRollMode, startRoll: s.startRoll, endRoll: s.endRoll,` line with the above.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/deck-startslice.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/deckStore.ts src/test/deck-startslice.test.ts
git commit -m "feat: startSlice store action (releases via the pre-existing, unchanged endRoll)"
```

---

## Task 4: `PadGridSlicer` component

**Files:**
- Create: `src/components/Deck/PadGridSlicer.tsx`
- Create: `src/components/Deck/PadGridSlicer.module.css`
- Test: `src/test/PadGridSlicer.test.tsx`

**Interfaces:**
- Consumes: `SLICE_WINDOW_SIZES`, `sliceIndexAt` (Task 1); `deck.sliceWindowBeats`, `setSliceWindowBeats`, `startSlice` (Tasks 2-3); the pre-existing `endRoll` action (unchanged).
- Produces: `<PadGridSlicer deckId="A" | "B" />` — a window-size selector row (4/8/16/32) + 8 slice pads in a 2×4 grid, with follow/held visual states.

- [ ] **Step 1: Write the failing test**

Create `src/test/PadGridSlicer.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PadGridSlicer } from '../components/Deck/PadGridSlicer';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';

function mockEngine() {
  return {
    seekTo: vi.fn(),
    getCurrentTime: () => 0,
    getDuration: () => 300,
    setLoop: vi.fn(),
    clearLoop: vi.fn(),
    isLooping: () => false,
  };
}

describe('PadGridSlicer', () => {
  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    playerRegistry.unregister('A');
  });

  it('renders the window-size row and 8 slice pads', () => {
    render(<PadGridSlicer deckId="A" />);
    expect(screen.getByRole('button', { name: /set slicer window to 8 beats on deck a/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /slice 1 on deck a/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /slice 8 on deck a/i })).toBeInTheDocument();
  });

  it('clicking a window-size button updates sliceWindowBeats', () => {
    render(<PadGridSlicer deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /set slicer window to 16 beats on deck a/i }));
    expect(useDeckStore.getState().decks.A.sliceWindowBeats).toBe(16);
  });

  it('all pads and the size row are disabled without a confirmed grid', () => {
    render(<PadGridSlicer deckId="A" />);
    expect(screen.getByRole('button', { name: /slice 1 on deck a/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /set slicer window to 8 beats on deck a/i })).toBeDisabled();
  });

  it('holding a pad calls startSlice, releasing calls endRoll', () => {
    const eng = mockEngine();
    playerRegistry.register('A', eng as never);
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: { ...useDeckStore.getState().decks.A, bpm: 120, anchor: 0, currentTime: 0, duration: 300 },
      },
    });
    render(<PadGridSlicer deckId="A" />);
    const pad = screen.getByRole('button', { name: /slice 3 on deck a/i });
    fireEvent.mouseDown(pad);
    expect(eng.setLoop).toHaveBeenCalled();
    expect(useDeckStore.getState().decks.A.loopActive).toBe(true);
    fireEvent.mouseUp(pad);
    expect(eng.seekTo).toHaveBeenCalled();
    expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/PadGridSlicer.test.tsx`
Expected: FAIL — cannot find module `../components/Deck/PadGridSlicer`.

- [ ] **Step 3: Create the component + CSS**

Create `src/components/Deck/PadGridSlicer.tsx`:

```tsx
/**
 * PadGridSlicer.tsx — SLICER pad-mode panel, rendered inside PadGrid.
 *
 * A window-size selector (4/8/16/32 beats) above 8 slice pads in a 2x4 grid.
 * Each pad shows two visual states: a dim "follow" highlight on the slice
 * the playhead is naturally passing through (recomputed from the existing
 * currentTime poll — no new polling), and a bright "held" highlight on a
 * slice actively being pressed/looped (wins when both coincide, tracked via
 * local component state since the store's loopBeatCount is null for every
 * slice and can't disambiguate which pad is held).
 *
 * Holding a pad arms a loop over that slice (startSlice); releasing catches
 * playback up to where it would have been via the pre-existing, unchanged
 * endRoll action (built for ROLL mode in Phase 1).
 *
 * Requires a confirmed beat grid (bpm + anchor) — disabled otherwise, same
 * precondition and message as LOOP mode's beat-count pads.
 */
import { useState } from 'react';
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import { SLICE_WINDOW_SIZES, sliceIndexAt } from '../../utils/slicer';
import styles from './PadGridSlicer.module.css';

const SLICE_COUNT = 8;

interface PadGridSlicerProps {
  deckId: 'A' | 'B';
}

export function PadGridSlicer({ deckId }: PadGridSlicerProps) {
  const bpm = useDeckStore((s) => s.decks[deckId].bpm);
  const anchor = useDeckStore((s) => s.decks[deckId].anchor);
  const currentTime = useDeckStore((s) => s.decks[deckId].currentTime);
  const sliceWindowBeats = useDeckStore((s) => s.decks[deckId].sliceWindowBeats);
  const { setSliceWindowBeats, startSlice, endRoll } = useDeckActions();

  const [heldIndex, setHeldIndex] = useState<number | null>(null);

  const gridConfirmed = bpm !== null && anchor !== null;
  const disabledTitle = 'Set BPM using Tap Tempo first';
  const followIndex = gridConfirmed ? sliceIndexAt({ bpm, anchor }, currentTime, sliceWindowBeats) : null;

  function handlePress(index: number) {
    if (!gridConfirmed) return;
    setHeldIndex(index);
    startSlice(deckId, index);
  }

  function handleRelease() {
    if (heldIndex === null) return;
    setHeldIndex(null);
    endRoll(deckId);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.sizeRow}>
        {SLICE_WINDOW_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            className={[styles.sizeBtn, sliceWindowBeats === size ? styles.sizeBtnActive : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => setSliceWindowBeats(deckId, size)}
            disabled={!gridConfirmed || heldIndex !== null}
            aria-pressed={sliceWindowBeats === size}
            aria-label={`Set Slicer window to ${size} beats on Deck ${deckId}`}
            title={gridConfirmed ? `${size}-beat window` : disabledTitle}
          >
            {size}
          </button>
        ))}
      </div>
      <div className={styles.pads}>
        {Array.from({ length: SLICE_COUNT }, (_, index) => {
          const isHeld = heldIndex === index;
          const isFollowed = followIndex === index;
          return (
            <button
              key={index}
              type="button"
              className={[
                styles.pad,
                isHeld ? styles.padHeld : isFollowed ? styles.padFollow : '',
                !gridConfirmed ? styles.padDisabled : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={!gridConfirmed}
              aria-label={`Slice ${index + 1} on Deck ${deckId}`}
              aria-pressed={isHeld}
              title={gridConfirmed ? `Hold to loop slice ${index + 1}` : disabledTitle}
              onMouseDown={() => handlePress(index)}
              onMouseUp={handleRelease}
              onMouseLeave={handleRelease}
              onTouchStart={(e) => {
                e.preventDefault();
                handlePress(index);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleRelease();
              }}
              onClick={(e) => {
                // Suppress click — mousedown/mouseup handle everything.
                e.preventDefault();
              }}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PadGridSlicer;
```

Create `src/components/Deck/PadGridSlicer.module.css`:

```css
.wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.sizeRow {
  display: flex;
  gap: var(--space-1);
}

.sizeBtn {
  flex: 1;
  height: var(--btn-height-sm);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  cursor: pointer;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    opacity var(--transition-fast);
}

.sizeBtn:hover:not(:disabled) {
  color: var(--color-text-primary);
}

.sizeBtn:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.sizeBtn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.sizeBtnActive {
  color: var(--color-text-inverse);
  background: var(--color-accent-primary);
  border-color: var(--color-accent-primary-bright);
  box-shadow: var(--shadow-button-active);
}

.pads {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
}

.pad {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 28px;
  padding: 0 var(--space-2);
  background: #1a1a1a;
  border: 1px solid #333333;
  border-radius: var(--radius-md);
  color: #888888;
  font-size: var(--text-xs);
  font-weight: 700;
  font-family: var(--font-primary);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.pad:hover:not(:disabled) {
  background: #242424;
  border-color: #555555;
  color: #aaaaaa;
}

.pad:focus-visible {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: var(--shadow-focus);
}

/* Follow highlight — dim indicator that the playhead is naturally passing through this slice */
.padFollow {
  background: #1a2a3a;
  border-color: #2a6aaa;
  color: #7ab8f5;
}

/* Held highlight — bright indicator this slice is actively pressed/looped (wins over follow) */
.padHeld {
  background: #2a2a0a;
  border-color: #8a8a2a;
  color: #d4d44a;
}

.padDisabled {
  opacity: 0.35;
  cursor: not-allowed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/PadGridSlicer.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Deck/PadGridSlicer.tsx src/components/Deck/PadGridSlicer.module.css src/test/PadGridSlicer.test.tsx
git commit -m "feat: PadGridSlicer component (window-size selector + 8 slice pads)"
```

---

## Task 5: Wire `PadGridSlicer` into `PadGrid`

**Files:**
- Modify: `src/components/Deck/PadGrid.tsx`
- Modify: `src/test/PadGrid.test.tsx`

**Interfaces:**
- Consumes: `PadGridSlicer` (Task 4).
- Produces: `PadGrid`'s SLICER mode button is enabled and renders `PadGridSlicer` when selected; SAMPLER remains disabled (untouched, Phase 2c).

- [ ] **Step 1: Update the test first (this will fail)**

In `src/test/PadGrid.test.tsx`, replace the third test:

```tsx
  it('SLICER and SAMPLER mode buttons are disabled', () => {
    render(<PadGrid deckId="A" />);
    expect(screen.getByRole('button', { name: /slicer pad mode for deck a/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /sampler pad mode for deck a/i })).toBeDisabled();
  });
```

with:

```tsx
  it('SAMPLER mode button is disabled', () => {
    render(<PadGrid deckId="A" />);
    expect(screen.getByRole('button', { name: /sampler pad mode for deck a/i })).toBeDisabled();
  });

  it('switching to SLICER mode renders the slice pads', () => {
    render(<PadGrid deckId="A" />);
    const slicerBtn = screen.getByRole('button', { name: /slicer pad mode for deck a/i });
    expect(slicerBtn).not.toBeDisabled();
    fireEvent.click(slicerBtn);
    expect(screen.getByRole('button', { name: /slice 1 on deck a/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hot cue 1 on deck a/i })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/PadGrid.test.tsx`
Expected: FAIL — SLICER button is still `disabled`.

- [ ] **Step 3: Wire in `PadGridSlicer`**

In `src/components/Deck/PadGrid.tsx`, update the top doc comment. Replace these exact three lines:

```
 * SLICER / SAMPLER pad section. Only HOT CUE and LOOP are functional in
 * Phase 2a; SLICER and SAMPLER render as disabled placeholder buttons
 * (Phase 2b/2c land later, flipping them on with no relayout).
```

with:

```
 * SLICER / SAMPLER pad section. Only HOT CUE, LOOP, and (as of Phase 2b)
 * SLICER are functional. SAMPLER renders as a disabled placeholder button
 * (Phase 2c lands later, flipping it on with no relayout).
```

Add the import:

```tsx
import { PadGridSlicer } from './PadGridSlicer';
```

Update the `MODES` array — change the `slicer` entry's `disabled` from `true` to `false`:

```tsx
const MODES: { mode: DeckState['padMode']; label: string; disabled: boolean }[] = [
  { mode: 'hotcue', label: 'HOT CUE', disabled: false },
  { mode: 'loop', label: 'LOOP', disabled: false },
  { mode: 'slicer', label: 'SLICER', disabled: false },
  { mode: 'sampler', label: 'SAMPLER', disabled: true },
];
```

Add the render branch, right after the `PadGridLoop` line:

```tsx
        {padMode === 'loop' && <PadGridLoop deckId={deckId} />}
        {padMode === 'slicer' && <PadGridSlicer deckId={deckId} />}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/PadGrid.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Deck/PadGrid.tsx src/test/PadGrid.test.tsx
git commit -m "feat: wire PadGridSlicer into PadGrid — SLICER mode is now functional"
```

---

## Task 6: Full-suite verification (build + lint + all tests + manual smoke test)

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test`
Expected: PASS — all suites green.

- [ ] **Step 2: Type-check + build**

Run: `npm run build`
Expected: `tsc -b` reports no errors; `vite build` completes.

- [ ] **Step 3: Lint (zero warnings)**

Run: `npm run lint`
Expected: exits 0 with no warnings.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open the app, load a track onto Deck A, set BPM via TAP (or confirm a grid via Tap Tempo), then verify:
- Switching to SLICER mode shows a window-size row (4/8/16/32, defaulting to 8 highlighted) above 8 numbered pads.
- While playing, one pad shows a dim "follow" highlight that advances as the track plays, wrapping to pad 1 every window.
- Holding a pad (mousedown) shows a bright "held" highlight and audibly loops that slice; releasing (mouseup) stops the loop and playback catches up to roughly where it would have been.
- Clicking a different window size (e.g. 16) changes the pad follow-highlight cadence accordingly.
- Without a confirmed grid (fresh deck, no BPM), all SLICER pads and the size row are visibly disabled.
- HOT CUE and LOOP modes still work exactly as before (regression check).

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: SLICER Phase 2b build/lint/test verification fixes"
```

---

## Self-Review (author checklist — completed)

**Spec coverage** (each Phase 2b spec item → task):
- Behavior fidelity (hold-to-loop + catch-up-on-release, reusing `endRoll` unchanged) (§2) → Tasks 3-4, explicitly verified by Task 3's Step 1 integration test and Task 4's Step 1 component test.
- Adjustable window size (4/8/16/32), reset convention mirroring `beatJumpSize` (§2) → Tasks 2, 4.
- `sliceWindowStart`/`sliceIndexAt`/`sliceStartFor` pure math (§3) → Task 1.
- `PadGridSlicer` component: size selector, 8 pads, follow/held highlight, disabled-without-grid, size-selector-disabled-while-held (§4) → Task 4.
- Wiring into `PadGrid`, SAMPLER untouched (§4) → Task 5.
- `manualLoopIn` staleness fix in `startSlice` (self-review finding from the spec) → Task 3, explicitly tested.
- Testing (§5) → per-task unit/component tests plus Task 6's full-suite gate + manual smoke test.

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `sliceWindowBeats`, `setSliceWindowBeats`, `startSlice`, `SLICE_WINDOW_SIZES`, `DEFAULT_SLICE_WINDOW_BEATS`, `sliceWindowStart`, `sliceIndexAt`, `sliceStartFor`, `PadGridSlicer` are used identically across tasks and match their defining tasks. `startSlice`'s field writes (`rollStartWallClock`/`rollStartPosition`/`loopActive`/`loopStart`/`loopEnd`/`loopBeatCount: null`) exactly match the shape `endRoll` (unchanged, pre-existing) reads.

**Deliberate design note:** the "held" pad index is tracked via local component `useState` in `PadGridSlicer`, not derived from store state — the store's `loopBeatCount` is `null` for every slice (by design, to distinguish Slicer/manual loops from named beat-loops), so it cannot by itself disambiguate *which* pad is currently held. This is documented in Task 4's component doc comment.
