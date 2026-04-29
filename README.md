# 🎚️ DJ Rusty

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

A browser-based two-deck DJ mixer powered by YouTube videos. Load any YouTube track onto either deck and mix, loop, sync, and scratch your way through a set — no downloads, no plugins, entirely in your browser.

---

## ✨ Features

### 🔐 Authentication
- **Google OAuth 2.0** sign-in via Google Identity Services
- **Persistent sessions** with 7-day expiry — no login popup on every refresh
- **Silent token refresh** 5 minutes before expiry
- Access token kept in memory only; non-sensitive profile data persisted to localStorage

### 🔍 Search & Pre-loading
- YouTube search with pagination
- Results cached in localStorage (1-hour TTL, max 20 entries, LRU eviction)
- Genre pre-loading on sign-in: house, techno, drum and bass, hip hop, trance

### 🎛️ Deck Controls (per deck)
- **Play / Pause / Cue** — standard transport controls
- **Pitch Fader** — 8 discrete rates: 0.25×, 0.5×, 0.75×, 1×, 1.25×, 1.5×, 1.75×, 2×
- **Tap Tempo (BPM)** — tap to set BPM for sync and loop calculations
- **Beat Jump** — jump ½, 1, 2, 4, 8, or 16 beats forward/backward
- **Beat Sync** — match this deck's pitch rate to the other deck's BPM
- **🔥 8 Hot Cues** — set and jump to up to 8 named positions; persisted per video ID
- **Loop Controls** — manual loop set/exit; beat-synced loops (1, 2, 4, 8 beats)
- **Loop Roll** — hold to loop, release to snap back to playback position
- **Slip Mode** — keeps shadow playhead running; exits back to position on release
- **🎚️ EQ** — low / mid / high (via IFrame volume)

### 🔀 Mixer
- **Channel Faders** — per-deck volume control (0–100)
- **VU Meters** — animated level display
- **Crossfader** with three curve modes:
  - **Smooth (S)** — constant-power cosine curve
  - **Linear (L)** — straight linear fade
  - **Sharp (X)** — hard cut mode
- **Master Volume** — global output level knob

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|:---:|--------|
| `Space` / `Enter` | Play / Pause (active deck) |
| `Q` | Jump to Cue — Deck A |
| `W` | Jump to Cue — Deck B |
| `A` | Set Cue — Deck A |
| `S` | Set Cue — Deck B |
| `←` / `→` | Beat Jump back/forward — Deck A |
| `,` / `.` | Beat Jump back/forward — Deck B |
| `1`–`8` | Trigger Hot Cue 1–8 (active deck) |
| `T` | Tap Tempo — Deck A |
| `Y` | Tap Tempo — Deck B |

> Shortcuts are disabled when focus is in a text input or textarea.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 18 |
| **State Management** | Zustand 4 |
| **Build Tool** | Vite 5 |
| **Language** | TypeScript 5 (strict mode, noUncheckedIndexedAccess) |
| **Testing** | Vitest + Testing Library |
| **Playback** | YouTube IFrame API |
| **Authentication** | Google Identity Services (GIS) |

**Language Composition:** 84.6% TypeScript, 14.6% CSS, 0.8% Other

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **Google Cloud project** with YouTube Data API v3 and Google Identity enabled
- **YouTube Data API key**
- **OAuth 2.0 client ID** (Web application type)

### Installation

1. **Clone and install**
   ```bash
   git clone https://github.com/rbenzing/DJRusty.git
   cd DJRusty
   npm install
   ```

2. **Configure environment**
   
   Create a `.env.local` file at the project root:
   ```env
   VITE_GOOGLE_CLIENT_ID=your-oauth-client-id.apps.googleusercontent.com
   VITE_YOUTUBE_API_KEY=your-youtube-data-api-key
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📋 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check then build for production |
| `npm run preview` | Serve the production build locally |
| `npm run test` | Run all tests once (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint (zero warnings policy) |

---

## 📁 Project Structure

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

---

## ⚠️ Limitations

- **No waveform display** — YouTube IFrame API runs in a sandboxed iframe; Web Audio API cannot access its audio stream due to CORS.
- **No real EQ/effects** — EQ knobs adjust IFrame volume only; no frequency-band processing is possible.
- **Discrete pitch rates only** — YouTube's `setPlaybackRate` accepts only fixed rates; smooth pitch bending is not supported.
- **YouTube Terms** — usage is subject to the YouTube API Services Terms of Service. Intended for personal/development use.

---

## 📝 License

MIT License — see [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Made with ❤️ by [rbenzing](https://github.com/rbenzing)**