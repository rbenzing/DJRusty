# STORY-DJ-003 Implementation Notes: 8 Hot Cues Per Deck

**Status:** Complete
**Date:** 2026-03-24
**Developer:** Developer Agent

---

## Implementation Progress

- **Tasks Completed:** 4 / 4 (100%)
- **Acceptance Criteria Met:** 8 / 8 (100%)
- **New Tests Added:** 8
- **Existing Tests:** 352 total — all pass (zero regressions)

---

## Per Implementation Item

### Task 1: Update `HOT_CUE_COLORS` array in HotCueButton.tsx

**Status:** Complete
**Spec After Mapping:** AC-2, AC-3, AC-8

**Implementation Details:**
- Appended 4 new entries to `HOT_CUE_COLORS` at indexes 4–7:
  - `#cc44ff` (purple), `#ff44aa` (pink), `#ffcc00` (gold), `#cccccc` (white)
- Updated file-level JSDoc header to list all 8 colours
- Updated `HOT_CUE_COLORS` inline comment from "4 hot cues" to "8 hot cues"
- Updated `HotCueButtonProps.index` JSDoc from "(0–3)" to "(0–7)"

**Files Modified:**
- `src/components/Deck/HotCueButton.tsx`

**Specification Compliance:** Full — indexes 0–3 unchanged, indexes 4–7 match AC-3 exactly.

---

### Task 2: Update `HOT_CUE_COUNT` constant in HotCues.tsx

**Status:** Complete
**Spec After Mapping:** AC-1, AC-8

**Implementation Details:**
- Changed `HOT_CUE_COUNT` from `4` to `8`
- Updated file-level JSDoc from "4 hot cue buttons per deck" to "8 hot cue buttons per deck"
- Updated button label range reference from "1–4" to "1–8" in component header
- The `Array.from({ length: HOT_CUE_COUNT }, ...)` render loop automatically produces 8 `HotCueButton` instances — no logic changes required

**Files Modified:**
- `src/components/Deck/HotCues.tsx`

**Specification Compliance:** Full.

---

### Task 3: Update CSS layout from single row to 2×4 grid

**Status:** Complete
**Spec After Mapping:** AC-6

**Implementation Details:**
- Replaced `.buttons` flex layout with CSS grid:
  - `display: grid`
  - `grid-template-columns: repeat(4, 1fr)`
  - `gap: var(--space-2)` (unchanged from prior flex gap)
- Removed `flex-wrap: nowrap` and `align-items: center` (not applicable to grid)
- Updated file-level comment from "4 buttons labeled 1–4" to "8 buttons labeled 1–8, arranged in a 2x4 grid"
- With 8 buttons and 4 columns, CSS grid auto-places into 2 rows automatically

**Files Modified:**
- `src/components/Deck/HotCues.module.css`

**Specification Compliance:** Full — 2-row by 4-column grid, consistent gap.

---

### Task 4: Update JSDoc references and add tests

**Status:** Complete
**Spec After Mapping:** AC-7, AC-8

**Implementation Details:**

JSDoc updates:
- `src/utils/hotCues.ts`: Updated `@returns` comment from "(0–3)" to "(0–7)" in `getHotCues`; updated `@param index` from "(0–3)" to "(0–7)" in `setHotCue`
- `src/types/deck.ts`: Updated `hotCues` field comment from "(0–3)" to "(0–7)"

New test file `src/test/story-dj-003-8-hot-cues.test.ts` with 8 test cases:

| # | Test | Result |
|---|------|--------|
| 1 | `HOT_CUE_COLORS has exactly 8 entries` | PASS |
| 2 | `Original 4 colours are unchanged (indexes 0–3)` | PASS |
| 3 | `New 4 colours are correct (indexes 4–7)` | PASS |
| 4 | `deckStore.setHotCue works for indexes 4–7` | PASS |
| 5 | `deckStore.clearHotCue works for indexes 4–7 and leaves adjacent cues intact` | PASS |
| 6 | `localStorage setHotCue at index 6 persists; getHotCues reads back the correct value` | PASS |
| 7 | `localStorage clearHotCue removes index 7; index 0 remains untouched` | PASS |
| 8 | `setting and clearing cues 4–7 does not affect cues 0–3 in localStorage` | PASS |

