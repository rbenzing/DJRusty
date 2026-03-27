# STORY-DJ-004: Keyboard Shortcuts

**Status:** Ready for Development
**Complexity:** Medium
**Dependencies:** None (STORY-DJ-002 beat-jump util is optional; inline fallback specified)
**Estimated Tasks:** 3

---

## Objective

Implement all global keyboard shortcuts for the DJ application by filling in the existing `useKeyboardShortcuts` stub. The hook must be mounted once at the app root and provide keyboard control over play/pause, cue, beat jump, hot cues, and tap tempo for both decks.

## Scope

- Implement `src/hooks/useKeyboardShortcuts.ts` (replace stub)
- Mount the hook in `src/App.tsx` (add one import + one call)
- Create test file `src/test/keyboardShortcuts.test.ts`
- No new stores, services, or types required

## Out of Scope

- Beat jump size UI control (separate story)
- Crossfader keyboard control
- Volume keyboard control
- EQ keyboard control

---

## Shortcut Map (Authoritative)

| Key | Action | Deck | Store/Registry Call |
|---|---|---|---|
| `Space` | Play/Pause | A | `useDeckStore.getState().setPlaybackState('A', toggled)` |
| `Enter` | Play/Pause | B | `useDeckStore.getState().setPlaybackState('B', toggled)` |
| `q` | Jump to Cue (seek to hotCues[0]) | A | `playerRegistry.get('A')?.seekTo(cuePoint, true)` |
| `w` | Jump to Cue (seek to hotCues[0]) | B | `playerRegistry.get('B')?.seekTo(cuePoint, true)` |
| `a` | Set Cue (store currentTime as hotCues[0]) | A | `useDeckStore.getState().setHotCue('A', 0, currentTime)` + `persistSetHotCue(videoId, 0, currentTime)` |
| `s` | Set Cue (store currentTime as hotCues[0]) | B | `useDeckStore.getState().setHotCue('B', 0, currentTime)` + `persistSetHotCue(videoId, 0, currentTime)` |
| `ArrowLeft` | Beat Jump backward | A | `playerRegistry.get('A')?.seekTo(clampedTime, true)` |
| `ArrowRight` | Beat Jump forward | A | `playerRegistry.get('A')?.seekTo(clampedTime, true)` |
| `,` | Beat Jump backward | B | `playerRegistry.get('B')?.seekTo(clampedTime, true)` |
| `.` | Beat Jump forward | B | `playerRegistry.get('B')?.seekTo(clampedTime, true)` |
| `1` | Jump to Hot Cue 1 (index 0) | A | `playerRegistry.get('A')?.seekTo(hotCues[0], true)` |
| `2` | Jump to Hot Cue 2 (index 1) | A | `playerRegistry.get('A')?.seekTo(hotCues[1], true)` |
| `3` | Jump to Hot Cue 3 (index 2) | A | `playerRegistry.get('A')?.seekTo(hotCues[2], true)` |
| `4` | Jump to Hot Cue 4 (index 3) | A | `playerRegistry.get('A')?.seekTo(hotCues[3], true)` |
| `5` | Jump to Hot Cue 1 (index 0) | B | `playerRegistry.get('B')?.seekTo(hotCues[0], true)` |
| `6` | Jump to Hot Cue 2 (index 1) | B | `playerRegistry.get('B')?.seekTo(hotCues[1], true)` |
| `7` | Jump to Hot Cue 3 (index 2) | B | `playerRegistry.get('B')?.seekTo(hotCues[2], true)` |
| `8` | Jump to Hot Cue 4 (index 3) | B | `playerRegistry.get('B')?.seekTo(hotCues[3], true)` |
| `t` | Tap Tempo | A | `tapTempoA.tap()` then `useDeckStore.getState().setBpm('A', result)` |
| `y` | Tap Tempo | B | `tapTempoB.tap()` then `useDeckStore.getState().setBpm('B', result)` |

---

## Acceptance Criteria

