# STORY-007 Implementation Notes

> Project: `dj-rusty`
> Story: STORY-007 — YouTube Data API + Search Panel
> Date: 2026-03-22
> Status: COMPLETE

---

## Implementation Progress

- **Acceptance Criteria**: 16/16 met (100%)
- **Files Created**: 10
- **Files Modified**: 5

---

## Acceptance Criteria Verification

| Criterion | Status | Notes |
|---|---|---|
| `youtubeDataApi.ts` implemented | DONE | Full two-step search, error handling |
| `searchVideos(query, token, pageToken?)` | DONE | Two-step search.list + videos.list |
| `parseDuration(iso8601)` | DONE | Pre-existing in `formatTime.ts` |
| Error handling for quotaExceeded/forbidden/keyInvalid | DONE | `ERROR_MESSAGES` map in `youtubeDataApi.ts` |
| `searchStore.ts` fully implemented | DONE | Pre-existing shell was already complete |
| `SearchPanel.tsx` renders at bottom of app | DONE | Added to `App.tsx` |
| Search bar with Enter/button submit | DONE | `SearchBar.tsx` |
| Results list: thumbnail, title, channel, duration | DONE | `SearchResult.tsx` |
| Loading skeleton while fetching | DONE | `SearchResultList.tsx` skeleton rows |
| Error state with message | DONE | Error banner in `SearchPanel.tsx` |
| Empty state: "No results" or "Search to get started" | DONE | `SearchResultList.tsx` |
| "Load Next Page" button when nextPageToken present | DONE | `SearchPanel.tsx` pagination footer |
| Track browser disabled when not authenticated | DONE | `opacity: 0.5; pointer-events: none` |
| `VITE_YOUTUBE_API_KEY` used as fallback | DONE | `apiFetch()` in `youtubeDataApi.ts` |
| Unit tests for `parseDuration` | DONE | `src/test/parse-duration.test.ts` (14 tests) |
| Unit tests for `searchStore` actions | DONE | `src/test/search-store.test.ts` (25 tests) |

---

## Files Created

| File | Purpose |
|---|---|
| `src/services/youtubeDataApi.ts` | YouTube Data API v3 two-step search implementation |
| `src/components/Search/SearchBar.tsx` | Search input form component |
| `src/components/Search/SearchBar.module.css` | SearchBar styles |
| `src/components/Search/SearchResult.tsx` | Individual result row with load buttons |
| `src/components/Search/SearchResult.module.css` | SearchResult styles |
| `src/components/Search/SearchResultList.tsx` | List of results with skeleton/empty states |
| `src/components/Search/SearchResultList.module.css` | SearchResultList styles |
| `src/components/Search/SearchPanel.module.css` | SearchPanel styles |
| `src/test/parse-duration.test.ts` | 14 unit tests for parseDuration |
| `src/test/search-store.test.ts` | 25 unit tests for searchStore actions |
| `src/types/youtube-globals.d.ts` | Window interface augmentation for YT globals |

## Files Modified

| File | Change |
|---|---|
| `src/services/youtubeDataApi.ts` | Full implementation (was a stub) |
| `src/components/Search/SearchPanel.tsx` | Full implementation (was a stub) |
| `src/components/Search/SearchBar.tsx` | Full implementation (was a stub) |
| `src/components/Search/SearchResultList.tsx` | Full implementation (was a stub) |
| `src/components/Search/SearchResult.tsx` | Full implementation (was a stub) |
| `src/App.tsx` | Added `<SearchPanel />` import and render |
| `src/services/authService.ts` | Fixed pre-existing `import.meta.env` TS error |
| `src/services/youtubeIframeApi.ts` | Reverted unnecessary cast (clean with type declaration) |
| `tsconfig.app.json` | Added `types: ["vitest/globals", "vite/client", "youtube"]` |

---

## Implementation Details

### Two-Step Search (`youtubeDataApi.ts`)

