# Requirements — MP3 Extension

**Project:** mp3-extension
**Date:** 2026-03-25

---

## Functional Requirements

### Audio Engine

**FR-001 — Local MP3 playback (P1)**
The application must play local MP3 files in either deck using the Web Audio API (`AudioContext`, `AudioBufferSourceNode`). The file must be decoded to an `AudioBuffer` before playback begins so that sample-accurate seeking, looping, and EQ processing are available.

**FR-002 — YouTube MP3 download and playback (P1)**
YouTube tracks must remain playable. The flow is: user authenticates → searches → clicks "Add to Playlist A/B" → application calls `POST /api/download` on the local Express server → server invokes `yt-dlp` → MP3 file is stored in `server/downloads/` → application polls status → when `ready`, loads the audio file URL into the Web Audio pipeline exactly as a local MP3.

**FR-003 — Playback rate (pitch) control (P1)**
The MP3 player must support playback rate adjustment matching the existing `PitchRate` constants used by the YouTube player. Implementation: set `AudioBufferSourceNode.playbackRate.value`.

**FR-004 — Play / Pause / Stop controls (P1)**
Play, pause, and stop must work for MP3 tracks. Because `AudioBufferSourceNode` is single-use, pause requires recording the current offset and stopping the source node; resume requires creating a new `AudioBufferSourceNode` from the same `AudioBuffer` and starting it at the saved offset.

**FR-005 — Seek (P1)**
Seeking to an arbitrary position (cue points, hot cues, waveform click, transport skip) must be supported. Seek requires stopping the current source node, creating a new one, and calling `start(0, seekOffset)`.

**FR-006 — Accurate current time (P1)**
Current playback position must be derivable at high frequency (at least 60 fps for waveform playhead animation). Use `AudioContext.currentTime` minus the wall-clock start time plus the last seek offset to compute position without polling.

**FR-007 — Volume control (P1)**
Per-deck volume must be implemented as a `GainNode` between the source and output. The mixer store's composite volume computation already drives `useDeckStore.setVolume`; the MP3 engine must subscribe to this and update the `GainNode.gain.value` accordingly.

### EQ

**FR-008 — 3-band EQ via BiquadFilterNode (P1)**
Each deck must have a Low, Mid, and High `BiquadFilterNode` chain inserted between the source `GainNode` and the output destination. The existing `eqLow`, `eqMid`, `eqHigh` state in `deckStore` must drive these nodes in real time. The EQ panel label "Visual Only" must be removed.

- Low shelf: 200 Hz, type `lowshelf`
- Mid peak: 1000 Hz, type `peaking`
- High shelf: 8000 Hz, type `highshelf`
- Gain range: -12 dB to +12 dB (matching existing UI range)

### Waveform

**FR-009 — Waveform rendering (P1)**
A static waveform must be rendered for each track using the decoded `AudioBuffer`. Render amplitude peaks at canvas pixel resolution (e.g. 2–4 px per pixel column). Display a playhead line that advances in real-time using `requestAnimationFrame`. Support click-to-seek on the waveform.

**FR-010 — Waveform loading state (P2)**
While the audio file is being decoded, show a loading indicator in the waveform area. If decoding fails, show an error state.

### BPM Detection

**FR-011 — Automatic BPM detection on load (P1)**
On MP3 load, analyze the decoded `AudioBuffer` using a browser-compatible BPM detection library (preferred: `bpm-detective` — MIT, no WASM; fallback: `web-audio-beat-detector`). Store the result in `deckStore.bpm`. The existing tap-tempo UI and beat-sync logic must remain functional as an override.

**FR-012 — BPM detection performance (P2)**
BPM analysis must not block the main thread. Run inside a `Web Worker` or use `AudioWorkletNode` if the chosen library supports it. If the library is synchronous, wrap it in a `setTimeout` + chunk or use the existing `Worker` API.

### Cue Points and Hot Cues

**FR-013 — Cue points on MP3 tracks (P1)**
The existing cue point system (hot cues index 0 = main cue, indices 0–7 for hot cues) must work for MP3 tracks. The key used for `localStorage` persistence must be based on a stable track identifier. For local files, use a hash of the filename + size as the key. For YouTube-downloaded files, continue to use `videoId`.

