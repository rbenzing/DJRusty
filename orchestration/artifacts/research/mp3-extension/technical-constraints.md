# Technical Constraints — MP3 Extension

**Project:** mp3-extension
**Date:** 2026-03-25

---

## 1. Web Audio API Constraints

### 1.1 AudioBufferSourceNode Is Single-Use

Every call to `AudioBufferSourceNode.start()` is a one-way transition. Once stopped (via `stop()` or when the buffer ends without loop), the node cannot be restarted. A new node must be created from the same `AudioBuffer` for every play action and every seek. The audio service must maintain a reference to the current source node and dispose of it on each play/seek cycle.

**Impact:** The audio service layer must implement a `createAndStartNode(buffer, offset, loop)` factory pattern rather than reusing a single node.

### 1.2 AudioBuffer Memory Cost

A decoded `AudioBuffer` is raw 32-bit float PCM. Memory cost: `channels * sampleRate * duration * 4 bytes`.

| Track length | 44.1 kHz stereo |
|---|---|
| 5 minutes | ~100 MB |
| 10 minutes | ~200 MB |
| 60 minutes | ~1.2 GB |

**Impact:** `AudioBuffer` objects must never be stored in Zustand state (would serialize on every re-render). They must live in service-layer refs or a module-level cache keyed by track identifier. With two decks active simultaneously, worst case is ~200 MB for typical DJ tracks (4–8 minutes).

**Mitigation:** Cap the cached buffer count (e.g. keep the last 4 decoded buffers in memory; evict LRU). Preload the next playlist entry in the background if feasible.

### 1.3 AudioContext Autoplay Policy

Browsers require an `AudioContext` to be created or resumed in response to a user gesture (click, keydown). An `AudioContext` created on app mount will be in the `suspended` state on Chrome/Edge/Firefox until the user interacts. Calling `audioContext.resume()` must be done as part of the first play button press.

**Impact:** The audio service must handle `AudioContext.state === 'suspended'` by calling `resume()` before `AudioBufferSourceNode.start()`. Any attempt to start audio before resume silently produces no output.

### 1.4 AudioContext Singleton

A single `AudioContext` per deck (or one shared per app) is strongly recommended. Each `AudioContext` has its own internal clock and output routing. Creating multiple contexts increases CPU overhead. The Architect must decide: one shared `AudioContext` with routing per deck, or one `AudioContext` per deck.

**Recommendation:** One shared `AudioContext` with a `GainNode` per deck routed to the shared `AudioContext.destination`. This matches how professional audio software routes channels.

### 1.5 decodeAudioData Duration

`decodeAudioData` is asynchronous but does block the audio rendering thread internally. For a 5-minute 128 kbps MP3, decoding takes approximately 300–700 ms on a modern desktop. For a 60-minute mix file, this can take 5–10 seconds.

**Impact:** Must show a loading/decoding state in the UI. BPM analysis must not start until decoding completes.

### 1.6 Web Audio API Loop Precision

`AudioBufferSourceNode.loopStart` and `loopEnd` are sample-accurate when set before `start()`. If set after `start()`, the loop boundaries take effect on the next loop iteration (no mid-loop updates). The current `deactivateLoop` implementation calls `playerRegistry.seekTo()` — for MP3 this must stop/restart the node at the computed target position.

---

## 2. File Access Constraints

### 2.1 FileReader / File.arrayBuffer()

The `FileReader` API and `File.arrayBuffer()` are available in all modern browsers. No origin restriction for locally dropped/picked files. `File.arrayBuffer()` (Promise-based) is preferred over the callback-based `FileReader.readAsArrayBuffer` for cleaner async code.

**Limitation:** Once the user closes or refreshes the browser, `File` objects are gone. There is no persistent handle to the file system path. Playlist entries backed by a `File` object can only be played in the current session unless re-dropped.

**Impact:** For persistence across sessions, the playlist store can persist the `filePath` (filename + size as a hint) but cannot guarantee the file will be accessible on the next load. The user must re-add the file or the app must gracefully show a "file not found" state.

### 2.2 File System Access API

The newer `showOpenFilePicker()` API (File System Access API) returns a persistent `FileSystemFileHandle` that can be stored and re-opened across sessions with user permission. However, this API is only available in Chrome/Edge (not Firefox 126). Since Firefox support is a target (NFR-010), this API should be used as a progressive enhancement only.

### 2.3 Drag-and-Drop Event Scope

`ondragover` and `ondrop` events fire on the element under the cursor. For OS file drag, the app must prevent default behavior on `dragover` to allow drop. For in-app DnD (playlist reorder/move), a DnD library manages this. These two drag modes must not interfere with each other: only `dragover` events that carry files (check `event.dataTransfer.types.includes('Files')`) should be handled as OS file drops.

---

## 3. YouTube API and ToS Constraints

### 3.1 YouTube Data API v3 Quota

The YouTube Data API v3 has a default daily quota of 10,000 units per project. `search.list` costs 100 units per call; `videos.list` costs 1 unit per call. A single two-step search consumes ~101 units. The existing quota management (caching, `VITE_YOUTUBE_CHANNEL_ID` scoping) must be preserved.

**No change:** The download flow does not use the Data API for downloading — `yt-dlp` fetches the video directly without API quota consumption.

### 3.2 YouTube Terms of Service — Downloading

YouTube's Terms of Service (Section 5.H) prohibit downloading content except where explicitly enabled by YouTube (e.g. YouTube Premium offline). The `yt-dlp` download approach is technically a ToS violation for public content.

**Mitigation:** The existing `server/index.js` already implements this approach. The project constraint is that this is a local-only, personal-use DJ tool — not a hosted service. The Architect and team must decide whether to document this risk and proceed on the grounds of personal use, or to scope the download feature only to content the authenticated user owns (their own channel uploads).

