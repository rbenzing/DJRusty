# STORY-DJ-005: Loop Roll & Slip Mode

## Status: READY FOR DEVELOPMENT

---

## 1. Objective

Add two professional DJ features to each deck:

1. **Loop Roll** -- a momentary (hold-to-engage) loop that, on release, seeks the playhead to where it *would* have been if the loop had never engaged. This creates a rhythmic stutter effect without losing position in the track.

2. **Slip Mode** -- a toggle that maintains an internal "shadow playhead" advancing in real time while the audible playhead is trapped in a loop. On loop exit, the deck snaps to the shadow position, creating seamless continuation.

Both features build on the existing beat-loop infrastructure (`activateLoopBeat`, `deactivateLoop`, loop-boundary enforcement in `useYouTubePlayer`).

---

## 2. Scope

### In Scope
- Slip mode state in `deckStore` and `DeckState` type
- Loop roll mode toggle and press-hold behavior on loop buttons
- New `SlipButton` component
- Modified `LoopControls` component with roll mode
- Slip-aware loop exit logic in `useYouTubePlayer`
- Unit tests for all new store state and logic
- CSS styles for new UI elements

### Out of Scope
- Slip mode interaction with hot cues (future story)
- Slip mode interaction with scratch/jog (not yet implemented)
- MIDI controller mapping
- Keyboard shortcut bindings for slip/roll (future story)

---

## 3. Dependencies

| Dependency | Status | Notes |
|---|---|---|
| Beat-synced loops (`activateLoopBeat`) | Implemented | Existing in `deckStore.ts` |
| Loop boundary enforcement (250ms poll) | Implemented | Existing in `useYouTubePlayer.ts` |
| `playerRegistry` for imperative seek | Implemented | Existing in `playerRegistry.ts` |
| BPM via tap-tempo | Implemented | Required for beat loops |

---

## 4. Technical Design

### 4.1 State Changes -- `src/types/deck.ts`

Add the following fields to the `DeckState` interface:

```typescript
/** Whether slip mode is enabled for this deck. */
slipMode: boolean;

/** The shadow playhead position (seconds) that advances in real time while slip is active. Null when slip is off or no anchor is set. */
slipPosition: number | null;

/** Wall-clock timestamp (ms) when slip tracking started. Used to compute elapsed time. */
slipStartTime: number | null;

/** Track position (seconds) when slip tracking started. Anchor for computing slipPosition. */
slipStartPosition: number | null;

/** Whether loop-roll mode is active (loop buttons act as momentary roll triggers). */
rollMode: boolean;

/** Wall-clock timestamp (ms) when the current loop roll press began. Null when no roll is in progress. */
rollStartWallClock: number | null;

/** Track position (seconds) at the moment the loop roll press began. Null when no roll is in progress. */
rollStartPosition: number | null;
```

**Default values** (all fields): `false` for booleans, `null` for nullable fields.

### 4.2 State Changes -- `src/store/deckStore.ts`

#### 4.2.1 Update `createInitialDeckState`

Add to the return object:
```
slipMode: false,
slipPosition: null,
slipStartTime: null,
slipStartPosition: null,
rollMode: false,
rollStartWallClock: null,
rollStartPosition: null,
```

#### 4.2.2 Update `loadTrack` action

Reset all new fields to defaults when a track is loaded (same as initial state). This prevents stale slip/roll state from a previous track.

#### 4.2.3 Update `clearTrack` action

Reset all new fields to defaults.

#### 4.2.4 New action: `setSlipMode`

```typescript
setSlipMode: (deckId: 'A' | 'B', enabled: boolean) => void;
```

**Behavior:**
- If `enabled === true`: set `slipMode: true`. Do NOT set `slipStartTime`/`slipStartPosition` here -- those are set when a loop or roll actually engages.
- If `enabled === false`: set `slipMode: false, slipPosition: null, slipStartTime: null, slipStartPosition: null`.

#### 4.2.5 New action: `startSlipTracking`

```typescript
startSlipTracking: (deckId: 'A' | 'B') => void;
```

**Behavior:** Only acts if `slipMode === true`. Reads current `currentTime` and sets:
- `slipStartTime: Date.now()`
- `slipStartPosition: currentTime`
- `slipPosition: currentTime`

Called internally when a loop activates while slip is on.

#### 4.2.6 New action: `updateSlipPosition`

