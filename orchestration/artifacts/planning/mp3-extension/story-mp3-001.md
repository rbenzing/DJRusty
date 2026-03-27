# Story mp3-001: Track Type Extensions

## Summary
Extend the core data types (`PlaylistEntry`, `DeckState`, `DeckPlayer` interface, `playerRegistry`) to support both MP3 and YouTube source types, laying the foundation for all subsequent stories.

## Background
The current codebase assumes every track is a YouTube video. `PlaylistEntry` has a required `videoId` field and a `channelTitle` field. `DeckState` stores `videoId` and `channelTitle`. The `playerRegistry` is typed to `YT.Player`. All of these must be generalized to support MP3 files as a first-class track source before any audio engine work can begin.

## Acceptance Criteria
- [ ] `TrackSourceType = 'mp3' | 'youtube'` type exported from `src/types/playlist.ts`
- [ ] `PlaylistEntry` interface updated: `sourceType: TrackSourceType` added, `videoId` made optional, `channelTitle` renamed to `artist`, `file?: File` and `audioUrl?: string` fields added
- [ ] `DeckState` interface updated: `videoId` renamed to `trackId`, `channelTitle` renamed to `artist`, `sourceType: TrackSourceType | null` added, `waveformPeaks: Float32Array | null` added, `decoding: boolean` added, `bpmDetecting: boolean` added
- [ ] `deckStore.ts` updated: `createInitialDeckState` includes new fields, `loadTrack` signature updated to accept `trackId` + `sourceType` + `artist`, all internal references to `videoId`/`channelTitle` renamed
- [ ] `playlistStore.ts` updated: `loadDeckTrack` uses new `loadTrack` signature with `entry.videoId ?? entry.id` as trackId and `entry.artist`
- [ ] `playerRegistry.ts` updated: `DeckPlayer` interface exported with `seekTo(seconds, allowSeekAhead?)`, `getCurrentTime()`, `getDuration()`. Registry typed to `DeckPlayer`. `YouTubePlayerAdapter` class added.
- [ ] `useYouTubePlayer.ts` updated: registers a `YouTubePlayerAdapter` wrapper instead of raw `YT.Player`. Subscribes to `trackId` instead of `videoId`.
- [ ] All components updated to use new field names: `Deck.tsx` (`trackId`), `DeckDisplay.tsx` (`artist`), `PlaylistTrack.tsx` (`artist`), `SearchResult.tsx` (`trackId` for badge comparison), `HotCues.tsx` and `hotCues.ts` utility (use `trackId`)
- [ ] `SearchPanel.tsx` and `SearchResult.tsx` construct `PlaylistEntry` with `sourceType: 'youtube'` and `artist` (mapped from `channelTitle`)
- [ ] TypeScript compilation passes with zero errors (`npm run build`)
- [ ] All existing tests pass without modification (or are updated to use new field names)
- [ ] No behavioral regressions: YouTube search, add to playlist, playback, hot cues, loops, auto-advance all continue to work identically

## Technical Notes
- This is a pure refactor with no new features. The app should work identically after this story.
- Use TypeScript strict mode to find all broken references after the rename. The compiler will flag every site that uses the old field names.
- The `YouTubePlayerAdapter` is a thin wrapper: `seekTo` delegates to `player.seekTo()`, `getCurrentTime` to `player.getCurrentTime()`, `getDuration` to `player.getDuration()`.
- `PlaylistEntry.file` and `PlaylistEntry.audioUrl` are optional and will be `undefined` for YouTube entries -- no code needs to handle them yet.
- `DeckState.waveformPeaks`, `decoding`, `bpmDetecting` are initialized to `null`/`false` -- no code reads them yet.

### Files to modify
- `src/types/playlist.ts`
- `src/types/deck.ts`
- `src/store/deckStore.ts`
- `src/store/playlistStore.ts`
- `src/services/playerRegistry.ts`
- `src/hooks/useYouTubePlayer.ts`
- `src/components/Deck/Deck.tsx`
- `src/components/Deck/DeckDisplay.tsx`
- `src/components/Deck/DeckControls.tsx` (if it references `videoId`)
- `src/components/Deck/HotCues.tsx`
- `src/components/Search/SearchResult.tsx`
- `src/components/Search/SearchPanel.tsx`
- `src/components/Search/SearchResultList.tsx`
- `src/components/Playlist/PlaylistTrack.tsx`
- `src/utils/hotCues.ts`

### Edge cases
- Hot cue persistence uses `videoId` as the localStorage key. After rename to `trackId`, existing persisted hot cues keyed by `videoId` must still load correctly (the value of `trackId` for YouTube entries IS the videoId).
- The `SearchResult.tsx` "Now Playing" badge reads `deckAVideoId` / `deckBVideoId` from deckStore. These change to `deckATrackId` / `deckBTrackId`.

## Dependencies
- None (first story)

## Out of Scope
- AudioEngine implementation (mp3-002)
- Any new UI components
- Any new playback behavior
- MP3 file loading
