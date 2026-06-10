# DJ Rusty — Production Hardening & Dual-Mode Player Fix

**Date:** 2026-06-10
**Status:** Approved (design) — pending spec review
**Author:** rbenzing (with Claude)

---

## 1. Problem Statement

DJ Rusty is a two-deck browser DJ mixer supporting **dual-mode sources**: live
YouTube playback (via the IFrame API) and local/downloaded **WAV/MP3** files
(via a Web Audio engine). The codebase is in far better shape than its "vibe
coded" reputation — 687 passing frontend unit tests, 22 server tests, clean
frontend + server builds, a real Web Audio signal chain (EQ, kill switches,
filter sweep, echo/reverb), and a `yt-dlp` download backend with SQLite library
and WebSocket progress.

Despite green tests, **interactive UI controls misbehave at runtime**:
buttons "do nothing" or "work wrong." The reported, reproducible symptom:

> Loading a YouTube (IFrame) track from history and pressing **CUE** does
> nothing. This worked in v1 of the project.

The unit tests do not catch this because they **mock the player/engine** — they
verify "button dispatches the right store action" but never "the right backend
actually receives the imperative command."

## 2. Root Cause

`playerRegistry` exposes **one slot per deck** (`Map<DeckId, DeckPlayer>`), but
**two backends register into it**:

- `useYouTubePlayer` (mounted via `<YouTubePlayer>` in `App.tsx`) registers a
  `YouTubePlayerAdapter`.
- `useAudioEngine` (called unconditionally in `Deck.tsx` for every deck)
  registers an `AudioEngineImpl`.

Registration is **last-writer-wins**. Imperative commands that bypass the store
— `seekTo` for CUE, restart, ±15s skip, hot-cue jump, loop boundary, slip/roll —
call `playerRegistry.get(deckId).seekTo(...)`. Whichever backend mounted last
holds the slot. For a YouTube track, the slot is very likely the (buffer-less)
`AudioEngineImpl`, so the seek hits a dead engine and **nothing happens**.

v1 had no Web Audio engine competing for the slot, so the IFrame CUE worked.

## 3. Goals

1. **Fix the dual-mode regression** — imperative commands resolve to the
   correct backend based on the deck's `sourceType`. CUE, restart, skip,
   hot-cues, loops, and slip/roll work on **both** YouTube and WAV/MP3 decks.
2. **Consistent source-type capability gating** — no control ever renders
   interactive while silently doing nothing. YouTube gates out real EQ /
   effects / filter sweep / continuous pitch; WAV/MP3 unlocks the full chain.
3. **TDD via the integration gap** — add tests that exercise the real
   UI→store→backend seam the unit tests mock, starting red and driven to green.
4. **Production hardening** — repair the broken lint gate, refresh the stale
   README, surface backend errors consistently.

## 4. Non-Goals (YAGNI)

- No new DJ features, no visual redesign.
- No removal of YouTube IFrame mode (dual-mode is retained per decision).
- The `.webm`-vs-`.mp3` on-disk discrepancy in `server/downloads/` is
  **verified, then fixed only if a test proves it broken** — not assumed.
- No migration of existing localStorage/SQLite data formats.

## 5. Architecture

### 5.1 Source-Aware Player Resolution

Replace the single-slot registry with a **per-deck, per-backend** registry and a
resolver that consults the deck's active `sourceType`.

```
registry: Map<DeckId, { youtube?: DeckPlayer; audio?: DeckPlayer }>

register(deckId, kind: 'youtube' | 'audio', player)   // additive, no clobber
unregister(deckId, kind)                                // remove one backend
getActivePlayer(deckId): DeckPlayer | undefined         // reads sourceType from store
```

`getActivePlayer` reads `useDeckStore.getState().decks[deckId].sourceType` and
returns `registry.get(deckId)?.[sourceType === 'youtube' ? 'youtube' : 'audio']`.
Synchronous, no timing issues (consistent with existing registry design).

**Backward-compatibility:** keep `get(deckId)` as a thin deprecated alias for
`getActivePlayer(deckId)` during migration so no call site breaks mid-refactor;
remove once all sites migrate.

### 5.2 Capability Map (Dual-Mode Source of Truth)

A single pure function defines what each source supports:

```ts
// src/constants/capabilities.ts
export interface SourceCapabilities {
  continuousPitch: boolean;  // MP3: true (any rate). YouTube: false (discrete only).
  realEq: boolean;           // MP3: true (BiquadFilters). YouTube: false (volume only).
  effects: boolean;          // MP3: true (echo/reverb). YouTube: false.
  filterSweep: boolean;      // MP3: true. YouTube: false.
  waveform: boolean;         // MP3: true (decoded peaks). YouTube: false.
}
export function capabilities(sourceType: TrackSourceType | null): SourceCapabilities
```