```typescript
updateSlipPosition: (deckId: 'A' | 'B') => void;
```

**Behavior:** Computes `slipPosition = slipStartPosition + ((Date.now() - slipStartTime) / 1000) * pitchRate`. Clamps to `[0, duration]`. No-op if `slipStartTime` is null.

Called from the 250ms poll in `useYouTubePlayer`.

#### 4.2.7 New action: `setRollMode`

```typescript
setRollMode: (deckId: 'A' | 'B', enabled: boolean) => void;
```

**Behavior:** Sets `rollMode` to the given value. If disabling, also clear `rollStartWallClock` and `rollStartPosition`.

#### 4.2.8 New action: `startRoll`

```typescript
startRoll: (deckId: 'A' | 'B', beatCount: 1 | 2 | 4 | 8) => void;
```

**Behavior:**
1. Record `rollStartWallClock: Date.now()`, `rollStartPosition: currentTime`.
2. Call the existing `activateLoopBeat` logic (set loopActive, loopStart, loopEnd, loopBeatCount).
3. If `slipMode` is true, call `startSlipTracking`.

#### 4.2.9 New action: `endRoll`

```typescript
endRoll: (deckId: 'A' | 'B') => void;
```

**Behavior:**
1. If `rollStartWallClock` is null, no-op (no roll in progress).
2. Compute `elapsed = (Date.now() - rollStartWallClock) / 1000`.
3. Compute `seekTarget = rollStartPosition + elapsed * pitchRate`.
4. Clamp `seekTarget` to `[0, duration]`.
5. Clear roll state: `rollStartWallClock: null, rollStartPosition: null`.
6. Deactivate loop: `loopActive: false, loopStart: null, loopEnd: null, loopBeatCount: null`.
7. Return `seekTarget` (the action sets state; the component reads `seekTarget` or the action itself triggers the seek via playerRegistry).

**Implementation note:** Because Zustand actions cannot return values easily to the caller for imperative operations, the `endRoll` action should perform the seek directly using `playerRegistry.get(deckId)?.seekTo(seekTarget, true)`. This matches the pattern used by HotCues.

#### 4.2.10 Modify `deactivateLoop` action

Add slip-aware exit logic:
1. If `slipMode === true` and `slipPosition !== null`:
   - Seek to `slipPosition` via `playerRegistry.get(deckId)?.seekTo(slipPosition, true)`.
   - Clear slip tracking: `slipPosition: null, slipStartTime: null, slipStartPosition: null`.
2. Then proceed with existing deactivation (clear loop fields).

#### 4.2.11 DeckStoreActions interface

Add all new actions to the interface:

```typescript
setSlipMode: (deckId: 'A' | 'B', enabled: boolean) => void;
startSlipTracking: (deckId: 'A' | 'B') => void;
updateSlipPosition: (deckId: 'A' | 'B') => void;
setRollMode: (deckId: 'A' | 'B', enabled: boolean) => void;
startRoll: (deckId: 'A' | 'B', beatCount: 1 | 2 | 4 | 8) => void;
endRoll: (deckId: 'A' | 'B') => void;
```

### 4.3 Player Hook Changes -- `src/hooks/useYouTubePlayer.ts`

#### 4.3.1 Slip position update in the 250ms poll

Inside the `startCurrentTimePoll` interval callback, after the existing loop-boundary enforcement block, add:

```typescript
// Slip position tracking: advance the shadow playhead while a loop is active.
const { slipMode, slipStartTime } = useDeckStore.getState().decks[deckId];
if (slipMode && slipStartTime !== null && loopActive) {
  useDeckStore.getState().updateSlipPosition(deckId);
}
```

This is the only change to `useYouTubePlayer.ts`. No other modifications needed -- the seek-on-exit is handled inside `deactivateLoop` and `endRoll` in the store.

### 4.4 New Component -- `src/components/Deck/SlipButton.tsx`

**Purpose:** Toggle button to enable/disable slip mode on a deck.

**Props:**
```typescript
interface SlipButtonProps {
  deckId: 'A' | 'B';
}
```

**Behavior:**
- Reads `slipMode` from `useDeck(deckId)`.
- On click: calls `useDeckStore().setSlipMode(deckId, !slipMode)`.
- Visual: pill-shaped button labeled "SLIP". When active: cyan/teal accent (`background: #0a2a2a`, `border-color: #2a8a8a`, `color: #4ad4d4`). When inactive: standard muted colors matching loop buttons.
- Accessibility: `aria-pressed={slipMode}`, `aria-label="Slip mode on Deck {deckId}"`.

