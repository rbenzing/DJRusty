# Context Document — MP3 Extension

**Project:** mp3-extension
**Date:** 2026-03-25

---

## 1. Tech Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| UI framework | React | 18.3.1 | Function components, hooks throughout |
| Language | TypeScript | 5.5.3 | Strict mode enabled |
| Build tool | Vite | 5.3.4 | ESM native, no CRA |
| State management | Zustand | 4.5.2 | Multiple stores (deckStore, playlistStore, mixerStore, authStore, searchStore, settingsStore) |
| Test runner | Vitest | 2.0.3 | jsdom environment |
| Download server | Node.js + Express | 4.19.2 | `server/index.js` — separate process on port 3001 |
| Audio (current) | YouTube IFrame API | latest | Cross-origin, limited |
| Audio (target) | Web Audio API | browser built-in | Full access |
| Auth | Google Identity Services (GIS) | implicit | OAuth 2.0 token flow |
| DnD (new) | `@dnd-kit/core` | recommended | In-app drag between playlists |

---

## 2. Existing Architecture

### 2.1 Application Structure

The app is a single-page React application served by Vite. Entry point is `src/main.tsx` → `src/App.tsx`.

`App.tsx` is the root shell. It:
- Mounts two hidden `YouTubePlayer` components (one per deck) that must remain in the DOM
- Listens for a `dj-rusty:load-track` `CustomEvent` dispatched by `SearchPanel` to bridge search → deck store
- Manages the search drawer open/close state
- Calls `loadYouTubeIframeApi()` on mount

### 2.2 Deck Architecture

Each deck (A/B) is composed of:

```
Deck.tsx                   — container, layout
  ├─ DeckDisplay.tsx       — track title, BPM, time, pitch rate
  ├─ VinylPlatter.tsx      — CSS-animated spinning disc
  ├─ DeckControls.tsx      — play/pause, cue, set cue, skip +/-15s, restart, sync, skip next
  ├─ HotCues.tsx           — 8 hot cue buttons
  ├─ LoopControls.tsx      — 1/2/4/8 beat loop buttons
  ├─ SlipButton.tsx        — slip mode toggle
  ├─ BeatJump.tsx          — beat jump controls
  ├─ TapTempo.tsx          — TAP BPM button
  ├─ PitchSlider.tsx       — stepped playback rate slider
  └─ EQPanel.tsx           — 3 rotary knobs (Low/Mid/High), currently visual-only
```

`YouTubePlayer.tsx` is mounted outside `Deck.tsx` in `App.tsx`. It owns `useYouTubePlayer` which manages the `YT.Player` instance lifecycle.

### 2.3 Player Lifecycle (YouTube)

```
App.tsx mounts YouTubePlayer A/B
  → useYouTubePlayer(deckId, containerRef)
    → loadYouTubeIframeApi() resolves
    → new YT.Player(mountTarget, { events: { onReady, onStateChange, onError, onPlaybackRateChange } })
    → playerRegistry.register(deckId, player)

deckStore.loadTrack(deckId, videoId, metadata, autoPlay)
  → sets videoId, autoPlayOnLoad

useYouTubePlayer subscribes to deckStore
  → videoId change → player.cueVideoById() or loadVideoById()
  → playbackState change → player.playVideo() / pauseVideo()
  → pitchRate change → player.setPlaybackRate()
  → volume change → player.setVolume()
  → currentTime polled every 250ms while playing

Track ends → onStateChange(ENDED) → playlistStore.skipToNext(deckId)
  → loadDeckTrack(deckId, nextEntry, autoPlay=true)
  → deckStore.loadTrack(deckId, nextVideoId, ..., autoPlay=true)
  → useYouTubePlayer detects videoId change + autoPlayOnLoad → loadVideoById()
```

### 2.4 Playlist Architecture

