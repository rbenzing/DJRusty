# Search Pre-load / Caching Research

> Project: `dj-rusty`
> Author: Researcher Agent
> Date: 2026-03-24
> Status: Complete — ready for Architect

---

## 1. Current Search Implementation Analysis

### Flow

Search is entirely on-demand and driven by explicit user input:

1. User opens the search drawer (press `/` or click handle).
2. User types a query and presses Enter or clicks SEARCH.
3. `SearchPanel.performSearch()` calls `searchVideos(query, accessToken)` in `youtubeDataApi.ts`.
4. `searchVideos` fires two sequential HTTP requests:
   - **Step 1** `GET /search?part=snippet&q={query}&type=video&maxResults=20&videoCategoryId=10&videoEmbeddable=true&videoDuration=medium` — 100 quota units.
   - **Step 2** `GET /videos?part=contentDetails,snippet&id={id1,...,id20}` — 1 quota unit.
5. Results are merged and written to `searchStore` (Zustand, in-memory only).
6. `SearchResultList` re-renders with the 20 results.

### What the user experiences as "slow"

Every search incurs at minimum two round trips to the Google APIs. On a typical broadband connection these typically take 300–800ms combined. The perceived latency is highest when:

- The user opens the drawer cold (no prior results in store).
- The user clears and re-types after a successful search (results are held in store but user wants new results).
- Token refresh happens concurrently (GIS silent refresh can add another 200–400ms).

### Existing store capabilities

`searchStore` exposes `setResults`, `appendResults`, and `clearResults`. It has no concept of a cache, keyed storage, or pre-loaded buckets. All state is discarded on page reload.

### Auth dependency

`accessToken` lives exclusively in Zustand (NFR-04 — never in localStorage). The token is populated:
- On initial app load via `requestToken(true)` (silent refresh — may or may not succeed depending on whether the user has an active Google session).
- On explicit sign-in via `requestToken(false)`.

The `handleTokenReceived` callback in `useAuth` sets the token and then fetches `userInfo`. This is the only reliable hook point at which a valid token is available after sign-in.

The app currently has **no post-auth hook** beyond fetching userInfo. There is no existing trigger to kick off data pre-loading after sign-in.

---

## 2. YouTube Data API v3 Quota Analysis

| Operation | Cost (units) | Notes |
|---|---|---|
| `search.list` | 100 | Charged per call regardless of `maxResults` |
| `videos.list` | 1 | Charged per call regardless of batch size |
| Daily quota (default) | 10,000 | ~99 searches before exhaustion |
| Daily quota (extended) | Up to 1,000,000 | Requires Google Cloud quota increase request |

### Pre-loading quota impact

If we pre-load N queries on sign-in, each query costs 101 units (100 + 1):

| Pre-load queries | Units consumed | Searches remaining in day |
|---|---|---|
| 1 | 101 | ~98 |
| 5 | 505 | ~94 |
| 10 | 1,010 | ~88 |
| 20 | 2,020 | ~78 |

Pre-loading 5 DJ-genre queries at login consumes 5% of the daily quota. This is acceptable. Pre-loading 20 queries would consume 20% — materially harmful to a real DJ who searches heavily during a session.

**Recommendation: pre-load no more than 5 queries on sign-in.**

### maxResults impact

The `search.list` cost is flat per call, not per result. Raising `maxResults` from 20 to 50 does not increase quota cost. However, `maxResults` is capped at 50 by the YouTube API. Raising it to 50 doubles the visible results per query at no extra quota cost, but increases `videos.list` payload size (still only 1 unit) and increases render time for the result list.

---

## 3. Pre-load Strategy Options

### Option A: Pre-fetch DJ genre queries on sign-in (Recommended)

Execute a small set of fixed genre-based searches immediately after a valid token is received. Store the results in an in-memory cache keyed by query string. When the user types a query that matches a cached key (exact or prefix), serve results instantly from cache before triggering a live search.

**Pros:**
- Provides instant results for the most common searches a DJ performs.
- Cache is warm from the first moment the search drawer opens.
- Quota cost is fixed and predictable (N × 101 units at login).
- Simple to implement — reuses the existing `searchVideos` function.

**Cons:**
- Only helps if the user's actual search matches (or closely resembles) a pre-loaded query.
- Pre-loaded results age during a session; a 1-hour expiry mitigates staleness.
- Consumes quota on every sign-in even if the user never opens the search drawer.

### Option B: Increase maxResults to 50

Trivial change: increase `YOUTUBE_SEARCH_MAX_RESULTS` from 20 to 50 in `api.ts` and pass `'50'` in `searchVideos`. No quota increase. Gives the user more results per search but does not reduce search latency.

**Verdict: Implement as a complementary improvement, not a primary solution.**

### Option C: Search-ahead (debounced pre-fetch while typing)