### 4.5 New CSS -- `src/components/Deck/SlipButton.module.css`

Style the button following the exact same conventions as `LoopControls.module.css`:
- `.slipBtn` -- base style matching `.loopBtn` dimensions (min-width 44px, height 28px).
- `.slipBtnActive` -- cyan/teal highlight: `background: #0a2a2a`, `border: 1px solid #2a8a8a`, `color: #4ad4d4`.
- Hover, focus-visible states matching the existing pattern.

### 4.6 Modified Component -- `src/components/Deck/LoopControls.tsx`

#### 4.6.1 Add ROLL mode toggle button

Add a "ROLL" toggle button after the "EXIT" button. Same styling pattern as loop buttons but with an amber/orange accent when active (`background: #2a2a0a`, `border-color: #8a8a2a`, `color: #d4d44a`).

**State:** Reads `rollMode` from `useDeck(deckId)`. On click: `useDeckStore().setRollMode(deckId, !rollMode)`.

#### 4.6.2 Modify loop button behavior when rollMode is true

When `rollMode === true`, the loop buttons change behavior:

- **On `onMouseDown` / `onTouchStart`:** Call `useDeckStore().startRoll(deckId, beatCount)`.
- **On `onMouseUp` / `onTouchEnd` / `onMouseLeave`:** Call `useDeckStore().endRoll(deckId)`.
- **On `onClick`:** No-op (suppress the existing click handler; the mousedown/mouseup handlers manage everything).

When `rollMode === false`, behavior is unchanged (existing click-to-toggle).

#### 4.6.3 Disable roll when not playing

Loop roll only works while the track is playing. When `playbackState !== 'playing'`, the roll buttons should be disabled (same visual treatment as when BPM is not set).

#### 4.6.4 Updated imports

Add `rollMode`, `playbackState` to the destructured `useDeck(deckId)` call. Add `startRoll`, `endRoll`, `setRollMode` to the destructured `useDeckStore()` call.

### 4.7 CSS Updates -- `src/components/Deck/LoopControls.module.css`

Add:
- `.rollBtn` -- base style matching `.exitBtn` structure.
- `.rollBtnActive` -- amber accent: `background: #2a2a0a`, `border-color: #8a8a2a`, `color: #d4d44a`.
- `.rollBtnActive:hover` -- slightly brighter amber.

### 4.8 Modified Component -- `src/components/Deck/Deck.tsx`

Add `SlipButton` to the deck layout. Place it between `LoopControls` and `TapTempo`:

```tsx
import { SlipButton } from './SlipButton';
// ...
<LoopControls deckId={deckId} />
<SlipButton deckId={deckId} />
<TapTempo deckId={deckId} />
```

---

## 5. Implementation Tasks

### Task 1: Extend DeckState type and store defaults
**Complexity:** Small
**Files to modify:**
- `src/types/deck.ts`
- `src/store/deckStore.ts` (createInitialDeckState, loadTrack, clearTrack)

**Steps:**
1. Add all 7 new fields to `DeckState` interface in `src/types/deck.ts` (see section 4.1).
2. Add default values in `createInitialDeckState` (see section 4.2.1).
3. Add resets in `loadTrack` action (see section 4.2.2).
4. Add resets in `clearTrack` action (see section 4.2.3).

**Acceptance criteria:**
- [ ] `DeckState` includes `slipMode`, `slipPosition`, `slipStartTime`, `slipStartPosition`, `rollMode`, `rollStartWallClock`, `rollStartPosition`
- [ ] Initial deck state has all new fields set to `false`/`null`
- [ ] `loadTrack` resets all new fields
- [ ] `clearTrack` resets all new fields
- [ ] TypeScript compiles without errors

---

### Task 2: Add slip mode store actions
**Complexity:** Medium
**Dependencies:** Task 1
**Files to modify:**
- `src/store/deckStore.ts`

**Steps:**
1. Add `setSlipMode` action (see section 4.2.4).
2. Add `startSlipTracking` action (see section 4.2.5).
3. Add `updateSlipPosition` action (see section 4.2.6).
4. Add all three to `DeckStoreActions` interface.

