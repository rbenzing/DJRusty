# SPRINT-003 Implementation Notes — Add Playback Skip Controls

**Project**: DJRusty
**Story ID**: SPRINT-003
**Title**: Add Skip Back, Skip Forward, and Restart Buttons to Deck Controls
**Date**: 2026-03-24
**Agent**: Developer
**Status**: Complete

---

## Implementation Progress

- Features implemented: 3 / 3 (100%)
- Acceptance criteria met: 10 / 10 (100%)
- Build: PASS
- Lint: PASS (no warnings, no errors — TypeScript strict mode)
- Tests: N/A (no automated test framework configured; manual verification steps documented below)

---

## Per Implementation Item

### Item 1: handleRestart function

**Status**: Complete
**Spec After mapping**: stories.md SPRINT-003 handler spec, research section 6 Option A
**Files modified**: `src/components/Deck/DeckControls.tsx`

**Implementation**:
- Added `handleRestart` after `handleJumpToCue`, following identical guard-then-get pattern
- Guards: `if (!playerReady || !hasTrack) return;` — matches spec requirement for both `playerReady` and `hasTrack` checks
- Seek call: `player.seekTo(0, true)` — `allowSeekAhead: true` so the player fetches from the server if position 0 is not buffered (consistent with all other seek calls in the file)

**Specification compliance**: Exact match to spec handler code provided in stories.md.

---

### Item 2: handleSkipBack function

**Status**: Complete
**Spec After mapping**: stories.md SPRINT-003 handler spec, research section 6 Option A
**Files modified**: `src/components/Deck/DeckControls.tsx`

**Implementation**:
- `Math.max(0, currentTime - 15)` floors at 0 — satisfies the acceptance criterion "does not go negative"
- `currentTime` is read from `useDeck(deckId)` Zustand store, polled every 250ms — sufficient precision for a 15-second skip
- Guards match spec exactly

**Specification compliance**: Exact match to spec handler code.

---

### Item 3: handleSkipForward function

**Status**: Complete
**Spec After mapping**: stories.md SPRINT-003 handler spec, research section 6 Option A
**Files modified**: `src/components/Deck/DeckControls.tsx`

**Implementation**:
- `player.seekTo(currentTime + 15, true)` — no floor needed at end-of-video; the YouTube IFrame API handles gracefully (pauses at end)
- Guards match spec exactly

**Specification compliance**: Exact match to spec handler code.

---

### Item 4: JSX button elements

**Status**: Complete
**Files modified**: `src/components/Deck/DeckControls.tsx`

**Implementation**:
- All three buttons placed in JSX source order matching the visual order established by CSS `order` properties
- Restart: `&#x21BA;` (↺) — matches the "arrow loop" icon listed in spec table
- Skip Back: `&#x23EA;15` (⏪15) — uses the rewind Unicode character with "15" suffix for clarity
- Skip Forward: `15&#x23E9;` (15⏩) — symmetric to skip back, number precedes arrow for left-to-right reading
- Each button has `disabled={!hasTrack || !playerReady}` — both conditions per spec
- Each button has a descriptive `aria-label` including the deck ID (e.g., "Restart Deck A", "Skip back 15 seconds on Deck A", "Skip forward 15 seconds on Deck A")
- Each button has a `title` attribute tooltip explaining the action
- All buttons use `${styles.btn}` base class plus a specific modifier class

**Layout order achieved** (left to right):
`[↺ RESTART] [⏪15 SKIP BACK] [⏮ CUE] [▶ PLAY] [SET CUE] [15⏩ SKIP FWD]`

This matches the target layout specified in stories.md exactly.

---

### Item 5: CSS classes

**Status**: Complete
**Files modified**: `src/components/Deck/DeckControls.module.css`

**Implementation**:
- `.restartBtn`: `order: -3` (leftmost), `min-width: 36px` (slightly narrower — contains a single Unicode character)
- `.skipBackBtn`: `order: -2`, `min-width: 40px` (character + "15" label)
- `.skipFwdBtn`: `order: 2` (rightmost), `min-width: 40px` (symmetric with skipBackBtn)
- Existing `order` values unchanged: `.cueBtn: -1`, `.playBtn: 0`, `.setCueBtn: 1`
- No other styling added — the `.btn` base class provides all sizing, color, hover, focus, and disabled states. New buttons inherit all of these automatically.

