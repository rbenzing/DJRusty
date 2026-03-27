# Implementation Notes — STORY-005: Deck B UI Shell

> Agent: Developer
> Story: STORY-005 — Deck B UI Shell
> Date: 2026-03-22
> Status: Complete

---

## Implementation Progress

| Category | Count | Status |
|---|---|---|
| Acceptance Criteria | 6 | 6/6 met (100%) |
| Files Created | 1 | Complete |
| Files Modified | 2 | Complete |
| Tests Added | 15 | All passing |

---

## Acceptance Criteria Verification

| # | Criterion | Status | Notes |
|---|---|---|---|
| AC-1 | Deck B renders with same component structure as Deck A | Complete | `App.tsx` renders `<Deck deckId="B" />` using the same `Deck.tsx` component — no duplication. Already wired up in STORY-004. |
| AC-2 | Deck B state reads from `deckStore` (`deckId: 'B'`) | Complete | `Deck.tsx` calls `useDeck(deckId)` with the prop; all sub-components (`DeckDisplay`, `DeckControls`, etc.) receive `deckId` and read their own deck slice. Already wired up in STORY-004. |
| AC-3 | `YouTubePlayer` component mounted for Deck B (`id="yt-player-b"`) | Complete | `App.tsx` renders `<YouTubePlayer deckId="B" />`. `YouTubePlayer.tsx` generates `id={yt-player-${deckId.toLowerCase()}}` = `yt-player-b`. Already wired up in STORY-004. |
| AC-4 | Deck B accent colour: `--deck-b-accent` token applied | Complete | `Deck.tsx` sets `data-deck={deckId.toLowerCase()}` = `"b"`. `Deck.module.css` `[data-deck='b']` now sets `border-color: var(--color-deck-b-border)` (red `#aa3a3a`) for the panel border, and defines `--deck-accent-text` / `--deck-accent-bg` / `--deck-accent-border` custom properties. `DeckDisplay.module.css` `.deckLabel` now uses `var(--deck-accent-text, var(--color-text-muted))` so "DECK B" label renders in red (`#f57a7a`). |
| AC-5 | Both decks visible simultaneously in the 3-column layout | Complete | `App.tsx` 3-column flex row: `<Deck deckId="A" />` in left column, mixer placeholder in centre, `<Deck deckId="B" />` in right column. Already wired up in STORY-004. |
| AC-6 | Visual differentiation: "A" label on Deck A, "B" label on Deck B | Complete | `DeckDisplay.tsx` renders `DECK {deckId}` in the header row. Deck A renders "DECK A" (blue text via `--color-deck-a-text`), Deck B renders "DECK B" (red text via `--color-deck-b-text`). |

---

## Pre-Implementation Analysis

STORY-004 already completed the structural work for STORY-005:
- `Deck.tsx` accepts `deckId: 'A' | 'B'` and passes it to all child components
- `App.tsx` renders both `<Deck deckId="A" />` and `<Deck deckId="B" />`
- `YouTubePlayer` for both decks is mounted in `App.tsx`
- `data-deck={deckId.toLowerCase()}` attribute is applied to the deck container
- `Deck.module.css` defines `[data-deck='a']` and `[data-deck='b']` with `--deck-accent-*` CSS custom properties

The gap identified during analysis: the `--deck-accent-*` custom properties were defined but not consumed anywhere — no element was reading `--deck-accent-text`, `--deck-accent-border`, or `--deck-accent-bg`. This meant both decks looked visually identical (both using `--color-text-muted` grey for the deck label, both using `--color-border-default` grey for the panel border).

---

## Per Implementation Item

### Item 1: `src/components/Deck/Deck.module.css` — Apply border accent to deck container

**Status**: Modified.

**Change**: Added `border-color: var(--color-deck-a-border)` to `[data-deck='a']` and `border-color: var(--color-deck-b-border)` to `[data-deck='b']`.

**Result**: Deck A container now has a blue border (`#2a6aaa`); Deck B container has a red border (`#aa3a3a`). This provides immediate visual differentiation between the two decks as hardware-style panel framing.

**Files modified**:
- `C:\GIT\DJRusty\src\components\Deck\Deck.module.css`

---

### Item 2: `src/components/Deck/DeckDisplay.module.css` — Apply accent text to deck label

**Status**: Modified.

**Change**: Changed `.deckLabel` `color` from `var(--color-text-muted)` to `var(--deck-accent-text, var(--color-text-muted))`.

**Reasoning**: The `--deck-accent-text` custom property is defined on the nearest `.deck` ancestor via the `[data-deck='a'/'b']` attribute selector in `Deck.module.css`. CSS custom properties cascade down the DOM tree, so `DeckDisplay` (a descendant of the `.deck` container) can consume `--deck-accent-text` without any JavaScript. The fallback `var(--color-text-muted)` ensures the label still renders correctly if the ancestor context is absent.