**Acceptance criteria:**
- [ ] `setSlipMode(deckId, true)` sets `slipMode: true` without touching slipStart fields
- [ ] `setSlipMode(deckId, false)` clears all slip fields
- [ ] `startSlipTracking` sets `slipStartTime`, `slipStartPosition`, `slipPosition` from current deck state
- [ ] `startSlipTracking` is a no-op when `slipMode === false`
- [ ] `updateSlipPosition` computes correct position using `pitchRate` and wall-clock elapsed
- [ ] `updateSlipPosition` clamps to `[0, duration]`
- [ ] `updateSlipPosition` is a no-op when `slipStartTime === null`
- [ ] TypeScript compiles without errors

---

### Task 3: Add roll mode store actions
**Complexity:** Medium
**Dependencies:** Task 1
**Files to modify:**
- `src/store/deckStore.ts`

**Steps:**
1. Add `setRollMode` action (see section 4.2.7).
2. Add `startRoll` action (see section 4.2.8).
3. Add `endRoll` action with `playerRegistry.seekTo` (see section 4.2.9).
4. Add all three to `DeckStoreActions` interface.
5. Import `playerRegistry` at the top of `deckStore.ts`.

**Acceptance criteria:**
- [ ] `setRollMode(deckId, true)` sets `rollMode: true`
- [ ] `setRollMode(deckId, false)` clears `rollMode`, `rollStartWallClock`, `rollStartPosition`
- [ ] `startRoll` records wall-clock time and current position, then activates a beat loop
- [ ] `startRoll` calls `startSlipTracking` when slip is on
- [ ] `endRoll` computes seek target from `rollStartPosition + elapsed * pitchRate`
- [ ] `endRoll` clamps seek target to `[0, duration]`
- [ ] `endRoll` calls `playerRegistry.get(deckId)?.seekTo()` with the computed target
- [ ] `endRoll` deactivates the loop and clears roll state
- [ ] `endRoll` is a no-op when `rollStartWallClock === null`
- [ ] TypeScript compiles without errors

---

### Task 4: Modify deactivateLoop for slip awareness
**Complexity:** Small
**Dependencies:** Task 2
**Files to modify:**
- `src/store/deckStore.ts`

**Steps:**
1. Modify `deactivateLoop` to check `slipMode` and `slipPosition` (see section 4.2.10).
2. If slip is active with a valid position, seek to `slipPosition` via playerRegistry before clearing loop state.
3. Clear slip tracking fields after seeking.

**Acceptance criteria:**
- [ ] When `slipMode === true` and `slipPosition !== null`, deactivateLoop seeks to slipPosition
- [ ] Slip tracking fields are cleared after the seek
- [ ] When `slipMode === false`, deactivateLoop behavior is unchanged from current implementation
- [ ] Existing loop tests still pass

---

### Task 5: Update useYouTubePlayer poll for slip tracking
**Complexity:** Small
**Dependencies:** Task 2
**Files to modify:**
- `src/hooks/useYouTubePlayer.ts`

**Steps:**
1. Inside the `startCurrentTimePoll` interval callback, after the loop-boundary enforcement block (line ~89), add slip position update logic (see section 4.3.1).

**Acceptance criteria:**
- [ ] When `slipMode === true` and `slipStartTime !== null` and `loopActive === true`, `updateSlipPosition` is called every 250ms
- [ ] When slip or loop is not active, no slip update occurs
- [ ] Existing loop enforcement behavior is unchanged
- [ ] No additional intervals or timers are created

---

### Task 6: Create SlipButton component
**Complexity:** Small
**Dependencies:** Task 2
**Files to create:**
- `src/components/Deck/SlipButton.tsx`
- `src/components/Deck/SlipButton.module.css`

**Files to modify:**
- `src/components/Deck/Deck.tsx`

**Steps:**
1. Create `SlipButton.tsx` with toggle behavior (see section 4.4).
2. Create `SlipButton.module.css` with cyan/teal active state (see section 4.5).
3. Import and render `SlipButton` in `Deck.tsx` between `LoopControls` and `TapTempo` (see section 4.8).

**Acceptance criteria:**
- [ ] SlipButton renders with text "SLIP"
- [ ] Clicking toggles `slipMode` in the store
- [ ] Button shows cyan/teal highlight when `slipMode === true`
- [ ] Button shows muted style when `slipMode === false`
- [ ] `aria-pressed` reflects current state
- [ ] `aria-label` includes deck ID
- [ ] Button appears in each deck between LoopControls and TapTempo

