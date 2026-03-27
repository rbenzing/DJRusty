# DJRusty — System Architecture

**Version**: 1.0
**Date**: 2026-03-21
**Status**: Approved

---

## 1. Overview

DJRusty is a browser-based DJ application that enables users to mix YouTube tracks in real time using two virtual decks. The application is a single-page application (SPA) with no backend server. All state is managed client-side, and authentication is handled via Google Identity Services (GIS) using a token-based flow directly from the browser.

### Core Constraints

- YouTube IFrame API audio cannot be captured or routed through the Web Audio API due to cross-origin restrictions. All audio manipulation must go through IFrame API methods only.
- Crossfading is implemented via `setVolume()` calls on each player, not via Web Audio nodes.
- EQ controls and waveform visualisations are UI affordances only in v1 — they do not alter audio.
- Pitch control is limited to the discrete playback rates exposed by the IFrame API: `0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2`.
- BPM is user-defined via tap-tempo; no audio analysis is possible.
- No backend. Secrets (API key) are public-facing; rate limiting is handled by Google quota alone.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (SPA)                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   React UI Layer                      │  │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │  │
│  │  │  Deck A  │  │  Deck B  │  │   Mixer / Crossfade │  │  │
│  │  └────┬─────┘  └────┬─────┘  └─────────┬──────────┘  │  │
│  │       │              │                  │              │  │
│  └───────┼──────────────┼──────────────────┼──────────────┘  │
│          │              │                  │                  │
│  ┌───────▼──────────────▼──────────────────▼──────────────┐  │
│  │                  Zustand Store                          │  │
│  │  (deckA, deckB, mixer, search, auth, ui)               │  │
│  └───────┬──────────────────────────────────┬─────────────┘  │
│          │                                  │                  │
│  ┌───────▼──────────┐            ┌──────────▼─────────────┐  │
│  │  YouTube IFrame  │            │  YouTube Data API v3   │  │
│  │  API (2 players) │            │  (search, metadata)    │  │
│  └──────────────────┘            └────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │          Google Identity Services (GIS)                │  │
│  │          Token Flow — OAuth 2.0 (implicit)             │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Language | TypeScript | 5.x |
| UI Framework | React | 18.x |
| Build Tool | Vite | 5.x |
| State Management | Zustand | 4.x |
| Styling | CSS Modules + CSS custom properties | — |
| Audio Playback | YouTube IFrame Player API | — |
| Video/Track Search | YouTube Data API v3 | — |
| Authentication | Google Identity Services (GIS) | — |
| Testing | Vitest + React Testing Library | — |
| Linting | ESLint + Prettier | — |
| Package Manager | npm | — |

See `decisions/adr-001-tech-stack.md` for rationale.

---

## 4. Application Structure

