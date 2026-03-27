# Story mp3-007: Auto-Advance with MP3 Tracks

## Summary
When an MP3 track reaches the end of its AudioBuffer, automatically advance to the next track in the deck's playlist and begin playback.

## Background
The YouTube player triggers auto-advance via `onStateChange(ENDED)` in `useYouTubePlayer`, which calls `playlistStore.skipToNext(deckId)`. The MP3 AudioEngine must provide equivalent behavior. The AudioBufferSourceNode fires an `onended` event when the buffer finishes playing. The `useAudioEngine` hook must listen for this event and call `skipToNext`.

## Acceptance Criteria
- [ ] When an MP3 track reaches the end, `playlistStore.skipToNext(deckId)` is called automatically
- [ ] The next track in the playlist loads, decodes, and begins playing without user intervention
- [ ] `deckStore.playbackState` transitions to `'ended'` briefly, then to `'playing'` when the next track starts
- [ ] If the current track is the last in the playlist, playback stops and state becomes `'ended'`
- [ ] If the playlist has only one track, playback stops at the end (no infinite loop)
- [ ] The auto-advance does NOT trigger when the user manually stops or pauses the track
- [ ] The auto-advance does NOT trigger when the user seeks (which internally stops/starts the source node)
- [ ] Auto-advance works correctly when tracks have different durations
- [ ] Mixed playlists (MP3 + YouTube tracks) advance correctly: MP3 -> YouTube -> MP3

## Technical Notes
- The `AudioBufferSourceNode.onended` event fires when the buffer completes naturally AND when `stop()` is called manually. Use a `stoppedManually` flag in the AudioEngine: set it to `true` before any manual `stop()` call, and check it in the `onended` handler. Only call the ended callback if `stoppedManually === false`.
- `playlistStore.skipToNext` already calls `loadDeckTrack(deckId, nextEntry, autoPlay=true)`. For MP3 entries, this sets `deckStore.autoPlayOnLoad = true`. The `useAudioEngine` hook must detect the new `trackId` + `autoPlayOnLoad = true` and automatically start playback after decoding.
- The decode step for the next track introduces a brief gap between tracks. This is acceptable for v1. Pre-decoding the next track in the background is a future optimization.
- Reset the `stoppedManually` flag to `false` at the start of each `play()` call.

### Files to modify
- `src/services/audioEngine.ts` -- add `stoppedManually` flag logic to `play()`, `pause()`, `stop()`, `seek()`, and `onended` handler
- `src/hooks/useAudioEngine.ts` -- register the `onEnded` callback that calls `skipToNext`, handle `autoPlayOnLoad` for the new track

### Edge cases
- Rapid skip: user clicks "skip next" repeatedly. Each skip stops the current source (manual stop, no auto-advance) and loads the next track.
- Track with 0-duration buffer (corrupt file): `onended` fires immediately. Handle gracefully -- skip to next or show error.
- Loop active when track ends: if `loopActive`, the track should NOT end -- it should loop. The loop enforcement in the rAF loop should handle this. Verify.
- Source type transition: current track is MP3, next track is YouTube. `useAudioEngine` should stop, `useYouTubePlayer` should activate for the YouTube track.

## Dependencies
- mp3-006 (Playback Controls with MP3)

## Out of Scope
- Pre-decoding the next track for gapless playback
- Crossfade between tracks
