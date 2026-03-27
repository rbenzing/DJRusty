# Code Review Report — STORY-012: Track Browser Enhancements

> **Project**: dj-rusty
> **Reviewer**: Code Reviewer Agent (Claude Sonnet 4.6)
> **Date**: 2026-03-23
> **Story**: STORY-012 — Track Browser Enhancements

---

## Overall Assessment

| Field | Value |
|-------|-------|
| **Status** | APPROVED |
| **Acceptance Criteria Met** | 10 / 10 (100%) |
| **Spec Compliance** | 100% |
| **Decision** | APPROVE |

All 10 acceptance criteria are fully implemented, all critical behaviours verified, no security issues found, and test coverage is comprehensive. The code is clean, well-structured, and follows established project patterns.

---

## Strict Validation Checklist

### Specification Compliance

| Item | Status | Notes |
|------|--------|-------|
| [x] AC-1: "Now Playing" A/B badge on search result loaded on a deck | PASS | `SearchResult.tsx` reads `deckStore.decks.A.videoId` and `decks.B.videoId` via granular Zustand selectors; badges rendered conditionally |
| [x] AC-2: Small "A" or "B" badge when video is loaded on that deck | PASS | `.deckBadge` / `.deckBadgeA` / `.deckBadgeB` pill badges with `aria-label` attributes |
| [x] AC-3: Recently played list — last 10 tracks, localStorage persisted | PASS | `recentlyPlayed.ts` deduplicates, prepends, slices to `MAX_RECENT = 10`; "Recent" tab in `SearchPanel` |
| [x] AC-4: Clear search (x) button resets query and results | PASS | `showClear = inputValue.length > 0 && !isDisabled`; clear button hidden when input empty or disabled |
| [x] AC-5: Search bar auto-focuses on app load | PASS | `autoFocus` attribute on `<input>` in `SearchBar.tsx` |
| [x] AC-6: Keyboard navigation — ArrowDown/Up moves highlight, Enter loads to Deck A | PASS | `SearchResultList.tsx` `onKeyDown` handler; stops at list boundaries (not wrapping) — standard UX |
| [x] AC-7: Full title tooltip on truncated result rows | PASS | `title={title}` on `.title` span in `SearchResult.tsx` |
| [x] AC-8: Search is submit-only (no auto-search on type) | PASS | `onChange` only updates `inputValue` local state; `onSearch` only fires on form submit or Enter key |
| [x] AC-9: "Copy YouTube URL" button — correct URL format, 2s feedback | PASS | Template literal `https://youtu.be/${videoId}`; 2s `copied` state; `COPY_FEEDBACK_DURATION_MS = 2000` |
| [x] AC-10: Unit tests for recently-played utility | PASS | 16 tests in `src/test/recently-played.test.ts` across 4 describe blocks |

### Critical Behaviour Verification

| Behaviour | Status | Evidence |
|-----------|--------|---------|
| [x] `addRecentTrack` deduplicates by `videoId` before prepending | PASS | `const filtered = existing.filter((t) => t.videoId !== track.videoId)` — line 40 |
| [x] `addRecentTrack` caps at 10 entries (`slice(0, MAX_RECENT)`) | PASS | `const updated = [track, ...filtered].slice(0, MAX_RECENT)` — line 41 |
| [x] `addRecentTrack` called in `App.tsx` load-track listener (not on search result click) | PASS | `App.tsx` lines 59-66 in `handleLoadTrack` — after deck store update |
| [x] `navigator.clipboard.writeText` called with correct URL format | PASS | `const url = \`https://youtu.be/${videoId}\`` — template literal, not eval |
| [x] Keyboard highlight stops at list boundaries | PASS | `Math.min(prev + 1, results.length - 1)` and `Math.max(prev - 1, 0)` |
| [x] Clear button only visible when query is non-empty | PASS | `showClear = inputValue.length > 0 && !isDisabled` — also hidden when loading |
| [x] No `dangerouslySetInnerHTML` | PASS | None present in any reviewed file |
| [x] Clipboard write uses template literal, not eval | PASS | Confirmed — template literal with `videoId` |
| [x] localStorage JSON.parse malformed JSON handled | PASS | `getRecentTracks` wraps in try/catch, returns `[]` on any error |
| [x] localStorage write errors silently swallowed | PASS | `addRecentTrack` and `clearRecentTracks` wrap `setItem`/`removeItem` in try/catch |

