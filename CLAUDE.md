# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

DJ Rusty is a browser-based two-deck DJ mixer. Tracks play from either YouTube (IFrame API) or locally downloaded MP3s (Web Audio API). A small Express + SQLite backend downloads audio via `yt-dlp` and streams real-time progress over WebSocket.

## Commands

Frontend (project root):
- `npm run dev` — runs **both** server (`server/`) and Vite UI concurrently (UI on :5173, API on :3001)
- `npm run build` — `tsc -b && vite build` (type-check then bundle)
- `npm run lint` — ESLint, **zero-warnings policy** (`--max-warnings 0`)
- `npm run test` / `test:watch` — Vitest (jsdom). Single test: `npx vitest run src/utils/beatSync.test.ts`

Server (`cd server`):
- `npm run dev` — `tsx watch src/index.ts`; `npm run lint` — `tsc --noEmit`; `npm run test` — Vitest
- Requires `yt-dlp` on PATH for downloads (`winget install yt-dlp.yt-dlp`)

Per the user's global instructions, **always run build and lint after writing code** (both frontend and server when touched).

## Architecture

**Dual playback backends, one interface.** Every deck command (seek, play, EQ) goes through the `DeckPlayer` interface in [src/services/playerRegistry.ts](src/services/playerRegistry.ts). YouTube tracks use `YouTubePlayerAdapter` (wraps a sandboxed IFrame); downloaded MP3s use the full Web Audio signal chain in [src/services/audioEngine.ts](src/services/audioEngine.ts) (real EQ/filter/effects). The player instance lives in a `useRef` and is **never** stored in Zustand — components reach it via the module-level registry. A deck's `sourceType` in [src/store/deckStore.ts](src/store/deckStore.ts) selects the backend.

**Capability split:** YouTube backend = discrete pitch rates only, no real EQ (volume-mapped), no waveform (CORS-sandboxed iframe). MP3 backend = full Web Audio EQ/filter/effects + waveform peaks. Don't assume a feature works on both — check `sourceType`.

**State:** Zustand stores in [src/store/](src/store/) — `deck` (per-deck A/B), `mixer`, `auth`, `search`, `playlist`, `download`, `settings`. Pure logic (beat sync, beat jump, loops, hot cues, waveform peaks) lives in [src/utils/](src/utils/) and is unit-tested in isolation; keep it free of React/DOM.

**Backend** ([server/src/](server/src/)): Express routes (`library`, `download`, `videos`) + a `ws/broadcast` WebSocket. `downloadService` spawns `yt-dlp` to extract MP3s into `server/downloads/`; `libraryService` persists track metadata to SQLite (`better-sqlite3`, schema in [server/src/db/schema.sql](server/src/db/schema.sql), DB at `server/data/djrusty.db`). The frontend tracks download progress live via [src/services/wsClient.ts](src/services/wsClient.ts) (singleton, auto-reconnect). `/api/audio/:videoId` streams the downloaded file.

## Conventions

- **Strict TS:** `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` are on — indexed access is `T | undefined`, and optional props can't be set to `undefined` explicitly. Code must handle these.
- CSS Modules (`*.module.css`) co-located per component under [src/components/](src/components/).
- Auth: Google Identity Services; access token kept **in memory only**, profile in localStorage (7-day session, silent refresh). See [src/services/authService.ts](src/services/authService.ts).
- The [README.md](README.md) predates the server/MP3 backend — treat this file as the source of truth for current architecture.
