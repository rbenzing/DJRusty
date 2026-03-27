# STORY-012: Track Browser Enhancements — Implementation Notes

> Date: 2026-03-23
> Developer Agent: Claude Sonnet 4.6
> Story: STORY-012 — Track Browser Enhancements

---

## Implementation Progress

- **Acceptance Criteria Met**: 10/10 (100%)
- **Files Created**: 2
- **Files Modified**: 6
- **Tests Added**: 16 new unit tests (recently-played utility)
- **All existing tests**: Passing (279/279)

---

## Acceptance Criteria Verification

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | "Now Playing" indicator on search result loaded on Deck A or B | DONE | `SearchResult.tsx` reads `deckStore.decks.A.videoId` and `decks.B.videoId`; renders A/B badge when matched |
| 2 | Small "A" or "B" badge if video is loaded on that deck | DONE | `.deckBadge` / `.deckBadgeA` / `.deckBadgeB` CSS classes with colored pill badges |
| 3 | Recently played list: last 10 tracks, persisted in localStorage | DONE | `recentlyPlayed.ts` utility + "Recent" tab in `SearchPanel.tsx` |
| 4 | "Clear search" (×) button resets query and results | DONE | `SearchBar.tsx` — clear button calls `onClear` → `setQuery('')` + `clearResults()` in `SearchPanel.tsx` |
| 5 | Search bar auto-focuses on app load | DONE | `autoFocus` attribute added to `<input>` in `SearchBar.tsx` |
| 6 | Keyboard navigation: arrow keys highlight, Enter loads to Deck A | DONE | `SearchResultList.tsx` — `onKeyDown` handler tracks `highlightedIndex` state; ArrowDown/Up moves index; Enter dispatches `onLoadToDeck('A', ...)` |
| 7 | Result row hover shows full title tooltip | DONE | `title={title}` attribute on `.title` span in `SearchResult.tsx` (was already present; verified) |
| 8 | Search input debounced (submit only via Enter or button — verify) | VERIFIED | `SearchBar.tsx` only calls `onSearch` on form submit or Enter keydown — no `onChange` search trigger |
| 9 | "Copy YouTube URL" button on each result | DONE | COPY button in `SearchResult.tsx` uses `navigator.clipboard.writeText`; 2s "Copied!" feedback state |
| 10 | Unit tests for recently-played localStorage utility | DONE | `src/test/recently-played.test.ts` — 16 tests covering `getRecentTracks`, `addRecentTrack`, `clearRecentTracks`, integration |

---

## Per-Item Implementation Details

### 1. `src/utils/recentlyPlayed.ts` (Created)

- Exports `RecentTrack` interface, `addRecentTrack`, `getRecentTracks`, `clearRecentTracks`.
- `addRecentTrack` deduplicates by `videoId` (removes existing, prepends new), then slices to `MAX_RECENT = 10`.
- `localStorage` write errors (quota exceeded, security) swallowed silently — matching `hotCues.ts` pattern.
- `getRecentTracks` returns empty array on missing or corrupt localStorage data.

### 2. `src/test/recently-played.test.ts` (Created)

- 16 tests across 4 `describe` blocks: `getRecentTracks`, `addRecentTrack`, `clearRecentTracks`, integration.
- Covers: empty state, ordering, deduplication (moves to front + updates `loadedAt`), cap at 10, quota error resilience, all fields preserved, round-trip behaviour.
- Uses `localStorage.clear()` in `beforeEach` via jsdom.

### 3. `src/components/Search/SearchBar.tsx` (Modified)

- Added `onClear?: () => void` prop.
- Added `autoFocus` attribute to the `<input>` element.
- Added clear (×) button — visible only when `inputValue.length > 0 && !isDisabled`.
- Clear button calls `setInputValue('')` locally and `onClear?.()` to propagate to the store.
- Wrapped input in `.inputWrapper` div to allow absolute positioning of the clear button inside the input.

### 4. `src/components/Search/SearchBar.module.css` (Modified)

- Added `.inputWrapper` (relative, flex) to contain the input and absolute-positioned clear button.
- Added `.clearBtn` — positioned at right edge of input, amber hover, focus-visible outline.
- Added `padding-right: 32px` to `.input` to prevent text running under the clear button.

### 5. `src/components/Search/SearchResult.tsx` (Modified)