```
/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.tsx                    # App entry point
│   ├── App.tsx                     # Root component, layout
│   │
│   ├── components/
│   │   ├── Deck/
│   │   │   ├── Deck.tsx            # Deck container (A or B)
│   │   │   ├── DeckControls.tsx    # Play/pause/cue/loop buttons
│   │   │   ├── DeckDisplay.tsx     # Track info, BPM, pitch display
│   │   │   ├── PitchSlider.tsx     # Discrete pitch rate control
│   │   │   ├── BpmDisplay.tsx      # Tap-tempo BPM display
│   │   │   ├── TapTempo.tsx        # Tap button + BPM calculation
│   │   │   ├── EQPanel.tsx         # Visual EQ knobs (v1: display only)
│   │   │   └── YouTubePlayer.tsx   # IFrame API wrapper component
│   │   │
│   │   ├── Mixer/
│   │   │   ├── Mixer.tsx           # Mixer strip container
│   │   │   ├── Crossfader.tsx      # Crossfade slider → setVolume()
│   │   │   ├── VolumeKnob.tsx      # Per-deck volume → setVolume()
│   │   │   └── VUMeter.tsx         # Visual VU meter (display only)
│   │   │
│   │   ├── Search/
│   │   │   ├── SearchPanel.tsx     # Search input + results list
│   │   │   ├── SearchResult.tsx    # Individual result row
│   │   │   └── SearchResultList.tsx
│   │   │
│   │   ├── Auth/
│   │   │   ├── AuthButton.tsx      # Sign-in / sign-out button
│   │   │   └── AuthStatus.tsx      # Displays current user
│   │   │
│   │   └── Layout/
│   │       ├── Header.tsx
│   │       └── AppLayout.tsx
│   │
│   ├── store/
│   │   ├── index.ts                # Store composition root
│   │   ├── deckStore.ts            # Deck A and B state slices
│   │   ├── mixerStore.ts           # Crossfader, volumes, channel state
│   │   ├── searchStore.ts          # Search query, results, loading
│   │   └── authStore.ts            # GIS token, user info, sign-in state
│   │
│   ├── hooks/
│   │   ├── useYouTubePlayer.ts     # IFrame API lifecycle hook
│   │   ├── useTapTempo.ts          # BPM tap calculation hook
│   │   ├── useCrossfade.ts         # Volume mapping hook
│   │   └── useAuth.ts              # GIS token acquisition hook
│   │
│   ├── services/
│   │   ├── youtubeDataApi.ts       # Data API v3 — search, video details
│   │   ├── youtubeIframeApi.ts     # IFrame API loader and player factory
│   │   └── authService.ts          # GIS initialisation and token request
│   │
│   ├── types/
│   │   ├── deck.ts                 # Deck state types
│   │   ├── mixer.ts                # Mixer state types
│   │   ├── search.ts               # Search result / video types
│   │   ├── auth.ts                 # Auth token / user info types
│   │   └── youtube.ts              # IFrame API type claudeations
│   │
│   ├── utils/
│   │   ├── pitchRates.ts           # Discrete rate constants and helpers
│   │   ├── tapTempo.ts             # BPM calculation from tap timestamps
│   │   ├── volumeMap.ts            # Crossfader position → volume curves
│   │   └── formatTime.ts           # MM:SS display formatting
│   │
│   └── constants/
│       ├── pitchRates.ts           # PITCH_RATES = [0.25, 0.5, ..., 2]
│       └── api.ts                  # API endpoint base URLs, quota keys
│
└── public/
    └── favicon.svg
```

---

## 5. State Architecture

State is managed exclusively through Zustand. There is no React Context used for shared mutable state. Each slice owns a clearly bounded domain.

### 5.1 Deck Slice (×2, keyed `'A'` and `'B'`)

```typescript
interface DeckState {
  deckId: 'A' | 'B';
  videoId: string | null;
  title: string;
  channelTitle: string;
  duration: number;           // seconds
  currentTime: number;        // seconds, polled from IFrame API
  playbackState: 'unstarted' | 'playing' | 'paused' | 'ended' | 'buffering';
  pitchRate: PitchRate;       // 0.25 | 0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2
  bpm: number | null;         // user-defined via tap-tempo
  volume: number;             // 0–100, controlled by VolumeKnob
  loopActive: boolean;
  loopStart: number | null;
  loopEnd: number | null;
  playerReady: boolean;
}
```

### 5.2 Mixer Slice

```typescript
interface MixerState {
  crossfaderPosition: number;   // 0.0 (full A) — 1.0 (full B)
  deckAVolume: number;          // 0–100, computed from crossfader + channel fader
  deckBVolume: number;
}
```

Crossfader position maps to volumes via a constant-power (equal-power) curve. See `utils/volumeMap.ts`.

### 5.3 Search Slice

```typescript
interface SearchState {
  query: string;
  results: YouTubeVideoSummary[];
  nextPageToken: string | null;
  loading: boolean;
  error: string | null;
}
```

### 5.4 Auth Slice

```typescript
interface AuthState {
  accessToken: string | null;
  expiresAt: number | null;     // Unix ms
  userInfo: GoogleUserInfo | null;
  signedIn: boolean;
}
```

---

## 6. Audio Pipeline

**Critical constraint**: YouTube IFrame embeds run in a sandboxed cross-origin iframe. The Web Audio API cannot connect to the audio output of a cross-origin iframe. There is no `MediaElementSourceNode` available for YouTube players.

### 6.1 What is possible

- `player.setVolume(0–100)` — controls playback volume via IFrame postMessage.
- `player.setPlaybackRate(rate)` — sets discrete playback rate.
- `player.seekTo(seconds)` — seeks to position.
- `player.pauseVideo()` / `player.playVideo()` — transport control.

