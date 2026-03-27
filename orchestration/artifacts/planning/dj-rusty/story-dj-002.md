# STORY-DJ-002: Beat Jump

**Status**: Ready for Development
**Complexity**: Medium
**Estimated Tasks**: 4
**Dependencies**: None (uses existing deckStore, playerRegistry, tap-tempo BPM)

---

## Objective

Add Beat Jump buttons to each deck that jump the playhead forward or backward by a fixed number of beats, calculated from the deck's current BPM. The user selects a beat size (default: 4) and uses directional arrows to jump. This gives DJs a precise, BPM-aware way to nudge the playhead without free-scrolling.

---

## Scope

**In scope:**
- Pure utility module for beat jump math (calculateJumpSeconds, clampTime)
- New `beatJumpSize` state field on each deck in deckStore
- New `BeatJump` component with size selector and directional jump buttons
- Integration into Deck layout (placed after LoopControls)
- Unit tests for the utility functions

**Out of scope:**
- Keyboard shortcuts for beat jump (future story)
- Beat jump with pitch-adjusted BPM (uses raw tap-tempo BPM only)
- Visual waveform markers showing jump distance
- Persisting beat jump size preference to localStorage

---

## Acceptance Criteria

- [ ] **AC-1: Beat Jump panel visible.** Each deck (A and B) renders a Beat Jump section with a row of size buttons (1/2, 1, 2, 4, 8, 16) and a pair of directional buttons (back arrow, forward arrow).
- [ ] **AC-2: Size selection.** Clicking a size label selects that size as the active beat jump amount. The selected size is visually highlighted. Clicking a size does NOT trigger a jump.
- [ ] **AC-3: Default size.** The initial selected beat jump size is 4 beats for both decks.
- [ ] **AC-4: Forward jump.** Clicking the forward button seeks the player forward by `(selectedBeats / bpm) * 60` seconds from the current playback position.
- [ ] **AC-5: Backward jump.** Clicking the backward button seeks the player backward by `(selectedBeats / bpm) * 60` seconds from the current playback position.
- [ ] **AC-6: BPM-driven calculation.** Jump distance is derived from the deck's `bpm` value (set via tap-tempo). When BPM is 120 and size is 4 beats, jump distance is 2.0 seconds.
- [ ] **AC-7: Clamped to track bounds.** Forward jump clamps to the track duration. Backward jump clamps to 0. The player never seeks to a negative time or past the end.
- [ ] **AC-8: Disabled when BPM is null/0.** All beat jump buttons (sizes and arrows) are disabled and visually greyed out when `bpm` is `null` or `0`.
- [ ] **AC-9: Disabled when no track loaded.** All beat jump buttons are disabled when `videoId` is `null`.
- [ ] **AC-10: Independent per deck.** Deck A and Deck B each maintain their own selected beat jump size. Changing the size or jumping on one deck does not affect the other.

---

## Technical Specification

### Task 1: Create Beat Jump Utility Module

**File to create:** `src/utils/beatJump.ts`

**Sizing:** Small
**Complexity:** Low
**Dependencies:** None

**Description:** Pure utility module with no React or store dependencies. Contains the beat jump math and the constant array of available sizes.

**Exported constants:**

```typescript
/**
 * Available beat jump sizes. Matches DJ hardware conventions.
 * 0.5 represents a half-beat jump.
 */
export const BEAT_JUMP_SIZES = [0.5, 1, 2, 4, 8, 16] as const;

export type BeatJumpSize = (typeof BEAT_JUMP_SIZES)[number];

/** Default beat jump size for a fresh deck. */
export const DEFAULT_BEAT_JUMP_SIZE: BeatJumpSize = 4;
```

**Exported functions:**

