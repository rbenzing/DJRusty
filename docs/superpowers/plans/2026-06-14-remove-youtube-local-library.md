# Remove YouTube → Client-Only Local-Audio Mixer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all YouTube/Google/server code and collapse DJ Rusty to a single Web Audio backend driven by locally imported files, with a session Library Browser and IndexedDB saved sessions — while retaining per-deck queues, add-to-deck, and auto-play-next.

**Architecture:** Delete the `server/` folder, the YouTube IFrame backend, Google auth, the yt-dlp download/WebSocket stack, and YouTube search. Collapse the `'mp3' | 'youtube'` `sourceType` split to a single Web Audio engine (`playerRegistry` becomes a deck→engine map; `getActivePlayer(deckId)` loses its second arg). Imports feed a new in-memory `libraryStore`; a `LibraryBrowser` lists/filters them and appends to per-deck queues. A `sessionStore` (IndexedDB) saves/loads named sessions capturing audio + queues + per-track cues/grid/loops.

**Tech Stack:** TypeScript 5 (strict: `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`), React 18, Zustand 4, Vite 5, Vitest + Testing Library, Web Audio API, IndexedDB (+ `fake-indexeddb` for tests).

## Global Constraints

- **PowerShell only:** use `npm run …`, no `npx`, no `&&` chaining. Single test file: `npm run test -- <path>`.
- **Finish every task with:** `npm run lint` (zero warnings — `--max-warnings 0`) and `npm run build` (`tsc -b && vite build`, strict). The build is the gate that catches missed `sourceType`/import removals.
- **Server is being deleted** — there are no more `--prefix server` commands after Task A1.
- **Pure utils stay free of React/DOM/store imports** (`src/utils/`). New stores/services follow the existing Zustand/module patterns.
- **Retained features (regression-critical — never break):** per-deck A/B queues (`playlistStore.playlists`/`currentIndex`), append-to-deck (`addTrack`), and **auto-play-next on track end** (engine `onEnded` → `setPlaybackState('ended')` → `skipToNext`). Each phase that touches these must keep their tests green.
- **Track-id convention (new):** a library track's `id` (`crypto.randomUUID()`) is the canonical `trackId` used everywhere — the `PlaylistEntry.id`, `deckStore.loadTrack` trackId, hot-cue/grid persistence key, and session serialization key. This makes cues/grid/sessions line up by id.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `server/` (whole dir) | yt-dlp downloads, SQLite, audio serving, WS | **Delete** |
| `src/services/wsClient.ts`, `src/hooks/useDownloadManager.ts`, `src/store/downloadStore.ts` | Download/progress stack | **Delete** |
| `src/services/authService.ts`, `src/hooks/useAuth.ts`, `src/store/authStore.ts`, `src/types/auth.ts`, `src/types/gis.d.ts`, `src/components/Auth/AuthButton.tsx` | Google auth | **Delete** |
| `src/services/youtubeDataApi.ts`, `src/services/youtubeIframeApi.ts`, `src/services/searchCache.ts`, `src/store/searchStore.ts`, `src/hooks/useSearchPreload.ts`, `src/utils/recentlyPlayed.ts` | YouTube data/search | **Delete** |
| `src/components/Search/SearchBar.tsx`, `SearchResult.tsx`, `SearchResultList.tsx` | YouTube search UI | **Delete** |
| `src/components/Library/ChannelPanel.tsx`, `DownloadLibrary.tsx` | YouTube channel/download UI | **Delete** |
| `src/hooks/useYouTubePlayer.ts`, `src/components/Deck/YouTubePlayer.tsx`, `src/types/youtube.ts`, `src/types/youtube-globals.d.ts`, `src/constants/capabilities.ts` | YouTube backend + capability gating | **Delete** |
| `src/services/playerRegistry.ts` | Single deck→engine map | **Rewrite** |
| `src/components/Search/SearchPanel.tsx` | Tabs: drop Search/Recent; keep Playlist; Library→LibraryBrowser | **Rewrite/repurpose** |
| `src/store/libraryStore.ts` | In-memory imported-track library | **Create** |
| `src/components/Library/LibraryBrowser.tsx` | Filterable list + Load-to-Deck A/B + remove | **Create** |
| `src/services/sessionStore.ts` | IndexedDB save/load/list/delete + snapshot/restore | **Create** |
| `src/components/Session/SessionPanel.tsx` | Save + saved-session list (Load/Delete) | **Create** |
| `src/store/deckStore.ts` | Remove `sourceType` field + the youtube pitch-snap; collapse `getActivePlayer` calls | **Modify** |
| `src/store/playlistStore.ts` | Strip YouTube-overlay; entries carry `file`/`audioUrl`/`id` | **Modify** |
| `src/hooks/useAudioEngine.ts` | Drop `sourceType !== 'mp3'` guards | **Modify** |
| `src/components/Deck/{Deck,DeckControls,HotCues,PitchSlider,EQPanel,EffectsPanel}.tsx`, `src/hooks/{useKeyboardShortcuts,usePlayhead}.ts` | Collapse `sourceType`/`getActivePlayer`; un-gate | **Modify** |
| `src/types/{playlist,deck,search}.ts` | Remove `TrackSourceType`/`sourceType`/`videoId` | **Modify** |
| `src/App.tsx`, `src/components/Auth/SettingsModal.tsx`, `package.json`, `.env.example`, `README.md` | Wiring/cleanup | **Modify** |

---

# PHASE A — Strip the server + network/auth/download/search layer

> Goal: remove everything network/account/YouTube-data without touching the playback type system (`sourceType`/`playerRegistry`/YT types stay until Phase B). App builds green at the end; the track-browser's Search/Recent tabs are gone, Playlist works, Library tab is a temporary placeholder.

## Task A1: Delete the server + fix the dev script

**Files:**
- Delete: `server/` (entire directory)
- Modify: `package.json` (scripts, devDeps)

- [ ] **Step 1: Delete the server**

```bash
git rm -r server
```

- [ ] **Step 2: Update `package.json` scripts** — `dev` runs Vite only; drop `concurrently`:

Replace the `scripts` block with:
```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "lint": "eslint . --report-unused-disable-directives --max-warnings 0",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```
Remove `"concurrently": "^9.2.1"` from `devDependencies`.

- [ ] **Step 3: Reinstall to drop concurrently**

Run: `npm install`
Expected: `concurrently` removed from `node_modules`/lockfile; no errors.

- [ ] **Step 4: Verify the frontend still builds + tests pass** (consumers of the server are deleted in A2; they still compile here since they only do runtime fetches)

