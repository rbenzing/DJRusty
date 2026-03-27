# Feature Sprint - Story Breakdown

**Project**: DJRusty
**Date**: 2026-03-24
**Agent**: Planner
**Source**: `/orchestration/artifacts/research/feature-sprint-research.md`

---

## Dependency Order

```
Story 1 (Remove Download Feature)
  |
  +---> Story 2 (Improve Search)
  +---> Story 3 (Playback Skip Controls)
  +---> Story 4 (Update EQ Panel Tooltip)
```

Stories 2, 3, and 4 depend on Story 1 completing first (Story 1 modifies `SearchPanel.tsx`, `SearchResult.tsx`, `SearchResultList.tsx`, `deckStore.ts`, and `deck.ts` which are also touched or depend on clean state for Stories 2-4). Stories 3 and 4 are independent of each other.

---

## Story 1: Remove Download Feature

**ID**: SPRINT-001
**Title**: Remove Download Feature (Server + Frontend)
**Complexity**: Medium
**Status**: Not Started

### Description

Remove all download-related code from the frontend and delete the Express download server. The "Recently Used" tab and "Search" tab must remain fully functional. The Playlist tab, local audio playback path, and all download service code are removed entirely.

### Files to DELETE

| File | Reason |
|------|--------|
| `src/services/downloadService.ts` | All 4 functions exclusively serve the download feature |
| `src/store/playlistStore.ts` | Entire Zustand store exclusively serves downloads |
| `src/components/Search/PlaylistTab.tsx` | Downloaded-tracks playlist UI tab |
| `src/components/Search/PlaylistTab.module.css` | CSS module for PlaylistTab |
| `src/hooks/useLocalAudioPlayer.ts` | HTML5 Audio player hook only activates when `isLocal` is true |
| `src/types/playlist.ts` | `PlaylistTrack` type has no remaining consumers after removal |
| `server/` | Entire directory -- Express + yt-dlp download server |

### Files to MODIFY

#### `src/App.tsx`

1. **Remove import** (line 14): `import type { PlaylistTrack } from './types/playlist';`
2. **Remove interface** (lines 38-41): `LoadLocalTrackEventDetail` interface
3. **Remove effect block** (lines 108-123): The entire `useEffect` that listens for `dj-rusty:load-local-track` and calls `loadLocalTrack`

**Keep intact**: The `dj-rusty:load-track` listener (lines 81-106) -- this is the bridge for YouTube track loads including Recently Used.

#### `src/components/Search/SearchPanel.tsx`

1. **Remove imports** (lines 26, 28-30):
   - `import { PlaylistTab } from './PlaylistTab';`
   - `import { downloadTrack } from '../../services/downloadService';`
   - `import { usePlaylistStore } from '../../store/playlistStore';`
   - `import type { PlaylistTrack } from '../../types/playlist';`
2. **Change ActiveTab type** (line 53): From `'search' | 'recent' | 'playlist'` to `'search' | 'recent'`
3. **Remove function** (lines 146-153): `handleAddToPlaylist` async function
4. **Remove function** (lines 155-160): `handleLoadLocalToDeck` function
5. **Remove prop** (line 271): `onAddToPlaylist={(result) => { void handleAddToPlaylist(result); }}` from `SearchResultList`
6. **Remove tab button** (lines 239-249): The "Playlist" tab button from the tablist
7. **Remove tabpanel** (lines 314-322): The Playlist tabpanel `<div>` block containing `<PlaylistTab>`
8. **Remove** `clearResults` from the destructured `useSearchStore` call (line 62) -- it is still used in `handleClear`, but this removal is handled in Story 2. For Story 1, leave `clearResults` in place.

#### `src/components/Search/SearchResultList.tsx`

1. **Remove prop definition** (line 24): `onAddToPlaylist?: (result: YouTubeVideoSummary) => void;` from `SearchResultListProps`
2. **Remove destructured prop** (line 45): `onAddToPlaylist,` from the props destructuring
3. **Remove prop spread** (line 106): `{...(onAddToPlaylist ? { onAddToPlaylist } : {})}` from `SearchResult` props

