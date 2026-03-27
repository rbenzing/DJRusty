# Code Review Report — STORY-011: Hot Cues

**Project**: dj-rusty
**Reviewer**: Code Reviewer Agent
**Date**: 2026-03-23
**Story**: STORY-011 — Hot Cues
**Review Scope**: HotCueButton.tsx, HotCueButton.module.css, HotCues.tsx, HotCues.module.css, DeckControls.tsx, useYouTubePlayer.ts, playerRegistry.ts, deckStore.ts, story-011-hot-cues.test.ts, Deck.tsx

---

## Overall Assessment

**Status**: APPROVED
**Acceptance Criteria Met**: 10/10 (100%)
**Specification Compliance**: 100%
**Decision**: APPROVE — proceed to Tester

**Summary**: All ten STORY-011 acceptance criteria are fully and correctly implemented. The playerRegistry pattern is sound and correctly keeps YT.Player outside of Zustand. Long-press timers are cleaned up on all required events and on unmount. The right-click handler calls `e.preventDefault()`. localStorage operations are correctly isolated by videoId. Cue operations are guarded against null videoId. The test suite is comprehensive (40 dedicated tests plus a pre-existing hot-cues utility test file with 24 additional tests). No security issues, no memory leaks, no anti-patterns detected.

---

## Strict Validation Checklist

### Specification Compliance

| Requirement | Status | Notes |
|---|---|---|
| 4 hot cue buttons per deck (indices 0–3) | [x] | `HOT_CUE_COUNT = 4`, `Array.from({ length: 4 })` renders all four |
| Colour-coded per index | [x] | `HOT_CUE_COLORS` array: red, orange, green, blue (index 0–3) |
| Unset: shows index number, dimmed | [x] | Label = `String(index + 1)`, class `hotCueBtnUnset` with `#1a1a1a`/`#555` |
| Set: shows formatted timestamp, brightly lit | [x] | `formatTime(timestamp)`, accent colour via CSS custom properties |
| Set via long-press (500ms) | [x] | `window.setTimeout(500)` in `handlePointerDown` |
| Set via shift+click | [x] | `event.shiftKey` check calls `onSet()` immediately |
| Jump: normal click on set cue calls `player.seekTo(timestamp, true)` | [x] | `handleJump` → `playerRegistry.get(deckId)?.seekTo(timestamp, true)` |
| Clear: right-click (contextmenu) on set cue | [x] | `handleContextMenu` calls `e.preventDefault()` then `onClear()` |
| Clear removes from state + localStorage | [x] | `persistClearHotCue(videoId, index)` + `clearHotCue(deckId, index)` |
| Persist across reload via localStorage | [x] | `setHotCue` utility writes on every set; `loadTrack` reads via `getHotCues` |
| Keyed by videoId, not deckId | [x] | All localStorage ops use `videoId` as key |
| DeckControls Cue button functional | [x] | `handleSetCue` persists to localStorage; `handleJumpToCue` uses `playerRegistry` |
| No cue operations when videoId is null | [x] | `hasTrack = videoId !== null`; buttons disabled + `handleSet`/`handleClear` guard with `if (!videoId) return` |
| Unit tests for set, jump, clear, persistence | [x] | 40 tests in story-011-hot-cues.test.ts cover all four operations |

### Implementation Spec §8 Compliance

| Item | Status | Notes |
|---|---|---|
| `STORAGE_KEY = 'dj-rusty-hot-cues'` | [x] | Consistent across utility and tests |
| `HotCueMap` interface with `[videoId][cueIndex] → timestamp` | [x] | Correctly typed in `hotCues.ts` |
| `getHotCues(videoId)` returns `Record<number, number>` | [x] | Returns `{}` for unknown videos, handles malformed JSON |
| `setHotCue(videoId, index, timestamp)` merges correctly | [x] | Spread-merge preserves existing cues at other indices |
| `clearHotCue` not in spec §8 but correctly implemented | [x] | Safe implementation with try/catch |

### Architecture Compliance

| Concern | Status | Notes |
|---|---|---|
| `YT.Player` never in Zustand state | [x] | Stays in `useRef` inside `useYouTubePlayer`; registry holds reference only |
| `playerRegistry` not serialisable Zustand state | [x] | Module-level `Map` outside React, not stored in any store |
| `deckStore.hotCues` is plain serialisable data | [x] | `Record<number, number>` — JSON-safe |

### Code Quality

| Check | Status | Notes |
|---|---|---|
| Readability | [x] | All files are well-commented with JSDoc blocks explaining the design intent |
| Naming conventions | [x] | Consistent camelCase, descriptive function names (`handlePointerDown`, `cancelPressTimer`) |
| Function size | [x] | All functions are small and single-responsibility |
| Code duplication | [x] | None; `formatCueTime` in DeckControls is a private local function intentionally separate from `formatTime` utility (minor, see Findings) |
| Separation of concerns | [x] | Persistence in utility, state in store, imperative commands in registry |
| TypeScript strict types | [x] | No `any` except the documented `mute: 1 as any` with comment justification |

