# DJ Rusty

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0-blue?style=for-the-badge)]()

A browser-based two-deck DJ mixer that works with local audio files — built for low-latency, sample-accurate playback and live performance in the browser.

[Highlights](#-highlights) • [Architecture](#-architecture) • [Quick start](#-quick-start) • [License](#-license)

</div>

---

DJ Rusty is a client-side DJ application implemented with modern Web Audio APIs, focused on accurate transport (cue/play/tempo), realistic scratching via an AudioWorklet-based scratch engine, and a compact performance-oriented UI.

---

## ✨ Highlights

- Two independent decks with per-deck queues and auto-advance
- Sample-accurate transport: play / pause / cue / beatgrid / SYNC
- Jog wheel with VINYL mode and real-time scratch playback (AudioWorklet)
- Performance pad grid (8 pads) with HOT CUE, LOOP, SLICER and SAMPLER modes
- Beat-synced loops, quantize, shift modifiers and SLIP mode
- Library browser (local file import) and named session persistence (IndexedDB)
- Client-only: no servers or accounts — runs entirely in-browser

---

## 🏗️ Architecture

### Project structure

```
DJRusty/
├── public/                    # Static assets and index.html
├── src/                       # Application source
│   ├── components/            # React/Vue/Solid UI components (Deck, Mixer, Pads, Library)
│   ├── services/              # Audio backend, scratch processor, player registry
│   ├── store/                 # IndexedDB session store, library store, sampler store
│   ├── styles/                # CSS / Tailwind / component styles
│   └── index.tsx              # App bootstrap
├── test/                      # Unit and integration tests
├── vite.config.ts             # Vite development config
└── package.json
```

---

## 🔊 Core Concepts

- Single Web Audio backend: all decks and sampler slots are scheduled against one AudioContext to keep tight sync.
- DeckPlayer abstraction: every deck command (play, pause, seek, scratch) funnels through `DeckPlayer` in the player registry for consistent behavior.
- Scratch engine: an AudioWorkletProcessor performs sample-accurate reverse and variable-speed playback for realistic vinyl-style scratching.
- Session persistence: named sessions save audio blobs, deck queues, hot cues and beatgrids to IndexedDB for offline recall.

---

## Features

- Dual decks — Import local audio files (MP3, WAV, FLAC, OGG, M4A/AAC) via drag-drop or file picker; each deck maintains its own queue with auto-advance
- CDJ transport — Sample-accurate play/pause/cue, beat-grid, tap-downbeat, SYNC
- Jog wheel + real scratch audio — Interactive platter with a VINYL mode toggle per deck: dragging scratches the track with sample-accurate reverse/variable-speed playback (driven by an AudioWorklet)
- Unified performance pads — One 8-pad grid per deck, switchable between four modes: HOT CUE (8 cues), LOOP (beat-synced loop lengths), SLICER (live beat-slice triggering with adjustable slice size), SAMPLER (load and trigger short samples)
- Manual + beat-synced loops — IN/OUT/RELOOP for manual loop points, beat-synced loop lengths, beat-jump (±1/2/4/8 bars), SLIP mode keeps time while loops/scratches occur
- Full channel strip — GAIN (input trim), 3-band EQ with kill switches, high-pass/low-pass filter sweep, Echo/Reverb FX with BEAT/TIME sync, QUANTIZE and SHIFT modifiers
- Continuous pitch slider — 0.5×–2.0× playback rate, with exact SYNC between decks and a live beatmatch guide
- Crossfader + mixer — Per-deck gain/volume, EQ columns flanking the mixer's channel strip, crossfader with selectable curve, VU meters
- Per-deck waveform — Frequency-colored waveform (bass/mid/high) with hot-cue markers and a live playhead
- Library Browser — Filter imported tracks; load to Deck A/B; remove from library
- Named sessions — Save/load/delete named sessions in IndexedDB (persists audio blobs, deck queues, hot cues, beat grids, loops, and sampler slots)
- Client-only — No server, no accounts, no network requests; everything runs locally in your browser

---

## 🛠️ Quick start

```bash
npm install
npm run dev        # Vite dev server on :5173
```

Open http://localhost:5173 in a modern browser (Chrome, Edge, or Firefox recommended). For best low-latency audio, enable the browser's experimental WebAudio flags if available.

---

## 🧪 Testing & Quality

```bash
npm run test       # Run unit tests (Vitest / Jest)
npm run lint       # ESLint, zero-warnings policy
npm run build      # tsc -b && vite build
```

---

## 📁 Notable source files

- `src/services/playerRegistry.ts` — DeckPlayer interface and central registry for deck control
- `src/services/scratchProcessor.ts` — AudioWorkletProcessor implementing real-time scratch playback
- `src/components/Deck/JogWheel.tsx` — Interactive jog wheel UI and input mapping
- `src/components/Deck/PadGrid.tsx` — Performance pads and mode switching (HotCue / Loop / Slicer / Sampler)
- `src/store/libraryStore.ts` — Local library management and blob URL lifecycle
- `src/services/sessionStore.ts` — IndexedDB save/load/list/delete for named sessions

Layout is designed and tested against a 1366×768 minimum viewport.

---

## 🎛️ Performance considerations

- Use a single shared AudioContext to keep decks synchronized
- Predecode audio where possible to reduce seek latency
- Limit concurrent sample playback to avoid CPU spikes in the browser
- Use WebAssembly or optimized workers if complex DSP is added

---

## 🤝 Contributing

Contributions welcome. Please follow these guidelines:

- Keep audio timing code deterministic and tested
- Prefer dependency-free utility code where feasible
- Add unit tests for transport and scheduler behavior
- Open a pull request with a clear description of functional changes

---

## 📄 License

Licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## 👤 Author

Built by **Russell Benzing**.

---

## 🆘 Support

- Issues: https://github.com/rbenzing/DJRusty/issues
- Repository: https://github.com/rbenzing/DJRusty

---

## 📝 Changelog

### v0.1.0

- Initial rewrite of README to match MalwareDefenseFramework style
- Documented architecture, features, and developer guidance

---

Enjoy DJ Rusty — drop in some tracks and spin!