#### `src/components/Search/SearchResult.tsx`

1. **Remove prop definition** (line 21): `onAddToPlaylist?: (result: YouTubeVideoSummary) => void;` from `SearchResultProps`
2. **Remove destructured prop** (line 29): `onAddToPlaylist` from the destructured props
3. **Remove state** (line 44): `const [adding, setAdding] = useState(false);`
4. **Remove function** (lines 54-60): `handleAddToPlaylist` function
5. **Remove JSX** (lines 139-150): The download/save button block `{onAddToPlaylist && ( ... )}`

#### `src/store/deckStore.ts`

1. **Remove initial state fields** (lines 33-34): `isLocal: false,` and `audioUrl: null,`
2. **Remove action signature** (lines 106-117): `loadLocalTrack` from `DeckStoreActions` interface
3. **Remove implementation** (lines 178-199): `loadLocalTrack` action body
4. **Remove fields in `loadTrack`** (lines 173-174): `isLocal: false,` and `audioUrl: null,` from the `loadTrack` action's `updateDeck` call
5. **Remove fields in `clearTrack`** (lines 302-303): `isLocal: false,` and `audioUrl: null,` from the `clearTrack` action's `updateDeck` call

#### `src/types/deck.ts`

1. **Remove field declarations** (lines 82-85): `isLocal: boolean;` and `audioUrl: string | null;` with their JSDoc comments

#### `src/hooks/useYouTubePlayer.ts`

1. **Remove isLocal guards** at lines 268-269, 290-291, 310-311, 329+341: Remove the `const isLocal = state.decks[deckId].isLocal;` and `if (isLocal) return;` guard pairs. These are dead code once `isLocal` is removed from `DeckState`.

### Acceptance Criteria

- [ ] All 7 files listed in "Files to DELETE" are deleted from the project
- [ ] The entire `server/` directory is deleted (including `node_modules`, `package.json`, `.gitignore`, `index.js`)
- [ ] `src/App.tsx` no longer imports `PlaylistTrack` type or listens for `dj-rusty:load-local-track` events
- [ ] `SearchPanel.tsx` only has two tabs: "Search" and "Recent" -- no "Playlist" tab visible
- [ ] `SearchPanel.tsx` no longer imports `PlaylistTab`, `downloadTrack`, `usePlaylistStore`, or `PlaylistTrack`
- [ ] `SearchResultList.tsx` no longer accepts or passes an `onAddToPlaylist` prop
- [ ] `SearchResult.tsx` no longer renders a download/save button (the `↓` button is gone)
- [ ] `SearchResult.tsx` no longer has `adding` state or `handleAddToPlaylist` function
- [ ] `DeckState` type in `src/types/deck.ts` no longer has `isLocal` or `audioUrl` fields
- [ ] `deckStore.ts` no longer has a `loadLocalTrack` action
- [ ] `useYouTubePlayer.ts` no longer has `isLocal` guard checks
- [ ] The "Search" tab works correctly: search, results display, load to deck A/B, copy URL, keyboard navigation
- [ ] The "Recent" tab works correctly: shows recently played tracks, load to deck A/B
- [ ] The `dj-rusty:load-track` event (YouTube loads) still functions correctly
- [ ] The application builds without TypeScript errors (`npm run build` succeeds)
- [ ] No runtime console errors related to removed code

### Testing Requirements

- Verify build compiles cleanly with zero TypeScript errors
- Verify Search tab: perform a search, load result to Deck A, load result to Deck B
- Verify Recent tab: shows tracks after loading, allows re-loading to deck
- Verify no download button appears on search results
- Verify no Playlist tab appears in the tab bar
- Verify no console errors referencing deleted modules

---

## Story 2: Improve Search (Relevance + Persistence + Load More UX)

**ID**: SPRINT-002
**Title**: Improve Search Relevance, Result Persistence, and Load More UX
**Complexity**: Small
**Status**: Not Started
**Depends On**: SPRINT-001

### Description

Three search improvements bundled into one story:

1. **Search Relevance**: Add `videoEmbeddable=true` and `videoDuration=medium` parameters to the YouTube Data API search call. This filters out non-embeddable videos (which cause embed errors on decks) and short clips under 4 minutes (not useful for DJ sets). Keep existing `videoCategoryId=10` and `channelId` scoping.

2. **Result Persistence**: Remove the `clearResults()` call from the `handleClear` function in `SearchPanel.tsx`. When the user clicks the X button to clear the search input, results should remain visible. Results are only replaced when a new search is submitted (which already works via `setResults` in `performSearch`). Also remove `setHasSearched(false)` from `handleClear` so the results list does not revert to the "Search for a track to get started" empty state.

3. **Load More UX**: Add a `loadingMore` state to distinguish next-page fetches from initial search loading. Show a spinner/disabled state on the "Load Next Page" button during next-page fetches instead of hiding the button entirely (the current `!loading` condition hides the button during ALL loads, including pagination loads, because `loading` is shared).

### Files to MODIFY

#### `src/services/youtubeDataApi.ts`

**In the `searchVideos` function (line 194-202)**, add two parameters to the `apiFetch` call:

```
videoEmbeddable: 'true',
videoDuration: 'medium',
```

These go alongside the existing `videoCategoryId: '10'` parameter.

#### `src/components/Search/SearchPanel.tsx`

**Task 2a -- Result Persistence (handleClear function, lines 127-131)**:

Change `handleClear` from:
```typescript
function handleClear() {
  setQuery('');
  clearResults();
  setHasSearched(false);
}
```
To:
```typescript
function handleClear() {
  setQuery('');
}
```

Remove both `clearResults()` and `setHasSearched(false)`. The `clearResults` import from `useSearchStore` destructuring (line 62) can also be removed if it has no other callers in this file (it does not after this change).

**Task 2b -- Load More UX (performSearch + pagination button)**:

1. Add a `loadingMore` local state: `const [loadingMore, setLoadingMore] = useState(false);`
2. In `performSearch`, when `pageToken` is defined (next-page fetch), set `loadingMore` to `true` before the fetch and `false` in the `finally` block. Do NOT call `setLoading(true)` for pagination fetches -- only for initial searches.
3. Update the pagination button condition from `{nextPageToken && !loading && (` to `{nextPageToken && !loading && (` (keep the `!loading` to hide during initial searches) but add a disabled + spinner state inside the button:
   - When `loadingMore` is true: button is disabled, text shows a spinner indicator (e.g., "Loading..." or a CSS spinner)
   - When `loadingMore` is false: button shows "Load Next Page" as before
4. The button should remain visible during `loadingMore` (not hidden).

Updated `performSearch` logic:
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

Updated pagination button:
```tsx
{nextPageToken && !loading && (
  <div className={styles.pagination}>
    <button
      type="button"
      className={styles.nextPageBtn}
      onClick={handleNextPage}
      disabled={loadingMore}
      aria-label="Load next page of results"
    >
      {loadingMore ? 'Loading...' : 'Load Next Page'}
    </button>
  </div>
)}
```

### Acceptance Criteria

- [ ] YouTube API search calls include `videoEmbeddable=true` parameter
- [ ] YouTube API search calls include `videoDuration=medium` parameter
- [ ] Existing parameters (`videoCategoryId=10`, `channelId`, `pageToken`, `maxResults=20`) are unchanged
- [ ] Clicking the search bar clear (X) button clears the input text but does NOT clear the search results list
- [ ] After clearing the input, the results list still shows the previous search results
- [ ] After clearing the input, the empty-state message ("Search for a track to get started") does NOT reappear
- [ ] Submitting a new search replaces the old results (existing behavior, unchanged)
- [ ] The "Load Next Page" button shows a disabled/loading state during next-page fetches
- [ ] The "Load Next Page" button text changes to "Loading..." (or shows a spinner) during next-page fetches
- [ ] The full-list skeleton loading state still appears for initial searches (not for pagination)
- [ ] The "Load Next Page" button is not hidden during next-page fetches
- [ ] The application builds without TypeScript errors

### Testing Requirements