As the user types, fire `search.list` calls for the partial query. Debounced to avoid excessive calls.

**Cons:**
- Each keystroke group that triggers a debounce costs 100 units. A user typing a 10-word query could burn 5–10 searches just in one interaction.
- Quota exhaustion risk is high for active DJ use.
- Complexity is much higher (debounce, cancellation via AbortController, partial-query cache).

**Verdict: Do not implement. Quota risk too high.**

### Option D: localStorage cache with expiry

Persist pre-loaded (and user-initiated) search results to `localStorage`, keyed by query, with a configurable TTL (e.g., 1 hour). On subsequent sessions, serve cached results instantly and optionally background-refresh them.

**Consideration against NFR-04:** NFR-04 only prohibits storing OAuth tokens in localStorage. Caching search *results* (public video metadata) in localStorage is not a security concern — the data is non-sensitive. This does not conflict with NFR-04.

**Verdict: Implement as the storage layer for pre-loaded results. Use alongside Option A.**

---

## 4. Recommended Approach

### Approach: Genre Pre-load on Sign-in + localStorage Cache with TTL

Combine Option A (genre pre-load) with Option D (localStorage TTL cache) as follows:

#### 4.1 Pre-load query set

Execute these 5 queries immediately after the OAuth token is confirmed (i.e. after `handleTokenReceived` completes):

```
1. "house music DJ set"
2. "techno DJ mix"
3. "drum and bass DJ set"
4. "hip hop DJ mix"
5. "trance DJ set"
```

These represent the five most common DJ performance genres and provide a useful starting catalogue without being overly prescriptive. The set should be configurable (e.g. `PRELOAD_QUERIES` constant) so DJs with different preferences can adjust it without code changes.

**maxResults per pre-load call: 20** (not 50). This limits render complexity and keeps per-query payload small. The gain from 50 is marginal at this stage.

#### 4.2 Cache storage: localStorage with TTL

Structure each cache entry as:

```typescript
interface SearchCacheEntry {
  results: YouTubeVideoSummary[];
  nextPageToken: string | null;
  cachedAt: number;       // Date.now() timestamp
  ttlMs: number;          // default: 3_600_000 (1 hour)
}
```

Storage key format: `dj-rusty:search-cache:{normalised-query}`

Query normalisation: trim, lowercase, collapse whitespace. This ensures "House Music DJ Set" and "house music dj set" hit the same cache entry.

#### 4.3 Cache lookup in search flow

When `performSearch` is called in `SearchPanel`:

1. Normalise the query.
2. Check localStorage for a valid (non-expired) cache entry.
3. If a valid entry exists: immediately populate `searchStore` from cache — the result is instant, no network call.
4. If no entry or entry is expired: proceed with existing `searchVideos` network call, then write the result to the cache.

This makes cached searches feel instantaneous while ensuring live searches still update the cache for future use.

#### 4.4 Pre-load trigger: useAuthStore subscription

The pre-load should be triggered when `signedIn` transitions from `false` to `true` in `authStore`. The cleanest place to implement this is a new hook `useSearchPreload` mounted once in `App.tsx`, which subscribes to `authStore` and fires the pre-load when sign-in is detected. This keeps the pre-load logic out of `useAuth` (which has a single responsibility: managing the token lifecycle) and out of `SearchPanel` (which should only deal with user-initiated searches).

#### 4.5 Pre-load execution: fire-and-forget, non-blocking

Pre-load calls must not block the UI. They are background `Promise.all` calls with individual error catch. A quota error on pre-load should be silently swallowed (logged to console only) — pre-load failure is non-fatal.

#### 4.6 Handling sign-out

On `clearAuth`, all `dj-rusty:search-cache:*` keys should be cleared from localStorage. This prevents a subsequent user on the same browser from seeing another user's pre-loaded results (minimal privacy concern for a non-sensitive dataset, but good hygiene).

---

## 5. Caching Strategy Details

| Property | Decision | Justification |
|---|---|---|
| Storage medium | `localStorage` | Survives page reload; pre-loaded results available on next session without quota cost |
| Key namespace | `dj-rusty:search-cache:{query}` | Avoids collisions with other localStorage keys |
| TTL | 1 hour (configurable constant) | DJ sessions are typically 1–4 hours; 1-hour TTL refreshes results once mid-session |
| Invalidation on sign-out | Yes — clear all cache keys | Privacy hygiene; avoid stale results from previous user |
| Max cache size | 20 entries (LRU eviction) | Prevents unbounded localStorage growth; each entry ~5KB estimated |
| Auth token in cache | Never | Only video metadata stored; token stays in Zustand only |
| Cache size per entry | ~20 videos × ~250 bytes each = ~5 KB | Well within localStorage limits (typical 5–10 MB per origin) |

