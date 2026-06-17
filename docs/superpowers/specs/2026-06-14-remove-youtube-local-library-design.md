# Remove YouTube → Local-Audio DJ Mixer (client-only) — Design Spec

**Date:** 2026-06-14
**Status:** Approved (brainstorming) — pending implementation plan

## Problem

DJ Rusty was built around **two playback backends** (YouTube IFrame + Web Audio MP3) selected by a per-deck `sourceType`. The YouTube integration is problematic and brings heavy machinery: Google OAuth, the YouTube Data API search, a yt-dlp download server, a WebSocket progress channel, SQLite persistence, and ~50 `sourceType === 'youtube'` branches plus capability-gating that only exists because YouTube is feature-limited. We want a **fully client-side local-audio DJ mixer**: import local files (mp3/wav/flac/ogg/m4a/aac), play them through the (already excellent) Web Audio engine, and drop everything YouTube.

## Goal

Remove **all** YouTube/Google/server code and collapse the app to a single Web Audio backend driven entirely by locally imported files, while **retaining every non-YouTube feature** (transport, loops, beat grid, SYNC, EQ/FX, per-deck queues, auto-advance, add-to-deck).

### Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Library/persistence model | **Client-only, no server, session-only.** Imported files are in-memory blob URLs that live for the session. Delete `server/` entirely. |
| Auth | **Remove Google sign-in entirely** (it existed only for the YouTube Data API). |
| Search | **Replace with a Library Browser** — filter/browse the session's imported tracks (by title/artist). |
| Audio formats | **mp3, wav, flac, ogg, m4a/aac** (decode support varies by browser; handle decode failures gracefully). |
| `sourceType` field | **Remove entirely** (full single-backend collapse — no vestigial field). |
| Load-to-Deck behavior | **Append** to that deck's queue (does NOT replace/interrupt what's playing). |
| Saved sessions | **Named sessions in IndexedDB** (in-app Save/Load list). Library is still empty on a fresh launch; sessions are explicit, opt-in restores. |
| Session contents | **Audio bytes + library + both deck queues/order + per-track hot cues, loops, and beat grid (bpm/anchor).** |

## Features to RETAIN (regression-critical)

These must keep working after the removal — call them out in every phase's tests:

- **Per-deck queues (Deck A / Deck B):** each deck has its own playlist/queue with add, reorder, remove, and a current index. (`playlistStore`: `playlists[deckId]`, `currentIndex[deckId]`.)
- **Add to a specific deck:** **appending** a track to Deck A or Deck B's queue from the Library Browser, the playlist UI, and **drag-drop onto a deck** — never interrupting the currently-playing track. (`addTrack(deckId, entry)`; an empty deck auto-loads the first appended track, a busy deck just enqueues.)
- **Auto-play next song on track end:** when a track finishes, the deck advances to the next queued track and plays it. (Engine `onEnded` → `setPlaybackState('ended')` → `playlistStore.skipToNext(deckId)`.) This must survive the engine's `onended` and the playlist wiring.
- **Everything from the hardware-accurate transport work:** CDJ cue/play, sample-accurate loops, beat grid + tap-downbeat, beat-jump, exact SYNC, continuous pitch, EQ/kills/filter-sweep, echo/reverb — all unchanged in behavior (only the YouTube *gating* is removed; they become unconditionally enabled).
- **Waveform, hot cues, crossfader/mixer, keyboard shortcuts** — unchanged.

## Architecture (after removal)

A single-backend, client-only app:

```
import (drag-drop / file picker)
   -> URL.createObjectURL(file) + File           [session blob URL]
   -> libraryStore.add({ id, title, artist, file, audioUrl, format })
Library Browser (filter)  ->  "Load to Deck A/B"  ->  playlistStore.addTrack(deckId, entry)
Deck drag-drop            ->  playlistStore.addTrack(deckId, entry) (+ load)
playlistStore.loadDeckTrack(deckId, entry) -> deckStore.loadTrack(deckId, entry.id, meta)
useAudioEngine -> decodeAudioFile(blob) -> AudioBuffer -> full Web Audio playback
track ends -> engine.onEnded -> skipToNext(deckId) -> load next -> autoplay
```

No network, no auth, no `sourceType`. `getActivePlayer(deckId)` returns the deck's Web Audio engine.

### Unit boundaries

