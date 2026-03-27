# STORY-SEARCH-001: Search Pre-loading & Result Caching

**Status**: Ready for Development
**Complexity**: Medium
**Estimated Tasks**: 5
**Dependencies**: None (builds on existing search and auth infrastructure)
**Source**: `orchestration/artifacts/research/dj-rusty/search-preload-research.md`

---

## Objective

Pre-load 5 genre queries in the background on sign-in and cache all search results (pre-loaded and user-initiated) in localStorage with a 1-hour TTL. Cached queries return instantly without a network call. The cache is capped at 20 entries with LRU eviction, cleared on sign-out, and degrades silently to network-only mode when localStorage is unavailable or corrupt.

---

## Scope

**In scope:**
- localStorage search cache utility with TTL, LRU eviction, and defensive error handling
- Background pre-loading of 5 genre queries after sign-in (fire-and-forget, sequential)
- Cache-first lookup in the existing search flow (SearchPanel)
- Cache cleared on sign-out via `clearAuth`
- Unit tests for the cache utility

**Out of scope:**
- User-configurable genre list (hardcoded constant for now)
- Raising `maxResults` from 20 to 50 (separate improvement)
- Browse/discovery UI for pre-loaded results (results are invisible cache only)
- Changes to `youtubeDataApi.ts` (reused as-is)
- Changes to `searchStore.ts` (reused as-is)

---

## Acceptance Criteria

- [ ] **AC-1: Pre-load on sign-in.** When `signedIn` transitions to `true` in `useAuthStore`, five genre queries execute silently in the background: `"house music DJ mix"`, `"techno DJ set"`, `"drum and bass mix"`, `"hip hop DJ set"`, `"trance DJ mix"`. Results are written to localStorage cache. No loading indicators, errors, or UI changes are visible to the user during pre-load.
- [ ] **AC-2: Pre-load fires at most once per session.** A `useRef(false)` guard in `useSearchPreload` prevents the pre-load from re-firing on token refresh, proactive refresh, or any subsequent `signedIn` state change within the same mount lifecycle.
- [ ] **AC-3: All search results cached.** Both pre-loaded results and user-initiated search results are written to localStorage after a successful API call. Cache entry format is `{ results: YouTubeVideoSummary[], cachedAt: number }`.
- [ ] **AC-4: Cache key format.** Each cached query is stored under the key `djrusty:search:{normalisedQuery}` where `normalisedQuery` is the query string lowercased and trimmed.
- [ ] **AC-5: Cache TTL of 60 minutes.** `getCached()` returns `null` for any entry whose `cachedAt` timestamp is older than 60 minutes relative to `Date.now()`. Expired entries are not served.
- [ ] **AC-6: Cache-first search flow.** When the user performs a search in SearchPanel, the cache is checked first. If a valid (non-expired) cached entry exists, results are served from cache with no network call. On cache miss or expiry, the existing network flow executes and the result is written to cache on success.
- [ ] **AC-7: Cache cleared on sign-out.** When `clearAuth()` is called (sign-out flow), all localStorage keys with the `djrusty:search:` prefix are removed.
- [ ] **AC-8: LRU eviction at 20 entries.** When `setCached()` would exceed 20 entries, the oldest entry (lowest `cachedAt` timestamp) is evicted before the new entry is written.
- [ ] **AC-9: Silent degradation on localStorage failure.** All localStorage reads and writes in the cache utility are wrapped in try/catch. If localStorage is unavailable (e.g. Safari private mode, quota exceeded), the cache functions return `null` (reads) or no-op (writes). No errors are thrown or surfaced to the user.
- [ ] **AC-10: Pre-load errors silently swallowed.** If any pre-load query fails (network error, quota exceeded, etc.), the error is caught and swallowed. Remaining queries in the sequence continue executing. No error state is set in any store.

---

## Technical Specification

### Task 1: Create Search Cache Utility

