# Code Review Report — STORY-007: YouTube Data API + Search Panel

> **Project**: dj-rusty
> **Reviewer**: Code Reviewer Agent
> **Date**: 2026-03-22
> **Story**: STORY-007 — YouTube Data API + Search Panel

---

## Items Reviewed

| File | Lines |
|------|-------|
| `src/services/youtubeDataApi.ts` | 213 |
| `src/store/searchStore.ts` | 63 |
| `src/types/search.ts` | 40 |
| `src/components/Search/SearchPanel.tsx` | 139 |
| `src/components/Search/SearchPanel.module.css` | 91 |
| `src/components/Search/SearchBar.tsx` | 79 |
| `src/components/Search/SearchBar.module.css` | 62 |
| `src/components/Search/SearchResult.tsx` | 63 |
| `src/components/Search/SearchResult.module.css` | 100 |
| `src/components/Search/SearchResultList.tsx` | 71 |
| `src/components/Search/SearchResultList.module.css` | 58 |
| `src/utils/formatTime.ts` | 56 |
| `src/test/parse-duration.test.ts` | 82 |
| `src/test/search-store.test.ts` | 263 |
| `src/App.tsx` | 71 |
| **Supporting ref**: `src/store/authStore.ts` | 57 |

**Total files reviewed**: 16
**Total lines reviewed**: ~1,508

---

## Overall Assessment

| Attribute | Result |
|-----------|--------|
| **Decision** | APPROVED |
| **Acceptance Criteria Met** | 16 / 16 (100%) |
| **Spec Compliance** | 100% |
| **Critical Issues** | 0 |
| **Major Issues** | 0 |
| **Minor Issues** | 2 |
| **Build Status** | PASS (0 TS errors, 0 test failures) |
| **Test Count** | 39 tests across 2 test files (14 + 25) |

**Summary**: The STORY-007 implementation is fully compliant with the specification. All 16 acceptance criteria are met. The two-step search pattern is correctly implemented. The `parseDuration` regex exactly matches the spec. Error codes are properly mapped. The store, components, and CSS are clean, well-typed, and follow project conventions. No security vulnerabilities were found. Test coverage is thorough with good edge-case coverage. Two minor style observations are noted below but are not blocking.

---

## Strict Validation Checklist

### Specification Compliance

| Item | Status | Notes |
|------|--------|-------|
| [x] `searchVideos(query, token, pageToken?)` two-step implemented | PASS | Step 1: `search.list` with `part=snippet,type=video,videoCategoryId=10,maxResults=20`; Step 2: `videos.list` with `part=contentDetails,snippet` — exactly matches §10 |
| [x] `parseDuration(iso8601)` regex `/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/` | PASS | Exact match to spec §11; uses `parseInt(match[n] ?? '0', 10)` with explicit radix |
| [x] Error handling: `quotaExceeded`, `forbidden`, `keyInvalid` | PASS | `ERROR_MESSAGES` map in `youtubeDataApi.ts`; reason extracted from `body.error.errors[0].reason` |
| [x] `searchStore.ts` — `query`, `results`, `nextPageToken`, `loading`, `error` | PASS | All five state fields present and typed correctly against `SearchState` interface |
| [x] `SearchPanel.tsx` renders at bottom of app | PASS | `<SearchPanel />` placed inside `<main>` below the `.app-deck-row` in `App.tsx` |
| [x] Search bar — submit on Enter or button click | PASS | `onSubmit` on `<form>` handles button; `onKeyDown` handles Enter key explicitly in `SearchBar.tsx` |
| [x] Results list: thumbnail, title, channel name, formatted duration | PASS | `SearchResult.tsx` renders all four fields; `formatTime(duration)` used for display |
| [x] Loading skeleton while fetching | PASS | `SearchResultList.tsx` renders 5 `<SkeletonRow />` elements when `loading === true`, with `aria-busy="true"` |
| [x] Error state with message (quota exceeded message included) | PASS | Error banner with `role="alert"` in `SearchPanel.tsx`; quota exceeded message flows from `ERROR_MESSAGES` map through store |
| [x] Empty state: "No results" or "Search for a track to get started" | PASS | `SearchResultList.tsx` shows "Search for a track to get started." before first search; "No results found for your search." after a search returns empty |
| [x] "Load Next Page" button when `nextPageToken` present | PASS | Conditional render `{nextPageToken && !loading && ...}` in `SearchPanel.tsx` |
| [x] Track browser disabled when user not authenticated | PASS | `panelDisabled` = `!credentialsAvailable`; applies `styles.panelDisabled` (`opacity: 0.5; pointer-events: none`) |
| [x] `VITE_YOUTUBE_API_KEY` used as fallback for unauthenticated searches | PASS | `apiFetch()` checks `token` first, then reads `VITE_YOUTUBE_API_KEY` from `import.meta.env` as API key query param |
| [x] Unit tests for `parseDuration` | PASS | 14 tests in `parse-duration.test.ts` covering happy paths and edge cases |
| [x] Unit tests for `searchStore` actions | PASS | 25 tests in `search-store.test.ts` covering all 6 actions plus initial state |
| [x] No security vulnerabilities (no XSS, no raw HTML injection) | PASS | No `dangerouslySetInnerHTML`, no `innerHTML`, no `eval()`, no `document.write` found in any search component or service |

