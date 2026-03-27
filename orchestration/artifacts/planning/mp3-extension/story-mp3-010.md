# Story mp3-010: BPM Detection

## Summary
Implement automatic BPM detection for MP3 tracks using the `bpm-detective` library, running analysis in a Web Worker to avoid blocking the UI. Display a loading spinner in the BPM display area while detection is in progress.

## Background
BPM (beats per minute) is essential for beat-syncing and loop sizing. Currently, BPM is set manually via tap-tempo. With direct access to the AudioBuffer, we can auto-detect BPM using onset-based autocorrelation. The `bpm-detective` library is a lightweight (2kB gzipped) MIT-licensed package that accepts a Float32Array of audio samples and returns a BPM estimate.

## Acceptance Criteria
- [ ] `bpm-detective` package added to `package.json` dependencies
- [ ] `src/services/bpmDetector.ts` created with `detectBPM(buffer: AudioBuffer): Promise<number | null>`
- [ ] BPM detection runs in a Web Worker (`src/workers/bpmWorker.ts`) to avoid blocking the main thread
- [ ] The worker receives a downsampled mono `Float32Array` (22050 Hz) and returns the BPM number or null
- [ ] `deckStore.bpmDetecting` field set to `true` when analysis begins, `false` when complete
- [ ] Detected BPM stored via `deckStore.setBpm(deckId, detectedBpm)`
- [ ] BPM detection triggered in `useAudioEngine` after AudioBuffer decode completes
- [ ] `DeckDisplay.tsx` updated to show a spinner when `bpmDetecting === true` (CSS-only spinner, 16px, 0.8s rotation)
- [ ] Spinner respects `prefers-reduced-motion` -- static indicator instead of animation
- [ ] `aria-live="polite"` on the BPM span so screen readers announce the detected value
- [ ] `aria-busy="true"` while detecting
- [ ] BPM detection completes within 3 seconds for a typical 5-minute track
- [ ] If BPM detection returns NaN, 0, or a value outside 40-220 range: set `bpm: null` (fallback to tap-tempo)
- [ ] Existing tap-tempo functionality continues to work as an override -- user can tap to set BPM regardless of auto-detection
- [ ] If user has already tapped a BPM for this track, auto-detection does NOT override it (check if bpm is already set when detection completes)
- [ ] BPM displayed with 1 decimal place (e.g., "128.0 BPM")

## Technical Notes
- **Downsampling for worker:** Take `buffer.getChannelData(0)`, downsample from the buffer's sample rate to 22050 Hz by picking every Nth sample. This reduces the data transferred to the worker and speeds up analysis.
- **Worker setup:** Create the worker using `new Worker(new URL('./workers/bpmWorker.ts', import.meta.url), { type: 'module' })`. This is Vite's built-in web worker import pattern.
- **bpm-detective API:** `analyze(audioData: Float32Array)` returns a Promise<number>. It uses FFT-based autocorrelation internally.
- **Accuracy notes:** `bpm-detective` works best for 4/4 electronic music (house, techno, trance). For other genres, accuracy is lower. The tap-tempo remains the reliable fallback.
- **Memory:** The downsampled Float32Array for a 5-minute track at 22050 Hz is ~5.3 MB. This is the `postMessage` payload to the worker. Use `Transferable` (transfer the underlying ArrayBuffer) to avoid copying.

### Files to create
- `src/services/bpmDetector.ts`
- `src/workers/bpmWorker.ts`

### Files to modify
- `src/hooks/useAudioEngine.ts` -- trigger BPM detection after decode
- `src/store/deckStore.ts` -- add `setBpmDetecting` action (if not added in mp3-001)
- `src/components/Deck/DeckDisplay.tsx` -- add BPM spinner, aria-live, aria-busy
- `src/components/Deck/DeckDisplay.module.css` -- add spinner styles
- `package.json` -- add `bpm-detective` dependency

### Edge cases
- Track with no clear beat (ambient, spoken word): detection returns NaN or 0. Set bpm to null.
- Very short track (< 10 seconds): insufficient data for accurate BPM. `bpm-detective` may throw or return NaN. Catch and default to null.
- Detection completes after track has changed (user loaded a different track): ignore the result (check that trackId still matches).
- Worker fails to load (CSP restriction, bundler issue): catch the error, log it, set bpm to null.
- Multiple rapid track changes: terminate the previous worker and start a new one for the latest track.

## Dependencies
- mp3-003 (AudioEngine + Store Integration -- for decoded AudioBuffer)

## Out of Scope
- BPM-based beat grid visualization
- BPM-locked tempo adjustment
- Key detection