### Migration Validation

Not applicable — this is a new feature addition, not a migration.

### Code Quality

| Item | Status | Notes |
|------|--------|-------|
| [x] Readability and clarity | PASS | All files have clear JSDoc comments; STORY-012 additions are labelled inline |
| [x] Naming conventions | PASS | Consistent camelCase for functions/vars, PascalCase for components/types |
| [x] Function size — no oversized functions | PASS | All functions are short and single-purpose |
| [x] No code duplication | PASS | `recentTrackToSummary` adapter correctly avoids shape duplication |
| [x] Comments present and accurate | PASS | Inline `// STORY-012:` comments identify additions throughout |
| [x] Redundant `key` prop on `<li>` inside `SearchResult` | MINOR | `key={videoId}` on the `<li>` at line 55 of `SearchResult.tsx` is redundant — `key` is passed by the parent's map. React silently ignores it; no runtime impact. |

### Best Practices

| Item | Status | Notes |
|------|--------|-------|
| [x] React patterns — granular Zustand selectors | PASS | `useDeckStore((state) => state.decks.A.videoId)` — avoids over-subscription |
| [x] Controlled vs uncontrolled inputs | PASS | `SearchBar` is controlled; `inputValue` managed with `useState` |
| [x] Event cleanup | PASS | Both `useEffect` hooks in `SearchPanel` return cleanup functions removing the event listener |
| [x] `useCallback` for stable references | PASS | `refreshRecentTracks` wrapped in `useCallback` to avoid `useEffect` re-fires |
| [x] Async operations handled correctly | PASS | `performSearch` is `async`; called via `void performSearch(...)` to avoid floating promises |
| [x] Clipboard error handled gracefully | PASS | `.catch(() => { /* fail silently */ })` — appropriate for permission/HTTPS failures |
| [x] No anti-patterns | PASS | No prop drilling abuse; no direct DOM manipulation |

### Security

| Item | Status | Notes |
|------|--------|-------|
| [x] No `dangerouslySetInnerHTML` | PASS | Confirmed absent |
| [x] No exposed credentials or tokens | PASS | No secrets in any reviewed file |
| [x] Clipboard content is safe | PASS | `videoId` from YouTube API data used in template literal; not rendered as HTML |
| [x] localStorage parse is safe | PASS | try/catch around `JSON.parse`; no eval |
| [x] Input validation | PASS | Search only fires on non-empty trimmed input (`if (!trimmed) return`) |
| [x] No XSS vectors | PASS | All user-visible content rendered through React's safe text interpolation |
| [x] No SQL injection risk | PASS | No database interactions |

### Testing

| Item | Status | Notes |
|------|--------|-------|
| [x] Unit tests present for the new utility | PASS | 16 tests in `recently-played.test.ts` |
| [x] `getRecentTracks` — empty state tested | PASS | Test: "returns an empty array when localStorage has no entry" |
| [x] `getRecentTracks` — malformed JSON tested | PASS | Test: "returns an empty array when localStorage contains malformed JSON" |
| [x] `addRecentTrack` — deduplication tested | PASS | Test: "deduplicates: moves an existing track to the front instead of creating a duplicate" |
| [x] `addRecentTrack` — `loadedAt` update on duplicate tested | PASS | Test: "updates the loadedAt timestamp when a duplicate is added" |
| [x] `addRecentTrack` — cap at 10 entries tested | PASS | Tests: "caps the list at 10 entries" and "retains the most recently added tracks when the cap is reached" |
| [x] `addRecentTrack` — quota error tested | PASS | Test: "does not throw when localStorage.setItem throws (quota exceeded)" — uses `vi.spyOn` |
| [x] `addRecentTrack` — all fields preserved tested | PASS | Test: "stores all required fields on the track" |
| [x] `clearRecentTracks` — clears list tested | PASS | Test: "clears all stored tracks" |
| [x] `clearRecentTracks` — idempotency tested | PASS | Test: "does not throw when the list is already empty" |
| [x] `clearRecentTracks` — removeItem error tested | PASS | Test: "does not throw when localStorage.removeItem throws" |
| [x] Integration / round-trip tested | PASS | Dedicated `recentlyPlayed integration` describe block |
| [x] `beforeEach` clears localStorage | PASS | `localStorage.clear()` in `beforeEach` ensures test isolation |
| [x] Coverage threshold | PASS | Developer notes report 279/279 tests passing (all pre-existing plus 16 new) |