**File to create:** `src/utils/searchCache.ts`

**Constants:**

```typescript
const CACHE_TTL_MS = 60 * 60 * 1000;     // 1 hour
const CACHE_MAX_ENTRIES = 20;
const CACHE_KEY_PREFIX = 'djrusty:search:';
```

**Interfaces:**

```typescript
interface SearchCacheEntry {
  results: YouTubeVideoSummary[];
  cachedAt: number;
}
```

**Exported functions:**

```typescript
/**
 * Normalise a search query for use as a cache key.
 * Lowercases and trims whitespace.
 */
export function normaliseQuery(query: string): string;

/**
 * Retrieve cached search results for the given query.
 * Returns null on cache miss, expired entry, parse error, or localStorage failure.
 */
export function getCached(query: string): YouTubeVideoSummary[] | null;

/**
 * Write search results to the cache for the given query.
 * Evicts the oldest entry (by cachedAt) if the cache exceeds CACHE_MAX_ENTRIES.
 * Silently no-ops on localStorage failure.
 */
export function setCached(query: string, results: YouTubeVideoSummary[]): void;

/**
 * Remove all localStorage keys that start with the CACHE_KEY_PREFIX.
 * Silently no-ops on localStorage failure.
 */
export function clearSearchCache(): void;
```

**Implementation details:**

- `normaliseQuery`: Return `query.trim().toLowerCase()`.
- `getCached`:
  1. Wrap entire body in try/catch returning `null` on any error.
  2. Build key: `CACHE_KEY_PREFIX + normaliseQuery(query)`.
  3. Call `localStorage.getItem(key)`. Return `null` if `null`.
  4. `JSON.parse` the raw string into a `SearchCacheEntry`.
  5. Validate that `cachedAt` is a number and `results` is an array. Return `null` if not.
  6. Check `Date.now() - entry.cachedAt > CACHE_TTL_MS`. Return `null` if expired.
  7. Return `entry.results`.
- `setCached`:
  1. Wrap entire body in try/catch (no-op on error).
  2. Build key: `CACHE_KEY_PREFIX + normaliseQuery(query)`.
  3. Build entry: `{ results, cachedAt: Date.now() }`.
  4. Call `localStorage.setItem(key, JSON.stringify(entry))`.
  5. Call `evictIfOverLimit()` (private helper).
- `evictIfOverLimit` (private, not exported):
  1. Iterate all localStorage keys. Collect those starting with `CACHE_KEY_PREFIX`.
  2. If count <= `CACHE_MAX_ENTRIES`, return.
  3. For each cache key, parse the entry and read `cachedAt`. On parse failure, mark it as oldest (evict corrupt entries first).
  4. Remove the key with the lowest `cachedAt`.
- `clearSearchCache`:
  1. Wrap entire body in try/catch (no-op on error).
  2. Collect all localStorage keys starting with `CACHE_KEY_PREFIX`.
  3. Remove each one via `localStorage.removeItem(key)`.

**Import:** `import type { YouTubeVideoSummary } from '../types/search';`

---

### Task 2: Add Pre-load Query Constants

**File to modify:** `src/constants/api.ts`

**Add after existing constants:**

```typescript
/**
 * Genre queries to pre-load into the search cache on sign-in.
 * Each query costs 101 YouTube API quota units (100 search + 1 video details).
 * Total pre-load cost: 505 units (~5% of default 10,000 daily quota).
 */
export const PRELOAD_QUERIES = [
  'house music DJ mix',
  'techno DJ set',
  'drum and bass mix',
  'hip hop DJ set',
  'trance DJ mix',
] as const;
```

No other constants in `api.ts` are modified.

---

### Task 3: Create Search Pre-load Hook

**File to create:** `src/hooks/useSearchPreload.ts`