```typescript
/**
 * Calculate the jump duration in seconds for the given number of beats at a BPM.
 *
 * Formula: (beats / bpm) * 60
 *
 * @param beats - Number of beats to jump (e.g. 0.5, 1, 2, 4, 8, 16).
 * @param bpm   - Beats per minute from tap-tempo.
 * @returns Duration in seconds. Always positive.
 */
export function calculateJumpSeconds(beats: number, bpm: number): number {
  return (beats / bpm) * 60;
}

/**
 * Clamp a time value to the valid range [0, duration].
 *
 * @param time     - The candidate time in seconds (may be negative or > duration).
 * @param duration - Track duration in seconds. Must be >= 0.
 * @returns Clamped time.
 */
export function clampTime(time: number, duration: number): number {
  return Math.max(0, Math.min(time, duration));
}
```

**Implementation steps:**
1. Create `src/utils/beatJump.ts`.
2. Export `BEAT_JUMP_SIZES`, `BeatJumpSize`, `DEFAULT_BEAT_JUMP_SIZE`.
3. Export `calculateJumpSeconds` and `clampTime`.
4. No imports required; this is a standalone math module.

**Files to create:**
- `src/utils/beatJump.ts`

**Testing requirements:** See Task 4.

**Acceptance criteria:**
- [ ] `BEAT_JUMP_SIZES` contains exactly `[0.5, 1, 2, 4, 8, 16]`.
- [ ] `calculateJumpSeconds(4, 120)` returns `2.0`.
- [ ] `calculateJumpSeconds(0.5, 120)` returns `0.25`.
- [ ] `calculateJumpSeconds(16, 128)` returns `7.5`.
- [ ] `clampTime(-5, 300)` returns `0`.
- [ ] `clampTime(400, 300)` returns `300`.
- [ ] `clampTime(150, 300)` returns `150`.

---

### Task 2: Add `beatJumpSize` to Deck Store

**File to modify:** `src/store/deckStore.ts`
**File to modify:** `src/types/deck.ts`

**Sizing:** Small
**Complexity:** Low
**Dependencies:** Task 1 (imports `DEFAULT_BEAT_JUMP_SIZE`, `BeatJumpSize`)

**Description:** Add a `beatJumpSize` field to each deck's state and a `setBeatJumpSize` action. Follows the exact same pattern as the existing `bpm` field and `setBpm` action.

**Changes to `src/types/deck.ts`:**

Add the following field to the `DeckState` interface, after the `loopBeatCount` field:

```typescript
/** Currently selected beat jump size. Controls how far the beat jump buttons seek. */
beatJumpSize: number;
```

**Changes to `src/store/deckStore.ts`:**

1. Import `DEFAULT_BEAT_JUMP_SIZE` from `../utils/beatJump`.

2. In `createInitialDeckState`, add:
   ```typescript
   beatJumpSize: DEFAULT_BEAT_JUMP_SIZE,
   ```
   Place it after the `loopBeatCount` property initialization.

3. In `DeckStoreActions` interface, add:
   ```typescript
   /** Set the selected beat jump size for the specified deck. */
   setBeatJumpSize: (deckId: 'A' | 'B', size: number) => void;
   ```

4. In the `create<DeckStore>` body, add the action implementation:
   ```typescript
   setBeatJumpSize: (deckId, size) => {
     updateDeck(set, deckId, { beatJumpSize: size });
   },
   ```

5. In `loadTrack`, do NOT reset `beatJumpSize` (it should persist across track loads so the DJ keeps their preferred jump size).

6. In `clearTrack`, reset `beatJumpSize` to `DEFAULT_BEAT_JUMP_SIZE`:
   ```typescript
   beatJumpSize: DEFAULT_BEAT_JUMP_SIZE,
   ```

**Implementation steps:**
1. Add `beatJumpSize: number` to `DeckState` in `src/types/deck.ts`.
2. Import `DEFAULT_BEAT_JUMP_SIZE` in `src/store/deckStore.ts`.
3. Add `beatJumpSize: DEFAULT_BEAT_JUMP_SIZE` to `createInitialDeckState`.
4. Add `setBeatJumpSize` to the `DeckStoreActions` interface.
5. Implement `setBeatJumpSize` action in the store body.
6. Add `beatJumpSize: DEFAULT_BEAT_JUMP_SIZE` to the `clearTrack` reset.