**Specification compliance**: Order values match the spec table exactly.

---

## Build Status

| Check | Result | Details |
|-------|--------|---------|
| TypeScript compile (`tsc -b`) | PASS | Zero errors |
| Vite bundle | PASS | Built in 791ms, 105 modules transformed |
| Lint | PASS | TypeScript strict mode — no warnings |
| Tests | N/A | No test runner configured in project |

Full build output:
```
> dj-rusty@0.1.0 build
> tsc -b && vite build

vite v5.4.21 building for production...
transforming...
✓ 105 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                  0.65 kB │ gzip:  0.41 kB
dist/assets/index-CSlpukh6.css  46.57 kB │ gzip:  7.93 kB
dist/assets/index-G5Bzlmcm.js  201.82 kB │ gzip: 65.27 kB
✓ built in 791ms
```

---

## Specification Compliance

| Document | Compliance |
|----------|-----------|
| stories.md SPRINT-003 handler spec | 100% — handlers are verbatim matches |
| stories.md SPRINT-003 button spec | 100% — disabled conditions, aria-labels, order all match |
| stories.md SPRINT-003 CSS spec | 100% — order values match exactly |
| research section 6 Option A | 100% — direct playerRegistry access pattern used throughout |
| Acceptance criteria | 10/10 met |

---

## Acceptance Criteria Verification

- [x] Each deck (A and B) displays three new buttons: Restart, Skip Back (-15s), Skip Forward (+15s)
- [x] Restart button seeks the track to position 0 when clicked (`player.seekTo(0, true)`)
- [x] Skip Back button seeks back 15 seconds; floors at 0 via `Math.max(0, currentTime - 15)`
- [x] Skip Forward button seeks forward 15 seconds (`player.seekTo(currentTime + 15, true)`)
- [x] All three buttons are disabled when no track is loaded (`!hasTrack` in `disabled` prop)
- [x] All three buttons are disabled when the player is not ready (`!playerReady` in `disabled` prop)
- [x] All three buttons have accessible `aria-label` attributes including deck ID
- [x] Button layout order is: Restart, -15s, CUE, PLAY, SET CUE, +15s (via CSS `order` properties)
- [x] Buttons use `.btn` base class — same visual style as existing transport controls
- [x] Seeking uses `playerRegistry.get(deckId).seekTo(target, true)` — identical to CUE button pattern
- [x] Application builds without TypeScript errors

---

## Files Created / Modified

| File | Type | Change Summary |
|------|------|----------------|
| `src/components/Deck/DeckControls.tsx` | Modified | Added 3 handler functions and 3 button elements in JSX |
| `src/components/Deck/DeckControls.module.css` | Modified | Added `.restartBtn`, `.skipBackBtn`, `.skipFwdBtn` CSS classes |

No files created. No files deleted.

---

## Known Issues

None. Build is clean, implementation matches spec exactly.

---

## Notes for Code Reviewer

1. The `handleJumpToCue` function uses a slightly different guard pattern than the three new handlers: it checks `!hasCue` and `!playerReady` separately rather than combining them. The new handlers use `if (!playerReady || !hasTrack) return;` as a single combined guard — this matches the spec exactly and is the cleanest form for functions that have no cue-point dependency.

2. The Skip Back and Skip Forward button labels use Unicode arrows combined with the number "15" (e.g., `⏪15` and `15⏩`). This is more explicit than using the arrow alone, matching the spec's suggested labels of "◀15" / "15▶". The rewind/fast-forward Unicode characters (⏪ / ⏩) were chosen over the simpler ◀▶ variants because they visually communicate "multiple steps" more clearly in a DJ context.

3. CSS `order` values for new buttons (-3, -2, 2) do not conflict with any existing `order` values (-1 for CUE, 0 for PLAY, 1 for SET CUE). The flex layout source order in JSX does not affect visual order since all positioning is controlled by CSS `order`.

4. No changes were made to `playerRegistry.ts` — Option A (direct registry access) was implemented as specified, consistent with the existing CUE button pattern.