```typescript
import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { searchVideos } from '../services/youtubeDataApi';
import { setCached } from '../utils/searchCache';
import { PRELOAD_QUERIES } from '../constants/api';

/**
 * Pre-loads genre search results into the localStorage cache
 * when the user signs in. Fires at most once per component
 * lifecycle (session). All errors are silently swallowed.
 *
 * Mount this hook once at the app root (App.tsx).
 */
export function useSearchPreload(): void {
  const signedIn = useAuthStore((s) => s.signedIn);
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (!signedIn || hasFiredRef.current) return;
    hasFiredRef.current = true;

    // Fire-and-forget — async IIFE that never rejects
    void (async () => {
      for (const query of PRELOAD_QUERIES) {
        try {
          const token = useAuthStore.getState().accessToken;
          const { results } = await searchVideos(query, token);
          setCached(query, results);
        } catch {
          // Silently swallow — pre-load failure is non-fatal
        }
      }
    })();
  }, [signedIn]);
}
```

**Key design decisions:**
- Queries execute **sequentially** (for-of loop with await), not in parallel, to avoid bursting 5 simultaneous YouTube API requests and risking rate limiting.
- `useAuthStore.getState().accessToken` is read fresh inside the loop because the token may refresh mid-sequence on long pre-loads.
- The `hasFiredRef` guard ensures the pre-load runs exactly once even if `signedIn` toggles (e.g. token refresh sets signedIn again).

---

### Task 4: Integrate Cache into Search Flow and App Root

#### 4a. Modify `src/components/Search/SearchPanel.tsx`

**Add imports at top of file:**

```typescript
import { getCached, setCached } from '../../utils/searchCache';
```

**Replace the `performSearch` function (lines 98-124) with a cache-aware version:**

Current code:
```typescript
async function performSearch(searchQuery: string, pageToken?: string) {
    setQuery(searchQuery);
    if (pageToken) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const { results: newResults, nextPageToken: newPageToken } =
        await searchVideos(searchQuery, accessToken, pageToken);

      if (pageToken) {
        appendResults(newResults, newPageToken);
      } else {
        setResults(newResults, newPageToken);
      }
      setHasSearched(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }
```

New code:
```typescript
async function performSearch(searchQuery: string, pageToken?: string) {
    setQuery(searchQuery);

    // Cache lookup — only for first-page searches (not pagination)
    if (!pageToken) {
      const cached = getCached(searchQuery);
      if (cached) {
        setResults(cached, null);
        setHasSearched(true);
        return;
      }
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const { results: newResults, nextPageToken: newPageToken } =
        await searchVideos(searchQuery, accessToken, pageToken);

      if (pageToken) {
        appendResults(newResults, newPageToken);
      } else {
        setResults(newResults, newPageToken);
        // Cache the first-page results on successful network fetch
        setCached(searchQuery, newResults);
      }
      setHasSearched(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }
```

**Changes explained:**
1. Before setting loading state on a first-page search, call `getCached(searchQuery)`.
2. If cache hit: call `setResults(cached, null)` immediately and return. No loading spinner, no network call. `nextPageToken` is `null` because the cache does not store pagination tokens (the user can perform a fresh search to get pagination).
3. If cache miss: proceed with existing network flow. After success, call `setCached(searchQuery, newResults)` to populate the cache for future queries.
4. Pagination requests (`pageToken` is truthy) always go to the network and are never cached.

#### 4b. Modify `src/App.tsx`

**Add import:**

```typescript
import { useSearchPreload } from './hooks/useSearchPreload';
```

**Add hook call inside the `App` function body, after the existing `useEffect` blocks and before the `return` statement (after line 100):**

```typescript
// STORY-SEARCH-001: Pre-load genre search results into cache on sign-in.
useSearchPreload();
```

#### 4c. Modify `src/store/authStore.ts`

**Add import at top of file:**

```typescript
import { clearSearchCache } from '../utils/searchCache';
```

**Modify the `clearAuth` method to call `clearSearchCache()`.** Insert `clearSearchCache();` after `set({ ...INITIAL_STATE });` and before the existing try/catch block that removes auth localStorage keys.

