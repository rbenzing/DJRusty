# Implementation Notes: STORY-SEARCH-001 — Search Pre-loading & Result Caching

**Status**: Complete
**Date**: 2026-03-24
**Developer Agent**: Claude (claude-sonnet-4-6)

---

## Implementation Progress

- **Tasks completed**: 7 / 7 (100%)
- **Acceptance criteria met**: 10 / 10 (100%)
- **New test cases**: 14
- **Files created**: 3
- **Files modified**: 4

---

## Per Implementation Item

### Task 1: `src/utils/searchCache.ts` (CREATED)

**Status**: Complete
**Spec After Mapping**: AC-3, AC-4, AC-5, AC-8, AC-9

**Implementation details:**
- `normaliseQuery(query)`: trims and lowercases — used as the cache key suffix
- `getCached(query)`: reads from `localStorage`, validates shape, checks TTL, returns `null` on any failure path
- `setCached(query, results)`: writes `{ results, cachedAt: Date.now() }` then calls `evictIfOverLimit()`
- `evictIfOverLimit()` (private): iterates all `djrusty:search:*` keys, finds the one with the lowest `cachedAt`, removes it when count > 20
- `clearSearchCache()`: collects then removes all `djrusty:search:*` keys
- `getCachedAt()` (private): reads a single key's `cachedAt`; returns 0 on missing/corrupt entry so corrupt entries are evicted first
- All public functions fully wrapped in `try/catch`; zero errors are surfaced to callers

**TypeScript note**: `noUncheckedIndexedAccess` is enabled in `tsconfig.app.json`. The eviction loop uses a `for...of` iterator rather than index access to avoid `string | undefined` type errors.

**Files created:**
- `src/utils/searchCache.ts`

**Tests added**: Tasks 1–14 in `src/test/searchCache.test.ts`

**Specification compliance**: 100% — all exported function signatures and behaviours match the spec exactly.

---

### Task 2: `src/constants/api.ts` (MODIFIED)

**Status**: Complete
**Spec After Mapping**: AC-1

**Implementation details:**
- Added `PRELOAD_QUERIES` constant array with `as const` assertion after the existing `YOUTUBE_MUSIC_CATEGORY_ID` constant
- Includes JSDoc comment documenting quota cost per pre-load

**Files modified:**
- `src/constants/api.ts`

**Specification compliance**: 100%

---

### Task 3: `src/hooks/useSearchPreload.ts` (CREATED)

**Status**: Complete
**Spec After Mapping**: AC-1, AC-2, AC-10

**Implementation details:**
- `hasFiredRef = useRef(false)` guard prevents the pre-load from firing more than once per mount lifecycle
- Subscribes to `signedIn` from `useAuthStore` via selector
- When `signedIn` becomes `true` and guard is clear: sets guard then fires a void async IIFE
- Sequential `for...of` loop over `PRELOAD_QUERIES` — avoids 5 simultaneous API requests
- `useAuthStore.getState().accessToken` read fresh inside each loop iteration (handles token refresh mid-sequence)
- Each query wrapped in `try/catch` that swallows all errors silently
- `setCached` called after each successful result — no `searchStore` state is touched

**Files created:**
- `src/hooks/useSearchPreload.ts`

**Specification compliance**: 100%

---

### Task 4a: `src/components/Search/SearchPanel.tsx` (MODIFIED)

**Status**: Complete
**Spec After Mapping**: AC-6

**Implementation details:**
- Added import: `import { getCached, setCached } from '../../utils/searchCache';`
- Modified `performSearch` to perform cache-first lookup before setting loading state on first-page searches
- Cache hit path: calls `setResults(cached, null)`, sets `hasSearched(true)`, returns early — no loading spinner, no network call
- `nextPageToken` is passed as `null` on cache hit (cached results have no pagination token)
- Cache miss path: proceeds with existing network flow unchanged; calls `setCached(searchQuery, newResults)` after successful first-page fetch
- Pagination (`pageToken` truthy): always bypasses cache — goes directly to network

**Files modified:**
- `src/components/Search/SearchPanel.tsx`

**Specification compliance**: 100%

---

### Task 4b: `src/App.tsx` (MODIFIED)

**Status**: Complete
**Spec After Mapping**: AC-1 (mounting the hook at root)

**Implementation details:**
- Added import: `import { useSearchPreload } from './hooks/useSearchPreload';`
- Added `useSearchPreload()` call inside the `App` function body, before the `return` statement
- Annotated with `// STORY-SEARCH-001` comment

**Files modified:**
- `src/App.tsx`

**Specification compliance**: 100%

---

### Task 4c: `src/store/authStore.ts` (MODIFIED)

**Status**: Complete
**Spec After Mapping**: AC-7

