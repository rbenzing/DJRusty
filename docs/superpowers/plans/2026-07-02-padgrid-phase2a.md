# PadGrid Phase 2a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate Hot Cue and Loop panels with one mode-switched 8-pad grid per deck (HOT CUE / LOOP functional; SLICER / SAMPLER shown disabled), matching the Hercules DJC Inpulse 300 MK2's unified pad section, while reusing all existing hot-cue and loop logic unchanged.

**Architecture:** Extract the pad-rendering guts of today's `HotCues.tsx` and `LoopControls.tsx` into two new panel components (`PadGridHotCue.tsx`, `PadGridLoop.tsx`) with no outer wrapper/label. A new `PadGrid.tsx` shell renders a 4-button mode-select row plus whichever panel matches the deck's new `padMode` field. The ROLL toggle relocates from the loop panel into `DeckModifiers.tsx` (it's a modifier, not a pad) — its behavior is unchanged, only its button moves.

**Tech Stack:** React 18 + TypeScript (strict), Zustand, Vitest (jsdom), `@testing-library/react`, CSS Modules.

## Global Constraints

- **Strict TS:** `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` are ON. Indexed access is `T | undefined` (guard/assert). `tsconfig.app.json` excludes `src/test` from type-checking — pre-existing test fixtures that hand-build `DeckState`-shaped objects are NOT required to include the new `padMode` field (established precedent from Phase 1's `gainDb`/`effectBeat` additions).
- **Lint:** `npm run lint` is zero-warnings (`--max-warnings 0`).
- **Behavior parity:** hot-cue and loop pad interactions (click/shift-click/long-press/right-click, quantize-snap, SHIFT halve/double, roll-mode press/release) must be byte-for-byte unchanged from today — this plan is a UI restructuring, not a behavior change.
- **`padMode` persists across track loads/ejects** — it is a deck-level UI preference like `quantize`/`shift`/`gainDb`, NOT reset by `loadTrack` or `clearTrack`.
- Tests live flat in `src/test/`. CSS Modules co-located under `src/components/`.
- After implementation: `npm run build` (`tsc -b && vite build`) and `npm run lint`, per project CLAUDE.md.

---

## File Structure

**New:**
- `src/utils/loopMath.ts` — no changes needed (`shiftedLoopBeatCount` already exists from Phase 1, reused as-is).
- `src/components/Deck/PadGridHotCue.tsx` + `PadGridHotCue.module.css` — HOT CUE mode's 8-pad panel.
- `src/components/Deck/PadGridLoop.tsx` + `PadGridLoop.module.css` — LOOP mode's 8-pad panel (IN, OUT, 1B, 2B, 4B, 8B, RELOOP, EXIT).
- `src/components/Deck/PadGrid.tsx` + `PadGrid.module.css` — shell: mode-select row + delegates to the active panel.
- `src/test/deck-padmode.test.ts`, `src/test/PadGrid.test.tsx` — new tests.

**Modified:**
- `src/types/deck.ts` — add `padMode` field.
- `src/store/deckStore.ts` — add `padMode` init + `setPadMode` action.
- `src/components/Deck/DeckModifiers.tsx` (+`.module.css` unchanged) — add ROLL button.
- `src/components/Deck/Deck.tsx` — replace `<HotCues>` + `<LoopControls>` with `<PadGrid>`.
- `src/components/Deck/DeckControls.tsx` — one doc-comment reference update.
- `src/test/DeckModifiers.test.tsx` — add ROLL coverage.
- `src/test/hotcues-quantize.test.tsx`, `src/test/hotcues-seek-routing.test.tsx` — retarget import from `HotCues` to `PadGridHotCue`.
- `src/test/loopcontrols-manual.test.tsx`, `src/test/loop-shift-halvedouble.test.tsx` — retarget import from `LoopControls` to `PadGridLoop`.

**Removed:** `src/components/Deck/HotCues.tsx`, `HotCues.module.css`, `src/components/Deck/LoopControls.tsx`, `LoopControls.module.css` (logic fully absorbed into the new panel components). `HotCueButton.tsx` is kept as-is and reused unchanged.

---

## Task 1: `padMode` state field + `setPadMode` action

**Files:**
- Modify: `src/types/deck.ts`
- Modify: `src/store/deckStore.ts`
- Test: `src/test/deck-padmode.test.ts`

**Interfaces:**
- Produces: `DeckState.padMode: 'hotcue' | 'loop' | 'slicer' | 'sampler'` (default `'hotcue'`); `deckStore.setPadMode(deckId, mode)`; exposed on `useDeckActions()` as `setPadMode`.

- [ ] **Step 1: Write the failing test**

Create `src/test/deck-padmode.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useDeckStore } from '../store/deckStore';

describe('deck pad mode', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('defaults padMode to hotcue', () => {
    expect(useDeckStore.getState().decks.A.padMode).toBe('hotcue');
  });

  it('setPadMode updates padMode', () => {
    useDeckStore.getState().setPadMode('A', 'loop');
    expect(useDeckStore.getState().decks.A.padMode).toBe('loop');
  });

  it('padMode is not reset by loadTrack', () => {
    useDeckStore.getState().setPadMode('A', 'loop');
    useDeckStore.getState().loadTrack('A', 'trk1', { title: '', artist: '', duration: 100, thumbnailUrl: null });
    expect(useDeckStore.getState().decks.A.padMode).toBe('loop');
  });

  it('padMode is not reset by clearTrack', () => {
    useDeckStore.getState().setPadMode('A', 'loop');
    useDeckStore.getState().clearTrack('A');
    expect(useDeckStore.getState().decks.A.padMode).toBe('loop');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/deck-padmode.test.ts`
Expected: FAIL — `padMode` is `undefined` / `setPadMode is not a function`.

- [ ] **Step 3: Implement the field and action**

In `src/types/deck.ts`, add to the `DeckState` interface, immediately after the `shift: boolean;` field (around line 148):

```ts
  /**
   * Active performance-pad mode. Only 'hotcue' and 'loop' are functional in
   * Phase 2a; 'slicer' and 'sampler' select via disabled placeholder buttons
   * until Phase 2b/2c land.
   */
  padMode: 'hotcue' | 'loop' | 'slicer' | 'sampler';
```

In `src/store/deckStore.ts`, `createInitialDeckState`, add after `shift: false,`:

```ts
    padMode: 'hotcue',
```

Add the action type to `DeckStoreActions`, after the `setShift` type:

```ts
  /** Set the active performance-pad mode for the specified deck. */
  setPadMode: (deckId: 'A' | 'B', mode: 'hotcue' | 'loop' | 'slicer' | 'sampler') => void;
```

Add the implementation, after the `setShift` implementation:

```ts
  setPadMode: (deckId, mode) => {
    updateDeck(set, deckId, { padMode: mode });
  },
```

Add `setPadMode` to the `useDeckActions` shallow bag, on the same line as `setQuantize`/`setShift`:

```ts
      setQuantize: s.setQuantize, setShift: s.setShift, setPadMode: s.setPadMode,
```

(Replace the existing `setQuantize: s.setQuantize, setShift: s.setShift,` line with the above.)

Do **not** add `padMode` to `loadTrack` or `clearTrack`'s reset objects — its omission there is intentional and is exactly what the third and fourth tests above verify.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/deck-padmode.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/types/deck.ts src/store/deckStore.ts src/test/deck-padmode.test.ts
git commit -m "feat: deck padMode state + setPadMode action"
```

---

## Task 2: `PadGridHotCue` panel (extracted from HotCues.tsx)

**Files:**
- Create: `src/components/Deck/PadGridHotCue.tsx`
- Create: `src/components/Deck/PadGridHotCue.module.css`
- Modify: `src/test/hotcues-quantize.test.tsx`
- Modify: `src/test/hotcues-seek-routing.test.tsx`

**Interfaces:**
- Consumes: `HotCueButton` (unchanged), `snapToGrid` (unchanged), `useDeckActions().setHotCue/.clearHotCue` (unchanged).
- Produces: `<PadGridHotCue deckId="A" | "B" />` — 8 hot-cue pads in a 2×4 grid, no outer wrapper/label. Identical button roles/aria-labels to the old `HotCues` component (same `HotCueButton` instances), so existing interaction tests only need an import-path change.

- [ ] **Step 1: Retarget the existing tests to the new component (this will fail first)**

In `src/test/hotcues-quantize.test.tsx`, change the import and both render calls:

```tsx
import { PadGridHotCue } from '../components/Deck/PadGridHotCue';
```

(replaces `import { HotCues } from '../components/Deck/HotCues';`)

```tsx
    render(<PadGridHotCue deckId="A" />);
```

(replaces both `render(<HotCues deckId="A" />);` occurrences — there are two `it` blocks in this file, update both.)

In `src/test/hotcues-seek-routing.test.tsx`, change the import and both render calls:

```tsx
import { PadGridHotCue } from '../components/Deck/PadGridHotCue';
```

(replaces `import { HotCues } from '../components/Deck/HotCues';`)

```tsx
    render(<PadGridHotCue deckId="A" />);
```

(replaces both `render(<HotCues deckId="A" />);` occurrences in this file's two `it` blocks.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/hotcues-quantize.test.tsx src/test/hotcues-seek-routing.test.tsx`
Expected: FAIL — cannot find module `../components/Deck/PadGridHotCue`.

- [ ] **Step 3: Create the component**

Create `src/components/Deck/PadGridHotCue.tsx`:

```tsx
/**
 * PadGridHotCue.tsx — HOT CUE pad-mode panel, rendered inside PadGrid.
 *
 * 8 hot cue pads in a 2x4 grid. Extracted from the pre-PadGrid HotCues.tsx —
 * interaction model (delegated to HotCueButton) and quantize-on-SET behavior
 * are unchanged:
 *   - Normal click on SET cue    → seekTo(timestamp)
 *   - Shift+click or long-press  → set cue at current (quantized) time
 *   - Right-click on SET cue     → clear cue
 */
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import {
  setHotCue as persistSetHotCue,
  clearHotCue as persistClearHotCue,
} from '../../utils/hotCues';
import { getActivePlayer } from '../../services/playerRegistry';
import { snapToGrid } from '../../utils/quantize';
import { HotCueButton } from './HotCueButton';
import styles from './PadGridHotCue.module.css';

/** Number of hot cue slots per deck. */
const HOT_CUE_COUNT = 8;

interface PadGridHotCueProps {
  deckId: 'A' | 'B';
}

export function PadGridHotCue({ deckId }: PadGridHotCueProps) {
  const { setHotCue, clearHotCue } = useDeckActions();

  const trackId = useDeckStore((s) => s.decks[deckId].trackId);
  const hotCues = useDeckStore((s) => s.decks[deckId].hotCues);
  const playerReady = useDeckStore((s) => s.decks[deckId].playerReady);
  const hasTrack = trackId !== null;

  /** Set a hot cue at the deck's current (quantized, if on) playback position. */
  function handleSet(index: number) {
    if (!trackId) return;
    const deck = useDeckStore.getState().decks[deckId];
    let t = deck.currentTime;
    if (deck.quantize && deck.bpm && deck.anchor !== null) {
      t = snapToGrid({ bpm: deck.bpm, anchor: deck.anchor }, t);
    }
    persistSetHotCue(trackId, index, t);
    setHotCue(deckId, index, t);
  }

  /** Jump to a stored hot cue timestamp via the player's seekTo() method. */
  function handleJump(index: number) {
    const timestamp = hotCues[index];
    if (timestamp === undefined) return;
    if (!playerReady) return;

    const player = getActivePlayer(deckId);
    if (player) {
      player.seekTo(timestamp, true);
    }
  }

  /** Clear a hot cue from localStorage and in-memory state. */
  function handleClear(index: number) {
    if (!trackId) return;
    persistClearHotCue(trackId, index);
    clearHotCue(deckId, index);
  }

  return (
    <div className={styles.buttons}>
      {Array.from({ length: HOT_CUE_COUNT }, (_, index) => (
        <HotCueButton
          key={index}
          index={index}
          deckId={deckId}
          timestamp={hotCues[index]}
          hasTrack={hasTrack}
          onSet={() => handleSet(index)}
          onJump={() => handleJump(index)}
          onClear={() => handleClear(index)}
        />
      ))}
    </div>
  );
}

export default PadGridHotCue;
```

Create `src/components/Deck/PadGridHotCue.module.css`:

```css
.buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/hotcues-quantize.test.tsx src/test/hotcues-seek-routing.test.tsx`
Expected: PASS (4 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/components/Deck/PadGridHotCue.tsx src/components/Deck/PadGridHotCue.module.css src/test/hotcues-quantize.test.tsx src/test/hotcues-seek-routing.test.tsx
git commit -m "feat: PadGridHotCue panel (extracted from HotCues.tsx)"
```

---

## Task 3: `PadGridLoop` panel (extracted from LoopControls.tsx, minus ROLL)

**Files:**
- Create: `src/components/Deck/PadGridLoop.tsx`
- Create: `src/components/Deck/PadGridLoop.module.css`
- Modify: `src/test/loopcontrols-manual.test.tsx`
- Modify: `src/test/loop-shift-halvedouble.test.tsx`

**Interfaces:**
- Consumes: `shiftedLoopBeatCount` (unchanged, from Phase 1's `src/utils/loopMath.ts`), `useDeckActions().activateLoopBeat/.deactivateLoop/.startRoll/.endRoll/.setLoopIn/.setLoopOut/.reloop` (all unchanged).
- Produces: `<PadGridLoop deckId="A" | "B" />` — 8 pads in a 2×4 grid: **IN, OUT, 1B, 2B, 4B, 8B, RELOOP, EXIT**. The ROLL *toggle button* is NOT included (moves to `DeckModifiers` in Task 4) — but the roll-mode press/release behavior of the four beat-length pads (driven by the store's existing `rollMode` field) is preserved unchanged.

- [ ] **Step 1: Retarget the existing tests to the new component (this will fail first)**

In `src/test/loopcontrols-manual.test.tsx`, change the import and render call:

```tsx
import { PadGridLoop } from '../components/Deck/PadGridLoop';
```

(replaces `import { LoopControls } from '../components/Deck/LoopControls';`)

```tsx
    render(<PadGridLoop deckId="A" />);
```

(replaces `render(<LoopControls deckId="A" />);`)

In `src/test/loop-shift-halvedouble.test.tsx`, change the import and render call:

```tsx
import { PadGridLoop } from '../components/Deck/PadGridLoop';
```

(replaces `import { LoopControls } from '../components/Deck/LoopControls';`)

```tsx
    render(<PadGridLoop deckId="A" />);
```

(replaces `render(<LoopControls deckId="A" />);` inside the `setup()` helper.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/loopcontrols-manual.test.tsx src/test/loop-shift-halvedouble.test.tsx`
Expected: FAIL — cannot find module `../components/Deck/PadGridLoop`.

- [ ] **Step 3: Create the component**

Create `src/components/Deck/PadGridLoop.tsx`:

```tsx
/**
 * PadGridLoop.tsx — LOOP pad-mode panel, rendered inside PadGrid.
 *
 * 8 pads in a 2x4 grid: IN, OUT, 1B, 2B, 4B, 8B, RELOOP, EXIT. Extracted
 * from the pre-PadGrid LoopControls.tsx. The ROLL *toggle* moved to
 * DeckModifiers (it's a modifier, not a pad) — but the roll-mode
 * press/release behavior of the beat-length pads is unchanged here: while
 * rollMode is on, holding a beat-length pad starts/ends a loop roll instead
 * of click-toggling a persistent loop.
 *
 * SHIFT + a loop-length button while a loop is active halves/doubles the
 * active loop instead of absolute-selecting the clicked length (unchanged
 * from Phase 1).
 */
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import { shiftedLoopBeatCount } from '../../utils/loopMath';
import styles from './PadGridLoop.module.css';

/** Beat counts available as loop lengths. */
const BEAT_COUNTS = [1, 2, 4, 8] as const;
type BeatCount = (typeof BEAT_COUNTS)[number];

interface PadGridLoopProps {
  deckId: 'A' | 'B';
}

export function PadGridLoop({ deckId }: PadGridLoopProps) {
  const bpm = useDeckStore((s) => s.decks[deckId].bpm);
  const loopActive = useDeckStore((s) => s.decks[deckId].loopActive);
  const loopBeatCount = useDeckStore((s) => s.decks[deckId].loopBeatCount);
  const rollMode = useDeckStore((s) => s.decks[deckId].rollMode);
  const playbackState = useDeckStore((s) => s.decks[deckId].playbackState);
  const manualLoopIn = useDeckStore((s) => s.decks[deckId].manualLoopIn);
  const lastManualLoop = useDeckStore((s) => s.decks[deckId].lastManualLoop);
  const shift = useDeckStore((s) => s.decks[deckId].shift);
  const { activateLoopBeat, deactivateLoop, startRoll, endRoll, setLoopIn, setLoopOut, reloop } = useDeckActions();

  const bpmIsSet = bpm !== null;
  const isPlaying = playbackState === 'playing';
  const disabledTitle = 'Set BPM using Tap Tempo first';
  const notPlayingTitle = 'Start playback to use loop roll';

  function handleLoopButton(beatCount: BeatCount) {
    if (!bpmIsSet) return;

    // SHIFT + a loop-length button while a loop is active: halve/double the
    // active loop instead of absolute-selecting the clicked length.
    if (shift && loopActive && loopBeatCount !== null) {
      const result = shiftedLoopBeatCount(loopBeatCount, beatCount);
      if (result === 'deactivate') {
        deactivateLoop(deckId);
      } else {
        activateLoopBeat(deckId, result);
      }
      return;
    }

    // Pressing the same active beat count exits the loop; any other count
    // activates that beat length (replacing any existing loop).
    if (loopActive && loopBeatCount === beatCount) {
      deactivateLoop(deckId);
    } else {
      activateLoopBeat(deckId, beatCount);
    }
  }

  function handleExit() {
    deactivateLoop(deckId);
  }

  // Roll behavior disabled when BPM not set or deck not playing.
  const rollDisabled = !bpmIsSet || !isPlaying;

  function getRollButtonTitle(beatCount: BeatCount): string {
    if (!bpmIsSet) return disabledTitle;
    if (!isPlaying) return notPlayingTitle;
    return `${beatCount}-beat loop roll`;
  }

  return (
    <div className={styles.buttons}>
      {/* Manual loop in/out */}
      <button
        type="button"
        className={[styles.loopBtn, manualLoopIn !== null ? styles.loopBtnActive : ''].filter(Boolean).join(' ')}
        onClick={() => setLoopIn(deckId)}
        aria-label={`Set loop in on Deck ${deckId}`}
        aria-pressed={manualLoopIn !== null}
        title="Set loop in-point"
      >
        IN
      </button>
      <button
        type="button"
        className={[styles.loopBtn, manualLoopIn === null ? styles.loopBtnDisabled : ''].filter(Boolean).join(' ')}
        onClick={() => setLoopOut(deckId)}
        disabled={manualLoopIn === null}
        aria-label={`Set loop out on Deck ${deckId}`}
        title="Set loop out-point and start looping"
      >
        OUT
      </button>
      {BEAT_COUNTS.map((beatCount) => {
        const isActive = loopActive && loopBeatCount === beatCount;

        if (rollMode) {
          // Roll mode: press-hold behavior
          return (
            <button
              key={beatCount}
              type="button"
              className={[
                styles.loopBtn,
                isActive ? styles.loopBtnActive : '',
                rollDisabled ? styles.loopBtnDisabled : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={rollDisabled}
              aria-label={`${beatCount}-beat loop roll on Deck ${deckId}`}
              aria-pressed={isActive}
              title={getRollButtonTitle(beatCount)}
              onMouseDown={() => {
                if (rollDisabled) return;
                startRoll(deckId, beatCount);
              }}
              onMouseUp={() => {
                if (rollDisabled) return;
                endRoll(deckId);
              }}
              onMouseLeave={() => {
                // End roll if cursor leaves while button is held down.
                endRoll(deckId);
              }}
              onTouchStart={(e) => {
                e.preventDefault(); // prevent synthetic mousedown
                if (rollDisabled) return;
                startRoll(deckId, beatCount);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                if (rollDisabled) return;
                endRoll(deckId);
              }}
              onClick={(e) => {
                // Suppress click in roll mode — mousedown/mouseup handle everything.
                e.preventDefault();
              }}
            >
              {beatCount}B
            </button>
          );
        }

        // Normal mode: click-to-toggle
        return (
          <button
            key={beatCount}
            type="button"
            className={[
              styles.loopBtn,
              isActive ? styles.loopBtnActive : '',
              !bpmIsSet ? styles.loopBtnDisabled : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleLoopButton(beatCount)}
            disabled={!bpmIsSet}
            aria-label={`${beatCount}-beat loop on Deck ${deckId}`}
            aria-pressed={isActive}
            title={bpmIsSet ? `${beatCount}-beat loop` : disabledTitle}
          >
            {beatCount}B
          </button>
        );
      })}

      {/* RELOOP — re-arm the last manual loop */}
      <button
        type="button"
        className={[styles.loopBtn, !lastManualLoop ? styles.loopBtnDisabled : ''].filter(Boolean).join(' ')}
        onClick={() => reloop(deckId)}
        disabled={!lastManualLoop}
        aria-label={`Reloop on Deck ${deckId}`}
        aria-pressed={loopActive && loopBeatCount === null}
        title="Re-arm the last manual loop"
      >
        RELOOP
      </button>

      {/* EXIT button — always clickable; dims when no loop is active */}
      <button
        type="button"
        className={[styles.exitBtn, !loopActive ? styles.exitBtnDim : '']
          .filter(Boolean)
          .join(' ')}
        onClick={handleExit}
        aria-label={`Exit loop on Deck ${deckId}`}
        title="Exit loop"
      >
        EXIT
      </button>
    </div>
  );
}

export default PadGridLoop;
```

Create `src/components/Deck/PadGridLoop.module.css`:

```css
.buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
}

/* ---- Loop pads (IN / OUT / 1B / 2B / 4B / 8B / RELOOP) ---- */

.loopBtn {
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

.loopBtn:hover:not(:disabled) {
  background: #242424;
  border-color: #555555;
  color: #aaaaaa;
}

.loopBtn:focus-visible {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: var(--shadow-focus);
}

.loopBtnActive {
  background: #1a3a1a;
  border-color: #4a9a4a;
  color: #7fd97f;
}

.loopBtnActive:hover {
  background: #1f421f;
  border-color: #5aaa5a;
  color: #8fe98f;
}

.loopBtnDisabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* ---- EXIT button ---- */

.exitBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 28px;
  padding: 0 var(--space-2);
  background: #2a1a1a;
  border: 1px solid #5a2a2a;
  border-radius: var(--radius-md);
  color: #cc6666;
  font-size: var(--text-xs);
  font-weight: 700;
  font-family: var(--font-primary);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast),
    opacity var(--transition-fast);
}

.exitBtn:hover {
  background: #3a1a1a;
  border-color: #aa3a3a;
  color: #ee7777;
}

.exitBtn:focus-visible {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: var(--shadow-focus);
}

.exitBtnDim {
  opacity: 0.4;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/loopcontrols-manual.test.tsx src/test/loop-shift-halvedouble.test.tsx`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/components/Deck/PadGridLoop.tsx src/components/Deck/PadGridLoop.module.css src/test/loopcontrols-manual.test.tsx src/test/loop-shift-halvedouble.test.tsx
git commit -m "feat: PadGridLoop panel (extracted from LoopControls.tsx, minus ROLL toggle)"
```

---

## Task 4: ROLL button relocates into DeckModifiers

**Files:**
- Modify: `src/components/Deck/DeckModifiers.tsx`
- Modify: `src/test/DeckModifiers.test.tsx`

**Interfaces:**
- Consumes: `useDeckStore`/`useDeckActions().setRollMode` (unchanged, pre-existing from before Phase 1).
- Produces: a third button, **ROLL**, in the `DeckModifiers` row, toggling the deck's existing `rollMode` field.

- [ ] **Step 1: Write the failing test**

In `src/test/DeckModifiers.test.tsx`, add a new `it` block inside the existing `describe('DeckModifiers', ...)`:

```tsx
  it('ROLL button toggles rollMode and reflects aria-pressed', () => {
    render(<DeckModifiers deckId="A" />);
    const roll = screen.getByRole('button', { name: /loop roll mode/i });
    expect(roll).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(roll);
    expect(useDeckStore.getState().decks.A.rollMode).toBe(true);
    expect(roll).toHaveAttribute('aria-pressed', 'true');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/DeckModifiers.test.tsx`
Expected: FAIL — no button matches `/loop roll mode/i`.

- [ ] **Step 3: Add the ROLL button**

Replace the full contents of `src/components/Deck/DeckModifiers.tsx`:

```tsx
/**
 * DeckModifiers.tsx — Compact SHIFT + QUANTIZE + ROLL toggle row for a deck.
 * Rendered under the transport. Buttons are small and clearly button-shaped
 * (fixed width, bordered, lit when active) — never a full-width bar.
 *
 * ROLL relocated here from the loop pad panel (Phase 2a) — it's a modifier
 * that changes how the loop pads react (click-toggle vs. hold-to-roll), not
 * a pad itself. Reuses the pre-existing rollMode/setRollMode unchanged.
 */
import { useShallow } from 'zustand/react/shallow';
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import styles from './DeckModifiers.module.css';

interface DeckModifiersProps {
  deckId: 'A' | 'B';
}

export function DeckModifiers({ deckId }: DeckModifiersProps) {
  const { shift, quantize, rollMode } = useDeckStore(
    useShallow((s) => ({
      shift: s.decks[deckId].shift,
      quantize: s.decks[deckId].quantize,
      rollMode: s.decks[deckId].rollMode,
    })),
  );
  const { setShift, setQuantize, setRollMode } = useDeckActions();

  return (
    <div className={styles.row}>
      <button
        type="button"
        className={`${styles.modBtn} ${shift ? styles.modBtnActive : ''}`}
        aria-label={`Shift modifier for Deck ${deckId}`}
        aria-pressed={shift}
        title="SHIFT — hold-alternative for secondary functions"
        onClick={() => setShift(deckId, !shift)}
      >
        SHIFT
      </button>
      <button
        type="button"
        className={`${styles.modBtn} ${quantize ? styles.modBtnActive : ''}`}
        aria-label={`Quantize for Deck ${deckId}`}
        aria-pressed={quantize}
        title="QUANTIZE — snap cues & loops to the beat grid"
        onClick={() => setQuantize(deckId, !quantize)}
      >
        Q
      </button>
      <button
        type="button"
        className={`${styles.modBtn} ${rollMode ? styles.modBtnActive : ''}`}
        aria-label={`Loop roll mode for Deck ${deckId}`}
        aria-pressed={rollMode}
        title="ROLL — hold a loop pad to trigger a momentary roll instead of a persistent loop"
        onClick={() => setRollMode(deckId, !rollMode)}
      >
        ROLL
      </button>
    </div>
  );
}

export default DeckModifiers;
```

(No changes needed to `DeckModifiers.module.css` — the existing fixed-width `.modBtn` class accommodates a third button in the same row without stretching.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/DeckModifiers.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Deck/DeckModifiers.tsx src/test/DeckModifiers.test.tsx
git commit -m "feat: ROLL toggle relocates into DeckModifiers"
```

---

## Task 5: `PadGrid` shell (mode-select row + panel delegation)

**Files:**
- Create: `src/components/Deck/PadGrid.tsx`
- Create: `src/components/Deck/PadGrid.module.css`
- Test: `src/test/PadGrid.test.tsx`

**Interfaces:**
- Consumes: `PadGridHotCue` (Task 2), `PadGridLoop` (Task 3), `deckStore.padMode`/`setPadMode` (Task 1).
- Produces: `<PadGrid deckId="A" | "B" />` — a 4-button mode-select row (HOT CUE, LOOP enabled; SLICER, SAMPLER disabled) plus the active mode's pad panel below it.

- [ ] **Step 1: Write the failing test**

Create `src/test/PadGrid.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PadGrid } from '../components/Deck/PadGrid';
import { useDeckStore } from '../store/deckStore';

describe('PadGrid mode switching', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('defaults to HOT CUE mode and renders 8 hot cue pads', () => {
    render(<PadGrid deckId="A" />);
    expect(screen.getByRole('button', { name: /hot cue pad mode for deck a/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /hot cue 1 on deck a/i })).toBeInTheDocument();
  });

  it('switching to LOOP mode renders the loop pads instead', () => {
    render(<PadGrid deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /loop pad mode for deck a/i }));
    expect(screen.getByRole('button', { name: /set loop in on deck a/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hot cue 1 on deck a/i })).not.toBeInTheDocument();
  });

  it('SLICER and SAMPLER mode buttons are disabled', () => {
    render(<PadGrid deckId="A" />);
    expect(screen.getByRole('button', { name: /slicer pad mode for deck a/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /sampler pad mode for deck a/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/PadGrid.test.tsx`
Expected: FAIL — cannot find module `../components/Deck/PadGrid`.

- [ ] **Step 3: Create the shell component**

Create `src/components/Deck/PadGrid.tsx`:

```tsx
/**
 * PadGrid.tsx — Unified performance-pad grid for a deck (Phase 2a).
 *
 * Replaces the separate HotCues + LoopControls panels with one mode-switched
 * 8-pad grid, matching the Hercules DJC Inpulse 300 MK2's HOT CUE / LOOP /
 * SLICER / SAMPLER pad section. Only HOT CUE and LOOP are functional in
 * Phase 2a; SLICER and SAMPLER render as disabled placeholder buttons
 * (Phase 2b/2c land later, flipping them on with no relayout).
 *
 * Mode-switch is a pure UI visibility concern — switching away from LOOP
 * mode does not deactivate a running loop or roll; the underlying state and
 * audio engine are unaffected. Hot-cue keyboard shortcuts keep working
 * regardless of the currently displayed mode.
 */
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import type { DeckState } from '../../types/deck';
import { PadGridHotCue } from './PadGridHotCue';
import { PadGridLoop } from './PadGridLoop';
import styles from './PadGrid.module.css';

interface PadGridProps {
  deckId: 'A' | 'B';
}

const MODES: { mode: DeckState['padMode']; label: string; disabled: boolean }[] = [
  { mode: 'hotcue', label: 'HOT CUE', disabled: false },
  { mode: 'loop', label: 'LOOP', disabled: false },
  { mode: 'slicer', label: 'SLICER', disabled: true },
  { mode: 'sampler', label: 'SAMPLER', disabled: true },
];

export function PadGrid({ deckId }: PadGridProps) {
  const padMode = useDeckStore((s) => s.decks[deckId].padMode);
  const { setPadMode } = useDeckActions();

  return (
    <div className={styles.wrapper}>
      <div className={styles.modeRow}>
        {MODES.map(({ mode, label, disabled }) => (
          <button
            key={mode}
            type="button"
            className={[
              styles.modeBtn,
              padMode === mode ? styles.modeBtnActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setPadMode(deckId, mode)}
            disabled={disabled}
            aria-pressed={padMode === mode}
            aria-label={`${label} pad mode for Deck ${deckId}`}
            title={disabled ? `${label} — coming soon` : `${label} pad mode`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.padArea}>
        {padMode === 'hotcue' && <PadGridHotCue deckId={deckId} />}
        {padMode === 'loop' && <PadGridLoop deckId={deckId} />}
      </div>
    </div>
  );
}

export default PadGrid;
```

Create `src/components/Deck/PadGrid.module.css`:

```css
.wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
}

.modeRow {
  display: flex;
  gap: var(--space-1);
}

.modeBtn {
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

.modeBtn:hover:not(:disabled) {
  color: var(--color-text-primary);
}

.modeBtn:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.modeBtn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.modeBtnActive {
  color: var(--color-text-inverse);
  background: var(--color-accent-primary);
  border-color: var(--color-accent-primary-bright);
  box-shadow: var(--shadow-button-active);
}

.padArea {
  min-height: 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/PadGrid.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Deck/PadGrid.tsx src/components/Deck/PadGrid.module.css src/test/PadGrid.test.tsx
git commit -m "feat: PadGrid shell — mode-select row + HOT CUE/LOOP panel delegation"
```

---

## Task 6: Wire PadGrid into Deck.tsx; remove the old panels

**Files:**
- Modify: `src/components/Deck/Deck.tsx`
- Modify: `src/components/Deck/DeckControls.tsx` (doc comment only)
- Delete: `src/components/Deck/HotCues.tsx`
- Delete: `src/components/Deck/HotCues.module.css`
- Delete: `src/components/Deck/LoopControls.tsx`
- Delete: `src/components/Deck/LoopControls.module.css`

**Interfaces:**
- Consumes: `PadGrid` (Task 5).
- Produces: `Deck.tsx` renders one `<PadGrid deckId={deckId} />` where it previously rendered `<HotCues>` + `<LoopControls>`.

- [ ] **Step 1: Update Deck.tsx's imports**

In `src/components/Deck/Deck.tsx`, replace these two import lines:

```tsx
import { HotCues } from './HotCues';
```
```tsx
import { LoopControls } from './LoopControls';
```

with a single import (insert it in the same alphabetical position as the removed `HotCues` import, i.e. right after the `DeckModifiers` import and before `BeatJump`):

```tsx
import { PadGrid } from './PadGrid';
```

- [ ] **Step 2: Replace the render calls**

In the same file, replace:

```tsx
      {/* Hot cue buttons (4 per deck, STORY-011) */}
      <HotCues deckId={deckId} />

      {/* Loop controls */}
      <LoopControls deckId={deckId} />
```

with:

```tsx
      {/* Unified performance-pad grid: HOT CUE / LOOP functional, SLICER / SAMPLER coming later */}
      <PadGrid deckId={deckId} />
```

- [ ] **Step 3: Update the stale doc-comment reference**

In `src/components/Deck/DeckControls.tsx`, near the top of the file, find the line:

```
 * Hot cue panel (indices 0–3, long-press, right-click) handled by HotCues.tsx (STORY-011).
```

Replace it with:

```
 * Hot cue panel (indices 0–3, long-press, right-click) handled by PadGridHotCue.tsx (via PadGrid).
```

- [ ] **Step 4: Delete the old components**

```bash
git rm src/components/Deck/HotCues.tsx src/components/Deck/HotCues.module.css src/components/Deck/LoopControls.tsx src/components/Deck/LoopControls.module.css
```

- [ ] **Step 5: Run the full test suite to verify nothing references the deleted files**

Run: `npm run test`
Expected: all tests pass — every test that previously rendered `HotCues`/`LoopControls` was already retargeted to `PadGridHotCue`/`PadGridLoop` in Tasks 2–3, so no test should reference the deleted modules.

- [ ] **Step 6: Type-check and lint**

Run: `npm run build`
Expected: no errors — confirms no remaining source-code import of the deleted files (test files are excluded from this check per `tsconfig.app.json`, but they were already verified clean in Step 5).

Run: `npm run lint`
Expected: zero warnings.

- [ ] **Step 7: Commit**

```bash
git add src/components/Deck/Deck.tsx src/components/Deck/DeckControls.tsx
git commit -m "feat: wire PadGrid into Deck.tsx; remove the superseded HotCues/LoopControls panels"
```

---

## Task 7: Full-suite verification (build + lint + all tests + manual smoke test)

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

Run: `npm run dev`, open the app, and verify for Deck A and Deck B:
- The pad area defaults to HOT CUE mode with 8 pads visible, in a 2×4 grid.
- Clicking LOOP switches to the 8 loop pads (IN, OUT, 1B, 2B, 4B, 8B, RELOOP, EXIT) in a 2×4 grid; hot-cue pads disappear.
- Clicking SLICER or SAMPLER does nothing (buttons are visibly disabled/greyed with a tooltip).
- SHIFT, Q, and ROLL all appear as three compact, fixed-width buttons under the transport (not stretched into a bar).
- Setting a hot cue, then switching to LOOP mode and back to HOT CUE, shows the hot cue is still set (mode-switch doesn't clear state).
- Activating a loop, then switching to HOT CUE mode, leaves the loop audibly running (verify with a loaded track); switching back to LOOP mode shows it still active.
- Toggling ROLL, then holding a beat-length pad in LOOP mode, triggers a momentary roll instead of a persistent loop; releasing returns playback to the pre-roll position family (same as pre-Phase-2a behavior).

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: Phase 2a build/lint/test verification fixes"
```

---

## Self-Review (author checklist — completed)

**Spec coverage** (each Phase 2a spec item → task):
- `padMode` state field + `setPadMode`, not reset by loadTrack/clearTrack (§3) → Task 1.
- HOT CUE mode panel, unchanged interaction contract (§4) → Task 2.
- LOOP mode panel, 8 pads (IN/OUT/1B/2B/4B/8B/RELOOP/EXIT), unchanged SHIFT/QUANTIZE behavior (§2, §4) → Task 3.
- ROLL relocates to DeckModifiers, behavior unchanged (§2, §4) → Task 4.
- PadGrid shell, mode-select row, SLICER/SAMPLER disabled+tooltip (§2, §4) → Task 5.
- Deck.tsx wiring, removal of superseded files (§4) → Task 6.
- Behavior edge cases (mode-switch independence, keyboard shortcuts unaffected) (§5) → verified structurally in Tasks 2/3/5 (no code path ties pad visibility to loop/hotcue state) and exercised in Task 7's manual smoke test.
- Testing (§6) → per-task unit/component tests plus Task 7's full-suite gate.

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `padMode`, `setPadMode`, `PadGridHotCue`, `PadGridLoop`, `PadGrid`, `shiftedLoopBeatCount`, `setLoopIn`/`setLoopOut`/`reloop`, `setRollMode`/`startRoll`/`endRoll` are used identically across tasks and match their defining tasks (all reused unchanged from Phase 1 except the three new items: `padMode`, `setPadMode`, and the three new component names).

**Deliberate scope note:** the roll-mode press/release logic in `PadGridLoop` is unchanged from `LoopControls.tsx` — only the ROLL *toggle button* moved. `PadGridHotCue`/`PadGridLoop` intentionally drop their old outer `.wrapper`/`.label` chrome since `PadGrid`'s mode-select row now conveys that context, per the approved design (redundant-label removal, matching the precedent set for `BeatmatchGuide` in Phase 1's final review).