### Implementation Spec §10 and §11 Compliance

| Item | Status |
|------|--------|
| [x] `BASE` constant set to `https://www.googleapis.com/youtube/v3` | PASS |
| [x] `search.list` called first with `videoCategoryId: '10'` (Music) | PASS |
| [x] `videos.list` called with `id` = comma-joined video IDs | PASS |
| [x] `mergeSearchResults` combines both responses | PASS |
| [x] `parseDuration` regex matches spec exactly | PASS |
| [x] `formatTime` handles H:MM:SS for durations > 1 hour | PASS — enhanced beyond spec minimum |

### Auth Token Strategy

| Item | Status |
|------|--------|
| [x] OAuth Bearer token used when `token` is non-null and non-empty | PASS — `if (token)` check in `apiFetch()` |
| [x] `VITE_YOUTUBE_API_KEY` appended as `key` query param when no token | PASS |
| [x] Token never written to `localStorage` | PASS — `authStore.ts` uses Zustand memory only |
| [x] No token appears in error messages or response bodies | PASS |

### UI Spec §6 (Track Browser) Compliance

| Item | Status |
|------|--------|
| [x] Panel height 220px | PASS — `.panel { height: 220px }` in `SearchPanel.module.css` |
| [x] Search bar: placeholder "Search YouTube...", height 36px | PASS |
| [x] Search bar: focus ring amber (`--color-accent-primary`) | PASS |
| [x] Search button: "SEARCH" label, amber background | PASS |
| [x] Thumbnail: 80x45px, `border-radius: 2px`, `object-fit: cover` | PASS |
| [x] Title: single line, `text-overflow: ellipsis` | PASS |
| [x] Channel name displayed below title | PASS |
| [x] Duration right-aligned in same row as title | PASS |
| [x] LOAD A button: `background: var(--color-deck-a-bg)`, `color: var(--color-deck-a-text)` | PASS |
| [x] LOAD B button: `background: var(--color-deck-b-bg)`, `color: var(--color-deck-b-text)` | PASS |
| [x] `aria-label="Load {title} to Deck {A/B}"` on load buttons | PASS |
| [x] Row hover: `background: var(--color-bg-elevated)` | PASS |
| [x] Row separator: `1px solid var(--color-border-subtle)` | PASS |
| [x] Disabled state: `opacity: 0.5`, `pointer-events: none` | PASS |

### Code Quality

