# DJ Rusty

A browser-based two-deck DJ mixer that works with local audio files.

## Features

- **Dual decks** — Import local audio files (MP3, WAV, FLAC, OGG, M4A/AAC) via drag-drop or file picker; each deck maintains its own queue with auto-advance
- **CDJ transport** — Sample-accurate play/pause/cue, beat-grid, tap-downbeat, SYNC
- **Jog wheel + real scratch audio** — Interactive platter with a VINYL mode toggle per deck: dragging scratches the track with sample-accurate reverse/variable-speed playback (via a custom `AudioWorklet`), or — with VINYL off — applies a temporary pitch bend without stopping playback
- **Unified performance pads** — One 8-pad grid per deck, switchable between four modes: **HOT CUE** (8 cues), **LOOP** (beat-synced loop lengths), **SLICER** (live beat-slice triggering with adjustable window size), and **SAMPLER** (8 one-shot sample slots, drag-drop or click to load, independent of the channel mixer)
- **Manual + beat-synced loops** — IN/OUT/RELOOP for manual loop points, beat-synced loop lengths, beat-jump (±1/2/4/8 bars), SLIP mode (shadow playhead keeps time through loops/scratches)
- **Full channel strip** — GAIN (input trim), 3-band EQ with kill switches, high-pass/low-pass filter sweep, Echo/Reverb FX with BEAT/TIME sync, QUANTIZE and SHIFT modifiers
- **Continuous pitch slider** — 0.5×–2.0× playback rate, with exact SYNC between decks and a live beatmatch guide
- **Crossfader + mixer** — Per-deck gain/volume, EQ columns flanking the mixer's channel strip, crossfader with selectable curve, VU meters
- **Per-deck waveform** — Frequency-colored waveform (bass/mid/high) at the top of each deck, with hot-cue markers and a live playhead
- **Library Browser** — Filter imported tracks; load to Deck A/B; remove from library
- **Named sessions** — Save/load/delete named sessions in IndexedDB (persists audio bytes + both deck queues + per-track hot cues + beat grid + loops + sampler slots)
- **Client-only** — No server, no accounts, no network requests; everything runs in your browser

## Quick start

```bash
npm install
npm run dev        # Vite dev server on :5173
```

## Testing

```bash
npm run test       # Vitest (jsdom)
npm run lint       # ESLint, zero-warnings policy
npm run build      # tsc -b && vite build
```

## Architecture

Single Web Audio backend. Every deck command goes through the `DeckPlayer` interface in `src/services/playerRegistry.ts`. The full Web Audio signal chain (EQ/filter/effects/waveform/scratch) lives in `src/services/audioEngine.ts`. Zustand stores in `src/store/` manage deck/mixer/library/playlist/sampler/session state.

- `src/components/Deck/JogWheel.tsx` + `src/services/scratchProcessor.ts` — interactive platter and the `AudioWorkletProcessor` driving real sample-accurate scratch playback
- `src/components/Deck/PadGrid.tsx` (+ `PadGridHotCue`/`PadGridLoop`/`PadGridSlicer`/`PadGridSampler`) — the unified, mode-switched performance-pad grid
- `src/store/samplerStore.ts` + `src/services/samplerEngine.ts` — per-deck sample slots and their dedicated playback bus (bypasses the channel fader/crossfader, still scaled by MASTER)
- `src/components/Mixer/EQPanel.tsx` — per-deck EQ, rendered inside the Mixer as columns flanking its channel strip (not inside the deck itself)
- `src/store/libraryStore.ts` — session-scoped imported track list with blob URL lifecycle
- `src/services/sessionStore.ts` — IndexedDB save/load/list/delete for named sessions
- `src/components/Library/LibraryBrowser.tsx` — filterable library with Load-to-Deck
- `src/components/Session/SessionPanel.tsx` — session save/load/delete UI

Layout is designed and tested against a 1366×768 minimum viewport (see `--min-viewport-width` in `src/index.css`).