### Performance

| Item | Status | Notes |
|------|--------|-------|
| [x] Zustand subscriptions are granular | PASS | Each `SearchResult` subscribes only to the two `videoId` fields it needs |
| [x] No unnecessary re-renders | PASS | `refreshRecentTracks` is memoised with `useCallback` |
| [x] localStorage accessed only on demand | PASS | `getRecentTracks()` called on mount, tab switch, and load-track event — not on every render |
| [x] Clipboard API is non-blocking | PASS | `.then()`/`.catch()` chain — does not block the UI thread |

---

## Detailed Findings

### Minor Issues

#### M-001: Redundant `key` prop inside `SearchResult` component

- **File**: `src/components/Search/SearchResult.tsx`, line 55
- **Severity**: Minor
- **Category**: Code Quality
- **Problem**: `<li key={videoId} ...>` — the `key` prop is applied to the root element of the `SearchResult` component itself. React only reads `key` from a component's usage site in the parent's map call (already provided in `SearchResultList.tsx` and `SearchPanel.tsx`). The `key` on an element inside the component is silently ignored.
- **Impact**: None at runtime. No bug, no re-render issue.
- **Recommendation**: Remove `key={videoId}` from the `<li>` element inside `SearchResult.tsx`.

#### M-002: Tab panel ARIA bindings incomplete

- **File**: `src/components/Search/SearchPanel.tsx`, lines 163-182
- **Severity**: Minor
- **Category**: Accessibility (out of scope for STORY-012 acceptance criteria)
- **Problem**: Tab buttons have `role="tab"` and `aria-selected` correctly, but the content panels below them do not have `role="tabpanel"`, `aria-labelledby`, or `id` attributes to complete the ARIA tabs pattern. Screen readers will not associate the active panel content with the selected tab.
- **Impact**: Assistive technology users may not understand the tab-to-panel relationship.
- **Recommendation**: Add `role="tabpanel"` and `aria-labelledby` to each content container, and add `id` attributes to the tab buttons to match. This can be deferred to STORY-014 (Accessibility pass) which explicitly covers WCAG 2.1 AA compliance.

---

## Positive Highlights

1. **Clean utility design** — `recentlyPlayed.ts` is a textbook utility module: pure functions, a single well-named constant (`MAX_RECENT`), exported interface, no side effects beyond the explicit localStorage operations, and defensive error handling that matches the `hotCues.ts` project pattern.

2. **Excellent test coverage for the new utility** — The 16 tests cover every code path including error injection via `vi.spyOn`. The factory function `makeTrack` is a good pattern for reducing boilerplate. The integration test catches subtle ordering regressions.

3. **Correct event architecture** — `addRecentTrack` is called in `App.tsx`'s `handleLoadTrack` event handler (after the deck store update), not in the search result click handler. This ensures the recently-played list is updated regardless of how a track is loaded in the future.

4. **Granular Zustand selectors** — Each `SearchResult` instance subscribes only to `state.decks.A.videoId` and `state.decks.B.videoId` rather than the entire store. This is the correct pattern for avoiding unnecessary renders in a list with potentially many rows.

5. **Clear button visibility logic** — `showClear = inputValue.length > 0 && !isDisabled` correctly hides the button when the panel is disabled or loading, preventing a confusing interaction state.

6. **Keyboard navigation does not wrap** — ArrowDown at the end and ArrowUp at the beginning clamp with `Math.min`/`Math.max`. This is the expected behaviour for a list navigation pattern (wrapping is typically reserved for circular menus). The implementation is correct and deliberate.