| Item | Status |
|------|--------|
| [x] Readability — clear naming, well-organised modules | PASS |
| [x] Naming conventions — camelCase functions, PascalCase types/components | PASS |
| [x] Function size — all functions are focused and small | PASS |
| [x] No code duplication | PASS |
| [x] JSDoc comments on all exported functions and interfaces | PASS |
| [x] No `any` in exported API surface (only internal cast) | PASS — one controlled `unknown` cast for `import.meta` in `apiFetch`, which is the standard Vite pattern |

### Best Practices

| Item | Status |
|------|--------|
| [x] React hooks usage correct | PASS |
| [x] No direct DOM manipulation | PASS |
| [x] Proper TypeScript typing throughout | PASS |
| [x] Error handled via `catch` with typed narrowing (`err instanceof Error`) | PASS |
| [x] `void` used correctly for floating promises | PASS — `void performSearch(...)` in event handlers |
| [x] `CustomEvent('dj-rusty:load-track')` pattern for STORY-008 decoupling | PASS — intentional and documented |
| [x] CSS custom properties used (design tokens) | PASS |
| [x] SOLID — single responsibility per component | PASS |

### Security Review

| Item | Status |
|------|--------|
| [x] No `dangerouslySetInnerHTML` | PASS |
| [x] No `innerHTML` assignment | PASS |
| [x] No `eval()` or `Function()` construction | PASS |
| [x] User-provided query string is passed as URL parameter (not embedded in HTML) | PASS — `URLSearchParams` used exclusively |
| [x] Error messages do not leak token or API key values | PASS — messages come from static `ERROR_MESSAGES` map or `response.statusText` |
| [x] API key read from environment variable, not hardcoded | PASS |
| [x] OAuth token stored in memory-only Zustand (confirmed in `authStore.ts`) | PASS |
| [x] No CORS credentials mode leaking cookies | PASS — `fetch()` uses default `credentials: 'omit'` (no `credentials` option set) |
| [x] Thumbnail URLs rendered as `src` attribute (not HTML injection vector) | PASS |
| [x] Title and channel text rendered as React text nodes (JSX escapes automatically) | PASS |

### Testing

| Item | Status |
|------|--------|
| [x] Unit tests present for `parseDuration` | PASS — 14 tests |
| [x] Unit tests present for `searchStore` actions | PASS — 25 tests |
| [x] Edge cases tested: empty string, invalid string, bare "PT", large values | PASS |
| [x] All 6 store actions tested (setQuery, setResults, appendResults, setLoading, setError, clearResults) | PASS |
| [x] Initial state verified | PASS |
| [x] Error clearing via `setResults` tested | PASS |
| [x] Quota exceeded message appears in test | PASS — explicit test "handles quota exceeded error message" |
| [x] Store reset between tests via `beforeEach` | PASS |
| [x] Test assertions are meaningful (not vacuous) | PASS |

### Performance

| Item | Status |
|------|--------|
| [x] No unnecessary re-renders (no objects created in render body passed as props) | PASS |
| [x] Results list uses stable `key={result.videoId}` | PASS |
| [x] Skeleton list uses index key (acceptable for static decoration) | PASS |
| [x] `lazy` loading on thumbnail images | PASS — `loading="lazy"` attribute present |
| [x] No N+1 API calls — video details fetched in a single batch `videos.list` call | PASS |
| [x] Early return when `searchRes.items` is empty (skips step 2) | PASS |

---

## Detailed Findings

### Critical Issues

None.

### Major Issues

None.

### Minor Issues

#### MINOR-1: `key` prop placed on `<li>` inside component body (redundant)

