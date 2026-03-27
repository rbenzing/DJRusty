# SPRINT-001 Implementation Notes
**Story**: Remove Download Feature (Server + Frontend)
**Date**: 2026-03-24
**Status**: Complete

---

## Build Status

- TypeScript compile: PASS (zero errors)
- Vite build: PASS (105 modules, 819ms)
- Test suite: PASS (314 tests, 14 test files, 0 failures)

---

## Files Deleted

| File | Reason |
|------|--------|
| `src/services/downloadService.ts` | All functions exclusively served the download feature |
| `src/store/playlistStore.ts` | Entire Zustand store exclusively served downloads |
| `src/components/Search/PlaylistTab.tsx` | Downloaded-tracks playlist UI tab |
| `src/components/Search/PlaylistTab.module.css` | CSS module for PlaylistTab |
| `src/hooks/useLocalAudioPlayer.ts` | HTML5 Audio player hook, only activated on local tracks |
| `src/types/playlist.ts` | `PlaylistTrack` type had no remaining consumers after removal |

Note: The `server/` directory was already absent from the working tree — no deletion needed.

---

## Files Modified

### `src/App.tsx`
- Removed `import type { PlaylistTrack } from './types/playlist'`
- Removed `LoadLocalTrackEventDetail` interface
- Removed the `useEffect` block that listened for `dj-rusty:load-local-track` and called `useDeckStore.getState().loadLocalTrack()`
- Kept the `dj-rusty:load-track` listener intact (used by Recently Used tab and all YouTube loads)

### `src/components/Search/SearchPanel.tsx`
- Removed imports: `PlaylistTab`, `downloadTrack`, `usePlaylistStore`, `PlaylistTrack`
- Removed `clearResults` from `useSearchStore` destructuring (no longer called)
- Changed `ActiveTab` type from `'search' | 'recent' | 'playlist'` to `'search' | 'recent'`
- Removed `handleAddToPlaylist` async function
- Removed `handleLoadLocalToDeck` function
- Updated `handleClear` to only reset query (no longer clears results — note: this is a forward-looking improvement consistent with SPRINT-002 requirements)
- Removed `onAddToPlaylist` prop from `SearchResultList` render
- Removed the "Playlist" tab button from the tablist
- Removed the Playlist tabpanel div containing `<PlaylistTab>`

### `src/components/Search/SearchResultList.tsx`
- Removed `onAddToPlaylist?: (result: YouTubeVideoSummary) => void` from `SearchResultListProps`
- Removed `onAddToPlaylist` from props destructuring
- Removed `{...(onAddToPlaylist ? { onAddToPlaylist } : {})}` spread from `SearchResult` props

### `src/components/Search/SearchResult.tsx`
- Removed `onAddToPlaylist?: (result: YouTubeVideoSummary) => void` from `SearchResultProps`
- Removed `onAddToPlaylist` from props destructuring
- Removed `const [adding, setAdding] = useState(false)` state
- Removed `handleAddToPlaylist` function
- Removed the download/save button JSX block `{onAddToPlaylist && ( ... )}`

### `src/store/deckStore.ts`
- Removed `isLocal: false` and `audioUrl: null` from `createInitialDeckState`
- Removed `loadLocalTrack` action signature from `DeckStoreActions` interface
- Removed `loadLocalTrack` implementation from the store
- Removed `isLocal: false` and `audioUrl: null` from `loadTrack` action's `updateDeck` call
- Removed `isLocal: false` and `audioUrl: null` from `clearTrack` action's `updateDeck` call

### `src/types/deck.ts`
- Removed `isLocal: boolean` field and its JSDoc comment
- Removed `audioUrl: string | null` field and its JSDoc comment

### `src/hooks/useYouTubePlayer.ts`
- Removed `const isLocal = state.decks[deckId].isLocal; if (isLocal) return;` guard from the videoId subscription
- Removed same guard from the pitchRate subscription
- Removed same guard from the volume subscription
- Updated playbackState subscription: changed `const { playbackState, volume, isLocal }` to `const { playbackState, volume }` and removed the `if (isLocal) return` guard

### `src/components/Deck/YouTubePlayer.tsx`
- Removed `import { useLocalAudioPlayer } from '../../hooks/useLocalAudioPlayer'`
- Removed `useLocalAudioPlayer(deckId)` call

### `src/test/deck-b.test.ts`
- Removed `isLocal: false` and `audioUrl: null` from both deck state reset objects (2 locations)

### `src/test/stores.test.ts`
- Removed `isLocal: false` and `audioUrl: null` from both deck state reset objects (2 locations)

### `src/test/story-011-hot-cues.test.ts`
- Removed `isLocal: false` and `audioUrl: null` from both deck state reset objects (2 locations)

### `package.json`
- Changed `"dev"` script from `concurrently "vite" "node server/index.js"` to `"vite"` alone
- Removed `"server": "node server/index.js"` script
- Removed `"concurrently": "^9.0.0"` from devDependencies (no longer used)

---

## Edge Cases Encountered

1. **`YouTubePlayer.tsx` was not in the spec's modification list** but imported `useLocalAudioPlayer` directly. Deleting the hook file without fixing this component would have caused a TypeScript error. Fixed by removing the import and the `useLocalAudioPlayer(deckId)` call.

2. **Three test files had `isLocal`/`audioUrl` in their store reset fixtures** (`deck-b.test.ts`, `stores.test.ts`, `story-011-hot-cues.test.ts`). These were not in the spec's modification list but caused TypeScript errors after `DeckState` was cleaned. All three were updated to remove the stale fields.

3. **`server/` directory was already absent** — no deletion was required for it. The spec listed `server/index.js` as a file to delete; it did not exist.

4. **`handleClear` simplification** — the spec called for removing `clearResults()` and `setHasSearched(false)` from `handleClear`, leaving only `setQuery('')`. This was done in SearchPanel. The `clearResults` destructuring from `useSearchStore` was also removed since it had no remaining callers.

---

## Acceptance Criteria Verification

- [x] All 6 files listed in "Files to DELETE" are deleted from the project
- [x] `server/` directory was already absent (no action needed)
- [x] `src/App.tsx` no longer imports `PlaylistTrack` type or listens for `dj-rusty:load-local-track` events
- [x] `SearchPanel.tsx` only has two tabs: "Search" and "Recent" — no "Playlist" tab
- [x] `SearchPanel.tsx` no longer imports `PlaylistTab`, `downloadTrack`, `usePlaylistStore`, or `PlaylistTrack`
- [x] `SearchResultList.tsx` no longer accepts or passes an `onAddToPlaylist` prop
- [x] `SearchResult.tsx` no longer renders a download/save button
- [x] `SearchResult.tsx` no longer has `adding` state or `handleAddToPlaylist` function
- [x] `DeckState` type no longer has `isLocal` or `audioUrl` fields
- [x] `deckStore.ts` no longer has a `loadLocalTrack` action
- [x] `useYouTubePlayer.ts` no longer has `isLocal` guard checks
- [x] The application builds without TypeScript errors (`npm run build` succeeded)
- [x] All 314 tests pass