### Storage estimate

20 cache entries × 5 KB = 100 KB maximum usage. This is negligible against the typical 5 MB localStorage quota.

---

## 6. Files That Would Need to Change

| File | Change Required |
|---|---|
| `src/constants/api.ts` | Add `YOUTUBE_SEARCH_MAX_RESULTS_PRELOAD`, `SEARCH_CACHE_TTL_MS`, `SEARCH_CACHE_MAX_ENTRIES`, `PRELOAD_QUERIES` constants |
| `src/services/youtubeDataApi.ts` | No changes needed — `searchVideos` is already the right abstraction |
| `src/utils/searchCache.ts` | **New file.** Implements read/write/evict/clear for the localStorage cache. Pure utility functions (no React). |
| `src/hooks/useSearchPreload.ts` | **New file.** React hook that subscribes to `authStore.signedIn`, fires pre-load when sign-in is detected, and clears cache on sign-out. Mounted once in `App.tsx`. |
| `src/components/Search/SearchPanel.tsx` | Modify `performSearch` to check cache before firing network call; write to cache after successful network call. |
| `src/App.tsx` | Mount `useSearchPreload()` hook alongside `useAuth()` to trigger pre-loading. |
| `src/store/searchStore.ts` | No changes needed — store shape is already correct for serving pre-loaded results. |
| `src/test/search-cache.test.ts` | **New test file.** Unit tests for cache read/write/expiry/eviction/clear. |
| `src/test/search-preload.test.ts` | **New test file.** Tests for `useSearchPreload` hook behaviour (mock `authStore`, mock `searchVideos`). |

---

## 7. Risks and Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Quota exhaustion from pre-loading | Medium | Cap pre-load at 5 queries; each pre-load is only triggered once per sign-in session (not on every token refresh) |
| Pre-load fires on silent token refresh (auto-login) — unexpected quota burn | Medium | Track a `preloadFired` flag in the hook using `useRef`; only fire once per session regardless of how many token refresh events occur |
| Stale pre-loaded results shown as if current | Low | TTL of 1 hour limits staleness; user can always perform a live search to get fresh results |
| localStorage quota exceeded | Low | LRU eviction at 20 entries caps storage at ~100 KB; well within limits |
| Cache poisoning (tampered localStorage) | Low | Data is non-sensitive public video metadata; worst case is garbled results, not a security breach. Parse defensively and fall through to live search on parse failure. |
| Pre-load from wrong account after sign-in / sign-out cycle | Low | Clear cache on `clearAuth`; pre-load re-fires on next sign-in |
| `videoCategoryId=10` (Music) filters out non-music DJ content | Low | Most DJ sets are uploaded to the Music category. If needed, `videoCategoryId` can be dropped from pre-load calls (not from user searches) to broaden results. |
| Pre-load network calls slow down app startup | Low | Calls are fire-and-forget in the background; they do not block UI rendering or any user-facing operation |
| User signs in, searches immediately before pre-load completes | Low | Cache miss triggers normal live search; no degraded experience — pre-load just wasn't warm yet |

---

## 8. Open Questions for Architect

1. Should the pre-load query list (`PRELOAD_QUERIES`) be hard-coded constants or user-configurable (stored in `settingsStore`)? A user-configurable list would require a settings UI change and increases scope.
2. Should the cache be implemented as a standalone utility (`searchCache.ts`) or as an extension to `searchStore` (a parallel `preloadStore`)? The utility approach keeps concerns separated; a store extension centralises cache state but mixes concerns.
3. Should `maxResults` for **user-initiated searches** also be raised to 50 as a quick win? This is a one-line change with no quota impact.
4. Should pre-loaded results be visibly surfaced to the user in a dedicated "Browse" tab (similar to the existing "Recent" tab), or should they only be used as an invisible cache to speed up matching searches?

---

## 9. Summary Recommendation

Implement **Option A + D combined**: genre pre-load on sign-in with localStorage TTL cache.

- Pre-load 5 fixed genre queries on first sign-in per session (fire-and-forget, background).
- Cache all search results (both pre-loaded and user-initiated) in localStorage with a 1-hour TTL.
- Serve cache hits instantly before touching the network.
- Clear cache on sign-out.
- Cap at 20 cache entries with LRU eviction.

This approach:
- Dramatically reduces perceived search latency for common DJ genre queries (0ms vs 300–800ms).
- Consumes a fixed, predictable 505 quota units at sign-in (5% of daily quota).
- Survives page reloads, giving warm results on the user's next visit within the TTL window.
- Requires no changes to `youtubeDataApi.ts`, `searchStore.ts`, or `authStore.ts`.
- Is fully reversible if the quota cost proves problematic — the pre-load can be disabled by setting `PRELOAD_QUERIES` to an empty array.
