# ADR-001: Web Audio API as the Core Audio Engine

**Status:** Accepted
**Date:** 2026-03-25
**Deciders:** Architect Agent

---

## Context

DJRusty currently plays audio exclusively through the YouTube IFrame Player API. Each deck embeds a hidden `YT.Player` instance that streams video audio. This architecture has a fundamental limitation: the audio stream runs inside a cross-origin iframe, making it completely inaccessible to the browser's Web Audio API. As a result, features that require direct access to audio data -- EQ processing, waveform visualization, BPM detection, and effects -- are impossible. The EQ knobs in the current app are explicitly labeled "Visual Only."

The project goal is to make DJRusty an MP3-first DJ application. This requires a new audio engine that can:

1. Play decoded audio from local MP3 files
2. Play decoded audio from downloaded YouTube tracks (via the existing Express/yt-dlp server)
3. Provide real-time EQ processing (3-band: low, mid, high)
4. Expose audio data for waveform visualization and BPM detection
5. Support variable playback rate for pitch control
6. Support seeking, looping, hot cues, and slip mode

## Decision

Use the **Web Audio API** (native browser API) as the core audio engine for all MP3 and decoded audio playback. Each deck gets its own `AudioEngine` instance with this signal chain:

```
AudioBufferSourceNode -> GainNode -> BiquadFilter (low) -> BiquadFilter (mid) -> BiquadFilter (high) -> AnalyserNode -> AudioContext.destination
```

Key design decisions within this:

- **AudioBufferSourceNode** for playback. Audio files are fully decoded into `AudioBuffer` objects before playback starts. This trades memory for instant seeking and guarantees no decode latency during playback.
- **Shared AudioContext singleton**. Both decks share one `AudioContext` (browser limit is typically 6-8 contexts). Each deck's signal chain connects to the same `context.destination`.
- **Position tracking via arithmetic**, not polling. Track `startOffset + (context.currentTime - startedAt) * playbackRate`. Update the store at 60fps via `requestAnimationFrame`.
- **New AudioBufferSourceNode per play()** call. The Web Audio spec makes source nodes single-use (they cannot be restarted after `stop()`). The GainNode, BiquadFilterNodes, and AnalyserNode persist and are reused.

The YouTube IFrame players remain in the DOM as a **fallback** for YouTube tracks that have not been downloaded. Long-term, all YouTube tracks will go through the download-then-decode path.

## Consequences

### Positive

- **Full audio control**: EQ, gain, pitch, and analysis all work natively. No more "visual only" limitations.
- **No external dependencies**: Web Audio API is a W3C standard, supported in all modern browsers. No npm packages needed.
- **Low latency**: Decoded AudioBuffers provide instant seek and no buffering delays.
- **Consistent behavior**: Both MP3 and downloaded YouTube tracks flow through the same signal chain, ensuring identical EQ, volume, and analysis behavior.
- **Extensible**: Future features (effects, recording, beat sync) can be added by connecting more nodes to the graph.

### Negative

- **Memory usage**: A fully decoded 10-minute 44.1kHz stereo track uses ~100MB of RAM as PCM float data. For a typical DJ session with 2 loaded tracks, this is ~200MB -- acceptable for desktop browsers but would be problematic on mobile (which is out of scope).
- **Decode latency**: Decoding a 10-minute MP3 takes 1-3 seconds on modern hardware. This must happen before playback can start. Mitigated by decoding at the time the track is added to the playlist, not when the user presses play.
- **AudioBufferSourceNode lifecycle**: The single-use nature of source nodes adds complexity to the engine. Every play/seek operation creates a new source node and reconnects it.
- **Browser autoplay policy**: AudioContext starts in a `suspended` state and must be resumed on user interaction. Must call `context.resume()` on the first click/keypress.

### Risks

- **AudioContext suspension**: If the first user interaction is missed, audio won't play. Mitigation: attach a one-time click/keydown listener at app mount that calls `ensureAudioContextResumed()`.
- **Sample rate mismatch**: If an MP3 is 48kHz but the AudioContext defaulted to 44.1kHz, the browser resamples automatically. This is handled transparently but could introduce artifacts at extreme quality levels.

## Alternatives Considered

### 1. HTMLAudioElement (`<audio>` tag)

- **Pros**: Simple API, native browser support, no memory overhead (streaming decode).
- **Cons**: No EQ processing (cannot insert BiquadFilterNodes into the audio path without `createMediaElementSource()` which has CORS restrictions for cross-origin audio). No waveform analysis without decoding the file separately. Cannot control playback rate with the same precision. Cannot share an AudioContext easily.
- **Rejected because**: The entire point of this project is to enable EQ, waveform, and BPM features. HTMLAudioElement does not provide the necessary audio graph control.

### 2. Howler.js

- **Pros**: Popular audio library, handles Web Audio API and HTMLAudioElement fallback, simpler API.
- **Cons**: Adds a dependency (~30KB). Abstracts away the Web Audio graph, making it harder to insert custom nodes (EQ, analyser). Does not expose BiquadFilterNodes for EQ. Would need to fork or wrap extensively.
- **Rejected because**: We need direct access to the Web Audio graph nodes. Howler.js would be an abstraction layer that gets in the way more than it helps.

### 3. Tone.js

- **Pros**: Full-featured Web Audio framework with built-in EQ, effects, and scheduling.
- **Cons**: Very large dependency (~150KB minified). Designed for music production, not DJ playback. Overkill for our 3-band EQ and simple playback needs. Learning curve for the team.
- **Rejected because**: Too heavy for the requirements. We only need a handful of Web Audio nodes, not a full music production framework.