`playlistStore` is a Zustand store with two independent queues (one per deck). Key operations:
- `addTrack(deckId, entry)` — appends to queue; if queue was empty, cues the track in deck (no autoplay)
- `skipToNext(deckId)` — advances index, calls `loadDeckTrack(autoPlay=true)`
- `jumpToTrack(deckId, index)` — jumps to arbitrary index with autoplay

`loadDeckTrack` calls `useDeckStore.getState().loadTrack()` imperatively (not through a React hook) — this is intentional to avoid Zustand subscription cycles.

### 2.5 Search and Load Flow

1. User opens SearchPanel, types query → `performSearch()` → `youtubeDataApi.searchVideos()`
2. Results rendered as `SearchResult` rows with "LOAD A" / "LOAD B" and "+A" / "+B" buttons
3. "LOAD A/B" dispatches `CustomEvent('dj-rusty:load-track')` → `App.tsx` handles → `deckStore.loadTrack()`
4. "+A/B" calls `playlistStore.addTrack()` directly (no event)

Note: "LOAD A/B" loads the track directly to the deck bypassing the playlist. "+A/B" adds to the playlist queue. These two paths are duplicated and the project requires removing "LOAD A/B" entirely.

### 2.6 EQ — Current State

EQ knobs in `EQPanel.tsx` update `deckStore.eqLow/Mid/High` state. These values are stored but have no audio effect because the YouTube IFrame cross-origin restriction prevents Web Audio API access to the audio stream. The knob tooltip explicitly states "Visual only".

### 2.7 playerRegistry

`playerRegistry` (`src/services/playerRegistry.ts`) is a module-level `Map<'A'|'B', YT.Player>`. It stores live `YT.Player` instances so that components outside `useYouTubePlayer` (e.g. `HotCues`, `DeckControls`) can call `player.seekTo()` imperatively without going through the store.

This pattern is sound and should be generalized for the MP3 engine.

### 2.8 Download Server

`server/index.js` is a pre-existing Express server on port 3001. It already implements:

| Endpoint | Method | Description |
|---|---|---|
| `/api/tracks` | GET | List all downloaded tracks from manifest.json |
| `/api/download` | POST | Trigger yt-dlp download for a videoId |
| `/api/tracks/:videoId/status` | GET | Poll download status |
| `/api/audio/:videoId` | GET | Stream the MP3 file |
| `/api/tracks/:videoId` | DELETE | Delete a track |

The server stores downloads in `server/downloads/` as `{videoId}.mp3` and maintains a `manifest.json` with track metadata and status.

The React frontend currently does not integrate with this server — that integration is part of this project.

---

## 3. Web Audio API Integration Patterns

### 3.1 Recommended Node Graph (Per Deck)

```
AudioBufferSourceNode
  → GainNode (trim/gain)
  → BiquadFilterNode (lowshelf, 200 Hz) — Low EQ
  → BiquadFilterNode (peaking, 1000 Hz) — Mid EQ
  → BiquadFilterNode (highshelf, 8000 Hz) — High EQ
  → GainNode (channel volume)
  → AudioContext.destination
```

The `AudioContext.destination` is the device audio output. All four nodes are connected once at initialization and persist for the lifetime of the deck. Only `AudioBufferSourceNode` is recreated on each play/seek.

### 3.2 Pause and Resume Pattern

```typescript
// Pause: record offset, stop node
const pauseOffset = audioContext.currentTime - startedAt + seekOffset;
sourceNode.stop();
sourceNode = null;
paused = true;

// Resume: create new node, start at saved offset
sourceNode = audioContext.createBufferSource();
sourceNode.buffer = audioBuffer;
sourceNode.playbackRate.value = pitchRate;
sourceNode.connect(gainNode);
sourceNode.start(0, pauseOffset);
startedAt = audioContext.currentTime;
seekOffset = pauseOffset;
```

### 3.3 Current Time Computation (No Polling Required)

