# DJ Rusty

A browser-based two-deck DJ mixer that works with local audio files.

## Features

- **Dual decks** — Import local audio files (MP3, WAV, FLAC, OGG, M4A/AAC) via drag-drop or file picker; each deck maintains its own queue with auto-advance
- **CDJ transport** — Sample-accurate play/pause/cue, beat-grid, tap-downbeat, SYNC
- **Beat-accurate loops** — Set/clear loop points; beat-jump (±1/2/4/8 bars)
- **Hot cues** — 8 per deck, persisted in localStorage
- **Full EQ + FX** — 3-band EQ with kill switches, high-pass/low-pass filter sweep, echo and reverb
- **Continuous pitch slider** — 0.5×–2.0× playback rate
- **Crossfader + mixer** — Per-deck volume/EQ + channel crossfader
- **Waveform display** — Scrolling dual waveform
- **Library Browser** — Filter imported tracks; load to Deck A/B; remove from library
- **Named sessions** — Save/load/delete named sessions in IndexedDB (persists audio bytes + both deck queues + per-track hot cues + beat grid + loops)
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

Single Web Audio backend. Every deck command goes through the `DeckPlayer` interface in `src/services/playerRegistry.ts`. The audio engine lives in `src/services/audioEngine.ts`. Zustand stores in `src/store/` manage deck/mixer/library/playlist/session state.

- `src/store/libraryStore.ts` — session-scoped imported track list with blob URL lifecycle
- `src/services/sessionStore.ts` — IndexedDB save/load/list/delete for named sessions
- `src/components/Library/LibraryBrowser.tsx` — filterable library with Load-to-Deck
- `src/components/Session/SessionPanel.tsx` — session save/load/delete UI