`EQPanel`, `PitchSlider`, `EffectsPanel`, and any other source-sensitive control
consume this map to disable + annotate ("MP3 only"), replacing the ad-hoc
`sourceType === 'mp3'` checks scattered today. One definition, consistent UI.

### 5.3 Touched Units

| Unit | Change |
|------|--------|
| `src/services/playerRegistry.ts` | Per-backend storage; `getActivePlayer`; deprecated `get` alias. |
| `src/constants/capabilities.ts` (new) | Pure capability map. |
| `src/hooks/useYouTubePlayer.ts` | `register(deckId, 'youtube', adapter)` / `unregister(deckId, 'youtube')`. |
| `src/hooks/useAudioEngine.ts` | `register(deckId, 'audio', engine)` / `unregister(deckId, 'audio')`. |
| `src/components/Deck/DeckControls.tsx` | Resolve seek via `getActivePlayer`. |
| `src/components/Deck/HotCues.tsx` | Resolve seek via `getActivePlayer`. |
| `src/components/Deck/LoopControls.tsx` | Resolve seek via `getActivePlayer` (if it issues direct seeks). |
| `src/store/deckStore.ts` | slip/roll `deactivateLoop`/`endRoll` resolve via `getActivePlayer`. |
| `src/components/Deck/EQPanel.tsx`, `PitchSlider.tsx`, `EffectsPanel.tsx` | Gate from `capabilities()`. |

### 5.4 Data Flow

Healthy paths are unchanged: **UI → store action → backend subscription → audio
output**. Repairs are confined to two seams:

- **Imperative seam** — commands that bypass the store (seek/cue) now resolve
  the correct backend.
- **Capability seam** — which controls render interactive is centralized.

## 6. Error Handling

- `getActivePlayer` returns `undefined` when the active backend isn't ready;
  existing `playerReady` guards remain. All call sites no-op safely.
- YouTube embed-disallowed (error 101/150) already surfaces `deck.error`; the
  same `deck.error` banner pattern covers MP3 decode and download-fetch
  failures (extend existing partial handling).
- Backend acquisition failures (`yt-dlp` missing; on-disk format mismatch) are
  surfaced as download errors with actionable text (already present in
  `downloadService`; verified against real disk state).

## 7. Testing Strategy (TDD — Integration-Gap Focus)

Every change is driven by a **failing test first**, then implemented to green.
New tests target the real seam the existing suite mocks.

1. **Registry resolution** — register both backends for a deck; assert
   `getActivePlayer` returns the YouTube adapter for `sourceType='youtube'` and
   the audio engine for `'mp3'`. *Fails today; proves the bug.*
2. **Cue/seek routing (integration)** — load a YouTube track, set cue, jump to
   cue → assert the **YouTube** adapter's `seekTo` is invoked, not the audio
   engine. Repeat for restart, ±15s skip, hot-cue jump.
3. **Capability gating** — YouTube deck disables effects/real-EQ/filter/
   continuous-pitch controls; MP3 deck enables them.
4. **Deck↔mixer↔crossfader wiring** — channel-fader and crossfader changes
   reach the correct active backend's volume.
5. **Backend disk-format check** — assert the download path produces the file
   the audio path actually loads (catches `.webm`/`.mp3` mismatch); fix only if
   it fails.

Existing 687 + 22 tests must stay green throughout (regression guard).

## 8. Production Hardening

- **Lint gate:** `npm run lint` references `eslint` which is not installed.
  Install ESLint + TypeScript/React config so the zero-warning gate mandated by
  CLAUDE.md actually runs and passes.
- **README:** refresh to describe the real dual-mode app (YouTube IFrame +
  local/downloaded WAV/MP3 with full Web Audio chain), not the v1 YouTube-only
  description.
- **Verification before "done":** frontend build, server build, full test
  suites, and lint all green; the CUE-on-YouTube bug manually confirmed fixed in
  a browser.

## 9. Acceptance Criteria

- [ ] Loading a YouTube track and pressing CUE seeks the IFrame player (manual +
      integration test).
- [ ] Same for restart, ±15s skip, hot-cue jump — on both YouTube and MP3 decks.
- [ ] No source-sensitive control renders interactive while doing nothing.
- [ ] `npm run lint` runs and passes with zero warnings.
- [ ] All existing + new tests green; both builds green.
- [ ] README reflects the real dual-mode architecture.