**Implementation details:**
- Added import: `import { clearSearchCache } from '../utils/searchCache';`
- Added `clearSearchCache()` call in `clearAuth()` after `set({ ...INITIAL_STATE })` and before the `try/catch` block that removes auth localStorage keys
- `clearSearchCache()` has its own internal `try/catch` so it is safe to call outside the auth try/catch

**Files modified:**
- `src/store/authStore.ts`

**Specification compliance**: 100%

---

### Task 5 (Task 7): `src/test/searchCache.test.ts` (CREATED)

**Status**: Complete

**Test cases (14 total):**
1. `normaliseQuery` lowercases and trims
2. `normaliseQuery` handles empty string
3. `getCached` returns null on empty cache
4. `getCached` returns results for valid cached entry
5. `getCached` is case-insensitive and trim-insensitive
6. `getCached` returns null for expired entry (Date.now mocked +61 min)
7. `getCached` returns results for entry within TTL (Date.now mocked +59 min)
8. `getCached` returns null for corrupted JSON without throwing
9. `getCached` returns null when localStorage.getItem throws without throwing
10. `setCached` writes results and cachedAt to localStorage
11. `setCached` evicts oldest entry when exceeding 20 entries
12. `setCached` handles localStorage.setItem throwing without throwing
13. `clearSearchCache` removes only `djrusty:search:*` prefixed keys
14. `clearSearchCache` handles localStorage.removeItem throwing without throwing

**Files created:**
- `src/test/searchCache.test.ts`

---

## Pre-existing Issue Fixed

**`src/hooks/useAuth.ts` line 78** — `persistSession` was destructured from `useAuthStore()` but never used (the code calls `useAuthStore.getState().persistSession()` at line 93 instead). This caused a TypeScript `noUnusedLocals` error (TS6133) that blocked the build. The unused destructured binding was removed. This was a pre-existing bug unrelated to STORY-SEARCH-001.

---

## Build Status

| Check | Result |
|---|---|
| TypeScript build (`tsc -b && vite build`) | PASS — 0 errors, 0 warnings |
| Tests (`vitest run`) | PASS — 344/344 (14 new + 330 pre-existing) |
| ESLint | Not installed in project — TypeScript strict mode (`strict: true`, `noUnusedLocals`, `noUncheckedIndexedAccess`) serves as the linting gate |

---

## Specification Compliance

| Artifact | Compliance |
|---|---|
| Story spec (story-search-001.md) | 100% |
| Acceptance criteria (AC-1 through AC-10) | 10/10 met |
| Implementation spec (Task 1–5) | 100% |
| Files modified match spec | 100% |

---

## Acceptance Criteria Verification

| AC | Description | Verified By |
|---|---|---|
| AC-1 | Pre-load 5 genre queries on sign-in | `useSearchPreload` hook; `PRELOAD_QUERIES` constant |
| AC-2 | Pre-load fires at most once per session | `hasFiredRef` guard in `useSearchPreload` |
| AC-3 | All search results cached | `setCached` called after network success in `SearchPanel` and in `useSearchPreload` |
| AC-4 | Cache key format `djrusty:search:{normalisedQuery}` | `CACHE_KEY_PREFIX` + `normaliseQuery()` in `searchCache.ts` |
| AC-5 | Cache TTL of 60 minutes | `CACHE_TTL_MS = 60 * 60 * 1000`; expiry check in `getCached`; test case #6 |
| AC-6 | Cache-first search flow | `getCached` called before `setLoading` in `performSearch`; cache hit returns early |
| AC-7 | Cache cleared on sign-out | `clearSearchCache()` called in `clearAuth()`; test case #13 |
| AC-8 | LRU eviction at 20 entries | `evictIfOverLimit()` called from `setCached`; test case #11 |
| AC-9 | Silent degradation on localStorage failure | All public functions wrapped in `try/catch`; test cases #8, #9, #12, #14 |
| AC-10 | Pre-load errors silently swallowed | `try/catch` per query in `useSearchPreload` |

---

## Known Issues

None. All acceptance criteria are met. Build and tests are clean.

---

## Notes for Code Reviewer

1. The `useAuth.ts` pre-existing `noUnusedLocals` error (TS6133) was blocking the build. The fix was minimal: remove the unused `persistSession` destructuring. The call on line 93 already uses `useAuthStore.getState().persistSession()` which is the correct pattern for reading fresh state inside a callback.

2. `evictIfOverLimit` uses a `for...of` loop instead of index-based access to satisfy `noUncheckedIndexedAccess`. The sentinel `oldestKey: string | null = null` with `Infinity` as the initial comparison value is a standard safe pattern.

3. Cache hit in `SearchPanel` passes `null` as `nextPageToken` to `setResults`. This is intentional — cached results have no pagination token. The user can perform a fresh search (which will hit the cache again) if they want to see more results, or they can wait for cache expiry.

4. `useSearchPreload` reads `useAuthStore.getState().accessToken` inside the loop on each iteration. This is intentional per the spec to handle token refresh mid-sequence.
