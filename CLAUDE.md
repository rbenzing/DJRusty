# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

DJ Rusty is a browser-based two-deck DJ mixer. Tracks play from local audio files (MP3, WAV, FLAC, OGG, M4A/AAC) via the Web Audio API. The app is fully client-side — no server, no accounts, no network requests.

## Commands

Frontend (project root):
- `npm run dev` — Vite dev server (UI on :5173)
- `npm run build` — `tsc -b && vite build` (type-check then bundle)
- `npm run lint` — ESLint, **zero-warnings policy** (`--max-warnings 0`)
- `npm run test` / `test:watch` — Vitest (jsdom). Single test: `npx vitest run src/utils/beatSync.test.ts`

Per the user's global instructions, **always run build and lint after writing code**.

## Architecture

**Single Web Audio backend.** Every deck command (seek, play, EQ) goes through the `DeckPlayer` interface in [src/services/playerRegistry.ts](src/services/playerRegistry.ts). The full Web Audio signal chain (EQ/filter/effects/waveform) lives in [src/services/audioEngine.ts](src/services/audioEngine.ts). The player instance lives in a `useRef` inside `useAudioEngine` and is **never** stored in Zustand — components reach it via the module-level registry.

**State:** Zustand stores in [src/store/](src/store/) — `deck` (per-deck A/B), `mixer`, `playlist`, `library`, `session`, `settings`. Pure logic (beat sync, beat jump, loops, hot cues, waveform peaks) lives in [src/utils/](src/utils/) and is unit-tested in isolation; keep it free of React/DOM.

**Library & Sessions:** `src/store/libraryStore.ts` manages the session-scoped imported track list (blob URL lifecycle). `src/services/sessionStore.ts` uses IndexedDB to save/load/delete named sessions (audio bytes + deck queues + hot cues + beat grid + loops). The `SearchPanel` at the bottom of the layout exposes Playlist, Library, and Sessions tabs.

## Conventions

- **Strict TS:** `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` are on — indexed access is `T | undefined`, and optional props can't be set to `undefined` explicitly. Code must handle these.
- CSS Modules (`*.module.css`) co-located per component under [src/components/](src/components/).
- The [README.md](README.md) is the source of truth for current architecture.