```typescript
function getCurrentTime(): number {
  if (!startedAt || !playing) return seekOffset;
  return (audioContext.currentTime - startedAt) * playbackRate + seekOffset;
}
```

This avoids the 250ms polling interval used by the YouTube player and gives sub-millisecond precision, suitable for waveform playhead animation at 60 fps.

### 3.4 EQ Node Update

```typescript
function setEq(band: 'low' | 'mid' | 'high', gainDb: number) {
  const node = eqNodes[band]; // BiquadFilterNode
  node.gain.value = gainDb;   // takes effect at next audio render quantum
}
```

Subscribe to `deckStore` EQ state changes and call this on every change.

### 3.5 Loop Implementation (Native)

```typescript
sourceNode.loop = true;
sourceNode.loopStart = loopStartSeconds;
sourceNode.loopEnd = loopEndSeconds;
```

Set before `start()` for immediate looping, or stop/restart if setting after playback has begun. This eliminates the 250ms polling workaround.

---

## 4. YouTube OAuth Download — Recommended Approach

### 4.1 Flow

```
User signs in (existing GIS OAuth flow → authStore.accessToken)
User searches for tracks from their channel
User clicks "Add to Playlist A/B" on a search result
  → playlistStore.addTrack() adds entry with sourceType: 'youtube', videoId
  → Frontend: if track not in /api/tracks manifest → POST /api/download { videoId, title, ... }
  → Server: yt-dlp downloads to server/downloads/{videoId}.mp3
  → Frontend: polls GET /api/tracks/:videoId/status every 2s
  → When status === 'ready':
    → playlistStore.updateEntry() sets audioUrl: 'http://localhost:3001/api/audio/{videoId}'
  → When deck reaches this playlist entry:
    → MP3 audio service fetches audioUrl → arrayBuffer() → decodeAudioData → AudioBuffer
    → Playback proceeds via Web Audio
```

### 4.2 The accessToken Is Not Needed by the Server

`yt-dlp` handles its own YouTube authentication (cookies or --cookies-from-browser). The OAuth accessToken from the frontend is only for the Data API search. The download endpoint does not need the token forwarded to it.

### 4.3 Polling Strategy

Poll `/api/tracks/:videoId/status` every 2 seconds. Show a "Downloading..." state on the playlist entry. When `status === 'ready'`, update the entry and optionally auto-load if the entry is currently active in the deck.

---

## 5. Risk Assessment

### High Risks

**R-001 — AudioContext suspended state (High)**
Browsers block audio playback until the first user gesture. If the app tries to play on load before any interaction, audio is silently blocked. Mitigation: call `audioContext.resume()` inside the play button handler and handle the `Promise` gracefully.

**R-002 — yt-dlp not installed (High)**
If `yt-dlp` is not on the PATH, the server returns an error. The frontend must detect this (`status: 'error'`, `error: 'yt-dlp not found'`) and display a clear message with installation instructions.

**R-003 — Large AudioBuffer memory (Medium-High)**
For DJ sets (60+ minutes), decoded AudioBuffer size exceeds 1 GB. This will cause out-of-memory on low-end hardware. Mitigation: add a file size warning for files over 100 MB and consider streaming decode for very long files (out of scope for this phase).

**R-004 — PlaylistEntry type breaking change (Medium)**
Adding `sourceType`, making `videoId` optional, and adding `filePath`/`audioUrl` fields is a breaking change. Every call site that constructs `PlaylistEntry` must be updated. Mitigation: use TypeScript to find all construction sites at compile time.

**R-005 — BPM detection accuracy (Medium)**
`bpm-detective` is accurate for 4/4 electronic music (house, techno, drum and bass). It is less reliable for hip-hop, jazz, or irregular BPMs. The existing tap-tempo is a reliable override. Mitigation: show BPM as editable; tap-tempo overrides the detected value.

### Medium Risks

