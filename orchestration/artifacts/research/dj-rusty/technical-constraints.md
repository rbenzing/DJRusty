# Technical Constraints

> Project: `dj-rusty`

---

## CRITICAL: Web Audio API + YouTube IFrame — CORS Restriction

**This is the single most important technical constraint for the entire project.**

### The Problem

The YouTube IFrame player embeds a cross-origin `<iframe>`. The Web Audio API's `createMediaElementAudioSource()` can only wrap `<video>` or `<audio>` elements from the **same origin**. Attempting to wrap a cross-origin iframe's audio source throws a `SecurityError`.

```javascript
// THIS FAILS — SecurityError: cross-origin MediaElementSource
const source = audioContext.createMediaElementAudioSource(iframeElement);
```

This means EQ filters, reverb, echo, and true Web Audio crossfading **cannot** be applied to YouTube IFrame audio.

### Resolution

| Mixing Feature | Implementation |
|----------------|----------------|
| Crossfader | `player.setVolume(0–100)` on each IFrame player instance |
| Per-deck volume | `player.setVolume()` |
| EQ (Bass/Mid/Treble) | Visual controls only in v1; no audio effect |
| Effects (reverb, echo) | Visual controls only in v1; no audio effect |

**Note:** `AnalyserNode` attached to `AudioContext.destination` can analyze the combined output, but cannot distinguish Deck A from Deck B individually.

---

## YouTube IFrame Player API — Capabilities & Limitations

### Available Controls
- `playVideo()`, `pauseVideo()`, `stopVideo()`, `seekTo(seconds, allowSeekAhead)`
- `setVolume(0–100)`, `getVolume()`, `mute()`, `unMute()`
- `setPlaybackRate(rate)` — **discrete values only**: 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2
- `getDuration()`, `getCurrentTime()`, `getVideoLoadedFraction()`
- State events: `onStateChange` (UNSTARTED=-1, ENDED=0, PLAYING=1, PAUSED=2, BUFFERING=3, CUED=5)

### Limitations
- **Pitch/Speed**: Only discrete playback rates — no continuous pitch slider
- **Waveform**: No access to audio buffer data
- **Simultaneous Playback**: Desktop browsers support 2 players simultaneously; iOS Safari does not
- **Autoplay**: Requires user gesture for first playback; muted init pattern recommended
- **Unembeddable videos**: Some videos disallow embedding — handle `onError` code 101/150

---

## YouTube Data API v3 — Quotas & Endpoints

### Daily Quota
- Default: **10,000 units/day** per Google Cloud project
- `search.list`: **100 units/call** (expensive — limit to user-initiated searches)
- `playlistItems.list`: **1 unit/call** (preferred for listing uploads)
- `videos.list`: **1 unit/call**
- `channels.list`: **1 unit/call**

### Quota Strategy
1. On login: fetch channel info (1 unit) + uploads playlist items (1 unit/page)
2. Cache uploads in app state — do not re-fetch unless user refreshes
3. Limit `search.list` to explicit user search actions
4. Show remaining searches estimate in settings if feasible

### Key Endpoints
```
GET channels.list?part=contentDetails,snippet&mine=true
GET playlistItems.list?part=snippet&playlistId={uploadsId}&maxResults=50
GET search.list?part=snippet&q={query}&type=video&maxResults=25
GET videos.list?part=snippet,contentDetails&id={videoId}
```

---

## Google Identity Services (GIS) — OAuth 2.0

### Current Library
Google deprecated `gapi.auth2`. Use **GIS** loaded from `https://accounts.google.com/gsi/client`.

### SPA Token Flow
```javascript
const tokenClient = google.accounts.oauth2.initTokenClient({
  client_id: 'YOUR_CLIENT_ID',
  scope: 'https://www.googleapis.com/auth/youtube.readonly',
  callback: (tokenResponse) => {
    // Store access_token in memory (NOT localStorage)
    accessToken = tokenResponse.access_token;
  }
});
tokenClient.requestAccessToken({ prompt: '' }); // silent refresh if session active
```

### Token Security
- **Store in memory only** — never in `localStorage` or `sessionStorage` (XSS risk)
- Tokens expire after **1 hour** — use `prompt: ''` for silent refresh
- Required Google Cloud Console config:
  - OAuth 2.0 Client ID (Web Application type)
  - Authorized JavaScript origins: your domain + `http://localhost:5173` (Vite dev)
  - YouTube Data API v3 enabled

---

## YouTube Terms of Service Compliance

### Allowed ✅
- Embedding videos via IFrame API
- Two simultaneous embedded players on desktop
- Using `setVolume()` for crossfading
- Displaying video titles and thumbnails from the API
- Users browsing their own YouTube uploads

### Not Allowed ❌
- Extracting, downloading, or re-serving the audio/video stream
- Removing or obscuring YouTube player branding
- Bypassing the embedded player to access raw media
- Storing/caching video content beyond browser defaults

### Risk Mitigation
- Keep IFrame players visible in a mini-player area (do not hide with `display:none` or `visibility:hidden`)
- Use `opacity: 0.01` or `pointer-events: none` to visually minimize if needed, but players must remain in DOM and visible to the browser
- Show YouTube attribution on track info displays

---

## BPM Detection — CORS Constraint

All audio analysis libraries (`bpm-detective`, `web-audio-beat-detector`, `Meyda.js`) require decoded PCM audio buffers, which are blocked by the same CORS restriction as Web Audio API.

### Recommended Approach
**Tap-tempo** per deck:
- User taps a button to the beat
- Calculate BPM from last 4 tap intervals: `BPM = 60000 / avg(intervals_ms)`
- Reset after 3 seconds of inactivity

Optional enhancement: lookup BPM via GetSongBPM API or AcousticBrainz using video title.

---

## Vinyl Platter Animation

Use CSS keyframes with `animation-play-state` controlled by React state:

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.platter {
  animation: spin 1.8s linear infinite; /* 33⅓ RPM */
  animation-play-state: var(--spin-state, paused);
}
```

- At 1× speed: `animation-duration: 1.8s`
- At 1.25×: `animation-duration: 1.44s`
- At 0.75×: `animation-duration: 2.4s`
- Formula: `duration = 1.8 / playbackRate`

Canvas is not required unless a needle/tone-arm animation is desired.

---

## Recommended Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | React + TypeScript | Component isolation for dual decks; type safety for audio state |
| Build | Vite | Fast dev server; native ESM |
| State | Zustand | Lightweight slices for deckA, deckB, mixer, auth |
| Styling | CSS Modules or Tailwind | Precise dark/skeuomorphic aesthetic |
| YouTube Player | IFrame API (dynamic script load) | Official API; no npm package needed |
| YouTube Data | Native `fetch()` to REST | No SDK needed |
| Auth | GIS token client | Current Google standard for SPAs |
| Animation | CSS `@keyframes` | More performant than Canvas for rotation |
