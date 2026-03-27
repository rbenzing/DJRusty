# ADR-002: YouTube Audio Download via Express Server + yt-dlp

**Status:** Accepted
**Date:** 2026-03-25
**Deciders:** Architect Agent

---

## Context

DJRusty currently plays YouTube audio through the IFrame Player API, which streams video in a cross-origin iframe. To enable MP3-like features (EQ, waveform, BPM) for YouTube content, we need the raw audio data as a decodable buffer. There are several approaches to obtain audio from YouTube videos.

The project already has an Express server at `server/index.js` (port 3001) that:
- Accepts POST `/api/download` with a `videoId`
- Spawns `yt-dlp` to download and convert to MP3
- Serves the resulting MP3 via GET `/api/audio/:videoId`
- Maintains a manifest.json for download status tracking
- Handles CORS for the Vite dev server origins

This server was built before this architecture phase and is already functional.

## Decision

Use the **existing Express server + yt-dlp approach** for YouTube audio downloads. The flow is:

1. User clicks "Download" on a YouTube search result in the browser
2. Client sends POST to `localhost:3001/api/download` with video metadata
3. Server spawns `yt-dlp -x --audio-format mp3` to download and convert
4. Client polls GET `/api/tracks/:videoId/status` every 2 seconds until status is "ready"
5. When ready, client fetches the MP3 via GET `/api/audio/:videoId` as an ArrayBuffer
6. Client decodes the ArrayBuffer into an AudioBuffer using Web Audio API
7. Track is played through the same AudioEngine as local MP3 files

Key design decisions:

- **Server-side download**: yt-dlp runs on the server (Node.js child_process), not in the browser. This is the only viable approach since yt-dlp is a Python/native binary.
- **MP3 format**: yt-dlp converts to MP3 (`--audio-format mp3 --audio-quality 0` for highest quality VBR). MP3 is universally decodable by Web Audio API.
- **Persistent cache**: Downloaded MP3s persist in `server/downloads/` across sessions. Re-downloading the same video returns the cached file instantly.
- **Polling for status**: The client polls the server for download completion rather than using WebSockets, because downloads are infrequent and the polling interval (2s) is acceptable.
- **No streaming decode**: The full MP3 file is fetched before decoding. This is consistent with the AudioBuffer approach in ADR-001 where we need the entire buffer loaded for instant seeking.

## Consequences

### Positive

- **Already implemented**: The Express server is functional today. Minimal new code needed on the server side.
- **High audio quality**: yt-dlp with `--audio-quality 0` produces high-quality VBR MP3 (typically 245+ kbps).
- **Offline availability**: Once downloaded, tracks are available without internet.
- **Unified playback path**: Downloaded YouTube audio goes through the same AudioEngine as local MP3s, ensuring identical EQ, waveform, and BPM behavior.
- **Simple architecture**: No WebSocket complexity. No browser-side WASM binary. Just REST calls.

### Negative

- **Requires yt-dlp installed**: Users must have `yt-dlp` installed on their system. The server already handles the ENOENT case with a helpful error message. The Downloads tab will show install instructions if yt-dlp is missing.
- **Download latency**: A typical 5-minute YouTube video takes 10-30 seconds to download and convert to MP3. Users must wait before playback through the AudioEngine. Mitigated by: (a) initiating downloads proactively when browsing search results, (b) allowing IFrame fallback playback while download is in progress.
- **Local server required**: The Express server must be running for YouTube downloads to work. This is acceptable for a desktop-focused DJ app. The app will detect if the server is unreachable and show a clear message.
- **Storage usage**: Each downloaded MP3 takes 5-15MB on disk. Over time this can grow. The server already supports DELETE `/api/tracks/:videoId` for cleanup.

### Risks

- **yt-dlp breakage**: YouTube frequently changes its internals, which can break yt-dlp. Users must keep yt-dlp updated. Mitigation: show yt-dlp version in the UI and prompt to update on errors.
- **Legal considerations**: Downloading YouTube audio may violate YouTube's ToS. This is a user responsibility. The app only facilitates downloading from the user's own authenticated channel content (the search is already scoped to `VITE_YOUTUBE_CHANNEL_ID` when set).

## Alternatives Considered

### 1. Client-Side Audio Extraction (YouTube Audio Stream URLs)

- **Concept**: Use the YouTube Data API or an undocumented endpoint to get the direct audio stream URL (itag 140 = AAC 128kbps), then fetch it directly in the browser.
- **Pros**: No server needed. No yt-dlp dependency. Faster (streaming directly).
- **Cons**: YouTube audio stream URLs are signed and expire. Extracting them requires reverse-engineering YouTube's player JS (fragile). CORS blocks direct fetch from browser. Would need a proxy server anyway, which is the same as the current approach but without yt-dlp's robust extraction logic.
- **Rejected because**: Fragile, likely to break, and still needs a server for CORS proxying.

### 2. Browser-Based WASM yt-dlp / ffmpeg

- **Concept**: Run yt-dlp or ffmpeg compiled to WASM in the browser.
- **Pros**: No server needed.
- **Cons**: yt-dlp is Python -- no WASM port exists. ffmpeg.wasm exists but is ~30MB, slow, and cannot fetch YouTube streams (CORS). Would still need a server to proxy the YouTube stream.
- **Rejected because**: Not technically feasible without a server proxy.

### 3. WebSocket-Based Progress Updates

- **Concept**: Replace polling with a WebSocket connection for real-time download progress.
- **Pros**: More responsive progress updates. Could show % progress and yt-dlp output in real time.
- **Cons**: Adds WebSocket server complexity (ws or socket.io dependency). Downloads are infrequent events -- the overhead is not justified. Polling at 2s intervals is perfectly adequate for the UX.
- **Rejected because**: Over-engineered for the use case. Can be added later if download progress becomes important.

### 4. IndexedDB for Client-Side Audio Caching

- **Concept**: After fetching the MP3 from the server, store the ArrayBuffer in IndexedDB so it doesn't need to be re-fetched.
- **Pros**: Faster re-access for previously played tracks.
- **Cons**: IndexedDB has storage limits. MP3 files are 5-15MB each. A 100-track library would consume 500MB-1.5GB of browser storage. The server already caches the files on disk, so re-fetching is just a localhost transfer (< 1 second).
- **Deferred**: Not needed for v1. The server-side cache is sufficient. Can be added if offline browser operation (no server) becomes a requirement.
