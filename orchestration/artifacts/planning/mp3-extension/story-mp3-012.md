# Story mp3-012: YouTube Download Integration

## Summary
Build the `downloadService.ts` client-side API and integrate it with the playlist workflow so that YouTube tracks are downloaded via the Express server and played through the Web Audio pipeline.

## Background
The Express server at `server/index.js` (port 3001) already implements the download infrastructure: `POST /api/download` triggers yt-dlp, `GET /api/tracks/:videoId/status` polls progress, `GET /api/audio/:videoId` streams the MP3 file. This story connects the frontend to these endpoints. When a YouTube track is added to a playlist and selected for playback, the system checks if it has been downloaded; if not, it initiates a download and waits for completion before decoding and playing.

## Acceptance Criteria
- [ ] `src/services/downloadService.ts` created with functions: `listDownloadedTracks()`, `downloadTrack(params)`, `getDownloadStatus(videoId)`, `fetchAudioBuffer(videoId)`, `deleteDownloadedTrack(videoId)`, `checkServerHealth()`
- [ ] When a YouTube track becomes the active track in a deck (loaded via `loadDeckTrack`), the `useAudioEngine` hook checks if the track has been downloaded by calling `getDownloadStatus(videoId)`
- [ ] If status is `'ready'`: fetch the MP3 via `fetchAudioBuffer(videoId)`, decode it, load into AudioEngine, and play
- [ ] If status is `'downloading'`: poll `getDownloadStatus` every 2 seconds until `'ready'`, then fetch and decode
- [ ] If not downloaded: call `downloadTrack(params)` to initiate download, then poll until ready
- [ ] `PlaylistEntry` for YouTube tracks stores `audioUrl` set to `http://localhost:3001/api/audio/{videoId}` once download is complete
- [ ] Download errors are handled gracefully: if server is not running, show `deckStore.setError(deckId, 'Download server not running. Start the server with: npm run server')`. If yt-dlp fails, show the error message from the server.
- [ ] `checkServerHealth()` calls `GET /api/tracks` (or a health endpoint) and returns true/false. Called on app mount to detect if server is available.
- [ ] YouTube tracks that have already been downloaded play immediately (no re-download)
- [ ] The download flow does NOT require the OAuth access token (yt-dlp handles auth independently)
- [ ] TypeScript compilation passes
- [ ] YouTube search -> add to playlist -> track downloads -> track plays via Web Audio: end-to-end flow works

## Technical Notes
- The `useAudioEngine` hook's track loading logic needs to branch on `sourceType`:
  - `'mp3'`: read `entry.file`, call `file.arrayBuffer()`, decode, load
  - `'youtube'`: check download status, download if needed, fetch MP3 from server, decode, load
- Polling: use `setInterval` with a 2-second interval. Clear the interval when status becomes `'ready'` or `'error'`, or when the component unmounts / track changes.
- Server base URL: `http://localhost:3001`. Consider making this configurable via a Vite env variable (`VITE_SERVER_URL`), but for v1, hardcode is acceptable.
- The YouTube IFrame player remains mounted as a fallback. If the download server is not running, YouTube tracks can still play through the IFrame (existing behavior). The `useDeckPlayer` facade should detect this and fall back to YouTube player mode.

### Files to create
- `src/services/downloadService.ts`

### Files to modify
- `src/hooks/useAudioEngine.ts` -- add YouTube download flow (check status, download, poll, fetch, decode)
- `src/hooks/useDeckPlayer.ts` -- handle fallback to YouTube player when server is unavailable
- `src/App.tsx` -- optionally check server health on mount and store availability state

### Edge cases
- Server not running: all fetch calls reject with network error. Catch and show user-friendly message.
- yt-dlp not installed: server returns `status: 'error'` with message. Display to user.
- Download interrupted (server crashes mid-download): status remains `'downloading'` forever. Add a timeout (e.g., 5 minutes) to stop polling and show an error.
- Same video downloaded while already downloading: server should handle idempotency (existing behavior).
- Track changes during download poll: cancel the poll interval, start fresh for the new track.
- Very large video (2+ hours): download takes a long time. Show a clear "Downloading..." status.

## Dependencies
- mp3-003 (AudioEngine + Store Integration)

## Out of Scope
- Download progress percentage (server does not currently expose byte progress)
- Download UI in playlist entries (mp3-013)
- Downloaded tracks library tab (mp3-013)
- Streaming decode (must fully download before decode)
