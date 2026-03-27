# Story mp3-002: AudioEngine Service

## Summary
Implement the core Web Audio API audio engine service: a shared AudioContext singleton, a per-deck AudioEngine class with the full signal chain, and the audio decoder utility.

## Background
The Web Audio API is the browser's native audio processing framework. To play decoded MP3 audio with EQ, gain, and analysis capabilities, we need a managed signal chain of Web Audio nodes. The AudioEngine class encapsulates this complexity, providing a clean interface for play/pause/seek/volume/EQ operations. The AudioContext must be shared between both decks (browser best practice, limits CPU overhead).

## Acceptance Criteria
- [ ] `src/services/audioContext.ts` created with `getAudioContext()` singleton and `ensureAudioContextResumed()` function
- [ ] `src/services/audioEngine.ts` created implementing the `AudioEngine` interface from mp3-001
- [ ] AudioEngine constructor creates the persistent signal chain: GainNode -> BiquadFilterNode (lowshelf 320Hz) -> BiquadFilterNode (peaking 1000Hz Q:0.7) -> BiquadFilterNode (highshelf 3200Hz) -> AnalyserNode -> destination
- [ ] `loadBuffer(buffer)` stores the AudioBuffer reference
- [ ] `play(offset?)` creates a new AudioBufferSourceNode, connects it, starts at the given offset. Handles AudioContext suspended state by calling `ensureAudioContextResumed()`
- [ ] `pause()` computes current position, stops and disconnects the source node
- [ ] `stop()` stops playback and resets position to 0
- [ ] `seek(seconds)` stops current source, creates new source, starts at new offset (if playing). Updates `seekOffset` (if paused).
- [ ] `getCurrentTime()` returns computed position using `seekOffset + (context.currentTime - startedAt) * playbackRate`
- [ ] `getDuration()` returns the AudioBuffer duration
- [ ] `setPlaybackRate(rate)` updates the source node's `playbackRate.value` and internal rate tracking
- [ ] `setVolume(volume)` maps 0-100 integer to 0.0-1.0 GainNode gain
- [ ] `setEQ(band, gainDb)` sets the appropriate BiquadFilterNode's gain.value
- [ ] `getAnalyser()` returns the AnalyserNode for visualization
- [ ] `isReady()` returns true when a buffer is loaded
- [ ] `isPlaying()` returns current playing state
- [ ] `onEnded(callback)` registers a callback for track-end detection
- [ ] `destroy()` disconnects all nodes
- [ ] AudioEngine implements the `DeckPlayer` interface (seekTo delegates to seek)
- [ ] `src/services/audioDecoder.ts` created with `decodeAudioFile(source: File | ArrayBuffer): Promise<AudioBuffer>`
- [ ] Unit tests for AudioEngine covering: play -> pause -> resume cycle, seek while playing, seek while paused, volume setting, playback rate, EQ setting, getCurrentTime accuracy, onEnded fires when buffer completes
- [ ] TypeScript compilation passes

## Technical Notes
- AudioBufferSourceNode is single-use per Web Audio spec. Every play/seek creates a new one. GainNode, BiquadFilterNodes, and AnalyserNode persist.
- The `onended` event on AudioBufferSourceNode fires both when the track naturally ends AND when `stop()` is called. Use a flag (`stoppedManually`) to distinguish manual stops from natural track completion.
- EQ band frequencies per architecture: lowshelf 320Hz, peaking 1000Hz Q:0.7, highshelf 3200Hz.
- AudioContext created with `{ latencyHint: 'interactive' }` for low latency.
- `decodeAudioFile` uses `File.arrayBuffer()` for File inputs (Promise-based, cleaner than FileReader).

### Files to create
- `src/services/audioContext.ts`
- `src/services/audioEngine.ts`
- `src/services/audioDecoder.ts`

### Files to modify
- None (pure new code)

### Edge cases
- `play()` called when AudioContext is suspended: must call `ensureAudioContextResumed()` first
- `play()` called when no buffer loaded: no-op or throw
- `seek()` beyond buffer duration: clamp to duration
- `seek()` to negative value: clamp to 0
- `setPlaybackRate()` called while not playing: store the rate, apply on next play
- `decodeAudioData` rejects for corrupt files: propagate the error

## Dependencies
- mp3-001 (Track Type Extensions -- for DeckPlayer interface)

## Out of Scope
- Store integration (mp3-003)
- Waveform analysis (mp3-008)
- BPM detection (mp3-010)
- EQ UI changes (mp3-009)
- Loop enforcement (handled in mp3-006)
