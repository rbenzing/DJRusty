# Story mp3-013: Download Progress and Library Tab

## Summary
Show download progress indicators on YouTube playlist entries that are being downloaded, and add a "Downloads" tab to the SearchPanel that lists all previously downloaded tracks from the server's manifest.

## Background
When a YouTube track is added to a playlist and begins downloading, the user needs visual feedback. Currently there is no indication of download progress. Additionally, users should be able to browse their library of previously downloaded tracks and add them to playlists without re-searching.

## Acceptance Criteria
- [ ] **Playlist entry download status:** `PlaylistTrack.tsx` shows a download status indicator for YouTube entries:
  - `'downloading'`: show a small spinner (CSS-only, 12px) and "Downloading..." text in place of the duration
  - `'ready'`: normal display (duration shown, no spinner)
  - `'error'`: show error icon and "Download failed" text in red
- [ ] Download status is tracked per playlist entry. The `useAudioEngine` hook (or a new `useDownloadStatus` hook) sets status on the entry.
- [ ] `PlaylistEntry` gains a `downloadStatus?: 'downloading' | 'ready' | 'error'` field
- [ ] `playlistStore` gains an `updateEntryStatus(deckId: 'A' | 'B', entryId: string, updates: Partial<PlaylistEntry>)` action
- [ ] **Downloads tab:** A new "Downloads" tab added to SearchPanel's tab bar (after "Playlist" tab)
- [ ] `src/components/Search/DownloadedTracksPanel.tsx` created
- [ ] DownloadedTracksPanel calls `downloadService.listDownloadedTracks()` on mount and displays results
- [ ] Each downloaded track shows: title, artist/channel, duration, "Add to A" / "Add to B" buttons
- [ ] Clicking "Add to A/B" creates a `PlaylistEntry` with `sourceType: 'youtube'`, `videoId`, `audioUrl` pre-set to the server URL, `downloadStatus: 'ready'`
- [ ] Downloaded tracks list refreshes when the tab becomes active (re-fetches from server)
- [ ] If server is not running, show "Download server is not running" message in the Downloads tab
- [ ] Delete button per track calls `downloadService.deleteDownloadedTrack(videoId)` and removes it from the list
- [ ] Tab badge shows count of downloaded tracks (e.g., "Downloads (12)")

## Technical Notes
- The DownloadedTracksPanel is a simple list component. Use `useEffect` to fetch on mount/tab activation.
- The download status on playlist entries can be set by the `useAudioEngine` hook as part of the YouTube download flow from mp3-012. When polling status and receiving `'downloading'`, update the entry. When `'ready'`, update and proceed to fetch/decode.
- Consider adding `downloadStatus` to `PlaylistEntry` as an optional field that defaults to `undefined` (not downloading). Only YouTube entries use it.
- The Downloads tab can reuse the `SearchResult` component styling for visual consistency, or use a simpler custom layout since there is no search context.

### Files to create
- `src/components/Search/DownloadedTracksPanel.tsx`
- `src/components/Search/DownloadedTracksPanel.module.css`

### Files to modify
- `src/types/playlist.ts` -- add `downloadStatus?: 'downloading' | 'ready' | 'error'` to `PlaylistEntry`
- `src/store/playlistStore.ts` -- add `updateEntryStatus` action
- `src/components/Search/SearchPanel.tsx` -- add Downloads tab button and tab panel
- `src/components/Playlist/PlaylistTrack.tsx` -- show download status indicator
- `src/components/Playlist/PlaylistTrack.module.css` -- add spinner and error styles
- `src/hooks/useAudioEngine.ts` -- update playlist entry download status during YouTube flow

### Edge cases
- Server returns empty manifest (no downloads): show "No downloaded tracks yet" empty state
- Track deleted on server but still in playlist: playback will fail on fetch. Show error on the playlist entry.
- Multiple playlists reference the same downloaded track: all share the same server file. Delete on server affects all.
- Rapidly switching tabs: debounce the fetch to avoid hammering the server

## Dependencies
- mp3-012 (YouTube Download Integration)

## Out of Scope
- Download progress percentage (byte-level progress not exposed by server)
- Batch download management
- Storage usage display