### 6.2 Crossfade implementation

The crossfader slider emits a normalised value `x ∈ [0, 1]`.

Volume for each deck is computed using a constant-power (equal-power) curve:

```
deckAVolume = cos(x * π/2) * 100
deckBVolume = cos((1 - x) * π/2) * 100
```

Both volumes are applied by calling `playerA.setVolume(deckAVolume)` and `playerB.setVolume(deckBVolume)` on every crossfader change. Per-deck channel faders are composed multiplicatively before the final `setVolume()` call.

### 6.3 EQ (v1 — visual only)

EQ knobs (Low, Mid, High) exist in the UI and persist values in deck state, but do not alter audio in v1. This is clearly labelled in the UI. A future version may use a backend proxy audio stream to enable real Web Audio EQ processing.

### 6.4 No waveform analysis

Waveform display and beat-grid analysis are not possible in v1 without audio stream access. A static decorative waveform graphic may be shown as a placeholder.

See `decisions/adr-002-audio-pipeline.md`.

---

## 7. Authentication & API Access

### 7.1 Google Identity Services — Token Flow

DJRusty uses the GIS JavaScript SDK with the OAuth 2.0 implicit (token) flow. No authorisation code exchange is required; the access token is returned directly to the browser.

Scopes requested:
- `https://www.googleapis.com/auth/youtube.readonly`

Token storage: in-memory only (Zustand `authStore`). Not persisted to `localStorage`. Token lifetime is typically 3600 seconds.

### 7.2 YouTube Data API v3

All Data API calls use the OAuth access token obtained via GIS. API key included as fallback for public endpoints.

Endpoints used:
- `GET /youtube/v3/search` — keyword search, type=video
- `GET /youtube/v3/videos` — video details (duration, title, channel)

### 7.3 No backend

Static SPA deployment (Vercel, GitHub Pages, etc.). OAuth client ID and API key are embedded in the client bundle. Mitigated by HTTP referrer restrictions on the API key in Google Cloud Console.

See `decisions/adr-003-auth-approach.md` and `decisions/adr-004-youtube-api.md`.

---

## 8. YouTube IFrame API Integration

Two `YT.Player` instances managed independently — one for Deck A, one for Deck B.

### 8.1 Player Lifecycle

1. IFrame API script loaded once via singleton `youtubeIframeApi.ts`.
2. `onYouTubeIframeAPIReady` fires; singleton promise resolves.
3. Each deck creates its `YT.Player` once API is ready and DOM node is mounted.
4. `onReady` → sets `playerReady: true` in deck store.
5. `onStateChange` → updates `playbackState` in deck store.
6. `currentTime` polled via `player.getCurrentTime()` every 250ms while playing.

### 8.2 Loading a Track

1. User selects search result → dispatches `loadTrack(deckId, videoId, metadata)`.
2. Store updates `videoId`, `title`, `channelTitle`, `duration`.
3. `YouTubePlayer` calls `player.cueVideoById(videoId)` (default) or `loadVideoById` (auto-play setting).

### 8.3 Component Communication

All inter-component communication flows through Zustand. Side effects calling the IFrame API are driven by `useEffect` hooks in `YouTubePlayer.tsx` watching relevant store fields.

---

## 9. Build & Deployment

- **Build**: `vite build` → `dist/`
- **Dev server**: `vite dev` → `localhost:5173`
- **Environment variables** (Vite `VITE_*` prefix):
  - `VITE_GOOGLE_CLIENT_ID`
  - `VITE_YOUTUBE_API_KEY`
- **Target**: Chrome 110+, Firefox 110+, Safari 16+

---

## 10. Known Limitations (v1)

| Limitation | Reason | Future Mitigation |
|---|---|---|
| No real EQ/effects | CORS blocks Web Audio on IFrame audio | Backend audio proxy |
| No waveform analysis | No audio stream access | Backend audio proxy |
| No beat sync | No audio analysis | Tap-tempo only |
| Pitch rates discrete only | IFrame API constraint | Backend proxy or HTML5 audio |
| Token not persisted | Security; no backend refresh flow | Backend with refresh tokens |
| API key public | No backend | Backend proxy for API calls |
