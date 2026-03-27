# Story mp3-009: 3-Band EQ (Functional)

## Summary
Wire the existing EQ knob values (`eqLow`, `eqMid`, `eqHigh`) from deckStore to the AudioEngine's BiquadFilterNode chain so that EQ adjustments produce audible effects on MP3 audio. Remove the "Visual Only" badge from the EQ panel.

## Background
The EQ knobs in `EQPanel.tsx` are already fully implemented: they render rotary knobs, handle drag interaction, keyboard input, double-click reset, and store values in deckStore. However, they are currently labeled "Visual Only" because YouTube IFrame audio is cross-origin and cannot be processed by Web Audio. With the new AudioEngine, EQ processing is fully functional for MP3 tracks.

## Acceptance Criteria
- [ ] `useAudioEngine` hook subscribes to `deckStore.eqLow`, `deckStore.eqMid`, `deckStore.eqHigh` changes
- [ ] On each EQ value change, `audioEngine.setEQ('low' | 'mid' | 'high', gainDb)` is called
- [ ] `audioEngine.setEQ` sets `BiquadFilterNode.gain.value = gainDb` for the correct band
- [ ] EQ bands: Low shelf at 320 Hz, Mid peaking at 1000 Hz (Q: 0.7), High shelf at 3200 Hz
- [ ] EQ gain range: -12 dB to +12 dB (matching existing UI range)
- [ ] EQ changes take effect immediately (no perceptible delay -- Web Audio processes at next render quantum ~3ms)
- [ ] "Visual Only" badge (`<span className={styles.v1Badge}>Visual Only</span>`) removed from `EQPanel.tsx`
- [ ] `.v1Badge` CSS class removed from `EQPanel.module.css`
- [ ] `aria-label` on EQ knobs updated: remove "(visual only)" suffix
- [ ] `title` attribute updated from "Visual only -- cross-origin iframe audio cannot be processed" to "Double-click to reset to 0 dB"
- [ ] Comment "EQ knobs (visual only)" in `Deck.tsx` updated to "EQ knobs"
- [ ] EQ values are applied when a track is first loaded (not just on change). When a new buffer loads, apply current EQ values.
- [ ] EQ works with both playing and paused tracks (the filter chain is persistent; changing gain on a paused track affects the sound when play resumes)
- [ ] For YouTube-source tracks (playing through IFrame), EQ remains non-functional (no AudioEngine active) -- this is expected and acceptable

## Technical Notes
- The `useAudioEngine` hook in mp3-003 should already subscribe to EQ state. This story ensures the subscription is correct and the AudioEngine's `setEQ` method is properly wired.
- BiquadFilterNode gain is set via `.gain.value = gainDb`. This is synchronous and takes effect at the next audio render quantum.
- When a new track is loaded and the buffer is set, the EQ nodes retain their previous gain values. No explicit re-apply is needed unless the nodes are recreated (they are persistent in the AudioEngine).
- Verify by ear: set EQ Low to -12 dB, play an MP3 with strong bass -- bass should be clearly attenuated. Reset to 0 dB -- bass returns.

### Files to modify
- `src/hooks/useAudioEngine.ts` -- ensure EQ subscription and `setEQ` calls are implemented
- `src/components/Deck/EQPanel.tsx` -- remove "Visual Only" badge, update aria-labels and title
- `src/components/Deck/EQPanel.module.css` -- remove `.v1Badge` class
- `src/components/Deck/Deck.tsx` -- update comment

### Edge cases
- EQ set to extreme values (-12 dB on all bands): audio becomes very quiet but should not distort or clip
- EQ set to +12 dB on all bands: audio becomes louder. If source audio is already near 0 dBFS, clipping may occur. This is expected (same behavior as hardware DJ EQ).
- Double-click reset on a knob while playing: gain instantly returns to 0 dB, audible change

## Dependencies
- mp3-003 (AudioEngine + Store Integration)

## Out of Scope
- EQ knob UI redesign (existing design is retained)
- EQ frequency or Q parameter changes (use architecture-specified values)
- EQ on YouTube-source tracks (not possible without download)