**Recommendation for Research:** Scope the download flow to videos from the authenticated user's channel (`VITE_YOUTUBE_CHANNEL_ID`). This is consistent with the existing search scoping. Content the channel owner uploaded is their own property.

### 3.3 YouTube IFrame ToS — Hidden Player

The current implementation maintains `YouTubePlayer` components in the DOM at all times (1×1 px, opacity 0.01) to satisfy YouTube's ToS requirement to render the player. If YouTube audio is eventually played via Web Audio rather than IFrame, the IFrame requirement may no longer apply. However, the safest approach during the migration period is to keep the IFrame players mounted.

---

## 4. Electron vs Pure Browser

Codebase inspection found no Electron-specific files (`main.js`, `preload.js`, `electron-builder.json`, etc.). The app runs as a pure browser application served by Vite. The `server/` directory contains a separate Node.js Express process, not an Electron main process.

**Constraint:** The browser environment applies. `fs`, `path`, and `child_process` modules are not available in the renderer. The Node.js code is confined to `server/index.js`.

**Impact on YouTube download:** The `yt-dlp` download correctly lives in `server/index.js` (Node.js). The browser client fetches `/api/download` and `/api/audio/:videoId` over HTTP.

**Impact on file access:** Local MP3 files must be loaded via `FileReader`/`File.arrayBuffer()` (browser file APIs), not `fs.readFile()`.

**Open Question for Architect:** Is Electron planned for a future release? If yes, the architecture should be designed with a clean service abstraction that can later delegate file operations to the Electron main process.

---

## 5. Performance Constraints

### 5.1 Waveform Canvas Size

A full-width waveform canvas on a 1920-wide display needs to process up to 1920 samples for the peak calculation. For a 5-minute track at 44.1 kHz, that is ~13.2 million samples. A naive peak scan takes ~10 ms with a typed array. This is fast enough to run synchronously post-decode.

**Optimization:** Use a `Float32Array` view of the `AudioBuffer.getChannelData(0)` channel directly — no copies needed.

### 5.2 GainNode / BiquadFilterNode Updates

Web Audio API parameter changes (`gain.value = x`, `frequency.value = x`) are synchronous and take effect at the next audio render quantum (~3 ms at 44.1 kHz). They do not cause UI reflows. These updates can be made freely on every `onChange` event from the EQ knobs.

### 5.3 BPM Detection Library Size

- `bpm-detective` (npm): ~2 kB gzipped. Synchronous, uses FFT-based autocorrelation. Fast enough for analysis off the main thread in a Worker.
- `web-audio-beat-detector` (npm): ~8 kB gzipped. Uses AudioWorklet. More accurate on electronic music.
- `essentia.js`: ~2 MB WASM binary. Overkill for BPM detection alone; not recommended.

**Recommendation:** Use `bpm-detective` for its size and simplicity. Run it in a `Web Worker` passing a downsampled `Float32Array` (mono, 22.05 kHz) to minimize worker message payload and computation time.

### 5.4 DnD Library Bundle Size

- `@dnd-kit/core` v6: ~15 kB gzipped. Modern, accessible, no jQuery dependency.
- `react-dnd` v16: ~30 kB gzipped. Older API, requires `react-dnd-html5-backend`.

**Recommendation:** `@dnd-kit/core` — smaller, actively maintained, better accessibility primitives.

---

## 6. Security Constraints

### 6.1 CORS on Express Server

`server/index.js` restricts CORS to `localhost:5173` (Vite dev) and `localhost:4173` (Vite preview). This is correct and must not be relaxed.

### 6.2 File Type Validation

On drag-drop, validate `file.type === 'audio/mpeg'` or `file.name.endsWith('.mp3')`. Reject other types with a toast error. Do not attempt to decode non-MP3 audio — `decodeAudioData` will reject, but validation should happen earlier.

### 6.3 Audio URL Origin

When the Express server streams an MP3 via `/api/audio/:videoId`, the browser fetches it over HTTP from `localhost:3001`. This is a local request with no HTTPS required. However, `AudioContext.decodeAudioData(await fetch(url).then(r => r.arrayBuffer()))` must handle fetch errors (server not running, file deleted).

### 6.4 OAuth Token Scope

The existing OAuth scope is `youtube.readonly`. Downloading via `yt-dlp` does not require the access token (yt-dlp handles auth independently). The access token is only needed for YouTube Data API search calls. No scope change is required for the download feature.

---

## 7. State Management Constraints

### 7.1 AudioBuffer Not Serializable

`AudioBuffer` is a non-serializable browser object. It must never be placed in Zustand state. The audio service must maintain it in a `useRef` or module-level Map.

### 7.2 PlaylistEntry Extension

The `PlaylistEntry` type currently has `videoId: string` as a required field, which couples the playlist to YouTube. This must become optional (or renamed), and `sourceType: 'mp3' | 'youtube'` plus `filePath?: string` and `audioUrl?: string` fields must be added. This is a breaking change to the `PlaylistEntry` type that affects `playlistStore.ts`, `PlaylistPanel.tsx`, `PlaylistTrack.tsx`, and anywhere `PlaylistEntry` is constructed (primarily `SearchPanel.tsx` and the new file drop handler).

### 7.3 playerRegistry Generalization

`playerRegistry` currently stores `YT.Player` instances. `YT.Player.seekTo()` is the only method currently called from outside `useYouTubePlayer`. The registry needs to expose a common interface:

```typescript
interface DJPlayer {
  seekTo(time: number): void;
  // Future: getDuration(), getCurrentTime(), etc.
}
```

The MP3 audio service must implement this interface and register itself with the same registry.