**Files to modify:**
- `src/types/deck.ts`
- `src/store/deckStore.ts`

**Testing requirements:** Covered by Task 4 store-level assertions.

**Acceptance criteria:**
- [ ] `DeckState` interface includes `beatJumpSize: number`.
- [ ] Initial deck state has `beatJumpSize` of `4`.
- [ ] `setBeatJumpSize('A', 8)` updates deck A's `beatJumpSize` to `8` without affecting deck B.
- [ ] `clearTrack` resets `beatJumpSize` to `4`.
- [ ] `loadTrack` does NOT reset `beatJumpSize` (preserves DJ preference).

---

### Task 3: Create BeatJump Component

**File to create:** `src/components/Deck/BeatJump.tsx`
**File to create:** `src/components/Deck/BeatJump.module.css`
**File to modify:** `src/components/Deck/Deck.tsx`

**Sizing:** Medium
**Complexity:** Medium
**Dependencies:** Task 1, Task 2

**Description:** New React component that renders the beat jump UI. Follows the exact same patterns as `LoopControls.tsx` for layout, styling, store access, and playerRegistry usage.

**Component: `src/components/Deck/BeatJump.tsx`**

```typescript
/**
 * BeatJump.tsx — Beat jump controls for a single deck.
 *
 * Renders a row of beat-size selector buttons (1/2, 1, 2, 4, 8, 16) and
 * directional jump buttons (back / forward). Jumping seeks the player by
 * (selectedBeats / bpm) * 60 seconds, clamped to [0, duration].
 *
 * Buttons are disabled when BPM has not been set via tap-tempo or when
 * no track is loaded.
 */
```

**Props interface:**
```typescript
interface BeatJumpProps {
  deckId: 'A' | 'B';
}
```

**Imports:**
- `useDeck`, `useDeckStore` from `../../store/deckStore`
- `playerRegistry` from `../../services/playerRegistry`
- `BEAT_JUMP_SIZES`, `calculateJumpSeconds`, `clampTime` from `../../utils/beatJump`
- `styles` from `./BeatJump.module.css`

**Component logic:**

1. Read from store via `useDeck(deckId)`: `bpm`, `currentTime`, `duration`, `beatJumpSize`, `videoId`, `playerReady`.
2. Read `setBeatJumpSize` from `useDeckStore()`.
3. Derive `isDisabled = !videoId || !bpm || bpm === 0 || !playerReady`.
4. Size selector: map over `BEAT_JUMP_SIZES`. Each button:
   - Displays the size label (use `"1/2"` for `0.5`, otherwise `String(size)`)
   - Highlighted when `beatJumpSize === size`
   - `onClick` calls `setBeatJumpSize(deckId, size)` -- does NOT jump
   - Disabled when `isDisabled` is true
   - `aria-label`: e.g. `"Select 4-beat jump size on Deck A"`
   - `aria-pressed`: true when selected
5. Back button (`<`):
   - `onClick` handler:
     ```
     const jumpSec = calculateJumpSeconds(beatJumpSize, bpm)
     const newTime = clampTime(currentTime - jumpSec, duration)
     playerRegistry.get(deckId)?.seekTo(newTime, true)
     ```
   - Disabled when `isDisabled` is true
   - `aria-label`: `"Jump backward on Deck A"`
6. Forward button (`>`):
   - Same as back but `currentTime + jumpSec`
   - `aria-label`: `"Jump forward on Deck A"`

**Display labels for sizes:**
| Value | Label |
|-------|-------|
| 0.5   | 1/2   |
| 1     | 1     |
| 2     | 2     |
| 4     | 4     |
| 8     | 8     |
| 16    | 16    |

**Layout (HTML structure):**
```
div.wrapper
  span.label "BEAT JUMP"
  div.buttons
    button.jumpBtn (back arrow)
    button.sizeBtn [for each size in BEAT_JUMP_SIZES]
    button.jumpBtn (forward arrow)
```