---

### Task 7: Add loop roll behavior to LoopControls
**Complexity:** Medium
**Dependencies:** Task 3
**Files to modify:**
- `src/components/Deck/LoopControls.tsx`
- `src/components/Deck/LoopControls.module.css`

**Steps:**
1. Add ROLL toggle button to LoopControls (see section 4.6.1).
2. Add CSS for `.rollBtn` and `.rollBtnActive` (see section 4.7).
3. Modify loop button rendering: when `rollMode === true`, attach `onMouseDown`/`onTouchStart` for `startRoll` and `onMouseUp`/`onTouchEnd`/`onMouseLeave` for `endRoll` (see section 4.6.2).
4. Disable roll buttons when `playbackState !== 'playing'` (see section 4.6.3).
5. Update destructured state and actions (see section 4.6.4).

**Acceptance criteria:**
- [ ] ROLL toggle button renders after EXIT button
- [ ] ROLL button toggles `rollMode` in store on click
- [ ] ROLL button shows amber highlight when active
- [ ] When `rollMode === true`, pressing (mousedown) a loop button starts a loop roll
- [ ] When `rollMode === true`, releasing (mouseup) a loop button ends the roll and seeks to the computed position
- [ ] `onMouseLeave` also ends an active roll (prevents stuck rolls if cursor leaves button)
- [ ] `onTouchStart`/`onTouchEnd` work for touch devices
- [ ] When `rollMode === false`, loop buttons behave as before (click to toggle)
- [ ] Roll buttons are disabled when deck is not playing
- [ ] Roll buttons are disabled when BPM is not set

---

### Task 8: Write unit tests
**Complexity:** Medium
**Dependencies:** Tasks 1-7
**Files to create:**
- `src/test/slip-mode.test.ts`

**Steps:**
1. Create test file using vitest + same patterns as `src/test/stores.test.ts`.
2. Reset deck store state in `beforeEach` including all new fields.
3. Write test cases per section 6 below.

**Acceptance criteria:**
- [ ] All tests pass
- [ ] Tests cover slip mode toggle
- [ ] Tests cover slip position computation with pitchRate
- [ ] Tests cover slip position stops when paused (no update when slipStartTime is null)
- [ ] Tests cover loop roll start/end with correct seek target
- [ ] Tests cover roll mode toggle
- [ ] Tests cover deactivateLoop with slip mode on
- [ ] Tests cover edge cases: roll with no BPM, roll when not playing, slip position clamping

---

## 6. Test Specification

### File: `src/test/slip-mode.test.ts`

```
describe('Slip Mode - Store Actions')
  it('setSlipMode(true) enables slipMode without setting start fields')
  it('setSlipMode(false) clears all slip fields')
  it('startSlipTracking sets slipStartTime and slipStartPosition from deck state')
  it('startSlipTracking is no-op when slipMode is false')
  it('updateSlipPosition computes correct position with pitchRate 1.0')
  it('updateSlipPosition computes correct position with pitchRate 0.75')
  it('updateSlipPosition clamps to [0, duration]')
  it('updateSlipPosition is no-op when slipStartTime is null')

describe('Roll Mode - Store Actions')
  it('setRollMode(true) sets rollMode')
  it('setRollMode(false) clears rollMode and roll timestamps')
  it('startRoll records wall clock and position, activates loop')
  it('startRoll triggers startSlipTracking when slipMode is on')
  it('startRoll is no-op when bpm is null')
  it('endRoll computes correct seek target from elapsed time')
  it('endRoll clamps seek target to duration')
  it('endRoll clears roll state and deactivates loop')
  it('endRoll is no-op when rollStartWallClock is null')

describe('deactivateLoop with Slip Mode')
  it('seeks to slipPosition when slipMode is on and slipPosition is set')
  it('clears slip tracking fields after seeking')
  it('behaves normally when slipMode is off')

describe('State Reset')
  it('loadTrack resets all slip and roll fields')
  it('clearTrack resets all slip and roll fields')
```

**Testing `updateSlipPosition` with time:** Use `vi.spyOn(Date, 'now')` or `vi.useFakeTimers()` to control wall-clock time for deterministic assertions.

