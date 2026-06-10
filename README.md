# 🎚️ DJ Rusty

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Node](https://img.shields.io/badge/Node-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

A browser-based two-deck DJ mixer. Search YouTube, load any track onto either deck, and mix, loop, sync, and scratch your way through a set. Stream tracks straight from YouTube, **or download them as MP3s** to unlock real EQ, filter sweeps, effects, and waveforms — all in your browser.

---

## ✨ Features

### 🎵 Two ways to play

DJ Rusty runs each deck on one of two playback engines, picked automatically based on the track you load:

| | **YouTube (streaming)** | **Downloaded MP3** |
|---|---|---|
| Source | YouTube IFrame player | Local file via Web Audio API |
| Pitch | 8 discrete rates | Smooth, continuous |
| EQ | Volume-mapped approximation | True 3-band frequency EQ |
| Filter / Effects | — | Filter sweep, echo, reverb |
| Waveform | — | Full colored waveform |

Download any search result with one click — the backend grabs it with `yt-dlp`, converts to MP3, and streams live progress to the UI over WebSocket. Once downloaded, a track gains the full Web Audio signal chain.

### 🔐 Authentication
- **Google OAuth 2.0** sign-in via Google Identity Services
- **Persistent sessions** with 7-day expiry — no login popup on every refresh, with silent token refresh before expiry
- Access token kept in memory only; non-sensitive profile data persisted to `localStorage`

### 🔍 Search & Library
- YouTube search with pagination, optionally **scoped to a single channel**
- Results cached in `localStorage` (1-hour TTL, LRU eviction)
- Genre pre-loading on sign-in: house, techno, drum & bass, hip hop, trance
- **Download Library** of your saved MP3s, **Channel** browser, and **Playlist** panel
- **Drag-and-drop file import** to load local audio directly onto a deck

### 🎛️ Deck Controls (per deck)
- **Play / Pause / Cue** transport
- **Pitch Fader** — smooth on MP3 decks; 8 fixed rates (0.25×–2×) on YouTube decks
- **Tap Tempo (BPM)** — tap to set tempo for sync and loop math; auto BPM detection on downloaded tracks
- **Beat Jump** — ½, 1, 2, 4, 8, or 16 beats forward/back
- **Beat Sync** — match this deck's tempo to the other deck
- **🔥 8 Hot Cues** — set and jump to named positions; persisted per video
- **Loops** — manual set/exit and beat-synced loops (1, 2, 4, 8 beats), plus **Loop Roll** (hold to loop, release to snap back)
- **Slip Mode** — keeps a shadow playhead running; snaps back to it on release
- **🎚️ 3-band EQ** with kill switches, **filter sweep**, and **echo / reverb** effects *(full fidelity on MP3 decks)*

### 🔀 Mixer
- **Channel Faders** with animated **VU Meters**
- **Crossfader** with three curves — **Smooth** (constant-power), **Linear**, and **Sharp** (hard cut)
- **Master Volume**

---

## ⌨️ Keyboard Shortcuts

| Key | Action | | Key | Action |
|:---:|--------|---|:---:|--------|
| `Space` / `Enter` | Play / Pause (active deck) | | `A` / `S` | Set Cue — Deck A / B |
| `Q` / `W` | Jump to Cue — Deck A / B | | `T` / `Y` | Tap Tempo — Deck A / B |
| `←` / `→` | Beat Jump — Deck A | | `,` / `.` | Beat Jump — Deck B |
| `1`–`8` | Trigger Hot Cue 1–8 (active deck) | | | |

> Shortcuts are disabled while focus is in a text input or textarea.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 · Zustand 4 · Vite 5 · TypeScript 5 (strict, `noUncheckedIndexedAccess`) |
| **Playback** | YouTube IFrame API · Web Audio API |
| **Auth** | Google Identity Services (GIS) |
| **Backend** | Node + Express · WebSocket (`ws`) · SQLite (`better-sqlite3`) |
| **Downloads** | `yt-dlp` (external binary) |
| **Testing** | Vitest + Testing Library |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** on your `PATH` (for MP3 downloads) — e.g. `winget install yt-dlp.yt-dlp` or `brew install yt-dlp`
- **Google Cloud project** with YouTube Data API v3 and Google Identity enabled — you'll need a **YouTube Data API key** and an **OAuth 2.0 client ID** (Web application type)

### Installation

1. **Clone and install** (installs both the app and the server)
   ```bash
   git clone https://github.com/rbenzing/DJRusty.git
   cd DJRusty
   npm install
   npm install --prefix server
   ```

2. **Configure environment** — create a `.env.local` at the project root:
   ```env
   VITE_GOOGLE_CLIENT_ID=your-oauth-client-id.apps.googleusercontent.com
   VITE_YOUTUBE_API_KEY=your-youtube-data-api-key
   # Optional: restrict all searches to one channel
   VITE_YOUTUBE_CHANNEL_ID=
   ```

3. **Run it** — one command starts both the API server (`:3001`) and the Vite UI (`:5173`):
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173).

---

## 📋 Available Scripts

Run from the project root unless noted.

| Command | Description |
|---------|-------------|
| `npm run dev` | Start **both** the backend server and the Vite UI with HMR |
| `npm run build` | Type-check then build the frontend for production |
| `npm run preview` | Serve the production build locally |
| `npm run test` / `test:watch` | Run frontend tests (Vitest) once / in watch mode |
| `npm run lint` | Lint the frontend (zero-warnings policy) |
| `npm run test --prefix server` | Run backend tests |
| `npm run lint --prefix server` | Type-check the backend |

---

## 📁 Project Structure

```
src/                      # React frontend
├── components/           # Deck, Mixer, Search, Library, Playlist, Auth, FileImport…
├── hooks/                # useAuth, useYouTubePlayer, useAudioEngine, useDownloadManager…
├── store/                # Zustand stores: deck, mixer, auth, search, playlist, download, settings
├── services/             # playerRegistry (backend abstraction), audioEngine, wsClient, youtube APIs
├── utils/                # Pure logic: beatSync, beatJump, loops, hotCues, waveform peaks
└── types/                # Shared TypeScript interfaces

server/                   # Express + SQLite backend
├── src/routes/           # library, download, videos
├── src/services/         # downloadService (yt-dlp), libraryService (SQLite)
├── src/ws/               # WebSocket download-progress broadcast
├── src/db/               # schema.sql + connection
├── data/                 # SQLite database
└── downloads/            # Downloaded MP3 files
```

The heart of the design is `services/playerRegistry.ts`: both playback engines implement one common `DeckPlayer` interface, so every control works the same regardless of whether a track is streaming from YouTube or playing from a downloaded MP3.

---

## ⚠️ Limitations

- **YouTube decks are limited by the IFrame sandbox** — no waveform (the audio stream is CORS-protected), EQ is only a volume approximation, and pitch is restricted to YouTube's fixed playback rates. Download a track to MP3 to lift all three.
- **Downloads require `yt-dlp`** installed and on your `PATH`.
- **YouTube Terms** — use is subject to the [YouTube API Services Terms of Service](https://developers.google.com/youtube/terms/api-services-terms-of-service). Intended for personal / development use.

---

## 📝 License

MIT License — see [LICENSE](LICENSE) for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to open an issue or submit a Pull Request.

---

**Made with ❤️ by [rbenzing](https://github.com/rbenzing)**