Current `clearAuth` (lines 75-84):
```typescript
clearAuth: () => {
    set({ ...INITIAL_STATE });
    try {
      localStorage.removeItem(STORAGE_KEY_USER_INFO);
      localStorage.removeItem(STORAGE_KEY_EXPIRES_AT);
      localStorage.removeItem(STORAGE_KEY_SESSION_EXPIRES_AT);
    } catch {
      // localStorage unavailable — in-memory clear is sufficient
    }
  },
```

New `clearAuth`:
```typescript
clearAuth: () => {
    set({ ...INITIAL_STATE });
    // STORY-SEARCH-001: Clear search cache on sign-out
    clearSearchCache();
    try {
      localStorage.removeItem(STORAGE_KEY_USER_INFO);
      localStorage.removeItem(STORAGE_KEY_EXPIRES_AT);
      localStorage.removeItem(STORAGE_KEY_SESSION_EXPIRES_AT);
    } catch {
      // localStorage unavailable — in-memory clear is sufficient
    }
  },
```

`clearSearchCache()` has its own internal try/catch, so it is safe to call outside the existing try/catch block.

---

### Task 5: Unit Tests for Search Cache Utility

**File to create:** `src/test/searchCache.test.ts`

**Test framework:** Vitest (consistent with existing test files in `src/test/`)

**Setup:** Before each test, clear all localStorage keys with the `djrusty:search:` prefix. Use `vi.spyOn(Storage.prototype, ...)` or the built-in `localStorage` mock as appropriate.

**Test cases:**

```typescript
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { normaliseQuery, getCached, setCached, clearSearchCache } from '../utils/searchCache';
```

1. **`normaliseQuery` lowercases and trims**
   - Input: `"  House Music DJ Mix  "`
   - Expected: `"house music dj mix"`

2. **`normaliseQuery` handles empty string**
   - Input: `""`
   - Expected: `""`

3. **`getCached` returns null on empty cache**
   - Call `getCached('techno DJ set')` with no prior `setCached`.
   - Expected: `null`

4. **`getCached` returns results for valid cached entry**
   - Call `setCached('techno DJ set', mockResults)`.
   - Call `getCached('techno DJ set')`.
   - Expected: `mockResults` (deep equal)

5. **`getCached` is case-insensitive and trim-insensitive**
   - Call `setCached('Techno DJ Set', mockResults)`.
   - Call `getCached('  techno dj set  ')`.
   - Expected: `mockResults`

6. **`getCached` returns null for expired entry**
   - Call `setCached('query', mockResults)`.
   - Advance `Date.now()` by 61 minutes using `vi.spyOn(Date, 'now')`.
   - Call `getCached('query')`.
   - Expected: `null`

7. **`getCached` returns results for entry within TTL**
   - Call `setCached('query', mockResults)`.
   - Advance `Date.now()` by 59 minutes.
   - Call `getCached('query')`.
   - Expected: `mockResults`

8. **`getCached` returns null for corrupted JSON (no throw)**
   - Write invalid JSON directly to `localStorage.setItem('djrusty:search:badquery', '{not valid json')`.
   - Call `getCached('badquery')`.
   - Expected: `null` (no error thrown)

9. **`getCached` returns null when localStorage throws**
   - Mock `localStorage.getItem` to throw an error.
   - Call `getCached('query')`.
   - Expected: `null` (no error thrown)

10. **`setCached` writes to localStorage**
    - Call `setCached('my query', mockResults)`.
    - Read `localStorage.getItem('djrusty:search:my query')`.
    - Parse and verify `results` deep-equals `mockResults` and `cachedAt` is a number.

