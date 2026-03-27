# STORY-DJ-003: Expand Hot Cues from 4 to 8 Per Deck

**Status:** Ready for Development
**Complexity:** Low
**Estimated Tasks:** 4
**Dependencies:** None (standalone enhancement)
**Prerequisite Stories:** STORY-011 (already complete)

---

## Objective

Expand each deck from 4 hot cue buttons to 8 hot cue buttons, adding 4 new DJ-convention colours for cues 5--8, and updating the layout to a 2-row by 4-column grid. All existing hot cue data in localStorage must be preserved without migration -- the storage format is index-keyed and already supports arbitrary numeric indices.

## Scope

- Increase the hot cue count constant from 4 to 8
- Add 4 new accent colours (indexes 4--7)
- Update the HotCues component layout from a single row to a 2x4 grid
- Update JSDoc comments and type annotations that reference "0--3" to "0--7"
- Add tests validating the expanded colour array and constant
- Ensure all existing tests pass without modification (backward compatibility)

## Out of Scope

- Keyboard shortcut bindings for cues 5--8 (future story)
- MIDI controller mapping for extended cues (future story)
- Any changes to localStorage key format or data migration

---

## Acceptance Criteria

- [ ] **AC-1:** 8 hot cue buttons render per deck (was 4)
- [ ] **AC-2:** Cues 1--4 retain their existing colours: red (#ff4444), orange (#ff9900), green (#44ff44), blue (#4488ff)
- [ ] **AC-3:** Cues 5--8 use new colours: purple (#cc44ff), pink (#ff44aa), gold (#ffcc00), white (#cccccc)
- [ ] **AC-4:** Existing localStorage hot cue data for indexes 0--3 loads correctly without any migration step
- [ ] **AC-5:** New cues at indexes 4--7 can be set, jumped to, and cleared (long-press, shift+click, right-click)
- [ ] **AC-6:** Buttons display in a 2-row by 4-column grid layout
- [ ] **AC-7:** All existing hot cue tests pass without modification (zero regressions)
- [ ] **AC-8:** New tests verify `HOT_CUE_COLORS` has exactly 8 entries and `HOT_CUE_COUNT` equals 8

---

## Task Breakdown

### Task 1: Update `HOT_CUE_COLORS` array in HotCueButton.tsx

**Sizing:** XS | **Complexity:** Trivial | **Dependencies:** None

**Description:**
Add 4 new colour entries to the `HOT_CUE_COLORS` array at indexes 4--7. The existing 4 entries at indexes 0--3 must not change.

**Implementation Steps:**

1. Open `src/components/Deck/HotCueButton.tsx`
2. Append 4 new entries to the `HOT_CUE_COLORS` array:
   - Index 4: `'#cc44ff'` (purple)
   - Index 5: `'#ff44aa'` (pink)
   - Index 6: `'#ffcc00'` (gold)
   - Index 7: `'#cccccc'` (white)
3. Update the file-level JSDoc block that currently lists "0 -> red, 1 -> orange, 2 -> green, 3 -> blue" to include all 8 entries
4. Update the inline comment on `HOT_CUE_COLORS` from "4 hot cues" to "8 hot cues"
5. Update the `HotCueButtonProps.index` JSDoc from "0-based cue index (0--3)" to "0-based cue index (0--7)"

**Files to Modify:**
- `src/components/Deck/HotCueButton.tsx` -- lines 28--34 (colour array), line 37 (interface JSDoc), lines 15--19 (file header)

**Acceptance Criteria:**
- [ ] `HOT_CUE_COLORS` array has exactly 8 entries
- [ ] Indexes 0--3 are unchanged: `#ff4444`, `#ff9900`, `#44ff44`, `#4488ff`
- [ ] Indexes 4--7 are: `#cc44ff`, `#ff44aa`, `#ffcc00`, `#cccccc`
- [ ] All JSDoc comments updated to reflect 8 cues

---

### Task 2: Update `HOT_CUE_COUNT` constant in HotCues.tsx

**Sizing:** XS | **Complexity:** Trivial | **Dependencies:** None

**Description:**
Change the `HOT_CUE_COUNT` constant from 4 to 8, and update related comments.

**Implementation Steps:**

1. Open `src/components/Deck/HotCues.tsx`
2. Change line 39: `const HOT_CUE_COUNT = 4;` to `const HOT_CUE_COUNT = 8;`
3. Update the file-level JSDoc on line 2 from "4 hot cue buttons per deck" to "8 hot cue buttons per deck"

**Files to Modify:**
- `src/components/Deck/HotCues.tsx` -- line 2 (JSDoc), line 39 (constant)

**Verification:**
The component already uses `Array.from({ length: HOT_CUE_COUNT }, ...)` on line 89, so changing the constant automatically renders 8 buttons. No other logic changes are needed -- `handleSet`, `handleJump`, and `handleClear` all accept an arbitrary numeric index.

**Acceptance Criteria:**
- [ ] `HOT_CUE_COUNT === 8`
- [ ] Component renders 8 `HotCueButton` instances per deck

---

### Task 3: Update CSS layout from single row to 2x4 grid

**Sizing:** S | **Complexity:** Low | **Dependencies:** Task 2

**Description:**
Change the `.buttons` container in `HotCues.module.css` from a single-row flex layout to a 2-row by 4-column CSS grid, so 8 buttons fit cleanly in the deck panel.

**Implementation Steps:**

1. Open `src/components/Deck/HotCues.module.css`
2. Replace the `.buttons` rule with a CSS grid layout:

```css
.buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
}
```

3. Update the file-level comment from "4 buttons labeled 1--4" to "8 buttons labeled 1--8, arranged in a 2x4 grid"

**Files to Modify:**
- `src/components/Deck/HotCues.module.css` -- `.buttons` rule (lines 27--31), file header comment (line 4)

**Acceptance Criteria:**
- [ ] Buttons render in 2 rows of 4
- [ ] Spacing between buttons is consistent (uses `--space-2` gap)
- [ ] Layout does not overflow the deck panel width

---

### Task 4: Update JSDoc references and add tests

**Sizing:** S | **Complexity:** Low | **Dependencies:** Tasks 1--3

**Description:**
Update remaining JSDoc comments across the codebase that reference "0--3" for hot cue indexes, and add new test cases validating the expanded configuration.

**Implementation Steps:**

1. **Update `src/utils/hotCues.ts`:**
   - Line 20: Change `@returns A map of cue index (0--3)` to `@returns A map of cue index (0--7)`
   - Line 37: Change `@param index - Cue index (0--3).` to `@param index - Cue index (0--7).`

2. **Update `src/types/deck.ts`:**
   - Line 65: Change `Hot cue timestamps keyed by index (0--3)` to `Hot cue timestamps keyed by index (0--7)`

3. **Add new test file `src/test/story-dj-003-8-hot-cues.test.ts`** with these test cases:

```typescript
/**
 * story-dj-003-8-hot-cues.test.ts -- STORY-DJ-003: 8 Hot Cues Per Deck.
 *
 * Validates:
 *   1. HOT_CUE_COLORS array has exactly 8 entries.
 *   2. HOT_CUE_COUNT constant equals 8.
 *   3. All 8 colour values are correct.
 *   4. Hot cue indexes 4--7 work in deckStore (set, read, clear).
 *   5. Hot cue indexes 4--7 work in localStorage utilities (set, get, clear).
 *   6. Backward compatibility: existing cues at indexes 0--3 unaffected.
 */
```

**Test cases to implement:**

| # | Test | What it validates |
|---|------|-------------------|
| 1 | `HOT_CUE_COLORS has exactly 8 entries` | Import `HOT_CUE_COLORS` from `HotCueButton`, assert `.length === 8` |
| 2 | `Original 4 colours are unchanged` | Assert indexes 0--3 match `#ff4444`, `#ff9900`, `#44ff44`, `#4488ff` |
| 3 | `New 4 colours are correct` | Assert indexes 4--7 match `#cc44ff`, `#ff44aa`, `#ffcc00`, `#cccccc` |
| 4 | `deckStore.setHotCue works for indexes 4--7` | Set cues at indexes 4, 5, 6, 7 on deck A; verify store state |
| 5 | `deckStore.clearHotCue works for indexes 4--7` | Set then clear cue at index 5; verify it is undefined; verify index 4 untouched |
| 6 | `localStorage setHotCue/getHotCues works for indexes 4--7` | Use `setHotCue` utility for index 6; read back with `getHotCues`; verify value |
| 7 | `localStorage clearHotCue works for indexes 4--7` | Set index 7, clear it, verify gone; verify index 0 untouched |
| 8 | `Backward compat: existing 0--3 cues unaffected by 4--7 operations` | Set cues 0--7, clear cue 5, verify 0--3 and 6--7 intact |

**Files to Modify:**
- `src/utils/hotCues.ts` -- JSDoc on lines 20, 37
- `src/types/deck.ts` -- JSDoc on line 65

**Files to Create:**
- `src/test/story-dj-003-8-hot-cues.test.ts`

**Acceptance Criteria:**
- [ ] All JSDoc references updated from "0--3" to "0--7"
- [ ] New test file created with all 8 test cases
- [ ] All 8 new tests pass
- [ ] All existing tests in `hot-cues.test.ts` and `story-011-hot-cues.test.ts` pass without modification

---

## Files Summary

### Files to Modify (4)

| File | Change |
|------|--------|
| `src/components/Deck/HotCueButton.tsx` | Add 4 colours to `HOT_CUE_COLORS`, update JSDoc |
| `src/components/Deck/HotCues.tsx` | Change `HOT_CUE_COUNT` from 4 to 8, update JSDoc |
| `src/components/Deck/HotCues.module.css` | Change `.buttons` from flex row to 2x4 CSS grid |
| `src/utils/hotCues.ts` | Update JSDoc index range comments |
| `src/types/deck.ts` | Update JSDoc index range comment |

### Files to Create (1)

| File | Purpose |
|------|---------|
| `src/test/story-dj-003-8-hot-cues.test.ts` | Tests for 8-cue expansion |

---

## Backward Compatibility Analysis

**Why no data migration is needed:**

The localStorage format stores hot cues as `Record<number, number>` keyed by video ID inside a `Record<string, Record<number, number>>`. The keys are numeric indexes, not a fixed-length array. The existing utilities (`getHotCues`, `setHotCue`, `clearHotCue`) already accept any numeric index -- there is no bounds checking. The deckStore's `hotCues` field is typed as `Record<number, number>`, not a fixed-length tuple.

This means:
- Existing cues at indexes 0--3 will load and display identically
- New cues at indexes 4--7 will simply be additional keys in the same object
- Users who downgrade back to 4-cue code will lose visibility of cues 5--8 but the data remains in localStorage without corruption

**No changes needed in:**
- `src/store/deckStore.ts` -- `hotCues: {}` initial state, `setHotCue`, `clearHotCue`, and `loadHotCues` all work with arbitrary indexes already
- `src/utils/hotCues.ts` -- all three functions are index-agnostic (only JSDoc updates)

---

## Implementation Order

```
Task 1 (HotCueButton colours)  ──┐
                                  ├──> Task 3 (CSS grid) ──> Task 4 (JSDoc + tests)
Task 2 (HOT_CUE_COUNT constant) ─┘
```

Tasks 1 and 2 are independent and can be done in either order. Task 3 depends on Task 2 (must have 8 buttons rendering to verify the grid). Task 4 (tests) should be done last to validate the complete change.

---

## Testing Requirements

### Existing Tests (must pass, zero modifications)

- `src/test/hot-cues.test.ts` -- 15 tests covering localStorage utilities
- `src/test/story-011-hot-cues.test.ts` -- 18 tests covering store integration, player registry, persistence

### New Tests (Task 4)

- `src/test/story-dj-003-8-hot-cues.test.ts` -- 8 tests covering expanded colours, extended indexes in store and localStorage, backward compatibility

### Manual Verification Checklist

- [ ] Load the app, verify 8 buttons appear per deck in 2 rows of 4
- [ ] Verify cues 1--4 show correct original colours when set
- [ ] Verify cues 5--8 show correct new colours when set
- [ ] Set a cue on index 5, reload the page, verify it persists
- [ ] Clear a cue on index 7 via right-click, verify it is removed
- [ ] Load a track that has existing 4-cue data, verify all 4 appear correctly

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CSS grid breaks on narrow viewports | Low | Low | Button size (36x28px) x 4 + gaps = ~160px, well within deck panel width |
| Colour contrast fails WCAG | Low | Medium | All chosen colours have sufficient contrast against dark backgrounds (#1a1a1a) |
| Existing test hardcodes "4 slots" assertion | Low | Low | Reviewed both test files -- no assertion on count. Test 8 in story-011 says "4 hot cue slots" in description only, not in assertion logic |