**Testing `endRoll` seek:** Mock `playerRegistry.get()` to return an object with a jest/vitest mock `seekTo` function. Assert it is called with the correct computed position.

---

## 7. File Change Summary

| File | Action | Description |
|---|---|---|
| `src/types/deck.ts` | MODIFY | Add 7 new fields to `DeckState` |
| `src/store/deckStore.ts` | MODIFY | Add defaults, resets, 6 new actions, modify `deactivateLoop` |
| `src/hooks/useYouTubePlayer.ts` | MODIFY | Add slip position update in 250ms poll |
| `src/components/Deck/SlipButton.tsx` | CREATE | Slip mode toggle button |
| `src/components/Deck/SlipButton.module.css` | CREATE | Slip button styles |
| `src/components/Deck/LoopControls.tsx` | MODIFY | Add ROLL toggle, mousedown/mouseup roll behavior |
| `src/components/Deck/LoopControls.module.css` | MODIFY | Add `.rollBtn`, `.rollBtnActive` styles |
| `src/components/Deck/Deck.tsx` | MODIFY | Import and render `SlipButton` |
| `src/test/slip-mode.test.ts` | CREATE | Unit tests for slip mode and loop roll |

---

## 8. Implementation Order

```
Task 1 (types + defaults)
  |
  +---> Task 2 (slip actions)
  |       |
  |       +---> Task 4 (deactivateLoop slip)
  |       |
  |       +---> Task 5 (useYouTubePlayer poll)
  |       |
  |       +---> Task 6 (SlipButton component)
  |
  +---> Task 3 (roll actions)
          |
          +---> Task 7 (LoopControls roll behavior)
                  |
                  +---> Task 8 (tests -- after all code is in place)
```

Tasks 2 and 3 can be done in parallel after Task 1.
Tasks 4, 5, and 6 can be done in parallel after Task 2.
Task 7 depends only on Task 3.
Task 8 is final and depends on all other tasks.

---

## 9. Edge Cases and Considerations

1. **Roll with cursor leaving button area:** `onMouseLeave` must trigger `endRoll` to prevent a stuck roll if the user moves their mouse off the button while holding.

2. **Multiple rapid roll presses:** Each `startRoll` overwrites the previous `rollStartWallClock`. If `endRoll` is called when no roll is active (null timestamps), it is a no-op. This is safe.

3. **Slip position drift:** The slip position is computed from wall-clock elapsed time multiplied by `pitchRate`. If the user changes `pitchRate` mid-slip, the computation will use the *current* rate for the *entire* elapsed duration. This is an acceptable approximation for v1. A future enhancement could track rate-change events for segment-based computation.

4. **Slip position exceeding track duration:** Clamped to `duration`. If the track ends while in a loop with slip on, the slip position will be at `duration`.

5. **YouTube seek latency:** `player.seekTo()` is not instantaneous. There may be a brief audible glitch on roll exit. This is inherent to the YouTube IFrame API and cannot be eliminated.

6. **Touch devices:** Both `onTouchStart` and `onMouseDown` are needed. Use `event.preventDefault()` on `touchstart` to prevent the browser from also firing a synthetic `mousedown`.

7. **Roll mode + regular loop interaction:** When `rollMode` is true, the loop buttons exclusively use press-hold behavior. The user must turn off ROLL mode to return to click-to-toggle loop behavior. The EXIT button always works regardless of roll mode.

8. **playerRegistry import in deckStore:** The store currently does not import `playerRegistry`. Adding this import creates a dependency from the store to the player infrastructure. This is acceptable because HotCues already follow this pattern (imperative seek from outside the hook). The import is `import { playerRegistry } from '../services/playerRegistry';`.

---

## 10. Verification Checklist

- [ ] All 7 new fields added to `DeckState` type
- [ ] All 6 new actions added to `DeckStoreActions` interface and implemented
- [ ] `deactivateLoop` is slip-aware
- [ ] `loadTrack` and `clearTrack` reset new fields
- [ ] 250ms poll updates slip position during active slip + loop
- [ ] SlipButton component renders and toggles correctly
- [ ] LoopControls supports both click-toggle and press-hold roll modes
- [ ] ROLL toggle button rendered in LoopControls
- [ ] CSS follows existing design patterns and color conventions
- [ ] All unit tests pass
- [ ] TypeScript compiles with zero errors
- [ ] No regressions to existing loop behavior when slip/roll are off