11. **`setCached` evicts oldest entry when exceeding 20 entries**
    - Set up `Date.now()` mock starting at a known timestamp.
    - Call `setCached` for 20 unique queries, each with an incrementing timestamp.
    - Call `setCached` for a 21st query.
    - Verify that the first query's key has been removed from localStorage.
    - Verify the 21st query's key is present.
    - Verify total cache entries equals 20.

12. **`setCached` handles localStorage.setItem throwing (no error)**
    - Mock `localStorage.setItem` to throw.
    - Call `setCached('query', mockResults)`.
    - Expected: no error thrown; function completes silently.

13. **`clearSearchCache` removes only `djrusty:search:` prefixed keys**
    - Set `localStorage.setItem('djrusty:search:q1', '...')`.
    - Set `localStorage.setItem('djrusty:search:q2', '...')`.
    - Set `localStorage.setItem('djrusty_user_info', '...')` (non-search key).
    - Call `clearSearchCache()`.
    - Verify `djrusty:search:q1` and `djrusty:search:q2` are removed.
    - Verify `djrusty_user_info` is still present.

14. **`clearSearchCache` handles localStorage failure (no throw)**
    - Mock `localStorage.removeItem` to throw.
    - Call `clearSearchCache()`.
    - Expected: no error thrown.

**Mock data factory:**

```typescript
const mockResults: YouTubeVideoSummary[] = [
  {
    videoId: 'abc123',
    title: 'Test DJ Mix',
    channelTitle: 'Test Channel',
    duration: 3600,
    thumbnailUrl: 'https://i.ytimg.com/vi/abc123/mqdefault.jpg',
  },
  {
    videoId: 'def456',
    title: 'Another Mix',
    channelTitle: 'Another Channel',
    duration: 1800,
    thumbnailUrl: null,
  },
];
```

---

## Files Summary

| Action | File Path | Description |
|---|---|---|
| **Create** | `src/utils/searchCache.ts` | Cache utility: get, set, clear, normalise, evict |
| **Create** | `src/hooks/useSearchPreload.ts` | Hook: fire-and-forget genre pre-load on sign-in |
| **Create** | `src/test/searchCache.test.ts` | Unit tests for cache utility (14 test cases) |
| **Modify** | `src/constants/api.ts` | Add `PRELOAD_QUERIES` constant array |
| **Modify** | `src/components/Search/SearchPanel.tsx` | Cache-first lookup in `performSearch` |
| **Modify** | `src/App.tsx` | Mount `useSearchPreload()` hook |
| **Modify** | `src/store/authStore.ts` | Call `clearSearchCache()` in `clearAuth` |

---

## Implementation Order

```
Task 1: searchCache.ts         (no dependencies — pure utility)
Task 2: api.ts constants        (no dependencies — one-liner)
Task 5: searchCache.test.ts     (depends on Task 1 — run tests to validate cache)
Task 3: useSearchPreload.ts     (depends on Tasks 1, 2 — uses setCached + PRELOAD_QUERIES)
Task 4: Integrate into SearchPanel, App.tsx, authStore.ts (depends on Tasks 1, 2, 3)
```

Tasks 1 and 2 can be implemented in parallel. Task 5 should be written alongside or immediately after Task 1. Tasks 3 and 4 are sequential.

---

## Verification Checklist

- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] `npm run lint` passes with no new warnings
- [ ] `npm run test` passes all existing tests plus the 14 new cache tests
- [ ] Manual test: sign in, open console, confirm 5 pre-load network requests fire sequentially
- [ ] Manual test: search for "house music DJ mix" after sign-in, confirm no network request (cache hit)
- [ ] Manual test: search for a query not in pre-load list, confirm network request fires and subsequent identical search is instant (cache hit)
- [ ] Manual test: sign out, confirm all `djrusty:search:*` keys removed from localStorage (Application > Local Storage in DevTools)
- [ ] Manual test: sign in again, confirm pre-load fires again (fresh session)
- [ ] Manual test: refresh page while signed in, confirm pre-load does NOT re-fire until next sign-in (hasFiredRef guard)