- Verify search results no longer include non-embeddable videos (test by loading results to a deck -- no embed errors)
- Verify search results filter out short clips (results should be 4-20 minutes for `medium` duration)
- Verify clearing search input preserves results
- Verify submitting new search replaces results
- Verify "Load Next Page" shows loading state and is disabled during fetch
- Verify initial search still shows skeleton loading
- Verify build compiles cleanly

---

## Story 3: Add Playback Skip Controls

**ID**: SPRINT-003
**Title**: Add Skip Back, Skip Forward, and Restart Buttons to Deck Controls
**Complexity**: Small
**Status**: Not Started
**Depends On**: SPRINT-001

### Description

Add three new transport control buttons to each deck's `DeckControls` component:

| Button | Label | Behavior | Icon |
|--------|-------|----------|------|
| **Restart** | Restart | Seeks to position 0 | &#x21BA; (arrow loop) |
| **Skip Back** | -15s | Seeks back 15 seconds (floor at 0) | &#x23EA; (rewind) |
| **Skip Forward** | +15s | Seeks forward 15 seconds | &#x23E9; (fast-forward) |

All three buttons use the same `playerRegistry.get(deckId)?.seekTo(target, true)` pattern established by the existing CUE button. Current time is read from `useDeck(deckId).currentTime` which is already available in the component (line 32).

### Files to MODIFY

#### `src/components/Deck/DeckControls.tsx`

Add three handler functions following the existing `handleJumpToCue` pattern:

```typescript
function handleRestart() {
  if (!playerReady || !hasTrack) return;
  const player = playerRegistry.get(deckId);
  if (player) {
    player.seekTo(0, true);
  }
}

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
```

Add three button elements to the JSX. Place them in this order using CSS `order` for visual layout:

**Target layout**:
```
[ ↺ RESTART ] [ ⏪ -15s ] [ ⏮ CUE ] [ ▶ PLAY ] [ SET CUE ] [ +15s ⏩ ]
```

All three new buttons:
- Are disabled when `!hasTrack` (no track loaded)
- Are disabled when `!playerReady` (player not initialized)
- Have descriptive `aria-label` attributes including the deck ID
- Follow the existing `.btn` base CSS class pattern

#### `src/components/Deck/DeckControls.module.css`

Add CSS classes for the three new buttons with `order` values to position them correctly:

- `.restartBtn` -- `order: -3` (leftmost)
- `.skipBackBtn` -- `order: -2` (second from left)
- `.skipFwdBtn` -- `order: 2` (rightmost)

The existing order values are: `.cueBtn` = `-1`, `.playBtn` = `0`, `.setCueBtn` = `1`.

The new buttons should use the same `.btn` base styling. They may have a slightly smaller `min-width` or different font-size since their labels are shorter. Keep consistent styling with the existing transport controls.

### Acceptance Criteria

- [ ] Each deck (A and B) displays three new buttons: Restart, Skip Back (-15s), Skip Forward (+15s)
- [ ] **Restart** button seeks the track to position 0 when clicked
- [ ] **Skip Back** button seeks back 15 seconds from current position; floors at 0 (does not go negative)
- [ ] **Skip Forward** button seeks forward 15 seconds from current position
- [ ] All three buttons are disabled when no track is loaded (`!hasTrack`)
- [ ] All three buttons are disabled when the player is not ready (`!playerReady`)
- [ ] All three buttons have accessible `aria-label` attributes (e.g., "Restart Deck A", "Skip back 15 seconds on Deck A")
- [ ] Button layout order is: Restart, -15s, CUE, PLAY, SET CUE, +15s
- [ ] Buttons use the same visual style (`.btn` base class) as existing transport controls
- [ ] Seeking uses `playerRegistry.get(deckId).seekTo(target, true)` -- same pattern as CUE button
- [ ] The application builds without TypeScript errors

### Testing Requirements

- Load a track on Deck A, play it for 30+ seconds, click Skip Back -- verify position decreases by ~15s
- Click Skip Back when track is at <15s position -- verify position goes to 0 (not negative)
- Click Skip Forward -- verify position increases by ~15s
- Click Restart -- verify position goes to 0
- Verify all buttons are disabled when no track is loaded
- Verify all buttons work on both Deck A and Deck B
- Verify build compiles cleanly