- Added `highlighted?: boolean` prop (for keyboard navigation, passed from `SearchResultList`).
- Reads `deckStore.decks.A.videoId` and `deckStore.decks.B.videoId` via `useDeckStore` selectors.
- Renders `A` and/or `B` badges conditionally when `videoId` matches each deck.
- Added `handleCopyUrl` — writes `https://youtu.be/{videoId}` to clipboard; 2s `copied` state toggles label/style.
- `title={title}` attribute already existed on the `.title` span — verified and retained.
- Applies `.rowHighlighted` class when `highlighted === true`.

### 6. `src/components/Search/SearchResult.module.css` (Modified)

- Added `.rowHighlighted` — amber outline for keyboard-highlighted row.
- Added `.deckBadge`, `.deckBadgeA`, `.deckBadgeB` — 16×16px colored pill badges.
- Added `.copyBtn`, `.copyBtnSuccess` — small copy button styles with green success state.

### 7. `src/components/Search/SearchResultList.tsx` (Modified)

- Added `highlightedIndex` state (`-1` = no highlight).
- `<ul>` is now `tabIndex={0}` and has `onKeyDown` / `onBlur` handlers.
- `onKeyDown`: ArrowDown increments index (capped at `results.length - 1`), ArrowUp decrements (floored at 0), Enter loads highlighted result to Deck A.
- `onBlur`: resets `highlightedIndex` to `-1`.
- Passes `highlighted={index === highlightedIndex}` to each `SearchResult`.

### 8. `src/components/Search/SearchResultList.module.css` (Modified)

- Added `outline: none` to `.list` to suppress the browser default focus ring on the `tabIndex={0}` list (individual row highlights take over).

### 9. `src/components/Search/SearchPanel.tsx` (Modified)

- Added `useState<ActiveTab>('search')` tab state; tab switcher rendered as `role="tablist"` with two `role="tab"` buttons.
- "Recent" tab reads `recentTracks` from state, refreshed via `getRecentTracks()` on mount, on tab switch, and on `dj-rusty:load-track` events.
- `handleClear()` added: calls `setQuery('')`, `clearResults()`, `setHasSearched(false)`.
- `onClear={handleClear}` passed to `SearchBar`.
- Recent tab renders `SearchResult` rows for each `RecentTrack` (converted via `recentTrackToSummary`).
- Removed unused `formatTime` import.

### 10. `src/components/Search/SearchPanel.module.css` (Modified)

- Added `.tabBar`, `.tab`, `.tabActive` styles for the tab switcher.
- Added `.recentTab`, `.recentList`, `.recentEmpty` styles for the Recent tab content.

### 11. `src/App.tsx` (Modified)

- Imported `addRecentTrack` from `./utils/recentlyPlayed`.
- In the `dj-rusty:load-track` event handler: calls `addRecentTrack(...)` with all track fields plus `loadedAt: Date.now()`.
- `thumbnailUrl` uses null-coalescing (`?? ''`) since deck store accepts `string | null` but `RecentTrack` requires `string`.

---

## Specification Compliance

| Spec | Compliance |
|------|-----------|
| Story breakdown STORY-012 acceptance criteria | 100% (10/10) |
| UI spec Section 6 (Track Browser) | 100% — tab bar, result rows, search bar all aligned |
| Technical notes in task description | 100% — followed exactly |

---

## Build Status

| Check | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`) | PASS — 0 errors |
| Tests (`npm test`) | PASS — 279/279 tests, 13 files |
| Lint | No lint tool configured in project |

---

## Deviations from Spec

None. All implementation follows the technical notes in the task description exactly.

---

## Notes for Code Reviewer

1. **`SearchResult` now subscribes to `deckStore`** — each row reads both deck video IDs. This is intentional; Zustand subscriptions are granular (only re-renders when those specific values change). If performance becomes an issue, a shared selector could be extracted.

2. **The "Recent" tab event listener in `SearchPanel`** also listens for `dj-rusty:load-track` to auto-refresh the recent list when a track is loaded. This is a duplicate listener alongside the one in `App.tsx`, but they serve different purposes (App.tsx = deck store update, SearchPanel = UI refresh). No state side effects.

3. **`clearRecentTracks` is exported** from the utility but not wired to any UI action in STORY-012. It is available for future use (e.g., a "Clear recent" button in the Recent tab).

4. **Auto-focus**: The `autoFocus` attribute on the search input will focus it on mount. This is appropriate for the app's primary workflow (search is the main entry point). It should not interfere with accessibility since the app loads at the top.

5. **Keyboard navigation resets on blur** — if the user clicks elsewhere and comes back, they start from no highlight again. This is standard list-navigation UX.
