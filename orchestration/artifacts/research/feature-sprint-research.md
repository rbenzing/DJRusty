# Feature Sprint Research Report
**Project**: DJRusty
**Date**: 2026-03-24
**Agent**: Researcher
**Scope**: 6 change areas for the upcoming feature sprint

---

## Table of Contents

1. [Download Feature Removal](#1-download-feature-removal)
2. [Search Relevance Improvement](#2-search-relevance-improvement)
3. [Search Result Persistence](#3-search-result-persistence)
4. [Pagination / Infinite Scroll](#4-pagination--infinite-scroll)
5. [EQ Implementation](#5-eq-implementation)
6. [Playback Controls Addition](#6-playback-controls-addition)

---

## 1. Download Feature Removal

### Current State

The download feature is a full-stack capability: a local Express server (`server/index.js`) accepts yt-dlp download requests, tracks status, and serves audio files. The front end has a complete playlist management UI and a secondary audio playback path for locally-served MP3s.

### Files to Delete Entirely

| File | Reason |
|------|--------|
| `src/services/downloadService.ts` | Entire file — all 4 functions (`getPlaylist`, `downloadTrack`, `pollTrackStatus`, `deleteTrack`) exclusively serve the download feature |
| `src/store/playlistStore.ts` | Entire file — `usePlaylistStore` with `tracks`, `loading`, `loadTracks`, `addOrUpdateTrack`, `updateTrackStatus`, `removeTrack` exclusively serve downloads |
| `src/components/Search/PlaylistTab.tsx` | Entire file — the downloaded-tracks playlist UI tab |
| `src/components/Search/PlaylistTab.module.css` | CSS module for the above |
| `src/hooks/useLocalAudioPlayer.ts` | Entire file — the HTML5 Audio player hook only activates when `isLocal` is true |
| `server/index.js` | The entire download server (Express + yt-dlp wrapper) |

### Files to Modify

#### `src/App.tsx`

**Line 14**: Remove import `import type { PlaylistTrack } from './types/playlist';`

**Lines 38–41**: Remove the `LoadLocalTrackEventDetail` interface:
```typescript
interface LoadLocalTrackEventDetail {
  deckId: 'A' | 'B';
  track: PlaylistTrack;
}
```

**Lines 108–123**: Remove the entire `handleLoadLocalTrack` effect block:
```typescript
useEffect(() => {
  function handleLoadLocalTrack(event: Event) { ... }
  window.addEventListener('dj-rusty:load-local-track', handleLoadLocalTrack);
  return () => window.removeEventListener('dj-rusty:load-local-track', handleLoadLocalTrack);
}, []);
```

#### `src/components/Search/SearchPanel.tsx`

**Lines 26–27**: Remove imports:
```typescript
import { PlaylistTab } from './PlaylistTab';
import { downloadTrack } from '../../services/downloadService';
import { usePlaylistStore } from '../../store/playlistStore';
import type { PlaylistTrack } from '../../types/playlist';
```

**Line 53**: Change the `ActiveTab` type from `'search' | 'recent' | 'playlist'` to `'search' | 'recent'`

**Lines 146–153**: Remove the `handleAddToPlaylist` async function

**Lines 155–160**: Remove the `handleLoadLocalToDeck` function that dispatches `dj-rusty:load-local-track`

**Lines 239–250**: Remove the "Playlist" tab button from the tablist

**Lines 314–322**: Remove the Playlist tabpanel `<div>` block

**Line 271**: Remove the `onAddToPlaylist` prop passed to `SearchResultList`:
```tsx
onAddToPlaylist={(result) => { void handleAddToPlaylist(result); }}
```

#### `src/components/Search/SearchResultList.tsx`

**Line 24**: Remove `onAddToPlaylist?: (result: YouTubeVideoSummary) => void;` from `SearchResultListProps`

**Line 45**: Remove `onAddToPlaylist,` from the destructured props

**Lines 106–107**: Remove `{...(onAddToPlaylist ? { onAddToPlaylist } : {})}` from `SearchResult` props spread

#### `src/components/Search/SearchResult.tsx`

**Lines 21**: Remove `onAddToPlaylist?: (result: YouTubeVideoSummary) => void;` from `SearchResultProps`

**Line 29**: Remove `onAddToPlaylist` from the destructured props

**Lines 43–46**: Remove `adding` state:
```typescript
const [adding, setAdding] = useState(false);
```

**Lines 54–60**: Remove the `handleAddToPlaylist` function

**Lines 139–149**: Remove the download/save button JSX block:
```tsx
{onAddToPlaylist && (
  <button ... onClick={handleAddToPlaylist} ...>
    {adding ? '…' : '↓'}
  </button>
)}
```

#### `src/store/deckStore.ts`

The `isLocal` and `audioUrl` fields on `DeckState` are used by `useLocalAudioPlayer` and `loadLocalTrack`. Once the local player hook and playlist feature are removed these fields become dead weight.

**Decision**: Remove `isLocal` and `audioUrl` from `DeckState` to keep the model clean:
- `src/types/deck.ts` lines 82–85: Remove both field declarations
- `src/store/deckStore.ts` lines 33–34: Remove `isLocal: false, audioUrl: null` from initial state
- `src/store/deckStore.ts` lines 107–117: Remove `loadLocalTrack` action signature
- `src/store/deckStore.ts` lines 178–199: Remove `loadLocalTrack` implementation
- All `isLocal` guard checks in `useYouTubePlayer.ts` (lines 268, 291, 330, 341) can be removed — the guard was only needed to avoid acting on local-track decks

#### `src/types/playlist.ts`

Delete entirely once `PlaylistTrack` has no remaining references.

### CustomEvents to Remove

| Event Name | Dispatcher | Listener |
|------------|------------|---------|
| `dj-rusty:load-local-track` | `SearchPanel.tsx` `handleLoadLocalToDeck` | `App.tsx` effect block |

The `dj-rusty:load-track` event (for YouTube tracks) must be **kept** — it is the bridge between SearchPanel and App for all YouTube loads, including the Recently Used tab.

### Git State Note

This is not a git repository (`git log` returned `fatal: not a git repository`). There is no commit history to revert. All changes must be applied as clean file edits.

---

## 2. Search Relevance Improvement

### Current State

`src/services/youtubeDataApi.ts` — `searchVideos()` function, lines 194–202:

```typescript
const searchRes = await apiFetch(`${BASE}/search`, token, {
  part: 'snippet',
  q: query,
  type: 'video',
  maxResults: '20',
  videoCategoryId: '10',   // Music category
  channelId: channelId ?? undefined,
  pageToken,
});
```

Parameters currently used:
- `part=snippet`
- `q={user query}`
- `type=video`
- `maxResults=20`
- `videoCategoryId=10` — scoped to Music category
- `channelId` — scoped to the configured channel (VITE_YOUTUBE_CHANNEL_ID) when set
- `pageToken` — for pagination

Parameters **not** currently used but available and relevant:

| Parameter | Values | Benefit |
|-----------|--------|---------|
| `order` | `relevance` (default), `date`, `rating`, `viewCount`, `title` | Switching from default `relevance` to `viewCount` can surface popular, well-known tracks. For DJs, `relevance` is generally correct, but `viewCount` could be a user-selectable sort. |
| `videoDuration` | `any` (default), `short` (<4 min), `medium` (4–20 min), `long` (>20 min) | DJ use-case: `medium` or `long` filters out clips, previews, ads, and shorts that are under 4 minutes. This is a high-value relevance improvement for DJ tracks. |
| `relevanceLanguage` | BCP-47 language code e.g. `en` | Biases results toward a language. Marginal benefit unless user's queries are non-English. |
| `safeSearch` | `none`, `moderate`, `strict` | No DJ-specific relevance impact. Default `moderate` is fine. |
| `videoType` | `any` (default), `episode`, `movie` | Not applicable; `any` is correct. |
| `videoEmbeddable` | `true` | **High value**: filters out videos the YouTube IFrame API cannot embed (error codes 101/150). Currently the app surfaces these as error states on the deck. Adding `videoEmbeddable=true` to search would prevent them from appearing in results at all. |
| `videoSyndicated` | `true` | Restricts to videos that can be played outside youtube.com. Closely related to embeddability; somewhat redundant with `videoEmbeddable=true`. |

### Recommendations

**Priority 1 — Add `videoEmbeddable=true`** (eliminates the current embed-error UX):
```typescript
videoEmbeddable: 'true',
```

**Priority 2 — Add `videoDuration=medium`** as a default filter, with the option to change to `any`. Filters tracks under 4 minutes. DJ tracks are typically 3–8 minutes; shorts/clips are typically under 2 minutes. This improves quality of results significantly.

**Priority 3 — Add `order` as a configurable parameter.** Default to `relevance`. Expose it as a filter option (dropdown in SearchBar) so the user can switch to `viewCount` for popular tracks or `date` for newest.

**Keep**: Channel scoping (`channelId`) and `videoCategoryId=10` as-is per the brief requirement to keep search scoped to channel videos and shorts only. Note: `videoCategoryId=10` already limits to Music. If `VITE_YOUTUBE_CHANNEL_ID` is set, the search is further scoped to that channel.

**Constraint**: When `channelId` is provided, the YouTube API ignores `videoCategoryId`. Both can still be sent but only `channelId` applies. The Music category filter only applies when no channel is scoped.

### Implementation Scope

All changes are isolated to `src/services/youtubeDataApi.ts` — the `searchVideos` function parameter block. The `SearchPanel.tsx` will need a small UI update if an `order` filter dropdown is added, but the core relevance improvements (`videoEmbeddable`, `videoDuration`) require only API parameter additions.

---

## 3. Search Result Persistence

### Current State

#### When results are currently cleared

The `clearResults()` action in `src/store/searchStore.ts` (line 60–62) sets `results: [], nextPageToken: null, error: null`. It is called in two places:

1. **`SearchPanel.tsx` line 129** — inside `handleClear()`, triggered by the SearchBar's clear (X) button
2. **`SearchPanel.tsx` line 31** — destructured from `useSearchStore` but only called via `handleClear`

There is no call to `clearResults` on new search submission. Looking at `performSearch()` (lines 99–120), when `pageToken` is undefined (new search), it calls `setResults(newResults, newPageToken)` which **replaces** results. So a new search already replaces results rather than clearing then re-populating. This is correct.

#### What the `hasSearched` flag does

`hasSearched` (line 66) is a React `useState` — it is **not** in Zustand. It is `false` initially and set to `true` after the first search completes. It controls the empty-state message in `SearchResultList`:
- `hasSearched=false` → "Search for a track to get started."
- `hasSearched=true, results=[]` → "No results found for your search."

**Problem**: `hasSearched` resets to `false` when `handleClear()` is called. If the user clears the search input but does not submit a new query, results disappear and the prompt resets to "Search for a track to get started." — i.e., clearing the query clears the results list visually. This may or may not be desired.

### What Needs to Change

The brief states: results should persist until (a) user submits a new search, or (b) user applies a filter.

**Current behavior already satisfies (a)**: Results are replaced on new search submission (`setResults` in `performSearch`). Results are NOT cleared on new submission — they are replaced.

**Gap**: The `handleClear()` function calls `clearResults()`, which removes all results when the user clicks the X button to clear the query text. Under the new requirement, clicking the clear button should only reset the query text, NOT the results.

### Required Changes

**`SearchPanel.tsx` — `handleClear` function (line 127–131)**:

Current:
```typescript
function handleClear() {
  setQuery('');
  clearResults();
  setHasSearched(false);
}
```

New (results are preserved when clearing the search input):
```typescript
function handleClear() {
  setQuery('');
  // Do NOT call clearResults() — results persist until a new search is submitted
  // hasSearched remains true so the list continues to show
}
```

**`SearchPanel.tsx` — `handleSearch` function (line 122–124)**:

Currently `handleSearch` calls `performSearch` which calls `setResults` (replaces results). This is already correct — a new search submission replaces results. No change needed here.

**For filter application**: When the `order` filter (from area 2) is applied, it should call `performSearch` with the new filter, which calls `setResults` and replaces results. This already flows correctly.

**`hasSearched` state**: After the clear change, `hasSearched` should remain `true` after clear so the results list does not revert to its "not yet searched" empty state. The variable should only reset if the component is unmounted (page reload) or if explicitly desired. Since `hasSearched` lives in React state (not Zustand), it will reset on component unmount naturally. No store-level change is needed.

**Summary of changes**: One-line deletion in `SearchPanel.tsx` `handleClear`.

---

## 4. Pagination / Infinite Scroll

### Current State

**`SearchPanel.tsx` lines 274–285**:
```tsx
{nextPageToken && !loading && (
  <div className={styles.pagination}>
    <button
      type="button"
      className={styles.nextPageBtn}
      onClick={handleNextPage}
      aria-label="Load next page of results"
    >
      Load Next Page
    </button>
  </div>
)}
```

**`SearchResultList.tsx`**: No pagination logic in the list component. The list simply renders whatever `results` are in the store. Pagination is managed at the `SearchPanel` level.

**`searchStore.ts`**: `appendResults` (line 45) appends to the existing array when a pageToken is passed. `nextPageToken` is stored in Zustand and updated on each fetch.

**`performSearch` in `SearchPanel.tsx`** (lines 99–120): Passes `pageToken` to `searchVideos`, and calls `appendResults` when `pageToken` is defined, `setResults` otherwise.

### Current UX Issues

1. The "Load Next Page" button sits below the results list. Users must scroll to the bottom of the result list, past all 20 results, to find the button.
2. There is no visual feedback during the next-page load (the main `loading` state is shared, which shows skeletons over the full list rather than an incremental spinner at the bottom).
3. No indication of how many pages/results are available.

### Approach Comparison

#### Option A: IntersectionObserver (Infinite Scroll)

**How it works**: An `IntersectionObserver` is attached to a sentinel element at the bottom of the results list. When the sentinel scrolls into view, `handleNextPage` is triggered automatically.

**Pros**:
- No click required — pages load as the user scrolls naturally
- Modern, well-understood UX pattern
- Clean implementation with React refs + `useEffect`

**Cons**:
- Can trigger unintended fetches if the user loads the panel and the sentinel is immediately visible
- Consumes quota (100 units per search.list call) on every scroll-triggered page
- Harder to test deterministically (requires viewport mocking)
- For a DJ app where the user may be searching specifically, accidental extra-page loads waste API quota

#### Option B: Improved "Load More" Button

**How it works**: Keep the manual button but improve its placement and visual feedback. Move the button to a sticky position at the bottom of the scroll container, add a per-page spinner (separate from the main loading state), and add a count label ("Showing 20 results — load more").

**Pros**:
- User controls when quota is consumed
- Explicit intent — appropriate for a professional tool where the user is deliberately browsing
- Easier to implement and test
- No risk of triggering quota waste

**Cons**:
- Requires a click action
- Marginally less ergonomic for heavy browsing

### Recommendation

**Implement Option B (improved "Load More" button)** with the following specific improvements:

1. Add a `loadingMore` boolean to `SearchPanel` local state (separate from `loading`) to track next-page loads specifically
2. Show an inline spinner/disabled state on the button during `loadingMore`
3. Add a results count label above the button ("20 results — load more")
4. Consider whether to add a sticky/fixed-position container for the button so it is always reachable without scrolling past all results

This recommendation aligns with the app's professional DJ tool character. Quota efficiency matters (100 units per call), and a DJ actively hunting for a specific track prefers controlled browsing over auto-load.

**If the team wants infinite scroll in a future iteration**, the architecture is already clean to support it: attach an `IntersectionObserver` in `SearchResultList` to a sentinel `<li>` at the end of the list, and call `onLoadNextPage` callback prop when triggered. The store and service layer need zero changes.

---

## 5. EQ Implementation

### Current State

**`src/components/Deck/EQPanel.tsx`**:
- EQ knobs are fully functional as interactive UI elements (mouse drag, arrow keys, double-click reset)
- Values are stored in `deckStore` as `eqLow`, `eqMid`, `eqHigh` in dB (-12 to +12)
- The component explicitly labels itself "Visual Only" with a badge and tooltip: `"Visual Only — EQ processing coming in v2"`
- No audio processing whatsoever — store values are persisted but never applied to any audio pipeline

**`src/hooks/useYouTubePlayer.ts`**:
- Manages a `YT.Player` instance inside an `<iframe>` element
- Available API methods from the YouTube IFrame API: `playVideo()`, `pauseVideo()`, `seekTo()`, `setVolume()`, `getVolume()`, `setPlaybackRate()`, `getCurrentTime()`, `getAvailablePlaybackRates()`
- No audio routing or Web Audio API integration
- The player renders inside a cross-origin iframe (`youtube.com` origin)

**`src/hooks/useLocalAudioPlayer.ts`** (to be removed in area 1):
- Uses a standard `HTMLAudioElement` created via `new Audio(...)`
- The audio element is entirely within the app's origin
- `audioRef.current` is a direct `HTMLAudioElement` reference
- Web Audio API **could** be connected via `AudioContext.createMediaElementSource(audioRef.current)` — but this code path is being deleted

**`src/services/playerRegistry.ts`**:
- Only stores `YT.Player` instances
- Has no awareness of local audio elements
- Does not expose any `getCurrentTime` method — that is accessed directly via `playerRef.current.getCurrentTime()` in the hook

### Technical Analysis: Why True EQ on YouTube iframes is Impossible

The YouTube IFrame player renders in an `<iframe>` with `src="https://www.youtube.com/..."`. This creates an **absolute cross-origin boundary**:

1. **Web Audio API requires same-origin access to audio sources.** `AudioContext.createMediaElementSource(element)` requires the `<audio>` or `<video>` element to be in the same document. The YouTube `<iframe>` is not accessible from the parent frame's JavaScript.

2. **`HTMLIFrameElement.contentDocument` is null** for cross-origin frames. There is no way to reach the internal `<video>` element inside the YouTube iframe.

3. **CORS headers on YouTube media streams** would block any attempt to route the stream through `fetch` and into an `AudioBuffer` or `MediaSource`.

4. **MediaStream capture is blocked.** `HTMLVideoElement.captureStream()` is same-origin only — cannot be called on cross-origin iframe content.

5. **`getVolume()` returns a 0–100 integer** — it is not a gain node and provides no per-frequency band control.

There is no legitimate browser API that can intercept a cross-origin iframe's audio for EQ processing. This is a fundamental browser security boundary, not a library limitation.

### Non-YouTube Audio Path

The app currently has **one non-YouTube audio path**: the local audio player (`useLocalAudioPlayer.ts`) which creates a same-origin `HTMLAudioElement`. As established in area 1, this entire path is being **removed**. After removal, all audio in the app flows through YouTube iframes, making real EQ universally impossible.

### Realistic Options

#### Option A: Keep Visual-Only EQ with Improved Labeling (No Change)

The EQ panel already exists, looks good, and stores values. Relabel from "Visual Only (v1)" to something like "EQ (Visual)" or simply remove the badge while adding a tooltip explaining the limitation. The values are already persisted in the store and could be used if a future audio pipeline is added.

**Effort**: Minimal (CSS/text change only)
**Benefit**: Honest UX, sets expectation correctly

#### Option B: Remove EQ Panel

Remove `EQPanel.tsx` and all `eqLow/eqMid/eqHigh` fields from `DeckState` since they have no functional effect.

**Effort**: Medium (store, types, component, and parent layout changes)
**Risk**: Loses the visual affordance that makes the UI look like a DJ mixer; removing EQ makes the deck look incomplete compared to real DJ software

#### Option C: Implement a Software EQ Simulation via a Proxy Architecture (Future)

If a future version of the app routes YouTube audio through a local server (e.g., using `yt-dlp` streaming without downloading, or a WebSocket proxy), then the app would have a local `MediaStream` that CAN be routed through Web Audio API `BiquadFilterNode`s.

**Architecture for functional EQ (requires audio proxy)**:
```
YouTube audio → local proxy server → MediaSource API → HTMLAudioElement
                                      (same-origin)
AudioContext.createMediaElementSource(audioElement)
  → BiquadFilterNode (low shelf, freq=200Hz)
  → BiquadFilterNode (peaking, freq=1000Hz)
  → BiquadFilterNode (high shelf, freq=8000Hz)
  → AudioContext.destination
```

The three BiquadFilterNode types for a 3-band EQ:
- **Low band**: `type='lowshelf'`, `frequency=200`, `gain=eqLow`
- **Mid band**: `type='peaking'`, `frequency=1000`, `Q=1.0`, `gain=eqMid`
- **High band**: `type='highshelf'`, `frequency=8000`, `gain=eqHigh`

This approach is technically correct and would work perfectly — but requires the proxy infrastructure that does not exist.

### Recommendation

**Keep the visual EQ as-is** (Option A) with a minor UX improvement:
- Update the badge tooltip to clearly state the technical reason: "YouTube's cross-origin iframe prevents direct audio access. EQ is visual only."
- The `eqLow`, `eqMid`, `eqHigh` values remain in the store, ready to be wired up if a proxy audio path is ever implemented.
- **Do not invest implementation effort** in the EQ for this sprint — the blocker is architectural, not a missing implementation detail.

### EQ Implementation Would Work For

If the download feature were kept (which it is not), local tracks via `useLocalAudioPlayer` would be the only path where functional EQ is achievable. Since that path is being removed, there is no audio source in the current app where EQ can be wired.

---

## 6. Playback Controls Addition

### Current State

**`src/components/Deck/DeckControls.tsx`** renders three controls:

1. **CUE (Jump to Cue)** — seeks to `hotCues[0]` via `playerRegistry.get(deckId).seekTo(cuePoint, true)`
2. **PLAY/PAUSE** — toggles `playbackState` in `deckStore`
3. **SET CUE** — stores `currentTime` as `hotCues[0]`

The seek call signature at line 64–65:
```typescript
const player = playerRegistry.get(deckId);
if (player) {
  player.seekTo(cuePoint, true);
}
```

`YT.Player.seekTo(seconds: number, allowSeekAhead: boolean): void`
- `seconds`: target position in seconds
- `allowSeekAhead`: when `true`, the player will make a new request to the server for unbuffered positions; when `false`, it seeks only within buffered segments

**`src/services/playerRegistry.ts`**:
- Only exposes `register`, `unregister`, and `get`
- No `seekTo` wrapper method
- No `getCurrentTime` wrapper method
- Current time is read directly via `playerRef.current.getCurrentTime()` inside `useYouTubePlayer.ts`

**`src/store/deckStore.ts`**:
- `currentTime` is available in `DeckState` (line 30), polled from the player every 250ms
- `setCurrentTime` action exists (line 61) — called by the poll, not for seeking

### What Needs to Be Added

Three new transport controls:

| Button | Label | Behavior | Icon suggestion |
|--------|-------|----------|-----------------|
| Skip Back | -15s | Seek to `Math.max(0, currentTime - 15)` | ⏮ or ⏪ |
| Skip Forward | +15s | Seek to `currentTime + 15` (no floor needed; YouTube handles end-of-track) | ⏩ or ⏭ |
| Restart | Return to start | Seek to `0` | ⏮⏮ or ↩ |

### Implementation Design

#### Option A: Direct playerRegistry access (same as existing CUE button)

The existing CUE button directly calls `playerRegistry.get(deckId).seekTo(...)`. The new skip/restart buttons can follow the same pattern. This is consistent with the existing code.

```typescript
function handleSkipBack() {
  if (!playerReady || !hasTrack) return;
  const player = playerRegistry.get(deckId);
  if (player) {
    const newTime = Math.max(0, currentTime - 15);
    player.seekTo(newTime, true);
  }
}

function handleSkipForward() {
  if (!playerReady || !hasTrack) return;
  const player = playerRegistry.get(deckId);
  if (player) {
    player.seekTo(currentTime + 15, true);
  }
}

function handleRestart() {
  if (!playerReady || !hasTrack) return;
  const player = playerRegistry.get(deckId);
  if (player) {
    player.seekTo(0, true);
  }
}
```

`currentTime` is already available in the component via `useDeck(deckId)` at line 32: `const { playbackState, videoId, currentTime, hotCues, playerReady } = deck;`

#### Option B: Add seekTo / getCurrentTime to playerRegistry

Add convenience methods to `playerRegistry.ts`:

```typescript
seekTo(deckId: DeckId, seconds: number): void {
  registry.get(deckId)?.seekTo(seconds, true);
},

getCurrentTime(deckId: DeckId): number {
  return registry.get(deckId)?.getCurrentTime() ?? 0;
},
```

This is cleaner for future callers but is a premature abstraction at this stage since the current time is already available from the Zustand store. Option A is preferred for this sprint to maintain consistency with existing patterns.

### playerRegistry.getCurrentTime Does Not Exist

Confirmed: `playerRegistry.ts` has no `getCurrentTime` method. The `currentTime` in `deckStore.decks[deckId].currentTime` is the polled value and is accurate to within 250ms — sufficient for skip/restart precision. No need to add a live `getCurrentTime` call to the registry.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/Deck/DeckControls.tsx` | Add 3 handler functions and 3 button elements |
| `src/components/Deck/DeckControls.module.css` | Add styling for the 3 new buttons |

### Button Placement

The current layout in `DeckControls` is a flex row:
```
[ ⏮ CUE ] [ ▶ PLAY ] [ SET CUE ]
```

Proposed new layout — skip controls flanking the CUE/PLAY/SET trio:
```
[ ↩ RESTART ] [ ⏪ -15s ] [ ⏮ CUE ] [ ▶ PLAY ] [ SET CUE ] [ +15s ⏩ ]
```

Or a simpler grouping with skip controls as a second row or grouped beside CUE:
```
Row 1: [ ⏮ CUE ] [ ▶ PLAY ] [ SET CUE ]
Row 2: [ ↩ ] [ -15s ] [ +15s ]
```

The architect should decide exact placement based on the DeckControls layout constraints. The key constraint is that the buttons should be disabled when `!hasTrack` (no track loaded) and when `!playerReady`.

### Local Audio Consideration

Currently, `DeckControls` uses `playerRegistry.get(deckId)` which only has `YT.Player` instances. After the download feature removal (area 1), there is no local audio path, so all decks always use the YouTube player. No special-casing needed for the skip controls.

---

## Cross-Cutting Notes

### isLocal / audioUrl Cleanup (from Area 1)

After removing the download feature, the `isLocal` guard checks in `useYouTubePlayer.ts` (lines 268, 291, 330, 341) are dead code. Each guard checks `if (isLocal) return;` to prevent the YouTube player from acting on a local-audio deck. Once `loadLocalTrack` is gone and `isLocal` is always `false`, these guards do nothing. They can be safely removed to clean up the hook.

### No Server Dependency After Removal

After area 1, the app has no remaining runtime dependency on `localhost:3001`. The `server/` directory becomes an orphaned artifact. It can be deleted or archived.

### Test Files

Check `src/test/` for any tests covering:
- `downloadService.ts`
- `playlistStore.ts`
- `PlaylistTab.tsx`
- `useLocalAudioPlayer.ts`

These must be deleted as part of the download feature removal.

---

## Summary Table

| Area | Effort | Files Changed | Blocker |
|------|--------|---------------|---------|
| 1. Download Removal | Medium | 6 deleted, ~5 modified | None |
| 2. Search Relevance | Small | 1 modified (`youtubeDataApi.ts`) | None |
| 3. Result Persistence | Trivial | 1 modified (`SearchPanel.tsx`) — one-line deletion | None |
| 4. Infinite Scroll / Load More | Small | 1–2 modified (`SearchPanel.tsx`, optional `SearchResultList.tsx`) | None |
| 5. EQ Implementation | None (keep visual) | 0 | YouTube CORS prevents real EQ |
| 6. Playback Controls | Small | 2 modified (`DeckControls.tsx`, `.module.css`) | None |