7. **No dangerouslySetInnerHTML anywhere** — All dynamic content is rendered through React's safe interpolation. The clipboard content is a template literal with a YouTube video ID from API data, not user-entered HTML.

---

## File-by-File Review

| File | Status | Comments |
|------|--------|---------|
| `src/utils/recentlyPlayed.ts` | APPROVED | Clean, well-documented, correct deduplication and cap logic, proper error handling |
| `src/test/recently-played.test.ts` | APPROVED | Comprehensive, well-isolated, edge cases covered, quota error simulated |
| `src/components/Search/SearchBar.tsx` | APPROVED | Clear button correctly conditional; autoFocus appropriate; submit-only confirmed |
| `src/components/Search/SearchBar.module.css` | APPROVED | `padding-right: 32px` prevents text/button overlap; focus-visible outline on clear button |
| `src/components/Search/SearchResult.tsx` | APPROVED | Badges correct; copy URL correct; tooltip present; minor redundant `key` (M-001) |
| `src/components/Search/SearchResult.module.css` | APPROVED | Badge colours use design tokens; copy button success state is visually distinct |
| `src/components/Search/SearchResultList.tsx` | APPROVED | Keyboard nav correct; boundary clamping appropriate; blur resets highlight |
| `src/components/Search/SearchResultList.module.css` | APPROVED | `outline: none` on focusable list is intentional and appropriate (individual row highlights take over) |
| `src/components/Search/SearchPanel.tsx` | APPROVED | Tab state managed correctly; clear handler complete; event listener properly cleaned up; minor ARIA gap (M-002) |
| `src/components/Search/SearchPanel.module.css` | APPROVED | Tab styles match ui-spec.md Section 6.3; recent list overflow handled |
| `src/App.tsx` | APPROVED | `addRecentTrack` called in correct location; `thumbnailUrl ?? ''` null-coalescing appropriate |

---

## Acceptance Criteria Verification

| # | Criterion | Status |
|---|-----------|--------|
| 1 | "Now Playing" A/B badge on search result currently loaded on a deck | [x] PASS |
| 2 | Small "A" or "B" badge when video loaded on that deck | [x] PASS |
| 3 | Recently played list: last 10 tracks, localStorage persisted | [x] PASS |
| 4 | "Clear search" x button resets query and results | [x] PASS |
| 5 | Search bar auto-focuses on app load | [x] PASS |
| 6 | Keyboard navigation: ArrowDown/Up moves highlight, Enter loads to Deck A | [x] PASS |
| 7 | Full title tooltip on truncated result rows | [x] PASS |
| 8 | Search input submit-only (no auto-search on type) | [x] PASS |
| 9 | "Copy YouTube URL" button copies `https://youtu.be/{videoId}`, shows 2s "Copied!" | [x] PASS |
| 10 | Unit tests for recently-played utility | [x] PASS |

---

## Recommendations

### Immediate (before next story)

None required. All acceptance criteria are met. The minor findings (M-001, M-002) are low-priority and do not block approval.

### Future Improvements

1. **(M-001) Remove redundant `key` prop** from `<li>` inside `SearchResult.tsx` — clean up in STORY-014 or next time the file is touched.
2. **(M-002) Complete ARIA tab panel bindings** — assign `id` to each tab button and `role="tabpanel"` + `aria-labelledby` to each content container. Appropriate for STORY-014 accessibility pass.
3. **Consider a "Clear Recent" button** in the Recent tab — `clearRecentTracks` is already exported from the utility but has no UI entry point. This would be a small STORY-014 or backlog addition.

---

## Metrics

| Metric | Value |
|--------|-------|
| Files reviewed | 11 (7 TSX/TS source + 4 CSS modules) |
| Critical issues | 0 |
| Major issues | 0 |
| Minor issues | 2 (M-001, M-002) |
| New unit tests | 16 |
| Total test suite | 279 / 279 passing |
| Acceptance criteria | 10 / 10 (100%) |
| Estimated review time | 45 minutes |