**File**: `src/components/Search/SearchResult.tsx`, line 20
**Category**: React Best Practice
**Problem**: The `<li>` element in `SearchResult.tsx` has `key={videoId}` as a prop, but the `key` is only meaningful when the component itself is rendered in an array — which happens in the parent `SearchResultList.tsx` via `<SearchResult key={result.videoId} ... />`. The `key` on the inner `<li>` has no effect in React.
**Recommendation**: Remove `key={videoId}` from the `<li>` element inside `SearchResult.tsx`. The parent already supplies the correct keyed `<SearchResult key={result.videoId} />`.
**Rationale**: While this does not cause a bug, it is misleading and may cause confusion for future developers. React ignores `key` when it is not the direct prop of an array-rendered element.

#### MINOR-2: `disabledOverlay` has `pointer-events: none` which prevents keyboard users from reading the overlay message via screen reader

**File**: `src/components/Search/SearchPanel.module.css`, line 29
**Category**: Accessibility (minor)
**Problem**: The disabled overlay div has `pointer-events: none`. Combined with the parent `.panelDisabled` also having `pointer-events: none`, the overlay message text is technically unreachable via pointer interaction. However, since the overlay has `aria-hidden="true"`, this is intentional for screen readers too. The panel section itself has `aria-label="Track browser"`. The net effect is that blind users will hear "Track browser" but not the specific reason for it being disabled.
**Recommendation**: Consider moving the disabled reason text to an `aria-describedby` attribute on the `<section>`, or remove `aria-hidden` from the overlay. This is a future accessibility improvement appropriate for STORY-014.
**Rationale**: Not blocking for STORY-007. STORY-014 covers full WCAG 2.1 AA accessibility pass.

---

## Positive Highlights

1. **Two-step API pattern is exemplary**: The `apiFetch` helper, `mergeSearchResults`, and `searchVideos` are clean, well-separated, and their responsibilities are clear. The fallback from `videos.list` snippet to `search.list` snippet is a thoughtful defensive detail.

2. **Type narrowing on error is correct**: The `err instanceof Error` pattern in `SearchPanel.tsx` is the correct TypeScript approach for `catch` blocks with `unknown` typed errors.

3. **`URLSearchParams` for all query building**: No string interpolation of user input into URLs. `buildParams` correctly omits `undefined` values.

4. **Skeleton UX with `aria-busy`**: The loading state uses `aria-busy="true"` and `aria-hidden="true"` on skeleton items — a clean accessible loading pattern.

5. **`parseDuration` robustness**: The implementation correctly uses `parseInt(..., 10)` with explicit radix, and handles the `PT` bare case (no hours/minutes/seconds) returning 0.

6. **Test isolation**: Store reset via `beforeEach` with `useSearchStore.setState(...)` is the correct Zustand testing pattern, avoiding test bleed.

7. **CustomEvent decoupling**: The `dj-rusty:load-track` custom event pattern for STORY-008 wiring is architecturally clean and the developer correctly documents it as intentional.

8. **CSS design tokens used throughout**: No hardcoded colours outside of hover adjustments, which are acceptable inline values for now.

---

## File-by-File Review

| File | Status | Notes |
|------|--------|-------|
| `src/services/youtubeDataApi.ts` | APPROVED | Two-step pattern correct, error handling complete, types well-defined |
| `src/store/searchStore.ts` | APPROVED | All 5 state fields, 6 actions, correct Zustand pattern |
| `src/types/search.ts` | APPROVED | `YouTubeVideoSummary` and `SearchState` interfaces match spec exactly |
| `src/components/Search/SearchPanel.tsx` | APPROVED | Orchestrates search correctly; CustomEvent pattern documented |
| `src/components/Search/SearchPanel.module.css` | APPROVED | Panel height 220px, disabled state, error banner, pagination |
| `src/components/Search/SearchBar.tsx` | APPROVED | Form submit + Enter key both handled; accessibility attrs present |
| `src/components/Search/SearchBar.module.css` | APPROVED | Matches UI spec §6.2 precisely |
| `src/components/Search/SearchResult.tsx` | APPROVED | Minor-1 noted (redundant key on li); all required fields rendered |
| `src/components/Search/SearchResult.module.css` | APPROVED | Matches UI spec §6.4: 64px height, 80x45 thumb, correct LOAD A/B colours |
| `src/components/Search/SearchResultList.tsx` | APPROVED | Skeleton, empty states, result list all correct |
| `src/components/Search/SearchResultList.module.css` | APPROVED | Skeleton pulse animation, overflow scroll, empty state centering |
| `src/utils/formatTime.ts` | APPROVED | `parseDuration` regex matches spec; `formatTime` handles H:MM:SS |
| `src/test/parse-duration.test.ts` | APPROVED | 14 tests, comprehensive edge case coverage |
| `src/test/search-store.test.ts` | APPROVED | 25 tests, all actions covered, good fixture pattern |
| `src/App.tsx` | APPROVED | `<SearchPanel />` correctly placed below deck row inside `<main>` |

