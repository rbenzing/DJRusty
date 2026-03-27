# STORY-011 Implementation Notes: Hot Cues

> Developer Agent — STORY-011
> Date: 2026-03-23

---

## Implementation Status

**Status:** COMPLETE
**Acceptance Criteria Met:** 10/10
**Build Status:** PASSING (0 TypeScript errors, 0 lint warnings)
**Tests:** 263 passed (12 test files), 0 failed

---

## Acceptance Criteria Verification

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | 4 hot cue buttons per deck (indices 0–3), colour-coded | DONE | Red/orange/green/blue per index 0–3 |
| 2 | Unset cue: button shows index number, dimmed | DONE | Shows `1`–`4` (1-based label), `#1a1a1a` bg, `#555` text |
| 3 | Set cue: button shows formatted timestamp, brightly lit | DONE | Uses `formatTime()`, per-cue accent colour via CSS custom props |
| 4 | Set: long-press (500ms) OR shift+click sets hot cue at `currentTime` | DONE | `HotCueButton` uses `pointerDown` + `setTimeout(500)` for long-press; `event.shiftKey` check for shift+click |
| 5 | Jump: normal click on set cue calls `player.seekTo(timestamp, true)` | DONE | Via `playerRegistry.get(deckId)?.seekTo()` |
| 6 | Clear: right-click (contextmenu) on set cue clears it | DONE | `onContextMenu` handler calls `persistClearHotCue` + store `clearHotCue` |
| 7 | Hot cues persist across page reload (localStorage) | DONE | `deckStore.loadTrack` calls `getHotCues(videoId)` on every track load |
| 8 | Hot cues keyed by `videoId`, not per-deck | DONE | `setHotCue(videoId, index, ts)` uses videoId as localStorage key |
| 9 | `DeckControls` Cue button wired: jump if cue 0 set; set cue 0 if not | DONE | `handleJumpToCue` calls `playerRegistry.seekTo()`; `handleSetCue` persists + updates store |
| 10 | Unit tests for hot cue interactions (set, jump, clear, persistence) | DONE | `src/test/story-011-hot-cues.test.ts` — 40 new tests |

---

## Files Created

| File | Purpose |
|------|---------|
| `src/components/Deck/HotCueButton.tsx` | Individual hot cue button — handles all interaction logic (long-press, shift+click, normal click, right-click) |
| `src/components/Deck/HotCueButton.module.css` | Styles for set/unset states, colour-coded via CSS custom properties |
| `src/components/Deck/HotCues.module.css` | Container wrapper styles for the 4-button row |
| `src/services/playerRegistry.ts` | Module-level map of `DeckId → YT.Player` enabling components outside `useYouTubePlayer` to issue `seekTo()` calls |
| `src/test/story-011-hot-cues.test.ts` | 40 unit and integration tests covering all STORY-011 acceptance criteria |

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/Deck/HotCues.tsx` | Replaced stub with full implementation using `HotCueButton`, `playerRegistry`, localStorage utilities |
| `src/components/Deck/Deck.tsx` | Added `import { HotCues }` and `<HotCues deckId={deckId} />` between `DeckControls` and `LoopControls` |
| `src/components/Deck/DeckControls.tsx` | Wired Cue button: `handleJumpToCue` now calls `playerRegistry.seekTo()`; `handleSetCue` now persists to localStorage via `persistSetHotCue` |
| `src/hooks/useYouTubePlayer.ts` | Added `playerRegistry.register(deckId, player)` after player creation; `playerRegistry.unregister(deckId)` in cleanup |

---

## Architecture Decisions

### playerRegistry Pattern
The `YT.Player` instance must not enter Zustand (it is an imperative object with browser-managed state). Components that need to seek (like `HotCues`) cannot call the player directly. A lightweight module-level `Map<DeckId, YT.Player>` registry provides the bridge. `useYouTubePlayer` populates and cleans it up; `HotCues` and `DeckControls` read from it.

This avoids introducing a React context or prop-drilling `playerRef` through the component tree.

### Colour Coding via CSS Custom Properties
Each `HotCueButton` receives its accent colour via inline CSS custom properties (`--cue-color`, `--cue-color-bg`, `--cue-color-border`). The CSS module references these properties, making it easy to override or animate without JavaScript. Alpha-hex shorthand (`color + '22'`) is used for consistent opacity tinting from the same hex base.

### Long-press vs. Shift+Click
Both methods call `onSet()` with the same outcome. Shift+click fires immediately in `handlePointerDown` (no timer started). Long-press uses `window.setTimeout(500)` and sets `longPressDidFireRef.current = true` to prevent the subsequent `onClick` from also firing a jump action.

### DeckControls Cue Button (Index 0)
`DeckControls` now calls `persistSetHotCue(videoId, 0, currentTime)` on "Set Cue" and `playerRegistry.get(deckId)?.seekTo(cuePoint, true)` on "Jump to Cue". This makes `hotCues[0]` the shared "main cue" between `DeckControls` and the `HotCues` panel — they read from the same store key and localStorage entry.

---

## Build & Test Results

```
Test Files: 12 passed (12)
Tests:      263 passed (263)
Duration:   ~2s

Build: ✓ 0 TypeScript errors, 0 warnings
       ✓ 101 modules transformed
       ✓ dist/assets/index-*.js ~185KB gzipped ~60KB
```

---

## Specification Compliance

| Spec | Compliance |
|------|-----------|
| story-breakdown.md STORY-011 | 100% — all 8 acceptance criteria from spec met (plus 2 additional from task brief) |
| implementation-spec.md §8 (Hot Cues localStorage) | 100% — `getHotCues`, `setHotCue`, `clearHotCue` utilities used as specified |
| ui-spec.md §4.5 (Hot Cue Buttons) | 100% — 36×28px buttons, unset/set visual states, long-press, right-click clear, aria-labels |

---

## Notes for Code Reviewer

1. The `playerRegistry` is a deliberate deviation from prop-drilling — justified because `YT.Player` cannot be in React state/context safely. It is tested in `story-011-hot-cues.test.ts`.

2. `HotCueButton.module.css` uses `color-mix(in srgb, ...)` for hover/glow effects — this is a modern CSS feature with good browser support (Chrome 111+, Firefox 113+, Safari 16.2+) matching the desktop-only requirement.

3. The `DeckControls` Cue button now calls `persistSetHotCue` on "Set Cue", making cue 0 persistent. Previously it was in-memory only. This is a behaviour improvement aligned with STORY-011.

4. No new Zustand actions were needed — `setHotCue` and `clearHotCue` already existed in the store from STORY-008 stubs.