| Unit | Responsibility | Change |
|---|---|---|
| `server/` (entire dir) | yt-dlp download, SQLite, audio serving, WS | **Delete** |
| `src/store/libraryStore.ts` (new) | Session list of imported tracks (add/remove/filter); blob-URL lifecycle | **Create** |
| `src/components/Library/LibraryBrowser.tsx` (new; replaces Search panel) | Filterable list of imported tracks + "Load to Deck A/B" | **Create** (repurpose Search UI) |
| `src/components/FileImport/FileImportZone.tsx` | Import (broadened formats) → libraryStore | Modify |
| `src/components/Deck/Deck.tsx` | Deck drag-drop import; drop `useYouTubePlayer` call | Modify |
| `src/services/audioDecoder.ts` | `decodeAudioFile` (format-agnostic) | Keep |
| `src/services/audioEngine.ts`, `src/hooks/useAudioEngine.ts` | Web Audio engine + lifecycle + auto-advance | Keep; drop `sourceType` guards |
| `src/services/playerRegistry.ts` | Single deck→engine map; `getActivePlayer(deckId)` | Simplify (drop YouTube adapter/backendType) |
| `src/store/playlistStore.ts` | Per-deck queues + skipToNext + loadDeckTrack | Keep; strip YouTube-overlay + `sourceType`/`videoId` |
| `src/store/deckStore.ts`, `src/types/*` | Deck state, playlist/track types | Remove `sourceType`/`videoId` fields |
| EQ/Effects/Pitch panels, `capabilities.ts` | Capability gating | Delete `capabilities.ts`; un-gate panels (always enabled / continuous pitch) |
| `src/services/sessionStore.ts` (new) | IndexedDB persistence: save/load/list/delete named sessions (audio Blobs + manifest) | **Create** |
| `src/components/Session/SessionPanel.tsx` (new) | Save Session (name) + list of saved sessions with Load/Delete | **Create** |

## What gets DELETED

**Server:** the entire `server/` directory (routes `download`/`videos`/`library`/`audio`, `downloadService`, `libraryService`, `db/`, `ws/broadcast`, `index.ts`, all server tests). Update root `package.json`: `dev` runs Vite only (drop the concurrent server run); remove `concurrently` if now unused; remove `--prefix server` scripts.

**Frontend — delete files:**
- YouTube backend: `src/hooks/useYouTubePlayer.ts`, `src/components/Deck/YouTubePlayer.tsx`, `src/services/youtubeIframeApi.ts`, `src/services/youtubeDataApi.ts`, `src/types/youtube.ts`, `src/types/youtube-globals.d.ts`.
- Auth: `src/services/authService.ts`, `src/hooks/useAuth.ts`, `src/store/authStore.ts`, `src/types/auth.ts`, `src/types/gis.d.ts`, `src/components/Auth/AuthButton.tsx`.
- Download/WS: `src/services/wsClient.ts`, `src/hooks/useDownloadManager.ts`, `src/store/downloadStore.ts`.
- Search: `src/store/searchStore.ts`, `src/services/searchCache.ts`, `src/hooks/useSearchPreload.ts`, the **YouTube-search components only** (`SearchBar`, `SearchResult`, `SearchResultList`, and the Search/Recent tabs of `SearchPanel`), `src/components/Library/ChannelPanel.tsx`, `src/components/Library/DownloadLibrary.tsx`.
  - **RETAIN the per-deck Playlist/queue UI** (the component(s) that render Deck A/B queues — e.g. the Playlist tab/panel). `SearchPanel` is *repurposed*, not deleted: it keeps the Playlist (per-deck queue) view and gains the new Library Browser tab; only its Search/Recent (YouTube) tabs are removed.
- Misc: `src/utils/recentlyPlayed.ts` (videoId-based), YouTube-specific constants in `src/constants/api.ts`.
- Tests: all `server/` tests + `youtube-player`, `authService`, `wsClient`, search/download tests.
- `capabilities.ts` + `capabilities` tests.

**Env:** remove `VITE_GOOGLE_CLIENT_ID`, `VITE_YOUTUBE_API_KEY`, `VITE_YOUTUBE_CHANNEL_ID` from `.env.example`.

## What gets COLLAPSED (single backend, no `sourceType`)