---

## Acceptance Criteria Verification

| # | Criterion | Status |
|---|-----------|--------|
| 1 | `youtubeDataApi.ts` — `searchVideos(query, token, pageToken?)` two-step | [x] PASS |
| 2 | `parseDuration(iso8601)` — converts ISO 8601 to seconds correctly | [x] PASS |
| 3 | Error handling for `quotaExceeded`, `forbidden`, `keyInvalid` | [x] PASS |
| 4 | `searchStore.ts` fully implemented: `query`, `results`, `nextPageToken`, `loading`, `error` | [x] PASS |
| 5 | `SearchPanel.tsx` renders at bottom of app | [x] PASS |
| 6 | Search bar — submit on Enter or button click | [x] PASS |
| 7 | Results list: thumbnail, title, channel name, formatted duration | [x] PASS |
| 8 | Loading skeleton while fetching | [x] PASS |
| 9 | Error state with message (quota exceeded message included) | [x] PASS |
| 10 | Empty state: "No results" or "Search for a track to get started" | [x] PASS |
| 11 | "Load Next Page" button when `nextPageToken` present | [x] PASS |
| 12 | Track browser disabled when user not authenticated | [x] PASS |
| 13 | `VITE_YOUTUBE_API_KEY` used as fallback for unauthenticated searches | [x] PASS |
| 14 | Unit tests for `parseDuration` | [x] PASS |
| 15 | Unit tests for `searchStore` actions | [x] PASS |
| 16 | No security vulnerabilities (no XSS, no raw HTML injection) | [x] PASS |

**16 / 16 acceptance criteria: PASSED**

---

## Recommendations

### Immediate (Non-Blocking, For Developer Awareness)

1. Remove the redundant `key={videoId}` prop from the `<li>` element inside `SearchResult.tsx` (MINOR-1). This is a one-line cleanup with no risk.

### Future Improvements (STORY-014)

1. Improve disabled panel accessibility: add `aria-describedby` to the `<section>` pointing to the disabled reason message (MINOR-2).
2. Consider adding an `aria-live="polite"` region to announce when new search results arrive for screen reader users.
3. The `handleKeyDown` in `SearchBar.tsx` is technically redundant because the parent `<form>` handles Enter via `onSubmit`. Both are harmless but the `onKeyDown` handler could be removed to simplify the code in STORY-014.

---

## Metrics

| Metric | Value |
|--------|-------|
| Files reviewed | 16 |
| Total lines reviewed | ~1,508 |
| Critical issues | 0 |
| Major issues | 0 |
| Minor issues | 2 |
| Acceptance criteria met | 16 / 16 (100%) |
| Spec compliance | 100% |
| Test files | 2 |
| Tests passing | 39 (14 + 25) |
| Build status | PASS |
| TypeScript errors | 0 |
| Estimated review time | 75 minutes |

---

## Decision

**APPROVED — Proceed to Tester.**

All 16 STORY-007 acceptance criteria are fully met. The implementation is clean, secure, well-typed, and consistent with the specification. Two minor observations are noted for awareness but are not blocking.