**CSS file: `src/components/Deck/BeatJump.module.css`**

Follow the exact same colour palette and variable conventions as `LoopControls.module.css`:
- `.wrapper`: flex row, `padding: var(--space-2) var(--space-4)`, `border-bottom: 1px solid var(--color-border-subtle)`, `gap: var(--space-3)`.
- `.label`: same as LoopControls `.label` (uppercase, muted, xs text).
- `.buttons`: flex row, `gap: var(--space-1)`, no wrap.
- `.sizeBtn`: same dimensions and colours as `.loopBtn` (`min-width: 36px`, `height: 28px`, background `#1a1a1a`, border `#333`, text `#888`).
- `.sizeBtnActive`: same as `.loopBtnActive` (green highlight: `background #1a3a1a`, `border #4a9a4a`, `color #7fd97f`).
- `.sizeBtnDisabled`: `opacity: 0.35`, `cursor: not-allowed`.
- `.jumpBtn`: same base as `.sizeBtn` but with cyan/blue accent for directionality: `background: #1a1a2a`, `border: 1px solid #2a2a5a`, `color: #6688cc`. Hover: `background: #24243a`, `border-color: #4455aa`, `color: #88aaee`.
- `.jumpBtnDisabled`: `opacity: 0.35`, `cursor: not-allowed`.
- Hover and focus-visible states follow the same pattern as LoopControls.

**Integration in Deck.tsx:**

Add import:
```typescript
import { BeatJump } from './BeatJump';
```

Add the component in the JSX, immediately after `<LoopControls deckId={deckId} />` and before `<TapTempo deckId={deckId} />`:
```tsx
{/* Beat jump controls */}
<BeatJump deckId={deckId} />
```

**Implementation steps:**
1. Create `src/components/Deck/BeatJump.module.css` with all styles.
2. Create `src/components/Deck/BeatJump.tsx` with the component.
3. Import and add `<BeatJump deckId={deckId} />` in `Deck.tsx` after `<LoopControls>`.

**Files to create:**
- `src/components/Deck/BeatJump.tsx`
- `src/components/Deck/BeatJump.module.css`

**Files to modify:**
- `src/components/Deck/Deck.tsx`

**Testing requirements:** Manual verification + unit tests in Task 4.

**Acceptance criteria:**
- [ ] BeatJump panel renders on both Deck A and Deck B.
- [ ] Six size buttons display: `1/2`, `1`, `2`, `4`, `8`, `16`.
- [ ] `4` is highlighted by default.
- [ ] Clicking a size button changes the highlight without jumping.
- [ ] Back arrow button seeks backward by the calculated beat duration.
- [ ] Forward arrow button seeks forward by the calculated beat duration.
- [ ] All buttons disabled when `bpm` is null.
- [ ] All buttons disabled when `videoId` is null.
- [ ] All buttons have appropriate `aria-label` attributes.
- [ ] Seek is clamped to [0, duration].

---

### Task 4: Write Unit Tests

**File to create:** `src/test/beat-jump.test.ts`

**Sizing:** Small
**Complexity:** Low
**Dependencies:** Task 1

**Description:** Unit tests for the beat jump utility functions. Follows the same test file conventions as `src/test/loop-utils.test.ts`.

**Test cases:**

```typescript
import { describe, it, expect } from 'vitest';
import {
  BEAT_JUMP_SIZES,
  DEFAULT_BEAT_JUMP_SIZE,
  calculateJumpSeconds,
  clampTime,
} from '../utils/beatJump';
```

**Suite: `calculateJumpSeconds`**

| Test case | Input | Expected |
|-----------|-------|----------|
| 4 beats at 120 BPM | `(4, 120)` | `2.0` |
| Half beat at 120 BPM | `(0.5, 120)` | `0.25` |
| 16 beats at 128 BPM | `(16, 128)` | `7.5` |
| 1 beat at 60 BPM | `(1, 60)` | `1.0` |
| 8 beats at 140 BPM | `(8, 140)` | `3.4285714285714284` (approx) |