- [ ] **AC-1:** All 20 shortcuts in the table above function correctly when pressed.
- [ ] **AC-2:** Shortcuts are suppressed when `document.activeElement` is an `<input>` or `<textarea>` element (prevents conflict with the search bar and any future text inputs).
- [ ] **AC-3:** `Space` and `Enter` default browser behavior (`preventDefault`) is called when the shortcut fires (prevents page scroll on Space and form submission on Enter).
- [ ] **AC-4:** A single `keydown` event listener is attached to `document` inside a `useEffect`, and is properly removed on unmount via the cleanup return.
- [ ] **AC-5:** Beat Jump shortcuts read `beatJumpSize` from the deck's BPM at the time of keypress. The jump distance in seconds is calculated as `(beatJumpSize / bpm) * 60`. If BPM is null, beat jump is a no-op. Default `beatJumpSize` is 4 beats.
- [ ] **AC-6:** Hot cue shortcuts (1-8) jump to the cue if it is set. If the hot cue at that index is not set, the key press is a no-op (do NOT set a hot cue via keyboard).
- [ ] **AC-7:** The hook is called exactly once in `App.tsx` at the root level.
- [ ] **AC-8:** All unit tests pass in `src/test/keyboardShortcuts.test.ts`.

---

## Task 1: Implement `useKeyboardShortcuts` Hook

**File:** `src/hooks/useKeyboardShortcuts.ts`
**Action:** Replace stub with full implementation
**Sizing:** Medium
**Complexity:** Medium

### Implementation Steps

1. **Add imports:**
   ```
   import { useEffect, useRef } from 'react';
   import { useDeckStore } from '../store/deckStore';
   import { playerRegistry } from '../services/playerRegistry';
   import { TapTempoCalculator } from '../utils/tapTempo';
   import { setHotCue as persistSetHotCue } from '../utils/hotCues';
   ```

2. **Create module-level constants:**
   - `DEFAULT_BEAT_JUMP_SIZE = 4` (beats) -- used until a dedicated beatJumpSize setting exists
   - `FOCUSABLE_TAGS = new Set(['INPUT', 'TEXTAREA'])` -- elements that suppress shortcuts

3. **Inside the hook function body, create two `useRef` for TapTempoCalculator instances:**
   - `tapTempoARef = useRef(new TapTempoCalculator())`
   - `tapTempoBRef = useRef(new TapTempoCalculator())`
   - These must persist across re-renders but not survive remounts (which is correct behavior).

4. **Single `useEffect` with `keydown` handler:**

   The handler function `handleKeyDown(event: KeyboardEvent)` must:

   a. **Guard: focus check** -- if `document.activeElement` tagName is in `FOCUSABLE_TAGS`, return immediately (do nothing).

   b. **Read current state** -- `const state = useDeckStore.getState()` to get live deck state at time of keypress. Extract `deckA = state.decks.A` and `deckB = state.decks.B`.

   c. **Switch on `event.key`:**

   - **`' '` (Space):**
     - `event.preventDefault()` (suppress scroll)
     - Toggle Deck A: if `deckA.playbackState === 'playing'` set to `'paused'`, else set to `'playing'`
     - Only act if `deckA.videoId !== null`

   - **`'Enter'`:**
     - `event.preventDefault()` (suppress form submission)
     - Toggle Deck B: same logic as Space but for Deck B
     - Only act if `deckB.videoId !== null`

   - **`'q'`:**
     - Jump to cue on Deck A: read `deckA.hotCues[0]`. If defined, `playerRegistry.get('A')?.seekTo(cuePoint, true)`. If undefined, no-op.

   - **`'w'`:**
     - Jump to cue on Deck B: same as `q` but for Deck B.

   - **`'a'`:**
     - Set cue on Deck A: if `deckA.videoId` is not null, call `state.setHotCue('A', 0, deckA.currentTime)` AND `persistSetHotCue(deckA.videoId, 0, deckA.currentTime)`.

   - **`'s'`:**
     - Set cue on Deck B: same as `a` but for Deck B.

   - **`'ArrowLeft'`:**
     - Beat Jump backward on Deck A. See beat jump logic below.

   - **`'ArrowRight'`:**
     - Beat Jump forward on Deck A.

   - **`','`:**
     - Beat Jump backward on Deck B.

   - **`'.'`:**
     - Beat Jump forward on Deck B.

   - **`'1'` through `'4'`:**
     - Hot cue jump on Deck A. Index = `Number(event.key) - 1` (so `'1'` maps to index 0, etc.)
     - Read `deckA.hotCues[index]`. If defined, `playerRegistry.get('A')?.seekTo(timestamp, true)`. If undefined, no-op.

   - **`'5'` through `'8'`:**
     - Hot cue jump on Deck B. Index = `Number(event.key) - 5` (so `'5'` maps to index 0, etc.)
     - Read `deckB.hotCues[index]`. If defined, `playerRegistry.get('B')?.seekTo(timestamp, true)`. If undefined, no-op.

   - **`'t'`:**
     - Tap tempo Deck A. Call `tapTempoARef.current.tap()`. If result is not null, `state.setBpm('A', result)`.

   - **`'y'`:**
     - Tap tempo Deck B. Call `tapTempoBRef.current.tap()`. If result is not null, `state.setBpm('B', result)`.

   d. **Attach and cleanup:**
   ```
   document.addEventListener('keydown', handleKeyDown);
   return () => document.removeEventListener('keydown', handleKeyDown);
   ```

   e. **Dependency array:** empty `[]` -- the handler reads state via `getState()` at call time, so no reactive dependencies are needed.