**R-006 — playerRegistry generalization (Medium)**
The current registry stores `YT.Player` directly. Changing it to a generic interface may break TypeScript types in `DeckControls.tsx`, `HotCues.tsx`, and `LoopControls.tsx` if they call methods beyond `seekTo()`. Mitigation: define a narrow `DJPlayer` interface with only the methods that external callers use.

**R-007 — File drag-drop event interference (Low-Medium)**
If both OS file drag and in-app DnD are active simultaneously, `dragover` event propagation must be carefully managed. Mitigation: check `event.dataTransfer.types` to distinguish file drags from in-app drags before handling.

**R-008 — Download server not running (Low-Medium)**
If `server/index.js` is not running, all YouTube download attempts will fail with a network error. The frontend must catch this and guide the user to start the server. Mitigation: add a `GET /api/health` endpoint and check on app start; show a status badge in the UI.

---

## 6. Edge Cases

- Track loaded on deck A is also in deck B's playlist — editing hot cues affects both because hot cues are keyed by videoId/trackId.
- File drag-drop during active playback — the dropped file should add to the playlist queue, not interrupt the currently playing track.
- BPM detection returns NaN or 0 — must be handled; default to `bpm: null` so tap-tempo remains the fallback.
- User drags the same MP3 file to both decks — both decks will decode the same `File` object; they should share the `AudioBuffer` from a cache to avoid double memory usage.
- Download server returns `status: 'downloading'` and the frontend navigates away — the download continues in the server process. On return, the frontend should poll the manifest and discover the completed download.
- `audioContext.decodeAudioData` rejects for corrupt files — show an error in the deck error banner.

---

## 7. References

- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- AudioBufferSourceNode: https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode
- BiquadFilterNode: https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode
- File API: https://developer.mozilla.org/en-US/docs/Web/API/File_API
- `bpm-detective` npm: https://www.npmjs.com/package/bpm-detective
- `@dnd-kit/core` npm: https://www.npmjs.com/package/@dnd-kit/core
- `yt-dlp` documentation: https://github.com/yt-dlp/yt-dlp
- YouTube Data API v3 quota: https://developers.google.com/youtube/v3/getting-started#quota
- HTML5 Drag and Drop API: https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API

---

## 8. Open Questions for Architect

**Q1:** Should the `AudioContext` be a singleton shared by both decks, or should each deck have its own `AudioContext`? A shared context simplifies timing (single master clock) but requires careful GainNode routing. A per-deck context isolates failures but doubles context overhead.

**Q2:** Should `AudioBuffer` instances be shared between decks when the same file is loaded on both? This would require a module-level cache keyed by file hash / videoId. Benefit: 50% memory reduction for this case.

**Q3:** Is Electron planned? If yes, the file loading path should be abstracted so it can later be delegated to the main process via IPC.

**Q4:** For waveform rendering, should the component use an off-screen `OffscreenCanvas` to pre-render the static peak data, or render directly to a visible `<canvas>` element? `OffscreenCanvas` allows rendering in a Worker.

**Q5:** Should the download polling be implemented as a React hook with `setInterval`, or should it use a persistent background process? A hook will stop polling when the component unmounts (e.g. search drawer closed). A service worker or BroadcastChannel could keep polling alive.

**Q6:** The `playerRegistry` pattern is used for imperative seeks from `HotCues`, `DeckControls`, and `LoopControls`. Should the MP3 engine register in the same registry (with a common interface), or should those components be updated to dispatch through the store instead?

**Q7:** What is the waveform color scheme? Should it match deck A (existing `--color-deck-a-text` CSS variable = amber) / deck B (cyan) color coding? Confirm with UI Designer.

**Q8:** For playlist entries backed by local files: when the playlist is serialized to localStorage (if ever added), how should File objects be serialized? File objects cannot be JSON-serialized. Options: store only `filename + size` as a hint (re-add file on next session), or don't persist local-file playlist entries across sessions.