- `src/types/playlist.ts` / `src/types/search.ts`: remove `TrackSourceType` and `videoId`; a track is `{ id, title, artist, duration, file, audioUrl, format }`.
- `deckStore`: remove the `sourceType` field from `DeckState`/`createInitialDeckState`/`loadTrack`; remove the `findClosestPitchRate` YouTube snap in `syncToDeck`.
- `playerRegistry`: delete `YouTubePlayerAdapter`, `BackendType`, `sourceTypeToBackend`; `register(deckId, engine)` / `getActivePlayer(deckId)` for one backend. Update **all** call sites (`HotCues`, `BeatJump`, `DeckControls`, `deckStore` loop/seek/sync, `useKeyboardShortcuts`, `usePlayhead`) to drop the `sourceType` arg.
- `useAudioEngine`: drop the `sourceType !== 'mp3'` guards (always act).
- `useYouTubePlayer` removal: `App.tsx`/`Deck.tsx` no longer mount it.
- EQPanel/EffectsPanel: remove the `isMp3` gate + "LIVE/Visual Only"/"MP3 only" badges — always enabled.
- PitchSlider: keep only the continuous (0.5–2.0) slider; delete the discrete-index branch.
- **Test fixtures:** the hand-built `DeckState` fixtures (`slip-mode`, `keyboardShortcuts`, `stores`, etc.) lose `sourceType`; the per-backend registry tests collapse to one backend. (This is the bulk of the mechanical churn.)

## The Library (new, session-scoped)

`libraryStore` (Zustand): `tracks: ImportedTrack[]` where `ImportedTrack = { id, title, artist, duration, format, file, audioUrl }`. Actions: `addTracks(files)`, `removeTrack(id)` (revokes its `audioUrl` via `URL.revokeObjectURL`), `clear()`. No persistence — empty on load.

`LibraryBrowser` (replaces the Search panel): a text filter over title/artist, each row showing title/artist/format with **Load to Deck A** / **Load to Deck B** buttons (→ `playlistStore.addTrack(deck, entry)` and load) and a remove (×). `FileImportZone` and deck drag-drop both call `libraryStore.addTracks` so imports appear here. Imports also still load directly to a deck on drag-drop (instant), and "Load to Deck A/B" enqueues + plays per the existing `loadDeckTrack` path — preserving **add-to-deck** and feeding the **per-deck queue** + **auto-advance**.

## Saved sessions (IndexedDB)

The library/decks start empty on every launch (no auto-persistence), but the DJ can **explicitly save and restore named sessions**, fully client-side.

`sessionStore` (a thin IndexedDB wrapper, raw IndexedDB or the tiny `idb` helper — one DB, an object store of sessions keyed by name):
- `saveSession(name)` — serialize the current state into a session record and `put` it.
- `listSessions()` → `[{ name, savedAt, trackCount }]`.
- `loadSession(name)` — read it and rehydrate the app.
- `deleteSession(name)`.

A **session record** captures everything needed to restore a set:
```ts
interface SavedSession {
  name: string;
  savedAt: number;
  tracks: { id: string; title: string; artist: string; duration: number; format: string; blob: Blob }[];
  deckA: { queue: string[]; currentIndex: number }; // queue = ordered track ids
  deckB: { queue: string[]; currentIndex: number };
  cues:  Record<string, Record<number, number>>;    // trackId -> { hotCueIndex -> seconds }
  grids: Record<string, { bpm: number | null; anchor: number | null }>;
  loops: Record<string, { loopStart: number | null; loopEnd: number | null; loopBeatCount: number | null }>;
}
```
IndexedDB stores `Blob`s natively (structured clone), so the **audio bytes** ride along — restore needs no re-selecting of files.

