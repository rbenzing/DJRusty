# Story mp3-006: Playback Controls with MP3

## Summary
Ensure all existing deck transport controls (play/pause, cue, set cue, skip +/-15s, restart, skip next, hot cues, loops, slip mode, beat jump) work correctly with the MP3 AudioEngine.

## Background
The deck controls (`DeckControls.tsx`, `HotCues.tsx`, `LoopControls.tsx`, `SlipButton.tsx`, `BeatJump.tsx`) currently operate by setting state in deckStore and calling `playerRegistry.get(deckId).seekTo()` for imperative seeks. Since mp3-003 registers the AudioEngine as a `DeckPlayer` in the registry, most controls should "just work." This story verifies and fixes any gaps.

## Acceptance Criteria
- [ ] **Play/Pause:** Clicking play sets `playbackState: 'playing'` which the `useAudioEngine` hook picks up and calls `audioEngine.play()`. Clicking pause sets `'paused'` and hook calls `audioEngine.pause()`. Audio starts and stops correctly.
- [ ] **Cue:** Pressing CUE seeks to the cue point (hot cue index 0) via `playerRegistry.seekTo()`. AudioEngine handles the seek correctly (stop current source, create new, start at offset).
- [ ] **Set Cue:** Sets `hotCues[0]` in deckStore. No AudioEngine interaction needed.
- [ ] **Skip +15s / -15s:** Calls `playerRegistry.seekTo(currentTime +/- 15)`. AudioEngine handles correctly.
- [ ] **Restart:** Calls `playerRegistry.seekTo(0)`. AudioEngine seeks to 0.
- [ ] **Hot Cues:** Activating a hot cue calls `playerRegistry.seekTo(timestamp)`. Works with AudioEngine.
- [ ] **Loop (1/2/4/8 beat):** `activateLoopBeat` sets loop state in deckStore. The `useAudioEngine` hook detects loop activation and enforces it in the rAF loop (seek back to loopStart when currentTime >= loopEnd). `deactivateLoop` stops loop enforcement.
- [ ] **Slip Mode:** When slip is active and a loop/hot cue interrupts normal playback, the shadow position advances. On deactivation, `playerRegistry.seekTo(slipPosition)` seeks the AudioEngine to the correct position.
- [ ] **Beat Jump:** Calls `playerRegistry.seekTo(currentTime +/- beatJumpSize)`. Works with AudioEngine.
- [ ] **Pitch Slider:** `setPitchRate` updates deckStore. `useAudioEngine` hook picks it up and calls `audioEngine.setPlaybackRate()`.
- [ ] **Volume Fader:** Volume changes flow through mixerStore -> deckStore -> `useAudioEngine` -> `audioEngine.setVolume()`.
- [ ] All controls are tested manually with an MP3 file loaded
- [ ] No regressions with YouTube playback (YouTube tracks still work through YouTube player)

## Technical Notes
- Most controls already go through `playerRegistry.get(deckId).seekTo()` which now resolves to `AudioEngine.seekTo()` for MP3 tracks. The key verification is that the AudioEngine's `seekTo` correctly handles all cases.
- Loop enforcement in the rAF loop: `if (loopActive && currentTime >= loopEnd) { audioEngine.seek(loopStart); }`. This replaces the YouTube player's 250ms poll approach.
- Volume flow: The mixer store computes effective volume from channel fader, crossfader, and master. The result is set via `deckStore.setVolume()`. The `useAudioEngine` hook subscribes and calls `audioEngine.setVolume(volume)`.
- The `DeckControls.tsx` play/pause handler currently dispatches to deckStore. It may also need to call `ensureAudioContextResumed()` for the very first play press (browser autoplay policy).

### Files to modify
- `src/hooks/useAudioEngine.ts` -- ensure loop enforcement, volume sync, playback rate sync, slip position handling
- `src/components/Deck/DeckControls.tsx` -- may need to call `ensureAudioContextResumed()` on play button press
- Potentially: `src/components/Deck/HotCues.tsx`, `src/components/Deck/LoopControls.tsx` -- verify `playerRegistry.get(deckId)?.seekTo()` calls work with the new `DeckPlayer` interface (the `allowSeekAhead` parameter is now optional)

### Edge cases
- Seek past end of track: AudioEngine clamps to duration
- Loop boundaries that extend past track duration: clamp loopEnd to duration
- Play pressed with no buffer loaded: no-op (isReady() returns false)
- Pitch rate change during active loop: loop timing adjusts automatically (loop boundaries are in seconds, not beats)
- Volume set to 0: GainNode gain = 0.0, silence (not muted -- just zero gain)

## Dependencies
- mp3-003 (AudioEngine + Store Integration)

## Out of Scope
- Auto-advance on track end (mp3-007)
- Waveform click-to-seek (mp3-008)
- EQ audio effect (mp3-009)