5. **Beat Jump calculation (inline helper):**

   ```typescript
   function beatJump(deckId: 'A' | 'B', direction: 1 | -1): void {
     const deck = useDeckStore.getState().decks[deckId];
     if (deck.bpm === null || !deck.videoId) return;
     const jumpSeconds = (DEFAULT_BEAT_JUMP_SIZE / deck.bpm) * 60;
     const newTime = deck.currentTime + direction * jumpSeconds;
     const clamped = Math.max(0, Math.min(newTime, deck.duration));
     playerRegistry.get(deckId)?.seekTo(clamped, true);
   }
   ```

   Define this inside the `useEffect` or as a nested function inside the hook. It must read state at call time (not at mount time).

### Key Design Decisions

- **Why `useDeckStore.getState()` instead of Zustand selectors?** The keydown handler must read the latest state at the moment the key is pressed. Using Zustand selectors would create stale closures. `getState()` always returns the current snapshot.
- **Why module-scoped TapTempoCalculator refs?** TapTempo needs to accumulate taps across multiple keypress events. A `useRef` preserves the calculator instance across renders without causing re-renders.
- **Why `DEFAULT_BEAT_JUMP_SIZE` as a constant?** No `beatJumpSize` field exists in any store yet. When STORY-DJ-002 adds it to `settingsStore` or `deckStore`, this constant can be replaced with a store read. The inline approach avoids a hard dependency.
- **Why persist set-cue to localStorage?** The `a`/`s` shortcuts must match the behavior of the SET CUE button in `DeckControls.tsx`, which calls both the in-memory store and `persistSetHotCue()` from `src/utils/hotCues.ts`.

### Interface Contract

```typescript
// No change to the exported signature:
export function useKeyboardShortcuts(): void
```

---

## Task 2: Mount Hook in App.tsx

**File:** `src/App.tsx`
**Action:** Add import and call
**Sizing:** Trivial
**Complexity:** Low

### Implementation Steps

1. Add import at the top of `App.tsx`:
   ```typescript
   import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
   ```

2. Call the hook inside the `App` function component, before the `return` statement and after the existing `useSearchPreload()` call (line 104):
   ```typescript
   // STORY-DJ-004: Global keyboard shortcuts for deck transport, cue, beat jump, hot cues, tap tempo.
   useKeyboardShortcuts();
   ```

3. **Do NOT add the hook inside any conditional or nested component.** It must be at the root level to ensure a single global listener.

### Verification

- The hook call should appear exactly once in the entire codebase.
- The `useEffect` inside the hook should add exactly one `keydown` listener to `document`.

---

## Task 3: Write Unit Tests

**File:** `src/test/keyboardShortcuts.test.ts` (new file)
**Action:** Create
**Sizing:** Medium
**Complexity:** Medium

### Test Setup

- Import `useDeckStore` to set up and inspect deck state.
- Import `playerRegistry` to mock/verify seek calls.
- Create a helper function to dispatch `KeyboardEvent` on `document`:
  ```typescript
  function pressKey(key: string, options?: Partial<KeyboardEvent>): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, ...options });
    document.dispatchEvent(event);
    return event;
  }
  ```
- Use `renderHook` from `@testing-library/react` to mount `useKeyboardShortcuts`.
- Before each test, reset deck store to initial state and register mock players in `playerRegistry`.

### Required Test Cases

1. **Space triggers Deck A play/pause toggle:**
   - Set Deck A videoId to a non-null value and playbackState to `'paused'`.
   - Press Space.
   - Assert `useDeckStore.getState().decks.A.playbackState === 'playing'`.
   - Press Space again.
   - Assert `useDeckStore.getState().decks.A.playbackState === 'paused'`.