**Save:** snapshot `libraryStore.tracks` (each track's `File`/`Blob`), both decks' queues (ordered track ids + `currentIndex` from `playlistStore`), and per-track hot cues / grid (`bpm`,`anchor`) / loop state (from `deckStore` + the hot-cue persistence). Write under `name` (overwrite-confirm if the name exists).

**Load:** for each saved track, recreate a blob URL from the stored `Blob` and repopulate `libraryStore`; rebuild each deck's `playlistStore` queue from the ordered ids (mapping to the recreated tracks); restore per-track cues/grid/loops so that when a track loads onto a deck its cue points and beat grid are already present. Loading replaces the current in-memory library/queues (confirm before discarding unsaved state). Track ids are stable within a session, so cues/grid reconnect by id.

**Quota:** IndexedDB is subject to the browser storage quota; a normal set (a handful to a few dozen tracks) is well within limits. If a save exceeds quota, surface a clear error ("not enough browser storage to save this session") and don't corrupt existing sessions.

**UI:** a `SessionPanel` (a tab alongside Library/Playlist, or a small menu): a **Save Session** action (prompts for a name) and a **list of saved sessions** each with **Load** and **Delete (×)**.

## Formats & error handling

- `FileImportZone` accept: `.mp3,.wav,.flac,.ogg,.m4a,.aac` (+ `audio/*`). Validate by MIME `audio/` or extension; keep a file-size cap (existing 500 MB).
- `decodeAudioFile` may reject (unsupported codec on this browser, corrupt file). Catch per-track: mark the track with a decode error and surface a clear message ("Couldn't decode <name> — this format may be unsupported in your browser"); never crash; other tracks unaffected.
- Revoke blob URLs on track removal / clear to avoid memory leaks.

## Testing strategy

- **Delete:** all `server/` tests + YouTube/auth/search/download/capabilities tests.
- **Adapt:** engine/transport/loop/sync/beat-grid/EQ tests — drop `sourceType` from fixtures and from `getActivePlayer` calls; collapse registry tests to one backend.
- **Add:**
  - `libraryStore`: add/remove/filter; `removeTrack` revokes the blob URL.
  - `FileImportZone`: accepts the new formats; a decode failure is handled per-file without crashing.
  - `playerRegistry`: single-backend register/getActivePlayer.
  - **Retained-feature regression tests:** add-to-Deck-A/B **appends** to that deck's playlist (and does not interrupt a playing track); **auto-advance** — simulate engine `onEnded` and assert the deck loads + plays the next queued track; panels (EQ/FX/Pitch) are enabled with a track loaded.
  - **Sessions:** `sessionStore` save→load round-trip (use `fake-indexeddb` as a test dep): saving then loading restores the library tracks (Blob round-trip), both deck queues + `currentIndex`, and per-track cues/grid/loops; `listSessions`/`deleteSession` behave; a quota/error path doesn't corrupt existing sessions.
- Gate: `npm run lint` (zero warnings), `npm run build`, `npm run test` all green. (Server test commands are gone with the server.)

## Phasing (one branch, reviewed per phase; app builds at each boundary)

1. **Strip the server + network/auth/download/search layer.** Delete `server/`, wsClient, downloadManager, downloadStore, auth (service/hook/store/types/AuthButton), youtubeDataApi/iframe, search store/cache/preload, ChannelPanel/DownloadLibrary, recentlyPlayed, YT/GIS env + constants, and their tests. Update `package.json` dev script. Temporarily stub the Search/Library panel to an empty placeholder so the app builds. Remove auth wiring from `App.tsx`/`SettingsModal`.
2. **Collapse the dual backend + remove `sourceType`.** Delete `useYouTubePlayer`/`YouTubePlayer`/`capabilities`; simplify `playerRegistry`; remove `sourceType`/`videoId` from types/state/call sites/fixtures; un-gate EQ/FX/Pitch; drop the YouTube pitch-snap in `syncToDeck`. Verify all retained transport/loop/sync features + **auto-advance** still pass.
3. **Build the Library Browser + broaden import.** Add `libraryStore`; replace the stubbed panel with `LibraryBrowser` (filter + Load-to-Deck-A/B + remove); broaden `FileImportZone` formats; wire imports → library; blob-URL revoke; per-file decode-error handling. Add the retained-feature regression tests (add-to-deck, auto-advance).
4. **Saved sessions.** Add `sessionStore` (IndexedDB save/load/list/delete) + `SessionPanel` UI; capture audio + library + both deck queues + per-track cues/grid/loops; restore rehydrates library, queues, and per-track metadata. Add `fake-indexeddb` dev-dep + the round-trip tests.
5. **Cleanup.** `SettingsModal` (remove Google account section, keep app/shortcut settings), `App.tsx` (remove the YouTube IFrame load + player mounts + event-bus simplification), README (rewrite for a client-only local-audio mixer), delete remaining dead constants/types.

Each phase is independently testable; the app compiles and the core mixer works at every phase boundary (drag-drop import keeps working before the browser lands in Phase 3).

## Out of scope (future, not now)

- **Auto-persisting** the library (the working library still starts empty each launch — persistence is only via explicit saved sessions).
- **Portable session files** (export/import a `.djset` zip) — IndexedDB named sessions only for now.
- File System Access API; local "search" beyond a title/artist filter; tag/BPM-based library organization.
- Re-introducing any streaming source.