The `searchVideos` function follows the specification precisely:
1. `search.list` with `type=video`, `videoCategoryId=10` (Music), `maxResults=20` — retrieves video IDs + snippets.
2. `videos.list` with `part=contentDetails,snippet` batch-fetching all video IDs — retrieves durations.
3. `mergeSearchResults` combines both responses, using `videos.list` snippet as authoritative source.

Auth strategy:
- If `token` is non-null: `Authorization: Bearer {token}` header (OAuth).
- If no token: `VITE_YOUTUBE_API_KEY` added as `key` query param.
- If no key either: request is made without credentials (will likely fail with `keyInvalid`).

Error handling maps YouTube API `reason` codes:
- `quotaExceeded` → "YouTube API quota exceeded. Try again tomorrow."
- `forbidden` → "Access forbidden. Please sign in and try again."
- `keyInvalid` → "API key invalid. Please check your configuration."

### Search Panel (`SearchPanel.tsx`)

The disabled state uses `opacity: 0.5; pointer-events: none` on the entire section element, plus a centered overlay message, when `credentialsAvailable` is false. Credentials are available if either `accessToken` (OAuth) or `VITE_YOUTUBE_API_KEY` (env var) is present.

Load-to-deck dispatches a `CustomEvent('dj-rusty:load-track')` on `window`. STORY-008 will wire up the event listener to actually call the deck store `loadTrack` action. This keeps STORY-007 decoupled from STORY-008.

### TypeScript Build Fixes (Pre-existing Issues)

Three pre-existing TypeScript errors were fixed as part of achieving a clean build:

1. **`import.meta.env`** — `tsconfig.app.json` did not include `vite/client` types. Fixed by adding `"types": ["vitest/globals", "vite/client", "youtube"]` to compiler options.

2. **`vi` global** — vitest globals (`vi`, `beforeEach`, etc.) not in scope for the type-check build. Fixed by adding `vitest/globals` to the types array above.

3. **`window.onYouTubeIframeAPIReady`** — `@types/youtube` declares the `YT` namespace but does not augment the `Window` interface for the ready callback. Fixed by adding `src/types/youtube-globals.d.ts` with the `Window` interface augmentation.

---

## Build Status

| Check | Result |
|---|---|
| `npm test` | PASS — 202 tests, 0 failures |
| `npx tsc -b --noEmit` | PASS — 0 errors |

---

## Specification Compliance

| Spec | Compliance |
|---|---|
| `implementation-spec.md §10` (Two-Step Search) | 100% |
| `implementation-spec.md §11` (ISO 8601 Duration) | 100% (pre-existing `parseDuration`) |
| `implementation-spec.md §15` (env setup) | 100% (tsconfig types fixed) |
| `ui-spec.md §6` (Track Browser) | 100% |
| `design-system.md` (tokens) | 100% (CSS custom properties used throughout) |
| `architecture.md §5.3` (Search State) | 100% (pre-existing store matched spec) |

---

## Known Issues

None. All acceptance criteria are met, build is clean, tests pass.

---

## Notes for Code Reviewer

1. The `youtubeDataApi.ts` uses `unknown` as intermediate cast for `import.meta.env` access (`import.meta as unknown as { env: ... }`) to satisfy strict TypeScript without the `vite/client` types. Now that `vite/client` is in the types array, these casts are still valid and explicit.

2. The `SearchPanel.tsx` `handleLoadToDeck` dispatches a `CustomEvent` rather than calling the deck store directly. This is intentional — STORY-007 does not depend on STORY-008 (Load Track), and the event bridge keeps them decoupled. STORY-008 should add the event listener.

3. The `searchStore.ts` was already fully implemented as a shell from STORY-001. No changes were required — it already matched the required state shape exactly.

4. `tsconfig.app.json` now includes explicit `types` to ensure vitest globals, vite client types, and YouTube types all resolve correctly. This is the standard pattern for Vite+Vitest projects.