**FR-014 — Hot cues seek via Web Audio (P1)**
When the user activates a hot cue (via `HotCues.tsx` or keyboard), the seek must go through the MP3 engine's seek mechanism (`AudioBufferSourceNode.start(0, offset)`) rather than `playerRegistry.get(deckId).seekTo()`. The `playerRegistry` pattern must be extended to support MP3 players or replaced with a unified `playerRegistry` interface.

### Loops

**FR-015 — Sample-accurate loops (P1)**
For MP3 tracks, loops must use `AudioBufferSourceNode.loopStart` and `loopEnd` with `loop = true` instead of the current 250ms poll + `seekTo` approach. The existing `activateLoop`, `activateLoopBeat`, `deactivateLoop` actions in `deckStore` must continue to set the same state; the MP3 engine observes these and configures the source node accordingly.

**FR-016 — Loop roll for MP3 (P2)**
The existing loop roll / slip mode mechanism must work for MP3 tracks. The engine needs to compute the shadow playhead position using `AudioContext.currentTime`.

### File Loading

**FR-017 — OS drag-and-drop into playlist area (P1)**
The playlist panel (or a designated drop zone on each deck) must accept file drag-and-drop from the OS file explorer. Accepted types: `audio/mpeg`, `audio/mp3`, `.mp3`. On drop, the file is read via the `FileReader` API or `File.arrayBuffer()` and added to the target deck's playlist.

**FR-018 — File picker as fallback (P2)**
A "Browse files" button (or drag hint with click handler) must open an `<input type="file" accept=".mp3,audio/mpeg">` file picker as an alternative to drag-and-drop.

**FR-019 — Drag tracks between Deck A and Deck B playlists (P1)**
Users must be able to drag an entry from one deck's playlist panel and drop it into the other deck's playlist. Implement with React DnD or `@dnd-kit/core`. The HTML5 native file drag (OS → browser) and the in-app drag (deck A → deck B) are separate interaction paths.

### YouTube Integration

**FR-020 — Channel library listing (P2)**
The search panel must have a "Library" tab showing all tracks previously downloaded to `server/downloads/`. The frontend fetches `GET /api/tracks` from the Express server and displays them with "Add to Playlist A/B" buttons.

**FR-021 — Download progress indication (P1)**
When a YouTube track is queued for a deck and needs downloading, the playlist entry must display a "downloading" status (spinner/progress indicator) and update to ready when the server reports `status: 'ready'`. The frontend polls `GET /api/tracks/:videoId/status` at a short interval until done.

**FR-022 — Remove LOAD A / LOAD B buttons (P1)**
The "LOAD A" and "LOAD B" buttons in `SearchResult.tsx` must be removed entirely. The "+A" / "+B" queue buttons are kept but renamed/restyled to be the primary action. The `onLoadToDeck` prop on `SearchResult` is removed.

**FR-023 — Remove A+ / B+ labels; unify to Add to Playlist (P1)**
The "+A" and "+B" buttons in `SearchResult.tsx` become the sole add action. The button labels should be clearer: "Add to A" / "Add to B" (or similar). The `onLoadToDeck` handler in `SearchPanel.tsx` and `App.tsx` is removed.

### UI Cleanup

**FR-024 — Empty state hint update (P1)**
The "No Track Loaded" empty state in `Deck.tsx` currently reads "Search for a track below and click LOAD A/B". This must be updated to reflect the new interaction model: "Drag an MP3 file here, or search and click Add to Playlist."

**FR-025 — Waveform component in Deck layout (P1)**
A new `WaveformDisplay` component must be added to each `Deck.tsx` layout, positioned between the `VinylPlatter` and `DeckControls`. It renders only when a track with an audio buffer is loaded.

---

## Non-Functional Requirements

### Performance

**NFR-001** — Audio decoding (`AudioContext.decodeAudioData`) must not block the UI. For files under 20 MB (typical MP3 at 128 kbps for 20 minutes), decoding takes 200–800 ms in modern browsers on desktop hardware. Show a loading spinner during this time.

**NFR-002** — BPM detection must complete within 3 seconds for a typical 5-minute track (at 44.1 kHz, mono channel, downsampled). Run off the main thread.