Run: `npm run build`
Expected: PASS (frontend has no compile-time dep on `server/`).
Run: `npm run test`
Expected: PASS (server tests are gone; frontend tests still green).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: delete the server (no backend in client-only build); dev runs vite only"
```

---

## Task A2: Delete the download/WebSocket stack + its UI

**Files:**
- Delete: `src/services/wsClient.ts`, `src/hooks/useDownloadManager.ts`, `src/store/downloadStore.ts`, `src/components/Library/DownloadLibrary.tsx`, `src/components/Library/ChannelPanel.tsx`
- Delete tests: `src/test/wsClient.test.ts`, and any download/channel tests
- Modify: `src/components/Search/SearchPanel.tsx` (remove DownloadLibrary/ChannelPanel/useDownloadManager usage), `src/store/playlistStore.ts` (remove the `useDownloadStore` import + the YouTube-overlay block), `src/App.tsx` (remove `useDownloadManager` mount if present)

- [ ] **Step 1: Find every importer first**

Run: `npm run test -- --reporter=dot 2>$null; rg -n "wsClient|useDownloadManager|downloadStore|DownloadLibrary|ChannelPanel" src`
(Use the Grep tool.) Note every file that imports these — they all need edits or deletion.

- [ ] **Step 2: Delete the files + tests**

```bash
git rm src/services/wsClient.ts src/hooks/useDownloadManager.ts src/store/downloadStore.ts src/components/Library/DownloadLibrary.tsx src/components/Library/ChannelPanel.tsx src/test/wsClient.test.ts
```
(Also `git rm` any test that targets downloadStore/ChannelPanel/DownloadLibrary — find via the grep.)

- [ ] **Step 3: Strip the YouTube-overlay block in `playlistStore.ts`**

In `src/store/playlistStore.ts` `loadDeckTrack` (≈lines 74-102), remove the `import { useDownloadStore }` and the whole INT-005 block. The function becomes (keep the rest of its body / `loadTrack` call, but `trackId` is now just `entry.id`):
```ts
function loadDeckTrack(deckId: 'A' | 'B', entry: PlaylistEntry, autoPlay: boolean): void {
  useDeckStore.getState().loadTrack(
    deckId,
    entry.id,
    {
      sourceType: entry.sourceType, // still present until Phase B
      title: entry.title,
      artist: entry.artist,
      duration: entry.duration,
      thumbnailUrl: entry.thumbnailUrl,
    },
    autoPlay,
  );
}
```

- [ ] **Step 4: Edit `SearchPanel.tsx` + `App.tsx`** — remove imports/usages of the deleted files. In `SearchPanel.tsx` the **Library tab** temporarily renders a placeholder:
```tsx
<div role="tabpanel" id="library-tab-panel" aria-labelledby="library-tab" hidden={activeTab !== 'library'}>
  <p className={styles.placeholder}>Library coming soon.</p>
</div>
```
Remove `useDownloadManager()` from `App.tsx` if it's mounted there.

- [ ] **Step 5: Verify + commit**

Run: `npm run lint` ; `npm run build` ; `npm run test`
Expected: PASS (some download/library tests removed; the rest green).
```bash
git add -A
git commit -m "feat: remove the download/WebSocket stack and its UI (client-only)"
```

---

## Task A3: Delete Google auth + its wiring

**Files:**
- Delete: `src/services/authService.ts`, `src/hooks/useAuth.ts`, `src/store/authStore.ts`, `src/types/auth.ts`, `src/types/gis.d.ts`, `src/components/Auth/AuthButton.tsx`
- Delete tests: `src/test/authService.test.ts`, `src/test/auth.test.ts` (the authStore test), any `useAuth` test
- Modify: `src/App.tsx` (remove `useAuth` + AuthButton), `src/components/Auth/SettingsModal.tsx` (remove the Google account section), any header that renders `AuthButton`

- [ ] **Step 1: Grep importers** — `rg -n "authService|useAuth|authStore|AuthButton|useAuthStore" src` (Grep tool). Note every file.

- [ ] **Step 2: Delete files + tests**

```bash
git rm src/services/authService.ts src/hooks/useAuth.ts src/store/authStore.ts src/types/auth.ts src/types/gis.d.ts src/components/Auth/AuthButton.tsx src/test/authService.test.ts src/test/auth.test.ts
```

- [ ] **Step 3: Edit consumers** — In `App.tsx` remove the `useAuth()` call and any `<AuthButton/>`. In `SettingsModal.tsx`, delete the account/sign-in section (the block reading `authStore` userInfo/channelName) and keep the rest of the modal (keyboard shortcuts / app info). In any header component, remove `<AuthButton/>`.

- [ ] **Step 4: Verify + commit**

Run: `npm run lint` ; `npm run build` ; `npm run test`
Expected: PASS.
```bash
git add -A
git commit -m "feat: remove Google auth and its wiring (no accounts in client-only build)"
```

---

## Task A4: Delete YouTube data/search + repurpose SearchPanel tabs

**Files:**
- Delete: `src/services/youtubeDataApi.ts`, `src/services/youtubeIframeApi.ts` *(NOTE: keep `youtubeIframeApi` until Phase B — see step 1)*, `src/services/searchCache.ts`, `src/store/searchStore.ts`, `src/hooks/useSearchPreload.ts`, `src/utils/recentlyPlayed.ts`, `src/components/Search/SearchBar.tsx`, `src/components/Search/SearchResult.tsx`, `src/components/Search/SearchResultList.tsx`
- Delete tests: `src/test/search-store.test.ts`, `src/test/searchCache.test.ts`, and any SearchBar/SearchResult tests
- Modify: `src/components/Search/SearchPanel.tsx` (remove Search + Recent tabs/panels; keep Playlist; keep the placeholder Library tab), `src/App.tsx` (remove the `dj-rusty:load-track` event bus + `addRecentTrack`), `src/constants/api.ts` (remove YouTube constants), `.env.example`

- [ ] **Step 1: IMPORTANT — `youtubeIframeApi` and YT types stay until Phase B.** `useYouTubePlayer.ts` (deleted in Phase B) still imports `youtubeIframeApi` and `YT.*` types. So in THIS task **do NOT delete** `youtubeIframeApi.ts`, `youtube.ts`, `youtube-globals.d.ts`, or `@types/youtube`. Only delete the data/search/recent files listed (minus iframe).

Corrected delete set for this task:
```bash
git rm src/services/youtubeDataApi.ts src/services/searchCache.ts src/store/searchStore.ts src/hooks/useSearchPreload.ts src/utils/recentlyPlayed.ts src/components/Search/SearchBar.tsx src/components/Search/SearchResult.tsx src/components/Search/SearchResultList.tsx src/test/search-store.test.ts src/test/searchCache.test.ts
```
(Also `git rm` any SearchBar/SearchResult/SearchResultList test files found via grep.)

- [ ] **Step 2: Repurpose `SearchPanel.tsx`** — reduce `ActiveTab` to `'playlist' | 'library'`; delete the Search and Recent tab buttons + panels and all their state/handlers (`performSearch`, `handleLoadToDeck`, search store reads, `searchVideos`, channel logic). Keep the Playlist tab (`<PlaylistPanel/>`) and the placeholder Library tab from A2. Default `activeTab = 'playlist'`.

- [ ] **Step 3: Remove the event bus in `App.tsx`** — delete the `dj-rusty:load-track` `useEffect` listener and the `addRecentTrack` import (file deleted). Track loading now happens via `PlaylistPanel`/`FileImportZone`/deck-drop directly (already wired through `playlistStore`).

- [ ] **Step 4: Clean constants + env** — In `src/constants/api.ts` remove `YOUTUBE_API_BASE`, `GOOGLE_USERINFO_URL`, `YOUTUBE_IFRAME_API_URL`, `YOUTUBE_SEARCH_MAX_RESULTS`, `PRELOAD_QUERIES` (keep any non-YouTube constants; if the file is now empty, `git rm` it and drop its importers). In `.env.example` remove `VITE_GOOGLE_CLIENT_ID`, `VITE_YOUTUBE_API_KEY`, `VITE_YOUTUBE_CHANNEL_ID`.

- [ ] **Step 5: Verify + commit**

Run: `npm run lint` ; `npm run build` ; `npm run test`
Expected: PASS. The app now has no network/auth/youtube-data; the track browser shows Playlist + a Library placeholder; the YouTube IFrame backend is still present (removed in Phase B).
```bash
git add -A
git commit -m "feat: remove YouTube search/data + recent; repurpose track-browser tabs (Playlist + Library placeholder)"
```

**Phase A gate:** `npm run lint` (0 warnings), `npm run build`, `npm run test` all green. App runs with local file import + per-deck queues + auto-advance intact; no network calls.

---

# PHASE B — Collapse the dual backend (remove `sourceType`, single Web Audio engine)

> The type-system surgery. Delete the YouTube backend + YT types + capabilities, rewrite `playerRegistry`, remove `sourceType`/`videoId` everywhere, un-gate panels, and update all 30 test fixtures. Build green at the end.

## Task B1: Rewrite `playerRegistry` to a single backend

**Files:**
- Rewrite: `src/services/playerRegistry.ts`
- Test: `src/test/playerRegistry.test.ts` (create or rewrite if present)

**Interfaces:**
- Produces: `interface DeckPlayer { seekTo(seconds, allowSeekAhead?); getCurrentTime(): number; getDuration(): number; setLoop?(s,e); clearLoop?(); isLooping?(): boolean }`; `playerRegistry.register(deckId, player)`, `playerRegistry.unregister(deckId)`, `getActivePlayer(deckId): DeckPlayer | undefined`. **No `sourceType` arg, no `BackendType`, no `YouTubePlayerAdapter`.**

- [ ] **Step 1: Write the failing test** at `src/test/playerRegistry.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { playerRegistry, getActivePlayer } from '../services/playerRegistry';
import type { DeckPlayer } from '../services/playerRegistry';