**Suite: `clampTime`**

| Test case | Input | Expected |
|-----------|-------|----------|
| Negative time clamped to 0 | `(-5, 300)` | `0` |
| Time past duration clamped | `(400, 300)` | `300` |
| In-range time passed through | `(150, 300)` | `150` |
| Zero time stays at 0 | `(0, 300)` | `0` |
| Time at exact duration | `(300, 300)` | `300` |

**Suite: `constants`**

| Test case | Assertion |
|-----------|-----------|
| BEAT_JUMP_SIZES has 6 entries | `BEAT_JUMP_SIZES.length === 6` |
| BEAT_JUMP_SIZES values correct | `[...BEAT_JUMP_SIZES]` deep equals `[0.5, 1, 2, 4, 8, 16]` |
| DEFAULT_BEAT_JUMP_SIZE is 4 | `DEFAULT_BEAT_JUMP_SIZE === 4` |

**Implementation steps:**
1. Create `src/test/beat-jump.test.ts`.
2. Import utility functions from `../utils/beatJump`.
3. Write all test cases listed above.
4. Run `npx vitest run src/test/beat-jump.test.ts` and verify all pass.

**Files to create:**
- `src/test/beat-jump.test.ts`

**Acceptance criteria:**
- [ ] All `calculateJumpSeconds` tests pass.
- [ ] All `clampTime` tests pass.
- [ ] All constants assertions pass.
- [ ] No test depends on external state, mocks, or timers.

---

## Implementation Order

```
Task 1 (beatJump.ts utility) ─── no dependencies
         │
Task 2 (deckStore + types)   ─── depends on Task 1 (imports DEFAULT_BEAT_JUMP_SIZE)
         │
Task 3 (BeatJump component)  ─── depends on Task 1 + Task 2
         │
Task 4 (unit tests)          ─── depends on Task 1 (can run in parallel with Task 2/3)
```

Tasks 1 and 4 can be implemented together. Task 2 follows. Task 3 follows last since it depends on both the utility and the store changes.

---

## Key Patterns to Follow

These patterns are derived from the existing codebase and must be followed exactly:

1. **Store access:** Use `useDeck(deckId)` for reading state, `useDeckStore()` for actions. Same as `LoopControls.tsx` and `DeckControls.tsx`.
2. **Player commands:** Use `playerRegistry.get(deckId)?.seekTo(time, true)`. Same as `DeckControls.tsx` lines 64-66, 72-74, 81-82, 90.
3. **Disabled state:** Check `videoId !== null` for track loaded, `bpm !== null` for BPM set, `playerReady` for player availability. Same guards as `LoopControls.tsx` and `DeckControls.tsx`.
4. **CSS module conventions:** Use CSS variables from the design system (`--space-*`, `--text-xs`, `--color-*`, `--radius-md`, `--transition-fast`, `--shadow-focus`). Match LoopControls colour palette.
5. **Component placement in Deck.tsx:** Add between existing sections. Follow the import + JSX comment pattern used for other components.
6. **Test conventions:** Use `vitest`, `describe/it/expect`. File goes in `src/test/`. No React component rendering tests needed for the utility module.

---

## Notes

- The `bpm` field is set by tap-tempo and reset to `null` on `loadTrack` and `clearTrack`. Beat jump will naturally disable when a new track is loaded until the user taps in a new BPM.
- `beatJumpSize` is intentionally NOT reset on `loadTrack` so the DJ's preferred jump size persists when switching tracks. It IS reset on `clearTrack` since that represents a full deck reset.
- The `currentTime` value used for jump calculations comes from the 250ms poll in `useYouTubePlayer`. This means there is up to 250ms of staleness, which is acceptable for beat jump (the same tradeoff applies to loop activation).
- The component reads `currentTime` from the store at the moment of the click, then issues a single `seekTo` call. There is no need to update `currentTime` in the store after seeking -- the poll will pick up the new position within 250ms.