2. **Enter triggers Deck B play/pause toggle:**
   - Set Deck B videoId to a non-null value and playbackState to `'paused'`.
   - Press Enter.
   - Assert `useDeckStore.getState().decks.B.playbackState === 'playing'`.

3. **Space preventDefault is called:**
   - Press Space.
   - Assert that `event.defaultPrevented === true` (or spy on `preventDefault`).

4. **Enter preventDefault is called:**
   - Press Enter.
   - Assert that `event.defaultPrevented === true`.

5. **Input focus suppresses Space shortcut:**
   - Create an `<input>` element, append to document body, and focus it.
   - Set Deck A videoId and playbackState to `'paused'`.
   - Press Space.
   - Assert Deck A playbackState is still `'paused'` (no toggle).
   - Clean up: remove the input element.

6. **Textarea focus suppresses shortcuts:**
   - Same as test 5 but with `<textarea>`.

7. **`q` jumps to cue on Deck A:**
   - Set Deck A `hotCues[0] = 42.5`.
   - Register a mock player for Deck A.
   - Press `q`.
   - Assert `mockPlayer.seekTo` was called with `(42.5, true)`.

8. **`q` is no-op when no cue is set:**
   - Deck A has empty `hotCues`.
   - Press `q`.
   - Assert `mockPlayer.seekTo` was NOT called.

9. **`a` sets cue on Deck A:**
   - Set Deck A videoId to `'abc123'` and currentTime to `30.0`.
   - Press `a`.
   - Assert `useDeckStore.getState().decks.A.hotCues[0] === 30.0`.

10. **ArrowLeft triggers beat jump backward on Deck A:**
    - Set Deck A videoId, currentTime to `60.0`, bpm to `120`, duration to `300`.
    - Register mock player for Deck A.
    - Press `ArrowLeft`.
    - Expected jump: `(4 / 120) * 60 = 2 seconds` backward. New time = `58.0`.
    - Assert `mockPlayer.seekTo` called with `(58.0, true)`.

11. **ArrowRight triggers beat jump forward on Deck A:**
    - Same setup as test 10.
    - Press `ArrowRight`.
    - Assert `mockPlayer.seekTo` called with `(62.0, true)`.

12. **Beat jump is no-op when BPM is null:**
    - Set Deck A bpm to `null`.
    - Press `ArrowLeft`.
    - Assert `mockPlayer.seekTo` was NOT called.

13. **Hot cue 1-4 maps to Deck A cues 0-3:**
    - Set `deckA.hotCues = { 0: 10, 1: 20, 2: 30, 3: 40 }`.
    - Register mock player.
    - Press `1`. Assert seekTo called with `(10, true)`.
    - Press `2`. Assert seekTo called with `(20, true)`.
    - Press `3`. Assert seekTo called with `(30, true)`.
    - Press `4`. Assert seekTo called with `(40, true)`.

14. **Hot cue 5-8 maps to Deck B cues 0-3:**
    - Set `deckB.hotCues = { 0: 15, 1: 25, 2: 35, 3: 45 }`.
    - Register mock player for Deck B.
    - Press `5`. Assert seekTo called with `(15, true)`.
    - Press `8`. Assert seekTo called with `(45, true)`.

15. **Hot cue shortcut is no-op if cue not set:**
    - Deck A has `hotCues = { 0: 10 }` (only cue 0).
    - Press `2`. Assert seekTo NOT called (index 1 not set).

16. **`t` triggers tap tempo on Deck A:**
    - Press `t` twice rapidly.
    - Assert `useDeckStore.getState().decks.A.bpm` is a number (not null).

17. **Beat jump clamps to 0 and duration:**
    - Set Deck A currentTime to `1.0`, bpm to `120`, duration to `300`.
    - Press `ArrowLeft`.
    - Expected: `1.0 - 2.0 = -1.0`, clamped to `0`. Assert seekTo called with `(0, true)`.

18. **Play/pause no-op when no track loaded:**
    - Deck A videoId is `null`.
    - Press Space.
    - Assert playbackState unchanged (still `'unstarted'`).

19. **Cleanup on unmount:**
    - Unmount the hook (via `renderHook` `unmount()`).
    - Press Space.
    - Assert no state change occurred (listener was removed).

### Test File Structure

