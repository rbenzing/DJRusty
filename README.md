# DJ Rusty

A browser-based two-deck DJ application powered by the YouTube IFrame API. Load any YouTube video onto either deck and mix, loop, sync, and scratch your way through a set — no downloads, no plugins, just a browser.

## Features

### Authentication
- Google OAuth 2.0 sign-in via Google Identity Services
- Persistent sessions (7-day expiry) — no login popup on every refresh
- Silent token refresh 5 minutes before expiry
- Access token kept in memory only; only non-sensitive profile data is persisted to localStorage

### Search & Pre-loading
- YouTube search with pagination
- Results cached in localStorage (1-hour TTL, max 20 entries, LRU eviction)
- Genre pre-loading on sign-in: house, techno, drum and bass, hip hop, trance

### Deck Controls (per deck)
- **Play / Pause / Cue** — standard transport controls
- **Pitch Fader** — 8 discrete playback rates: 0.25×, 0.5×, 0.75×, 1×, 1.25×, 1.5×, 1.75×, 2×
- **Tap Tempo (BPM)** — tap to set BPM for sync and loop calculations
- **Beat Jump** — jump ½, 1, 2, 4, 8, or 16 beats forward/backward
- **Beat Sync** — match this deck's pitch rate to the other deck's BPM (snaps to closest discrete rate)
- **8 Hot Cues** — set and jump to up to 8 named positions per track; persisted to localStorage per video ID
- **Loop Controls** — manual loop set/exit; beat-synced loops (1, 2, 4, 8 beats)
- **Loop Roll** — hold to loop, release to snap back to where playback would have been
- **Slip Mode** — keeps a shadow playhead running during loops/rolls; exits back to that position on release
- **EQ** — low / mid / high (visual, via IFrame volume — no Web Audio due to YouTube CORS)

### Mixer
- **Channel Faders** — per-deck volume (0–100)
- **VU Meters** — animated level display
- **Crossfader** — with three curve modes:
  - **Smooth (S)** — constant-power cosine curve; both decks at ~71% at centre
  - **Linear (L)** — straight linear fade
  - **Sharp (X)** — hard cut; both decks at 100% until they cross centre
- **Master Volume** — global output level knob

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause — active deck |
| `Enter` | Play / Pause — active deck |
| `Q` | Jump to Cue — Deck A |
| `W` | Jump to Cue — Deck B |
| `A` | Set Cue — Deck A |
| `S` | Set Cue — Deck B |
| `←` | Beat Jump back — Deck A |
| `→` | Beat Jump forward — Deck A |
| `,` | Beat Jump back — Deck B |
| `.` | Beat Jump forward — Deck B |
| `1`–`8` | Trigger Hot Cue 1–8 (active deck) |
| `T` | Tap Tempo — Deck A |
| `Y` | Tap Tempo — Deck B |

Shortcuts are disabled when focus is inside a text input or textarea.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 |
| State | Zustand 4 |
| Build | Vite 5 |
| Language | TypeScript 5 (strict, `noUncheckedIndexedAccess`) |
| Testing | Vitest + Testing Library |
| Playback | YouTube IFrame API |
| Auth | Google Identity Services (GIS) |

## Prerequisites

- Node.js 18+
- A Google Cloud project with the **YouTube Data API v3** and **Google Identity** enabled
- A YouTube Data API key
- An OAuth 2.0 client ID (Web application type)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables**

   Create a `.env.local` file at the project root:

   ```env
   VITE_GOOGLE_CLIENT_ID=your-oauth-client-id.apps.googleusercontent.com
   VITE_YOUTUBE_API_KEY=your-youtube-data-api-key
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173) in your browser.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check then build for production |
| `npm run preview` | Serve the production build locally |
| `npm run test` | Run all tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint (zero warnings policy) |

## Project Structure

```
src/
├── components/
│   ├── Deck/          # Per-deck controls (transport, loops, hot cues, sync, slip)
│   ├── Mixer/         # Crossfader, channel faders, VU meters, master volume
│   ├── Search/        # Search panel and results
│   └── Auth/          # Sign-in / sign-out
├── hooks/             # useAuth, useYouTubePlayer, useKeyboardShortcuts, useSearchPreload
├── store/             # Zustand stores (auth, deck, mixer, settings)
├── utils/             # Pure utilities (beatSync, beatJump, volumeMap, searchCache, hotCues)
├── constants/         # pitchRates, api
├── services/          # playerRegistry (IFrame player instances)
└── types/             # TypeScript interfaces
```

## Limitations

- **No waveform display** — the YouTube IFrame API runs in a sandboxed iframe; Web Audio API cannot access its audio stream due to CORS.
- **No real EQ/effects** — EQ knobs adjust IFrame volume only; no frequency-band processing is possible.
- **Discrete pitch rates only** — YouTube's `setPlaybackRate` accepts only a fixed set of rates; smooth pitch bending is not supported.
- **YouTube terms** — usage is subject to the YouTube API Services Terms of Service. The app is intended for personal/development use.