**NFR-003** — Waveform canvas rendering must target 60 fps for the playhead animation using `requestAnimationFrame`. Static waveform peaks are rendered once after decode and cached on the canvas.

**NFR-004** — The Express download server (`server/index.js`) must remain available. The frontend must gracefully degrade if the server is not running (show a "Download server not running" message rather than crashing).

**NFR-005** — Audio latency: `AudioContext` created with `latencyHint: 'interactive'` to minimize playback latency.

### Security

**NFR-006** — Local file data must never be uploaded to any remote server. Files are decoded entirely in-browser via `FileReader` / `File.arrayBuffer()`. No file bytes leave the user's machine.

**NFR-007** — The Express server must continue to restrict CORS to `localhost:5173` and `localhost:4173`. No public network access.

**NFR-008** — OAuth access tokens must continue to be stored only in-memory (existing authStore pattern). The download flow does not require the access token to be sent to `server/index.js` — the user has already authenticated and the server uses `yt-dlp` directly.

**NFR-009** — Content type validation on file drag-drop: only accept `audio/mpeg` or `.mp3` extension. Reject other file types with a user-visible error message.

### Browser Compatibility

**NFR-010** — Target: latest Chrome, Firefox, and Edge on desktop (Windows/macOS). Web Audio API is fully supported in all three. `File.arrayBuffer()` is supported in Chrome 76+, Firefox 69+, Edge 79+.

**NFR-011** — File System Access API (showOpenFilePicker) is NOT required — a standard `<input type="file">` or `FileReader` is sufficient and has broader support.

**NFR-012** — The application is currently browser-only (no Electron) based on codebase inspection (`vite` dev server, no Electron main/preload files). The Architect must confirm whether Electron is planned; if so, the Node.js `fs` module becomes available as an alternative file reading path.

---

## Constraints

**C-001** — Must not break existing YouTube IFrame playback flow during development. The YouTube IFrame player must remain mounted and functional until the YouTube download flow is fully implemented.

**C-002** — `AudioBuffer` objects are large (a 5-minute MP3 decodes to ~50 MB of 32-bit float PCM). They must be stored in component/service refs, never in Zustand state.

**C-003** — `AudioBufferSourceNode` is single-use per the Web Audio API spec. A new node must be created for every play / seek. The audio service must manage this lifecycle internally.

**C-004** — The existing `playerRegistry` uses `YT.Player` as the stored type. The registry interface must be generalized to a common `DJPlayer` interface with at minimum `seekTo(time: number): void`.

**C-005** — The existing `hotCues.ts` utility keys persistence by `videoId`. For local MP3 files there is no `videoId`. A stable file identifier (e.g. `filename:size` hash) must be introduced.

**C-006** — The `yt-dlp` binary must be installed on the host machine for YouTube download to work. The server already handles the `ENOENT` case; the frontend must surface this error clearly.

---

## Dependencies

| ID | Dependency | Required By |
|---|---|---|
| D-001 | `bpm-detective` npm package (MIT) | FR-011 |
| D-002 | `@dnd-kit/core` or `react-dnd` (MIT) | FR-019 |
| D-003 | `yt-dlp` binary on host machine (pre-existing) | FR-002 |
| D-004 | Web Audio API (browser built-in) | FR-001, FR-007, FR-008, FR-015 |
| D-005 | Web Workers API (browser built-in) | FR-012 |
| D-006 | HTML5 File API / FileReader (browser built-in) | FR-017 |
| D-007 | Express server (`server/index.js`) already exists | FR-002, FR-020, FR-021 |

### Requirement Dependencies

- FR-015 (sample-accurate loops) depends on FR-001 (Web Audio playback)
- FR-008 (EQ) depends on FR-001 (Web Audio playback)
- FR-009 (waveform) depends on FR-001 (decode AudioBuffer)
- FR-011 (BPM detection) depends on FR-001 (decode AudioBuffer)
- FR-014 (hot cue seek) depends on FR-001 (Web Audio seek)
- FR-002 (YouTube download play) depends on FR-001 (Web Audio playback) and D-003 (yt-dlp)
- FR-021 (download progress) depends on FR-002
- FR-022, FR-023 (UI cleanup) can proceed independently of audio engine work