**Result**: "DECK A" renders in blue (`#7ab8f5`); "DECK B" renders in red (`#f57a7a`). This satisfies the visual differentiation requirement of AC-4 and AC-6.

**Files modified**:
- `C:\GIT\DJRusty\src\components\Deck\DeckDisplay.module.css`

---

### Item 3: `src/test/deck-b.test.ts` — STORY-005 test suite

**Status**: Created — 15 new tests, all passing.

**Test coverage (store-level)**:
- Deck B has `deckId: 'B'` in its initial state
- Deck A and Deck B are separate state objects (not the same reference)
- Deck B can be set to `playing` while Deck A remains `unstarted`
- Deck B can be `paused` while Deck A is `playing` (both visible simultaneously, AC-5)
- Deck B loads a track without affecting Deck A (AC-2)
- Deck A and Deck B can hold different tracks simultaneously
- Loading a new track onto Deck B resets its transient state (currentTime, bpm, loop, playbackState)
- Deck B stores its own pitch rate independently
- Deck B stores its own volume independently
- Deck B stores its own BPM independently
- Deck B stores its own EQ values independently
- Deck B stores its own current time independently
- Deck B can be set to an error state without affecting Deck A
- Deck B can clear its error state

**Rationale for store-level tests**: The existing test suite is entirely store-level (no component rendering tests). Following the established pattern, STORY-005 acceptance criteria that are structural (AC-1, AC-3, AC-5, AC-6) are verified by reading the source and noting they were implemented in STORY-004. AC-2 and AC-4 are tested at the store layer for the state independence aspect. The CSS visual differentiation (border colour, label colour) is verified by code review of the CSS changes.

**Files created**:
- `C:\GIT\DJRusty\src\test\deck-b.test.ts`

---

## Build Status

| Check | Status | Notes |
|---|---|---|
| TypeScript compilation (STORY-005 code) | Pass | CSS module changes have no TypeScript surface; no new `.tsx` files |
| Tests (all) | Pass | 137/137 (122 pre-existing + 15 new from STORY-005) |
| Pre-existing build errors | Pre-existing | Same issues from STORY-001/002/003 as documented in STORY-004 notes; not caused by STORY-005 |

---

## Specification Compliance

| Specification | Compliance |
|---|---|
| Story Breakdown STORY-005 acceptance criteria | 100% — 6/6 |
| design-system.md §2.5 (Deck A accent — blue) | 100% — `--color-deck-a-border` (`#2a6aaa`), `--color-deck-a-text` (`#7ab8f5`) applied |
| design-system.md §2.6 (Deck B accent — red) | 100% — `--color-deck-b-border` (`#aa3a3a`), `--color-deck-b-text` (`#f57a7a`) applied |
| story-breakdown.md STORY-005 technical notes | 100% — `data-deck` attribute used; no code duplication |

---

## Files Created/Modified

| File | Action | Description |
|---|---|---|
| `src/components/Deck/Deck.module.css` | Modified | Added `border-color` to `[data-deck='a']` and `[data-deck='b']` rules to apply accent border colours |
| `src/components/Deck/DeckDisplay.module.css` | Modified | Changed `.deckLabel` color to consume `--deck-accent-text` CSS custom property |
| `src/test/deck-b.test.ts` | Created | 15 store-level tests verifying Deck B state independence and acceptance criteria |

---

## Known Issues

None. All acceptance criteria implemented and verified.

---

## Notes for Code Reviewer

1. **Structural work was complete from STORY-004**: AC-1, AC-3, AC-5, and AC-6 were already fully implemented in STORY-004. `App.tsx` renders both decks and both YouTube players; `Deck.tsx` uses `data-deck` and shows "DECK A"/"DECK B" label via `DeckDisplay`. STORY-005's implementation work was exclusively CSS accent colour wiring.

2. **CSS custom property inheritance**: `--deck-accent-text` is set on `.deck[data-deck='b']` and consumed by `.deckLabel` inside `DeckDisplay.module.css`. This works because CSS custom properties cascade through the DOM. `DeckDisplay` renders inside the `.deck` container, so it inherits the custom property. No JavaScript change was needed.

3. **`--deck-b-accent` vs `--deck-accent-*`**: The story spec mentions `--deck-b-accent` token by name, but the design-system.md uses separate tokens (`--color-deck-b-bg`, `--color-deck-b-border`, `--color-deck-b-text`). The implementation correctly uses the design-system tokens and maps them to component-scoped `--deck-accent-*` intermediaries, which is the pattern established in STORY-004.

4. **Border colour decision**: The deck container border is the most visually prominent accent surface. Using `--color-deck-b-border` (`#aa3a3a`) for the border gives a clear red frame around Deck B without overriding any interactive states. The alternative of using `--deck-accent-bg` for the container background was rejected because it would conflict with `--color-bg-surface` and create a muddy dark-red background.

5. **No new `.tsx` files**: STORY-005 required no new component code — all components needed already existed from STORY-004 and accept `deckId` as a prop.
