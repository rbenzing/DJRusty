# Story mp3-003: AudioEngine + Store Integration

## Summary
Create the `useAudioEngine` hook that bridges the AudioEngine service to the Zustand deckStore, and the `useDeckPlayer` facade hook that selects between AudioEngine and YouTube player based on source type.

## Background
The AudioEngine from mp3-002 is a standalone service. To function within the React app, it needs a hook that: (a) subscribes to deckStore state changes and pushes them to the engine, (b) pushes engine state (currentTime, playbackState) back to the store at 60fps, (c) registers the engine in `playerRegistry` so imperative seek calls from HotCues and LoopControls work, and (d) handles the decode-then-load pipeline when a new MP3 track is loaded.

## Acceptance Criteria
- [ ] `src/hooks/useAudioEngine.ts` created
- [ ] Hook creates an AudioEngine instance on mount, destroys on unmount
- [ ] Hook registers AudioEngine in `playerRegistry` on mount, unregisters on unmount
- [ ] When `deckStore.trackId` changes and `sourceType === 'mp3'`: the hook reads the `file` or `audioUrl` from the active playlist entry, calls `decodeAudioFile()`, then `audioEngine.loadBuffer()`. Sets `deckStore.decoding = true` during decode, `false` after.
- [ ] When `deckStore.playbackState` changes to `'playing'`: calls `audioEngine.play()`. When `'paused'`: calls `audioEngine.pause()`. When `'unstarted'`: calls `audioEngine.stop()`
- [ ] When `deckStore.volume` changes: calls `audioEngine.setVolume()`
- [ ] When `deckStore.pitchRate` changes: calls `audioEngine.setPlaybackRate()`
- [ ] When `deckStore.eqLow/eqMid/eqHigh` changes: calls `audioEngine.setEQ()` for each band
- [ ] When `deckStore.loopActive` changes to true: configures loop on the engine. When false: deactivates loop.
- [ ] A `requestAnimationFrame` loop updates `deckStore.setCurrentTime()` at ~60fps while playing
- [ ] AudioEngine `onEnded` callback fires `playlistStore.skipToNext(deckId)` when track naturally completes
- [ ] `src/hooks/useDeckPlayer.ts` created as a facade: reads `deckStore.sourceType`, calls `useAudioEngine` for `'mp3'`, delegates to existing `useYouTubePlayer` for `'youtube'`
- [ ] `App.tsx` updated to mount `useDeckPlayer('A')` and `useDeckPlayer('B')` instead of directly mounting YouTube players (YouTube players still mount inside `useDeckPlayer` when source is youtube)
- [ ] A one-time user gesture listener is added to App.tsx (or useDeckPlayer) that calls `ensureAudioContextResumed()` on the first click/keydown
- [ ] TypeScript compilation passes
- [ ] Existing YouTube playback continues to work through the facade hook

## Technical Notes
- The `useAudioEngine` hook must NOT double-subscribe to deckStore. Use `useDeckStore.subscribe()` for non-rendering subscriptions (volume, EQ, pitchRate) and `useDeckStore()` selector for rendering-relevant state (trackId, playbackState).
- To get the active playlist entry's `file` or `audioUrl`, read from `usePlaylistStore.getState().playlists[deckId][currentIndex[deckId]]`.
- The `requestAnimationFrame` loop should only run while `playing === true`. Cancel with `cancelAnimationFrame` on pause, unmount, or track change.
- Loop enforcement: when loop is active, check `getCurrentTime() >= loopEnd` in the rAF loop and call `seek(loopStart)` if exceeded. This is more reliable than relying on AudioBufferSourceNode's native loop property when loop boundaries change during playback.
- The `useDeckPlayer` hook must handle the case where `sourceType` is null (no track loaded) -- in that case, neither engine activates.

### Files to create
- `src/hooks/useAudioEngine.ts`
- `src/hooks/useDeckPlayer.ts`

### Files to modify
- `src/App.tsx` -- mount `useDeckPlayer` hooks, add AudioContext resume listener, conditionally render YouTubePlayer components

### Edge cases
- Track changes while playing: the hook must stop the current playback, decode the new file, and auto-play if `autoPlayOnLoad` is true
- `sourceType` changes from `'youtube'` to `'mp3'` mid-session: the hook must cleanly transition from YouTube player to AudioEngine
- `decodeAudioFile` rejects: set `deckStore.setError(deckId, 'Failed to decode audio file')`
- Component unmount during active decode: cancel or ignore the decode result

## Dependencies
- mp3-002 (AudioEngine Service)

## Out of Scope
- Waveform extraction (mp3-008 -- happens here but is part of that story)
- BPM detection (mp3-010 -- triggered after decode but part of that story)
- File loading UI (mp3-004, mp3-005)