function mockPlayer(): DeckPlayer {
  return { seekTo: vi.fn(), getCurrentTime: () => 0, getDuration: () => 0 };
}

describe('playerRegistry (single backend)', () => {
  beforeEach(() => { playerRegistry.unregister('A'); playerRegistry.unregister('B'); });

  it('registers and resolves a deck player by deckId', () => {
    const p = mockPlayer();
    playerRegistry.register('A', p);
    expect(getActivePlayer('A')).toBe(p);
    expect(getActivePlayer('B')).toBeUndefined();
  });

  it('unregister removes the player', () => {
    playerRegistry.register('A', mockPlayer());
    playerRegistry.unregister('A');
    expect(getActivePlayer('A')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm run test -- src/test/playerRegistry.test.ts` (old signature / module shape).

- [ ] **Step 3: Rewrite** `src/services/playerRegistry.ts` entirely:

```ts
/**
 * playerRegistry.ts — Module-level map of deckId → Web Audio engine.
 * The engine instance lives in a useRef inside useAudioEngine (never in Zustand).
 * Components/store look up the deck's player here to issue imperative commands.
 */
type DeckId = 'A' | 'B';

export interface DeckPlayer {
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setLoop?(startSec: number, endSec: number): void;
  clearLoop?(): void;
  isLooping?(): boolean;
}

const registry = new Map<DeckId, DeckPlayer>();

export const playerRegistry = {
  register(deckId: DeckId, player: DeckPlayer): void { registry.set(deckId, player); },
  unregister(deckId: DeckId): void { registry.delete(deckId); },
};

/** The Web Audio engine registered for this deck, or undefined if none. */
export function getActivePlayer(deckId: DeckId): DeckPlayer | undefined {
  return registry.get(deckId);
}
```

- [ ] **Step 4: Run to verify it passes** — `npm run test -- src/test/playerRegistry.test.ts` (build of this file alone may still fail because consumers use the old 2-arg API — that's expected; they're fixed in B2-B4). Run just this test file; it passes in isolation.

- [ ] **Step 5: Commit** (the suite/build is RED until B2-B4 land — commit the registry rewrite as the first step of the collapse)

```bash
git add src/services/playerRegistry.ts src/test/playerRegistry.test.ts
git commit -m "refactor: playerRegistry is a single deck->engine map (getActivePlayer(deckId))"
```

## Task B2: Delete the YouTube backend + capabilities; un-gate panels; collapse `useAudioEngine`

**Files:**
- Delete: `src/hooks/useYouTubePlayer.ts`, `src/components/Deck/YouTubePlayer.tsx`, `src/services/youtubeIframeApi.ts`, `src/types/youtube.ts`, `src/types/youtube-globals.d.ts`, `src/constants/capabilities.ts`; remove `@types/youtube` from `package.json`
- Delete tests: `src/test/youtube-player.test.ts`, capabilities tests
- Modify: `src/App.tsx` (remove IFrame load + `<YouTubePlayer/>` mounts), `src/components/Deck/Deck.tsx` (remove `useYouTubePlayer(deckId)` call), `src/hooks/useAudioEngine.ts` (drop the `sourceType !== 'mp3'` guards), `src/components/Deck/{EQPanel,EffectsPanel,PitchSlider}.tsx` (un-gate), `src/store/playerRegistry.ts` registration callers

- [ ] **Step 1: Delete YouTube backend + capabilities + tests**

```bash
git rm src/hooks/useYouTubePlayer.ts src/components/Deck/YouTubePlayer.tsx src/services/youtubeIframeApi.ts src/types/youtube.ts src/types/youtube-globals.d.ts src/constants/capabilities.ts src/test/youtube-player.test.ts
```
(Also `git rm` capabilities test files via grep.) Remove `"@types/youtube": "^0.1.0"` from `package.json` devDeps; run `npm install`.

- [ ] **Step 2: `App.tsx`** — delete the `loadYouTubeIframeApi()` `useEffect` (keep the `mixer.setCrossfaderPosition` line, move it to its own effect) and remove `<YouTubePlayer deckId="A"/>`/`"B"` and their import.

- [ ] **Step 3: `Deck.tsx`** — remove `useYouTubePlayer(deckId);` and its import (keep `useAudioEngine(deckId);`).

- [ ] **Step 4: `useAudioEngine.ts`** — `useAudioEngine` registers via the new API: change `playerRegistry.register(deckId, 'audio', engine)` → `playerRegistry.register(deckId, engine)` and `playerRegistry.unregister(deckId, 'audio')` → `playerRegistry.unregister(deckId)`. In every store-subscription guard, drop the `sourceType` term: `if (sourceType !== 'mp3' || !engineRef.current) return;` → `if (!engineRef.current) return;`. Remove the `sourceType`/`prevSourceType`/`sourceJustBecameMp3` plumbing in the pitch-rate effect (it just applies `pitchRate` whenever it changes). Remove `sourceType` from every `state.decks[deckId]` destructure in this file.

- [ ] **Step 5: Un-gate the panels** — `EQPanel.tsx`: remove the `sourceType` selector + `isMp3` + the "LIVE/Visual Only" badge (EQ always live). `EffectsPanel.tsx`: remove `sourceType`/`isMp3`, the `panelInactive` class, the `disabled={!isMp3}` on buttons, and the "MP3 only" note. `PitchSlider.tsx`: remove the `sourceType` selector and the `if (sourceType === 'mp3') {...} else {...}` branch — keep ONLY the continuous (0.5–2.0) slider body; delete the discrete-index branch and `pitchRateLocked` handling if it was YouTube-only (verify: `pitchRateLocked` was a YouTube restricted-video flag — remove it from the component and from `DeckState` in B3).

- [ ] **Step 6: Build will still be RED** (deckStore + other call sites still pass `sourceType`). That's fixed in B3. Do not run the full gate yet; commit this slice.

```bash
git add -A
git commit -m "feat: delete YouTube backend + capabilities gating; collapse useAudioEngine + panels to single backend"
```

## Task B3: Remove `sourceType`/`videoId` from types, deckStore, and the remaining call sites

**Files:**
- Modify: `src/types/playlist.ts`, `src/types/deck.ts`, `src/types/search.ts`, `src/store/deckStore.ts`, `src/components/Deck/{DeckControls,HotCues}.tsx`, `src/hooks/{useKeyboardShortcuts,usePlayhead}.ts`, `src/components/FileImport/FileImportZone.tsx`, `src/components/Playlist/PlaylistPanel.tsx`, `src/store/playlistStore.ts`

**Interfaces:**
- Produces: `PlaylistEntry = { id, title, artist, duration, thumbnailUrl, file?, audioUrl? }` (no `sourceType`/`videoId`); `DeckState` has no `sourceType`/`pitchRateLocked`; `deckStore.loadTrack(deckId, trackId, { title, artist, duration, thumbnailUrl }, autoPlay?)`; `getActivePlayer(deckId)`.

- [ ] **Step 1: Types** — `src/types/playlist.ts`: delete `export type TrackSourceType`; remove `sourceType` and `videoId` from `PlaylistEntry`. `src/types/search.ts`: remove `sourceType`/`videoId` from `TrackSummary` (or delete the file if now unused — grep `TrackSummary`). `src/types/deck.ts`: remove the `sourceType` field and (if present) `pitchRateLocked`; remove the `import { TrackSourceType }`.

- [ ] **Step 2: `deckStore.ts`** — remove `sourceType: null` from `createInitialDeckState` and `clearTrack`; remove `sourceType` from the `loadTrack` metadata param + the `updateDeck` write; delete the `if (me.sourceType === 'youtube') rate = findClosestPitchRate(rate);` line in `syncToDeck` (and the now-unused `findClosestPitchRate` import if nothing else uses it). Collapse **all** `getActivePlayer(deckId, …sourceType)` calls to `getActivePlayer(deckId)` — exact sites: lines ~405, 414, 417, 569, 595, 596, 629, 632, 645, 664 (drop the second argument in each). Remove `pitchRateLocked` writes if you removed the field.

- [ ] **Step 3: Components/hooks** — drop `sourceType` and the second `getActivePlayer` arg:
  - `DeckControls.tsx`: remove the `sourceType` selector; `getActivePlayer(deckId, sourceType)` → `getActivePlayer(deckId)`.
  - `HotCues.tsx`: same.
  - `usePlayhead.ts`: remove the `const { sourceType } = …` read; `getActivePlayer(deckId, sourceType)` → `getActivePlayer(deckId)`.
  - `useKeyboardShortcuts.ts`: the 4 calls `getActivePlayer('A'/'B', …decks[…].sourceType)` → `getActivePlayer('A'/'B')`.
  - `FileImportZone.tsx` and `PlaylistPanel.tsx` and `Deck.tsx` drop handler: remove `sourceType: 'mp3'` from the `PlaylistEntry` literals they build.
  - `playlistStore.ts` `loadDeckTrack`: remove `sourceType: entry.sourceType` from the `loadTrack` metadata (loadTrack no longer takes it).

- [ ] **Step 4: Verify build (types) compiles** — `npm run build`. Fix any remaining `sourceType`/`videoId` the compiler flags. The TEST suite is still red (fixtures) — fixed in B4.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove sourceType/videoId from types, deckStore, and all call sites (single backend)"
```

## Task B4: Update all test fixtures to the collapsed model

**Files:** Modify ~30 test files that reference `sourceType` / the old registry API. (Inventory list below.)

- [ ] **Step 1: Apply the uniform transformation** to every test file. The rules:
  - **`loadTrack('X', 'id', { sourceType: '…', title, artist, duration, thumbnailUrl }, …)`** → drop the `sourceType` key: `loadTrack('X', 'id', { title, artist, duration, thumbnailUrl }, …)`.
  - **Full `DeckState` literals / `makeDeckState` helpers** → delete the `sourceType: …` line (and `pitchRateLocked` if you removed it).
  - **`playerRegistry.register('A', 'youtube'|'audio', player)`** → `playerRegistry.register('A', player)`; **`playerRegistry.unregister('A', 'youtube'|'audio')`** → `playerRegistry.unregister('A')`.
  - **`getActivePlayer('A', sourceType)`** in tests → `getActivePlayer('A')`.
  - **Delete YouTube-only tests** that have no meaning now (e.g. tests asserting discrete pitch on YouTube, the `deck-rerender.test.tsx` case that loaded `sourceType: 'youtube'` → change to a normal load; `deckControls-seek-routing.test.tsx` "YouTube backend" assertions → collapse to one backend, asserting the registered engine gets the seek).
  - **`playlist-store.test.ts` / `deck-b.test.ts` / `story-011` / `story-dj-003` etc.** with `sourceType` fixtures → drop the field.

  Files to touch (from inventory): `slip-mode`, `keyboardShortcuts`, `stores`, `mp3-003-transport`, `mp3-004-eq-volume`, `mp3-005-pitch`, `mp3-006-waveform`, `mp3-008-bpm`, `deck-b`, `deck-rerender`, `deck-playhead-rerender`, `deckcontrols-cdj`, `deckControls-seek-routing`, `beatjump-action`, `beatjump-buttons`, `loop-actions`, `sync-action`, `transport-store`, `usePlayhead`, `GridControl`, `hotcues-seek-routing`, `story-011-hot-cues`, `story-dj-003-8-hot-cues`, `pitch-continuous`, `useAudioEngine`, `playlist-store`, `FileImportZone`. (Plus delete `search-store`, `searchCache`, `youtube-player`, `authService`, `auth`, `wsClient` — already removed in Phase A/B.)

- [ ] **Step 2: Run the full gate**

Run: `npm run test`
Expected: PASS — fix every remaining fixture the run flags (the transformation is uniform; the failures are missed `sourceType` lines).
Run: `npm run lint` ; `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test: collapse all fixtures to the single-backend model (drop sourceType/registry backendType)"
```

**Phase B gate:** lint/build/test green. Single Web Audio backend; no `sourceType` anywhere; EQ/FX/pitch always enabled + continuous pitch. **Verify retained features still pass:** the auto-advance test (`useAudioEngine` onEnded → skipToNext) and the add-to-deck/playlist tests are green.

---

# PHASE C — Library Browser + broadened import

## Task C1: `libraryStore` (in-memory imported-track library)

**Files:**
- Create: `src/store/libraryStore.ts`
- Test: `src/test/libraryStore.test.ts`

**Interfaces:**
- Produces: `interface ImportedTrack { id: string; title: string; artist: string; duration: number; format: string; file: File; audioUrl: string; decodeError?: string }`; `useLibraryStore` with `tracks: ImportedTrack[]`, `addFiles(files: File[]): ImportedTrack[]`, `removeTrack(id: string): void`, `clear(): void`, `setDuration(id, n): void`, `setDecodeError(id, msg): void`, `restore(tracks: ImportedTrack[]): void`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test** at `src/test/libraryStore.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLibraryStore } from '../store/libraryStore';

const ACCEPTED = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'];

function makeFile(name: string, type = 'audio/mpeg'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

describe('libraryStore', () => {
  beforeEach(() => {
    useLibraryStore.getState().clear();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() } as unknown as typeof URL);
  });

  it('addFiles imports accepted audio files with id/title/format and a blob url', () => {
    const created = useLibraryStore.getState().addFiles([makeFile('My Track.mp3')]);
    const t = useLibraryStore.getState().tracks[0]!;
    expect(useLibraryStore.getState().tracks).toHaveLength(1);
    expect(t.title).toBe('My Track');
    expect(t.format).toBe('mp3');
    expect(t.audioUrl).toBe('blob:x');
    expect(t.id).toMatch(/.+/);
    expect(created[0]!.id).toBe(t.id);
  });

  it('removeTrack revokes its blob url and drops it', () => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:y', revokeObjectURL: revoke } as unknown as typeof URL);
    const [t] = useLibraryStore.getState().addFiles([makeFile('a.wav', 'audio/wav')]);
    useLibraryStore.getState().removeTrack(t!.id);
    expect(revoke).toHaveBeenCalledWith('blob:y');
    expect(useLibraryStore.getState().tracks).toHaveLength(0);
  });

  it('skips files whose extension is not accepted', () => {
    useLibraryStore.getState().addFiles([makeFile('notes.txt', 'text/plain')]);
    expect(useLibraryStore.getState().tracks).toHaveLength(0);
  });
});
void ACCEPTED;
```

- [ ] **Step 2: Run to verify it fails** — `npm run test -- src/test/libraryStore.test.ts`.

- [ ] **Step 3: Implement** `src/store/libraryStore.ts`:

```ts
import { create } from 'zustand';

export interface ImportedTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
  format: string;       // lowercase extension, e.g. 'mp3'
  file: File;
  audioUrl: string;     // blob: URL
  decodeError?: string;
}

const ACCEPTED_EXT = new Set(['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac']);

function extOf(name: string): string { return name.split('.').pop()?.toLowerCase() ?? ''; }
function stripExt(name: string): string { return name.replace(/\.[^/.]+$/, ''); }

interface LibraryState {
  tracks: ImportedTrack[];
  addFiles: (files: File[]) => ImportedTrack[];
  removeTrack: (id: string) => void;
  clear: () => void;
  setDuration: (id: string, duration: number) => void;
  setDecodeError: (id: string, message: string) => void;
  restore: (tracks: ImportedTrack[]) => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  addFiles: (files) => {
    const created: ImportedTrack[] = [];
    for (const file of files) {
      const format = extOf(file.name);
      if (!ACCEPTED_EXT.has(format)) continue;
      created.push({
        id: crypto.randomUUID(),
        title: stripExt(file.name),
        artist: 'Local File',
        duration: 0,
        format,
        file,
        audioUrl: URL.createObjectURL(file),
      });
    }
    if (created.length) set({ tracks: [...get().tracks, ...created] });
    return created;
  },
  removeTrack: (id) => {
    const t = get().tracks.find((x) => x.id === id);
    if (t) URL.revokeObjectURL(t.audioUrl);
    set({ tracks: get().tracks.filter((x) => x.id !== id) });
  },
  clear: () => {
    for (const t of get().tracks) URL.revokeObjectURL(t.audioUrl);
    set({ tracks: [] });
  },
  setDuration: (id, duration) =>
    set({ tracks: get().tracks.map((t) => (t.id === id ? { ...t, duration } : t)) }),
  setDecodeError: (id, message) =>
    set({ tracks: get().tracks.map((t) => (t.id === id ? { ...t, decodeError: message } : t)) }),
  restore: (tracks) => {
    for (const t of get().tracks) URL.revokeObjectURL(t.audioUrl);
    set({ tracks });
  },
}));
```

- [ ] **Step 4: Run to verify it passes** — `npm run test -- src/test/libraryStore.test.ts`. Then `npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/store/libraryStore.ts src/test/libraryStore.test.ts
git commit -m "feat: libraryStore — in-memory imported-track library with blob lifecycle"
```

## Task C2: Wire imports → library; broaden formats; append-to-deck

**Files:**
- Modify: `src/components/FileImport/FileImportZone.tsx`, `src/components/Deck/Deck.tsx` (drop handler), `src/store/playlistStore.ts` (`addFromLibrary` helper / append semantics)
- Test: `src/test/import-to-library.test.tsx`

**Interfaces:**
- Consumes: `useLibraryStore.addFiles`, `ImportedTrack`.
- Produces: a helper to enqueue a library track onto a deck — `playlistStore.addTrack(deckId, entryFromLibraryTrack(track))` where the entry's `id === track.id`.

- [ ] **Step 1: Write the failing test** at `src/test/import-to-library.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileImportZone } from '../components/FileImport/FileImportZone';
import { useLibraryStore } from '../store/libraryStore';

beforeEach(() => {
  useLibraryStore.getState().clear();
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:z', revokeObjectURL: vi.fn() } as unknown as typeof URL);
});

it('importing files adds them to the library (accepts flac/ogg/m4a too)', () => {
  render(<FileImportZone deckId="A" />);
  const input = screen.getByTestId('file-input') as HTMLInputElement; // FileImportZone exposes data-testid="file-input"
  const files = [
    new File([new Uint8Array([1])], 'song.flac', { type: 'audio/flac' }),
    new File([new Uint8Array([1])], 'beat.m4a', { type: 'audio/mp4' }),
  ];
  fireEvent.change(input, { target: { files } });
  const titles = useLibraryStore.getState().tracks.map((t) => t.title);
  expect(titles).toEqual(['song', 'beat']);
});
```

- [ ] **Step 2: Run to verify it fails** — `npm run test -- src/test/import-to-library.test.tsx` (FileImportZone still adds to playlist with old accept list; no library).

- [ ] **Step 3a: Make `addTrack` preserve a provided id** — In `src/store/playlistStore.ts`, change `addTrack(deckId, entry)` so that when the incoming entry already has an `id`, that id is used verbatim (only generate a `crypto.randomUUID()` when no id is supplied). This is essential: the library track's id must flow through to the `PlaylistEntry.id` → `deckStore` `trackId` → hot-cue/grid/session keys so everything lines up by id. Update its type to accept `PlaylistEntry | Omit<PlaylistEntry, 'id'>`. Existing `addTrack` callers that pass `Omit<…,'id'>` still work (id generated).

- [ ] **Step 3b: Add `libraryTrackToEntry` to `src/store/libraryStore.ts`** (exported from there; consumed by Deck/LibraryBrowser/sessionStore):
```ts
import type { PlaylistEntry } from '../types/playlist';
/** A full PlaylistEntry for a library track — id is preserved so cues/grid/sessions align by id. */
export function libraryTrackToEntry(t: ImportedTrack): PlaylistEntry {
  return { id: t.id, title: t.title, artist: t.artist, duration: t.duration, thumbnailUrl: null, file: t.file, audioUrl: t.audioUrl };
}
```

- [ ] **Step 3c: Wire import → library + append** — In `FileImportZone.tsx`: change the `accept` attribute to `.mp3,.wav,.flac,.ogg,.m4a,.aac,audio/*`; ensure the file input has `data-testid="file-input"`; replace `processFile` so it collects the dropped/picked files and calls `useLibraryStore.getState().addFiles(files)` (which validates + imports). In `Deck.tsx` `handleDeckDrop`, replace the per-file blob/entry construction with: `const created = useLibraryStore.getState().addFiles(files); created.forEach((t) => usePlaylistStore.getState().addTrack(deckId, libraryTrackToEntry(t)));` and **do NOT** `clearPlaylist` (append, don't replace). Keep the 500 MB size cap if it's validated there.

- [ ] **Step 4: Run to verify** — `npm run test -- src/test/import-to-library.test.tsx`; then `npm run test` (full); `npm run lint` ; `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: imports feed the library; broaden formats; deck-drop appends (no replace)"
```

## Task C3: `LibraryBrowser` component (filter + Load-to-Deck A/B + remove)

**Files:**
- Create: `src/components/Library/LibraryBrowser.tsx` (+ `.module.css`)
- Modify: `src/components/Search/SearchPanel.tsx` (Library tab renders `<LibraryBrowser/>`)
- Test: `src/test/LibraryBrowser.test.tsx`

**Interfaces:**
- Consumes: `useLibraryStore` (tracks, removeTrack), `usePlaylistStore.addTrack`, `libraryTrackToEntry`.
- Produces: `<LibraryBrowser />`.

- [ ] **Step 1: Write the failing test** at `src/test/LibraryBrowser.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibraryBrowser } from '../components/Library/LibraryBrowser';
import { useLibraryStore } from '../store/libraryStore';
import { usePlaylistStore } from '../store/playlistStore';

beforeEach(() => {
  useLibraryStore.getState().clear();
  usePlaylistStore.getState().clearPlaylist('A');
  usePlaylistStore.getState().clearPlaylist('B');
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() } as unknown as typeof URL);
});

function seed(name: string) {
  return useLibraryStore.getState().addFiles([new File([new Uint8Array([1])], name, { type: 'audio/mpeg' })])[0]!;
}

it('lists imported tracks and filters by title', () => {
  seed('House Anthem.mp3'); seed('Techno Roller.mp3');
  render(<LibraryBrowser />);
  expect(screen.getByText('House Anthem')).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText(/filter/i), { target: { value: 'techno' } });
  expect(screen.queryByText('House Anthem')).not.toBeInTheDocument();
  expect(screen.getByText('Techno Roller')).toBeInTheDocument();
});

it('Load to Deck A appends the track to deck A’s queue', () => {
  const t = seed('Track.mp3');
  render(<LibraryBrowser />);
  fireEvent.click(screen.getByRole('button', { name: /load .*deck a/i }));
  const queue = usePlaylistStore.getState().playlists.A;
  expect(queue).toHaveLength(1);
  expect(queue[0]!.id).toBe(t.id);
});
```

- [ ] **Step 2: Run to verify it fails** — `npm run test -- src/test/LibraryBrowser.test.tsx`.

- [ ] **Step 3: Implement** `src/components/Library/LibraryBrowser.tsx`:

```tsx
import { useState } from 'react';
import { useLibraryStore } from '../../store/libraryStore';
import { usePlaylistStore } from '../../store/playlistStore';
import { libraryTrackToEntry } from '../../store/libraryStore';
import styles from './LibraryBrowser.module.css';

export function LibraryBrowser() {
  const tracks = useLibraryStore((s) => s.tracks);
  const removeTrack = useLibraryStore((s) => s.removeTrack);
  const addTrack = usePlaylistStore((s) => s.addTrack);
  const [filter, setFilter] = useState('');

  const q = filter.trim().toLowerCase();
  const shown = q
    ? tracks.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
    : tracks;

  return (
    <div className={styles.browser} aria-label="Library">
      <input
        className={styles.filter}
        placeholder="Filter library…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Filter library"
      />
      {shown.length === 0 ? (
        <p className={styles.empty}>{tracks.length === 0 ? 'No tracks imported yet.' : 'No matches.'}</p>
      ) : (
        <ul className={styles.list}>
          {shown.map((t) => (
            <li key={t.id} className={styles.row}>
              <span className={styles.title} title={t.title}>{t.title}</span>
              <span className={styles.meta}>{t.artist} · {t.format}{t.decodeError ? ' · ⚠' : ''}</span>
              <button onClick={() => addTrack('A', libraryTrackToEntry(t))} aria-label={`Load ${t.title} to Deck A`}>A</button>
              <button onClick={() => addTrack('B', libraryTrackToEntry(t))} aria-label={`Load ${t.title} to Deck B`}>B</button>
              <button onClick={() => removeTrack(t.id)} aria-label={`Remove ${t.title} from library`}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```
Create `LibraryBrowser.module.css` (a simple list; match sibling CSS-module style). In `SearchPanel.tsx`, the Library tab panel renders `<LibraryBrowser/>` (replace the placeholder from A2).

- [ ] **Step 4: Run to verify** — `npm run test -- src/test/LibraryBrowser.test.tsx`; then `npm run test` (full); `npm run lint` ; `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: LibraryBrowser — filter imported tracks + append to Deck A/B + remove"
```

## Task C4: Per-file decode-error handling

**Files:**
- Modify: `src/hooks/useAudioEngine.ts` (catch decode failure → `libraryStore.setDecodeError`), `src/components/Library/LibraryBrowser.tsx` (already shows ⚠)
- Test: `src/test/decode-error.test.ts`

- [ ] **Step 1: Write the failing test** — when `decodeAudioFile` rejects, the deck doesn't crash and the library track is flagged with a decode error. Mock `decodeAudioFile` to reject; load a library track to a deck; assert `useLibraryStore.getState().tracks[i].decodeError` is set and no throw. (Model it on the existing `useAudioEngine.test.ts` decode-path tests; reuse their mock of `decodeAudioFile`.)

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement** — In `useAudioEngine.ts` where the track buffer is decoded (the `decodeAudioFile(...).then(...).catch(...)`), in the `catch` call `useLibraryStore.getState().setDecodeError(trackId, 'Couldn\\'t decode — this format may be unsupported in your browser')` (trackId is the deck's `trackId`, which equals the library id). Keep the existing decode-failure handling (set decoding=false, etc.) and don't rethrow.

- [ ] **Step 4: Run to verify it passes** + full suite + lint + build.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: per-file decode-error handling (flag the library track, no crash)"
```

**Phase C gate:** lint/build/test green. Import (broad formats) → Library Browser → append to Deck A/B → play; decode errors are surfaced per-track; retained queue/auto-advance tests green.

---

# PHASE D — Saved sessions (IndexedDB)

## Task D1: `sessionStore` — IndexedDB save/load/list/delete + snapshot/restore

**Files:**
- Create: `src/services/sessionStore.ts`
- Modify: `package.json` (add `fake-indexeddb` devDep + a test setup that imports it)
- Test: `src/test/sessionStore.test.ts`

**Interfaces:**
- Produces:
  - `interface SavedSession { name; savedAt; tracks: {id,title,artist,duration,format,blob:Blob}[]; deckA: {queue: string[]; currentIndex: number}; deckB: {...}; cues: Record<string, Record<number, number>>; grids: Record<string, {bpm: number|null; anchor: number|null}>; loops: Record<string, {loopStart: number|null; loopEnd: number|null; loopBeatCount: number|null}> }`
  - `saveSession(name: string): Promise<void>` (snapshots live stores → IndexedDB)
  - `listSessions(): Promise<{name: string; savedAt: number; trackCount: number}[]>`
  - `loadSession(name: string): Promise<void>` (reads IndexedDB → rehydrates stores)
  - `deleteSession(name: string): Promise<void>`
- Consumes: `useLibraryStore`, `usePlaylistStore`, `useDeckStore`, hot-cue persistence (`getHotCues`/`setHotCue` in `src/utils/hotCues.ts`), `ImportedTrack`, `libraryTrackToEntry`.

- [ ] **Step 1: Add the test dep + setup** — `npm install -D fake-indexeddb`. Ensure the Vitest setup imports it (add `import 'fake-indexeddb/auto';` to the existing test setup file referenced by `vitest.config`/`setupFiles`; if none, create `src/test/setup.ts` and wire `setupFiles` in the vite/vitest config).

- [ ] **Step 2: Write the failing test** at `src/test/sessionStore.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveSession, loadSession, listSessions, deleteSession } from '../services/sessionStore';
import { useLibraryStore } from '../store/libraryStore';
import { usePlaylistStore } from '../store/playlistStore';
import { libraryTrackToEntry } from '../store/libraryStore';

beforeEach(async () => {
  useLibraryStore.getState().clear();
  usePlaylistStore.getState().clearPlaylist('A');
  usePlaylistStore.getState().clearPlaylist('B');
  // jsdom: stub blob URL + give File.arrayBuffer
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:s', revokeObjectURL: vi.fn() } as unknown as typeof URL);
  for (const s of await listSessions()) await deleteSession(s.name);
});

it('save → load round-trips the library and a deck queue', async () => {
  const [t] = useLibraryStore.getState().addFiles([new File([new Uint8Array([1, 2, 3])], 'Set Track.mp3', { type: 'audio/mpeg' })]);
  usePlaylistStore.getState().addTrack('A', libraryTrackToEntry(t!));

  await saveSession('Friday');
  expect((await listSessions()).map((s) => s.name)).toContain('Friday');

  // wipe live state, then restore
  useLibraryStore.getState().clear();
  usePlaylistStore.getState().clearPlaylist('A');
  await loadSession('Friday');

  expect(useLibraryStore.getState().tracks.map((x) => x.title)).toEqual(['Set Track']);
  expect(usePlaylistStore.getState().playlists.A.map((e) => e.id)).toEqual([useLibraryStore.getState().tracks[0]!.id]);
});

it('deleteSession removes it', async () => {
  const [t] = useLibraryStore.getState().addFiles([new File([new Uint8Array([1])], 'x.wav', { type: 'audio/wav' })]);
  void t;
  await saveSession('Temp');
  await deleteSession('Temp');
  expect((await listSessions()).map((s) => s.name)).not.toContain('Temp');
});
```

- [ ] **Step 3: Run to verify it fails** — `npm run test -- src/test/sessionStore.test.ts`.

- [ ] **Step 4: Implement** `src/services/sessionStore.ts` — a small raw-IndexedDB wrapper (one DB `dj-rusty`, store `sessions` keyed by `name`) plus snapshot/restore:

```ts
import { useLibraryStore, type ImportedTrack, libraryTrackToEntry } from '../store/libraryStore';
import { usePlaylistStore } from '../store/playlistStore';
import { useDeckStore } from '../store/deckStore';
import { getHotCues, setHotCue } from '../utils/hotCues';

const DB = 'dj-rusty';
const STORE = 'sessions';

export interface SavedSession {
  name: string;
  savedAt: number;
  tracks: { id: string; title: string; artist: string; duration: number; format: string; blob: Blob }[];
  deckA: { queue: string[]; currentIndex: number };
  deckB: { queue: string[]; currentIndex: number };
  cues: Record<string, Record<number, number>>;
  grids: Record<string, { bpm: number | null; anchor: number | null }>;
  loops: Record<string, { loopStart: number | null; loopEnd: number | null; loopBeatCount: number | null }>;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'name' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

async function snapshot(name: string): Promise<SavedSession> {
  const lib = useLibraryStore.getState().tracks;
  const tracks = await Promise.all(lib.map(async (t) => ({
    id: t.id, title: t.title, artist: t.artist, duration: t.duration, format: t.format,
    blob: new Blob([await t.file.arrayBuffer()], { type: t.file.type }),
  })));
  const pl = usePlaylistStore.getState();
  const decks = useDeckStore.getState().decks;
  const cues: SavedSession['cues'] = {};
  const grids: SavedSession['grids'] = {};
  const loops: SavedSession['loops'] = {};
  for (const t of lib) {
    cues[t.id] = getHotCues(t.id);
  }
  for (const id of ['A', 'B'] as const) {
    const d = decks[id];
    // grid/loop are per-DECK on state; snapshot the currently-loaded track's metadata by its trackId
    if (d.trackId) {
      grids[d.trackId] = { bpm: d.bpm, anchor: d.anchor };
      loops[d.trackId] = { loopStart: d.loopStart, loopEnd: d.loopEnd, loopBeatCount: d.loopBeatCount };
    }
  }
  return {
    name, savedAt: Date.now(),
    tracks,
    deckA: { queue: pl.playlists.A.map((e) => e.id), currentIndex: pl.currentIndex.A },
    deckB: { queue: pl.playlists.B.map((e) => e.id), currentIndex: pl.currentIndex.B },
    cues, grids, loops,
  };
}

export async function saveSession(name: string): Promise<void> {
  const session = await snapshot(name);
  try {
    await tx('readwrite', (s) => s.put(session) as unknown as IDBRequest<IDBValidKey>);
  } catch (e) {
    throw new Error('Not enough browser storage to save this session.');
  }
}

export async function listSessions(): Promise<{ name: string; savedAt: number; trackCount: number }[]> {
  const all = await tx<SavedSession[]>('readonly', (s) => s.getAll() as IDBRequest<SavedSession[]>);
  return all.map((x) => ({ name: x.name, savedAt: x.savedAt, trackCount: x.tracks.length }))
            .sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteSession(name: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(name) as unknown as IDBRequest<undefined>);
}

export async function loadSession(name: string): Promise<void> {
  const session = await tx<SavedSession | undefined>('readonly', (s) => s.get(name) as IDBRequest<SavedSession | undefined>);
  if (!session) return;
  // 1) rebuild library from stored blobs
  const restored: ImportedTrack[] = session.tracks.map((t) => ({
    id: t.id, title: t.title, artist: t.artist, duration: t.duration, format: t.format,
    file: new File([t.blob], `${t.title}.${t.format}`, { type: t.blob.type }),
    audioUrl: URL.createObjectURL(t.blob),
  }));
  useLibraryStore.getState().restore(restored);
  const byId = new Map(restored.map((t) => [t.id, t]));
  // 2) restore per-track hot cues
  for (const [trackId, map] of Object.entries(session.cues)) {
    for (const [idx, sec] of Object.entries(map)) setHotCue(trackId, Number(idx), sec);
  }
  // 3) rebuild deck queues
  const pl = usePlaylistStore.getState();
  for (const deck of ['A', 'B'] as const) {
    pl.clearPlaylist(deck);
    const snap = deck === 'A' ? session.deckA : session.deckB;
    for (const id of snap.queue) {
      const t = byId.get(id);
      if (t) pl.addTrack(deck, libraryTrackToEntry(t));
    }
  }
  // 4) grids/loops are restored lazily when a track loads onto a deck — deckStore.loadTrack
  //    reads getHotCues; grid/loop restore is applied via a 'pendingGrids/pendingLoops' map (see D2 note).
}
```

> NOTE on grids/loops restore: grid (`bpm`/`anchor`) and loop are per-deck state, applied when a track is loaded. The simplest correct restore is to stash `session.grids`/`session.loops` in a module map and have `deckStore.loadTrack` apply any pending grid/loop for the incoming `trackId`. Implement that hook in Task D2 (it's a tiny `deckStore` addition); for D1, restoring library + queues + cues is sufficient and tested.

- [ ] **Step 5: Run to verify it passes** — `npm run test -- src/test/sessionStore.test.ts`; then `npm run test` (full); `npm run lint` ; `npm run build`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: sessionStore — IndexedDB save/load/list/delete of named sessions (audio + queues + cues)"
```

## Task D2: Restore grids/loops on load + `SessionPanel` UI

**Files:**
- Modify: `src/services/sessionStore.ts` (pending grid/loop map), `src/store/deckStore.ts` (apply pending grid/loop in `loadTrack`)
- Create: `src/components/Session/SessionPanel.tsx` (+ `.module.css`); wire into the track-browser (a Sessions tab or a small menu)
- Test: extend `src/test/sessionStore.test.ts` (grid round-trips); `src/test/SessionPanel.test.tsx`

- [ ] **Step 1: Failing test (grid restore)** — extend `sessionStore.test.ts`: set a deck's grid (`setGrid('A', 128, 0.25)`) and load a track on A, save, wipe, load session, then load that track onto A and assert its `bpm`/`anchor` are restored. (Asserts the pending-grid application in `loadTrack`.)

- [ ] **Step 2: Failing test (SessionPanel)** — `SessionPanel.test.tsx`: renders a Save button + a name input; clicking Save calls `saveSession`; the saved list shows the name with Load/Delete. Mock the sessionStore functions with `vi.mock`.

- [ ] **Step 3: Implement** — In `sessionStore.ts` add `const pendingGrids = new Map<string, {bpm,anchor}>()` and `pendingLoops` similarly; `loadSession` populates them from `session.grids`/`session.loops`; export `consumePendingGrid(trackId)`/`consumePendingLoop(trackId)`. In `deckStore.loadTrack`, after setting up the deck, call `consumePendingGrid(trackId)` and if present `setGrid(deckId, bpm, anchor)` (+ apply loop fields). Create `SessionPanel.tsx`: a text input + Save button (`saveSession(name)`), and a list from `listSessions()` each with Load (`loadSession(name)`) and Delete (`deleteSession(name)`), refreshing the list after each action. Add it to the track browser (a `'sessions'` tab in `SearchPanel`, or a button in the header).

- [ ] **Step 4: Run to verify** — both new tests + full suite + lint + build green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: restore per-track grid/loop on load + SessionPanel (save/load/delete sessions)"
```

**Phase D gate:** lint/build/test green. Save a session → refresh/clear → load it → library, both deck queues, hot cues, and grids are restored.

---

# PHASE E — Cleanup

## Task E1: App wiring, README, dead code

**Files:** Modify `src/App.tsx`, `src/components/Auth/SettingsModal.tsx` (if not already), `README.md`, `CLAUDE.md`; delete any now-orphaned files/constants.

- [ ] **Step 1: Orphan sweep** — Grep for dead references: `rg -n "youtube|YT\\.|videoId|sourceType|gis|google|wsClient|download|authStore|searchStore|capabilities|recentlyPlayed" src` (Grep tool). Every hit should be intentional (e.g. a comment) or removed. Delete any now-empty files (`src/components/Auth/` if empty, `src/components/Search/` leftovers, `src/constants/api.ts` if empty) and their imports.

- [ ] **Step 2: `App.tsx`** — ensure no auth/youtube/download wiring remains; the layout renders decks + mixer + the track browser (Playlist / Library / Sessions) + `FileImportZone`. Remove any leftover `LoadTrackEventDetail`/event-bus types.

- [ ] **Step 3: Docs** — rewrite `README.md` for a **client-only local-audio DJ mixer** (no server, no YouTube/Google): import local files (mp3/wav/flac/ogg/m4a/aac), per-deck queues + auto-advance, sample-accurate loops/CDJ transport/beat-grid/SYNC, and IndexedDB saved sessions. Update `CLAUDE.md` "Architecture" to drop the dual-backend/server/yt-dlp description and reflect single-backend client-only.

- [ ] **Step 4: Verify the full gate**

Run: `npm run lint` ; `npm run build` ; `npm run test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: final cleanup — App wiring, README/CLAUDE rewrite, remove orphaned YouTube/server references"
```

## Final verification gate

- [ ] `npm run lint` → PASS (0 warnings)
- [ ] `npm run build` → PASS
- [ ] `npm run test` → PASS
- [ ] Manual smoke (`npm run dev`): import several files of different formats → they appear in the Library Browser; Load-to-Deck-A/B **appends** to the queue (doesn't interrupt a playing track); a track ending **auto-advances** to the next; deck drag-drop appends; EQ/FX/pitch are live + continuous; an unsupported file shows a decode warning, not a crash; Save a session, refresh, Load it → library + queues + cues + grids restored. No network requests in the devtools network tab.

---

## Self-Review Notes

- **Spec coverage:** server delete + dev script → A1; download/WS → A2; auth → A3; YouTube search/data + tab repurpose → A4; backend collapse + `sourceType` removal + un-gate + fixtures → B1–B4; libraryStore + import broadening + append → C1–C2; Library Browser → C3; decode errors → C4; sessions (IndexedDB) + restore + UI → D1–D2; cleanup/README → E1. Retained features (queues/append/auto-advance) called out in the Phase B/C gates + the final smoke.
- **Type consistency:** `getActivePlayer(deckId)` (no 2nd arg) everywhere; `DeckPlayer` keeps `setLoop?/clearLoop?/isLooping?`; `ImportedTrack` and `libraryTrackToEntry` (id == trackId) used consistently in library/playlist/session; `SavedSession` shape consistent between snapshot and restore.
- **Build-green ordering:** `youtubeIframeApi`/YT types are kept through Phase A (A4 note) and deleted only in B2 alongside `useYouTubePlayer`; `playerRegistry` is rewritten first (B1) but the suite/build only goes green again after B2–B4. Each phase boundary (A, B, C, D, E) is lint+build+test green.
- **Known follow-ups (out of scope per spec):** auto-persisting the working library; portable `.djset` export/import; File System Access; richer library organization (BPM/tags).