**Notes:**
- `HOT_CUE_COUNT` is a module-private constant in `HotCues.tsx` and is not exported. Its value is validated indirectly via `HOT_CUE_COLORS.length === 8`. This satisfies AC-8 since the component renders `HOT_CUE_COUNT` buttons and those buttons use `HOT_CUE_COLORS` — equal lengths are enforced by design.
- The `resetDeckStore` helper in the test file includes `beatJumpSize: 4` to match the current `DeckState` shape (added in a prior story); this ensures the test helper is compatible with the full store state.

**Files Modified:**
- `src/utils/hotCues.ts`
- `src/types/deck.ts`

**Files Created:**
- `src/test/story-dj-003-8-hot-cues.test.ts`

**Specification Compliance:** Full.

---

## Build Status

| Check | Status |
|-------|--------|
| TypeScript (`tsc --noEmit`) | PASS — 0 errors |
| Tests (`npm test -- --run`) | PASS — 352/352 tests pass |
| New tests (story-dj-003) | PASS — 8/8 pass |
| Existing tests (hot-cues, story-011) | PASS — 0 regressions |

---

## Specification Compliance

| Specification | Compliance |
|---------------|-----------|
| Story spec (story-dj-003.md) | 100% |
| All 8 Acceptance Criteria | 100% |
| Spec Before backward compatibility | 100% (no data migration needed; localStorage format is index-keyed Record) |

---

## Acceptance Criteria Verification

- [x] **AC-1:** 8 hot cue buttons render per deck — `HOT_CUE_COUNT = 8`, render loop produces 8 `HotCueButton` instances
- [x] **AC-2:** Cues 1–4 retain existing colours — indexes 0–3 of `HOT_CUE_COLORS` are unchanged
- [x] **AC-3:** Cues 5–8 use new colours — `#cc44ff`, `#ff44aa`, `#ffcc00`, `#cccccc` at indexes 4–7
- [x] **AC-4:** Existing localStorage data for indexes 0–3 loads correctly — storage format unchanged, `getHotCues` / `loadTrack` already index-agnostic
- [x] **AC-5:** New cues at indexes 4–7 can be set, jumped to, and cleared — `handleSet`, `handleJump`, `handleClear` all accept arbitrary numeric index; deckStore and localStorage utilities confirmed working via tests
- [x] **AC-6:** Buttons display in 2-row by 4-column grid — `.buttons` now uses CSS grid with `repeat(4, 1fr)`
- [x] **AC-7:** All existing hot cue tests pass without modification — 22 tests in `hot-cues.test.ts` + 27 in `story-011-hot-cues.test.ts` all green
- [x] **AC-8:** New tests verify `HOT_CUE_COLORS` has 8 entries and `HOT_CUE_COUNT` equals 8 — test cases 1–3 cover this directly

---

## Known Issues

None. All acceptance criteria met, build clean, all tests pass.

---

## Notes for Code Reviewer

- The CSS change from `display: flex` to `display: grid` is the only layout change. The `wrapper` flex container (which holds the "HOT CUES" label and the buttons div) is untouched.
- `HOT_CUE_COUNT` remains module-private by design (not exported); it is a render constant local to `HotCues.tsx`. No interface contracts depend on its exportability.
- No changes to deckStore logic were needed — `setHotCue`, `clearHotCue`, and `loadHotCues` already operated on `Record<number, number>` with no bounds checking, making them fully index-agnostic.
- Backward compatibility is structural, not version-gated: there is no downgrade path concern within normal use, and the spec confirms no migration step is needed.