### Best Practices

| Check | Status | Notes |
|---|---|---|
| React hooks rules | [x] | No conditional hook calls |
| Event handler cleanup | [x] | `pointerup` and `pointerleave` both call `cancelPressTimer`; unmount effect calls `stopCurrentTimePoll` + `unregister` |
| No memory leaks | [x] | Long-press `setTimeout` cleared in `handlePointerUp`, `handlePointerLeave`, and `cancelPressTimer`; component does not `useEffect` for timer so no additional cleanup needed |
| Pointer events over mouse events | [x] | `onPointerDown/Up/Leave` used correctly, enabling touch support |
| Optional chaining on registry lookups | [x] | `playerRegistry.get(deckId)?.seekTo(...)` — safe when player not yet ready |

### Security

| Check | Status | Notes |
|---|---|---|
| No user input rendered as HTML | [x] | Labels are computed values: `String(index + 1)` or `formatTime(timestamp)` — no `dangerouslySetInnerHTML` |
| No sensitive data exposed | [x] | localStorage only stores numeric timestamps and video IDs |
| localStorage key is static | [x] | `'dj-rusty-hot-cues'` — no dynamic key injection from user input |
| `e.preventDefault()` on contextmenu | [x] | Present at line 121 of HotCueButton.tsx |
| Error information leakage | [x] | No error details leaked; catch blocks in `hotCues.ts` are silent |

### Testing

| Check | Status | Notes |
|---|---|---|
| Unit tests present | [x] | 40 tests in story-011-hot-cues.test.ts; 24 more in hot-cues.test.ts (utility) |
| Coverage estimate | [x] | All logical paths covered: set/jump/clear/persist/reload/keyed-by-videoId/long-press timer/playerRegistry ops |
| Edge cases | [x] | Malformed JSON, missing videoId, no player registered, overwriting existing cue, clearing non-existent index, quota exceeded |
| Test naming | [x] | Descriptive `it('...')` strings in `describe` groups per criterion |
| Assertions meaningful | [x] | Tests verify concrete values and absence of values, not just that functions don't throw |
| `beforeEach` isolation | [x] | `localStorage.clear()` + `resetDeckStore()` ensures test independence |

### Performance

| Check | Status | Notes |
|---|---|---|
| No unnecessary re-renders | [x] | `useDeck(deckId)` selector is scoped to the specific deck slice |
| Timer cleanup | [x] | Long-press uses `window.setTimeout`, cleaned up correctly |
| localStorage reads minimal | [x] | Only on `loadTrack` (track load) and on every `setHotCue`/`clearHotCue` — not polled |

---

## Detailed Findings

### Minor Issues

**MINOR-001 — `formatCueTime` duplicates `formatTime` utility**

- File: `src/components/Deck/DeckControls.tsx`, lines 110–115
- Severity: Minor
- Category: Code Duplication
- Problem: `formatCueTime` in DeckControls is a local private function that is functionally identical to the exported `formatTime` utility in `src/utils/formatTime.ts`. The `HotCueButton` already imports and uses `formatTime` directly.
- Current code: Private `formatCueTime(seconds)` function at the bottom of `DeckControls.tsx`
- Recommendation: Replace `formatCueTime` with an import of `formatTime` from `../../utils/formatTime` to eliminate the duplication.
- Rationale: DRY principle; if `formatTime` display logic changes, DeckControls will diverge silently.
- Blocking: No — this is cosmetic and does not affect correctness or the acceptance criteria.

---

## Positive Highlights

1. **playerRegistry pattern is well-justified and safely implemented.** The architecture decision note in the implementation notes correctly articulates why `YT.Player` cannot enter Zustand. The `Map<DeckId, YT.Player>` module-level registry is the simplest correct solution, registered on player creation and unregistered in the cleanup function.

2. **Long-press interaction is correctly guarded on all three exit paths.** `handlePointerUp`, `handlePointerLeave`, and the `longPressDidFireRef` guard on `handleClick` together correctly prevent: the long-press firing after the pointer leaves, the click handler firing a jump after a long-press set, and shift+click triggering both the immediate set and later a jump.

3. **localStorage utilities are robustly implemented.** The `try/catch` pattern in `hotCues.ts` handles both malformed JSON and `QuotaExceededError` gracefully without crashing the application. The test suite even tests the quota-exceeded path.

4. **`DeckControls` cue button shares state with the hot cue panel correctly.** By using `hotCues[0]` as the shared "main cue", both the DeckControls Cue button and the first HotCueButton always read from and write to the same slot. This is a clean integration without any special-casing.