---

## Story 4: Update EQ Panel Tooltip

**ID**: SPRINT-004
**Title**: Update EQ Panel Tooltip and Badge to Explain CORS Limitation
**Complexity**: Trivial
**Status**: Not Started
**Depends On**: SPRINT-001

### Description

The EQ panel currently shows a "Visual Only (v1)" badge and a tooltip reading "Visual Only -- EQ processing coming in v2". This is misleading because it implies EQ processing is planned for a v2 release, when in fact YouTube's cross-origin iframe prevents direct audio access entirely -- making real EQ impossible as long as the app uses YouTube iframes for playback.

Update the tooltip and badge to explain the limitation clearly and professionally. Remove the implication that functional EQ is coming soon.

### Files to MODIFY

#### `src/components/Deck/EQPanel.tsx`

1. **Update the badge text** (line 166): Change from `Visual Only (v1)` to `Visual Only`

2. **Update the badge tooltip** (line 164): Change the `title` attribute from:
   ```
   EQ is visual only in v1 -- audio EQ requires a future audio pipeline upgrade (CORS limitation)
   ```
   To:
   ```
   YouTube embeds play inside a cross-origin iframe, which prevents the browser from accessing the audio stream. EQ knobs are visual only -- values are stored and ready for a future direct-audio playback mode.
   ```

3. **Update each knob's title attribute** (line 132): Change from:
   ```
   Visual Only -- EQ processing coming in v2
   ```
   To:
   ```
   Visual only -- cross-origin iframe audio cannot be processed
   ```

4. **Update each knob's aria-label** (line 127): The existing `(visual only)` suffix in the aria-label is already accurate. No change needed.

### Acceptance Criteria

- [ ] The EQ panel badge text reads "Visual Only" (not "Visual Only (v1)")
- [ ] The EQ panel badge tooltip explains the cross-origin iframe limitation clearly
- [ ] The badge tooltip does NOT promise EQ in a future version
- [ ] Each EQ knob's title tooltip explains the limitation (not "coming in v2")
- [ ] The aria-label for each knob still includes "(visual only)" for screen readers
- [ ] EQ knob interaction (drag, arrow keys, double-click reset) still works correctly
- [ ] EQ values are still stored in `deckStore` (no functional changes to state management)
- [ ] The application builds without TypeScript errors

### Testing Requirements

- Hover over the "Visual Only" badge -- verify tooltip explains CORS/iframe limitation
- Hover over any EQ knob -- verify tooltip says "Visual only" without "v2" promise
- Drag an EQ knob -- verify interaction still works
- Double-click a knob -- verify it resets to 0
- Verify build compiles cleanly

---

## Summary

| Story | ID | Complexity | Files Deleted | Files Modified | Depends On |
|-------|----|-----------|---------------|----------------|------------|
| Remove Download Feature | SPRINT-001 | Medium | 7 files + `server/` dir | 7 files | None |
| Improve Search | SPRINT-002 | Small | 0 | 2 files | SPRINT-001 |
| Playback Skip Controls | SPRINT-003 | Small | 0 | 2 files | SPRINT-001 |
| Update EQ Tooltip | SPRINT-004 | Trivial | 0 | 1 file | SPRINT-001 |

**Total Stories**: 4
**Total Files Deleted**: 7 (+ `server/` directory tree)
**Total Files Modified**: 12 unique files across all stories

### Implementation Order

1. **SPRINT-001** -- Must complete first (modifies shared files, removes dead code)
2. **SPRINT-002** -- After SPRINT-001 (modifies `SearchPanel.tsx` which was cleaned in Story 1)
3. **SPRINT-003** -- After SPRINT-001, parallel with SPRINT-002 and SPRINT-004 (isolated to `DeckControls`)
4. **SPRINT-004** -- After SPRINT-001, parallel with SPRINT-002 and SPRINT-003 (isolated to `EQPanel`)