```
describe('useKeyboardShortcuts', () => {
  // Setup: renderHook, register mock players, reset stores
  // Teardown: unmount hook, unregister players, remove DOM elements

  describe('Play/Pause', () => { ... tests 1-4, 18 })
  describe('Focus Guard', () => { ... tests 5-6 })
  describe('Cue Controls', () => { ... tests 7-9 })
  describe('Beat Jump', () => { ... tests 10-12, 17 })
  describe('Hot Cues', () => { ... tests 13-15 })
  describe('Tap Tempo', () => { ... test 16 })
  describe('Cleanup', () => { ... test 19 })
})
```

---

## Files to Create/Modify

| File | Action | Description |
|---|---|---|
| `src/hooks/useKeyboardShortcuts.ts` | **Modify** | Replace 12-line stub with full implementation (~90-120 lines) |
| `src/App.tsx` | **Modify** | Add import + one hook call (2 lines) |
| `src/test/keyboardShortcuts.test.ts` | **Create** | 19 test cases covering all shortcuts, guards, and edge cases |

---

## Dependencies and Integration Points

### Imports Required by `useKeyboardShortcuts.ts`

| Import | Source | Purpose |
|---|---|---|
| `useEffect`, `useRef` | `react` | Hook lifecycle and persistent refs |
| `useDeckStore` | `../store/deckStore` | Read deck state, dispatch play/pause/setBpm/setHotCue |
| `playerRegistry` | `../services/playerRegistry` | Imperative seekTo calls for cue, beat jump, hot cues |
| `TapTempoCalculator` | `../utils/tapTempo` | BPM calculation from keyboard taps |
| `setHotCue` (as `persistSetHotCue`) | `../utils/hotCues` | Persist cue points to localStorage |

### Interaction with Existing `/` Shortcut in App.tsx

`App.tsx` lines 46-56 already register a `keydown` listener for the `/` key to toggle the search drawer. This listener includes the same `INPUT`/`TEXTAREA` guard pattern. The new `useKeyboardShortcuts` hook registers a separate listener on `document`. Both listeners will fire on each keypress; there is no conflict because they handle different keys. No changes to the existing `/` handler are needed.

### Interaction with `useYouTubePlayer` Subscriptions

The keyboard shortcuts dispatch state changes to `useDeckStore` (for play/pause) and call `playerRegistry.get(deckId)?.seekTo()` (for cue/beat jump/hot cues). The `useYouTubePlayer` hook subscribes to `playbackState` changes and translates them into `playVideo()`/`pauseVideo()` IFrame API calls. This existing subscription pattern means the keyboard shortcut hook does NOT need direct access to `YT.Player` instances for play/pause -- it only needs to update the store. For seek operations, it uses `playerRegistry` which is the established pattern (also used by `DeckControls.tsx` and `HotCues` components).

---

## Risk and Edge Cases

| Risk | Mitigation |
|---|---|
| BPM is null on beat jump | Explicitly guard: if `deck.bpm === null`, return early (no-op) |
| Beat jump seeks past track boundaries | Clamp result to `[0, deck.duration]` |
| Hot cue index not set | Check `hotCues[index] !== undefined` before seeking |
| Stale state in closure | Use `useDeckStore.getState()` inside handler (not selector) |
| Multiple listeners if hook re-mounts | `useEffect` cleanup removes the previous listener; React guarantees cleanup runs before each new effect |
| Conflict with search bar input | `FOCUSABLE_TAGS` guard ensures no shortcut fires while typing |
| Space scrolls page | `event.preventDefault()` called before dispatching action |
| Enter submits form | `event.preventDefault()` called before dispatching action |
| `beatJumpSize` not yet in store | Use `DEFAULT_BEAT_JUMP_SIZE = 4` constant; future story can replace with store read |

---

## Verification Checklist

- [ ] `useKeyboardShortcuts` is called exactly once in `App.tsx`
- [ ] Only one `keydown` listener is attached to `document` (verified by cleanup logic)
- [ ] All 20 key bindings map to correct actions (see Shortcut Map table)
- [ ] `document.activeElement` guard prevents shortcuts in INPUT/TEXTAREA
- [ ] `event.preventDefault()` called for Space and Enter
- [ ] Beat jump uses BPM at keypress time, not mount time
- [ ] Beat jump clamps to `[0, duration]`
- [ ] Hot cue keyboard shortcuts only jump (never set)
- [ ] Tap tempo uses persistent `TapTempoCalculator` instances (not recreated per keypress)
- [ ] Set Cue persists to localStorage via `persistSetHotCue`
- [ ] All 19 test cases pass
- [ ] `npm run lint` passes with no new warnings
- [ ] `npm run build` succeeds