5. **Aria labels are thorough and instructional.** Each button's `aria-label` and `title` include the action instructions (right-click to clear, shift+click or hold to set), making the interaction model discoverable to assistive technology users and via tooltip.

6. **CSS custom property approach for colour coding is elegant.** Injecting `--cue-color` per button enables a single CSS class to handle all four colour variants without four separate modifier classes. The `color-mix()` usage for hover/glow is appropriate for the desktop-only requirement and the browser support range is documented in the implementation notes.

---

## File-by-File Review

| File | Status | Notes |
|---|---|---|
| `src/components/Deck/HotCueButton.tsx` | APPROVED | Complete, clean, well-documented interaction contract |
| `src/components/Deck/HotCueButton.module.css` | APPROVED | Matches ui-spec.md §4.5 dimensions and states |
| `src/components/Deck/HotCues.tsx` | APPROVED | Clean delegation to HotCueButton, correct guard on null videoId |
| `src/components/Deck/HotCues.module.css` | APPROVED | Minimal, correct layout |
| `src/components/Deck/DeckControls.tsx` | APPROVED | Cue wiring correct; minor `formatCueTime` duplication noted |
| `src/hooks/useYouTubePlayer.ts` | APPROVED | `playerRegistry.register` after player creation, `unregister` in cleanup |
| `src/services/playerRegistry.ts` | APPROVED | Simple, correct, no YT.Player in React state |
| `src/store/deckStore.ts` | APPROVED | `setHotCue`/`clearHotCue` immutable updates, `loadTrack` calls `getHotCues` |
| `src/utils/hotCues.ts` | APPROVED | try/catch on all localStorage ops, correct merge strategy |
| `src/test/story-011-hot-cues.test.ts` | APPROVED | 40 tests, good coverage, proper isolation |
| `src/test/hot-cues.test.ts` | APPROVED | 24 utility-level tests including error paths |
| `src/components/Deck/Deck.tsx` | APPROVED | `<HotCues deckId={deckId} />` placed correctly between DeckControls and LoopControls |

---

## Acceptance Criteria Verification

| # | Criterion | Verified | Implementation Location |
|---|---|---|---|
| 1 | 4 hot cue buttons per deck (indices 0–3), colour-coded | [x] | `HotCues.tsx` + `HOT_CUE_COLORS` in `HotCueButton.tsx` |
| 2 | Unset: shows index number, dimmed | [x] | `label = String(index + 1)`, class `hotCueBtnUnset` |
| 3 | Set: shows formatted timestamp, brightly lit | [x] | `label = formatTime(timestamp)`, class `hotCueBtnSet` with accent vars |
| 4 | Set via long-press (500ms) OR shift+click | [x] | `handlePointerDown` in `HotCueButton.tsx` |
| 5 | Jump: normal click on set cue calls `seekTo(timestamp, true)` | [x] | `handleJump` in `HotCues.tsx` via `playerRegistry` |
| 6 | Clear: right-click removes from state + localStorage | [x] | `handleContextMenu` in `HotCueButton.tsx` + `handleClear` in `HotCues.tsx` |
| 7 | Persist across reload (localStorage + loaded in `loadTrack`) | [x] | `hotCues.ts` utilities + `deckStore.loadTrack` calls `getHotCues(videoId)` |
| 8 | Per-video keying (by `videoId`) | [x] | All localStorage ops use `videoId` as outer key |
| 9 | DeckControls Cue button functional (jump/set cue 0) | [x] | `handleSetCue` + `handleJumpToCue` in `DeckControls.tsx` |
| 10 | Unit tests for set, jump, clear, persistence | [x] | `story-011-hot-cues.test.ts` (40 tests), `hot-cues.test.ts` (24 tests) |

---

## Recommendations

### Immediate (before this story is closed)
- None — no blocking issues found.

### Future Improvements (non-blocking, for backlog consideration)
- STORY-014 keyboard shortcut `1`–`4` for hot cues will require the focused-deck concept. The `HotCues`/`HotCueButton` component architecture already supports this cleanly — no changes to the hot cue components will be needed.
- The `formatCueTime` duplication in `DeckControls.tsx` should be cleaned up in STORY-014's polish pass.
- If `prefers-reduced-motion` is applied in STORY-014, consider whether the glow box-shadow transition on `.hotCueBtnSet` should be suppressed.

---

## Metrics

| Metric | Value |
|---|---|
| Files reviewed | 12 |
| Critical issues | 0 |
| Major issues | 0 |
| Minor issues | 1 (formatCueTime duplication) |
| Dedicated STORY-011 tests | 40 |
| Utility-level hot cue tests | 24 |
| Estimated review time | 45 minutes |
| Build status (per developer notes) | PASSING — 0 TypeScript errors, 0 lint warnings |
| All tests passing (per developer notes) | 263 tests, 0 failures |
