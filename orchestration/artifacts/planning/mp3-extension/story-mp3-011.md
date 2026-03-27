# Story mp3-011: UI Cleanup -- Remove Load A/B Buttons

## Summary
Remove the LOAD A / LOAD B buttons from `SearchResult.tsx`, remove the associated `onLoadToDeck` prop chain and `dj-rusty:load-track` CustomEvent listener, update empty state hint text in `Deck.tsx`, and widen the +A/+B buttons as the primary add action.

## Background
The LOAD A / LOAD B buttons bypass the playlist queue by loading a track directly into the deck. With the MP3 extension, all track loading goes through the playlist (add to playlist -> playlist drives the deck). The +A/+B queue buttons are already the correct workflow. The LOAD buttons are redundant and confusing, so they are removed.

## Acceptance Criteria
- [ ] LOAD A and LOAD B `<button>` elements removed from `SearchResult.tsx`
- [ ] `onLoadToDeck` prop removed from `SearchResultProps` interface in `SearchResult.tsx`
- [ ] `onLoadToDeck` prop removed from `SearchResultList.tsx` props interface and prop threading
- [ ] `handleLoadToDeck` function removed from `SearchPanel.tsx`
- [ ] `onLoadToDeck` prop removed from `SearchPanel.tsx` -> `SearchResultList.tsx` -> `SearchResult.tsx` chain
- [ ] `dj-rusty:load-track` CustomEvent listener removed from `App.tsx`
- [ ] `LoadTrackEventDetail` interface (if any) removed from `App.tsx`
- [ ] `addRecentTrack` call moved to `playlistStore.loadDeckTrack` (or equivalent location) so recently played tracks are still tracked when a playlist entry becomes active
- [ ] `.loadBtn`, `.loadBtnA`, `.loadBtnB` CSS classes removed from `SearchResult.module.css`
- [ ] +A/+B buttons widened from 28px to 40px in `SearchResult.module.css` (`.saveBtn` width change)
- [ ] +A/+B button labels remain "+A" / "+B" (or changed to "+ A" / "+ B" with space for readability)
- [ ] Deck A hover accent on +A button: `var(--color-deck-a-text)` border on hover
- [ ] Deck B hover accent on +B button: `var(--color-deck-b-text)` border on hover
- [ ] Empty state text in `Deck.tsx` updated from "Search for a track below and click LOAD {deckId}" to "Drag an MP3 file here, or search and click +{deckId}"
- [ ] Empty state text in `PlaylistPanel.tsx` updated to "Drag MP3 files here, or search for a track and click +{deckId}"
- [ ] TypeScript compilation passes
- [ ] No runtime errors when searching and adding tracks to playlists

## Technical Notes
- The `dj-rusty:load-track` CustomEvent was dispatched in `SearchPanel.tsx` `handleLoadToDeck` and listened for in `App.tsx`. Both sides must be removed.
- `addRecentTrack` is currently called in `App.tsx` `handleLoadTrack`. After removing this, recent tracks must be recorded elsewhere -- the best place is inside `playlistStore.loadDeckTrack` or `playlistStore.jumpToTrack`, since those are the only paths that activate a track in a deck. Check how `addRecentTrack` works (likely in a separate store or utility) and wire it appropriately.
- The +A/+B buttons already call `playlistStore.addTrack()` which cues the first track if the playlist was empty. No behavior change needed for the buttons themselves.

### Files to modify
- `src/components/Search/SearchResult.tsx` -- remove LOAD buttons, remove `onLoadToDeck` prop
- `src/components/Search/SearchResult.module.css` -- remove `.loadBtn` classes, widen `.saveBtn`
- `src/components/Search/SearchResultList.tsx` -- remove `onLoadToDeck` prop
- `src/components/Search/SearchPanel.tsx` -- remove `handleLoadToDeck`, remove prop threading
- `src/App.tsx` -- remove `dj-rusty:load-track` listener and handler
- `src/components/Deck/Deck.tsx` -- update empty state hint text
- `src/components/Playlist/PlaylistPanel.tsx` -- update empty state hint text

### Edge cases
- Ensure the recent tracks feature still records tracks when they play through the playlist flow
- Verify that the search result "Now Playing" badges (A/B) still work after removing the load buttons (they read from deckStore, not related to load buttons)

## Dependencies
- mp3-001 (Track Type Extensions -- for `artist` field rename in case hints reference it)

## Out of Scope
- File drag-and-drop (mp3-005)
- Download button for YouTube results (mp3-012)
- Cross-deck drag (mp3-014)
