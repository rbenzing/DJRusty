# Design Document -- MP3 Extension

**Project:** mp3-extension
**Phase:** Planning
**Date:** 2026-03-25

---

## 1. Technical Approach

The MP3 Extension transforms DJRusty from a YouTube-only DJ application into an MP3-first, dual-source DJ platform. The core architectural change is introducing a **Web Audio API audio engine** that replaces the YouTube IFrame player as the primary audio path. YouTube tracks remain supported by downloading them via the existing Express/yt-dlp server and routing the resulting MP3 through the same Web Audio pipeline.

The implementation is structured in five phases:

1. **Foundation** -- Extend data types and build the AudioEngine service. This is the bedrock that every subsequent story depends on.
2. **Core MP3 Playback** -- File loading (picker + drag-and-drop), playback controls integration, and auto-advance.
3. **Audio Features** -- Waveform visualization, functional EQ, and BPM detection. These leverage the AudioBuffer that becomes available in Phase 1.
4. **YouTube Download Integration** -- Connect the frontend to the existing Express download server so YouTube tracks flow through the Web Audio pipeline.
5. **UI Cleanup and Polish** -- Remove deprecated buttons, add cross-deck drag, and finalize the UI.

---

## 2. Key Architectural Decisions

### ADR-001: Web Audio API as Core Audio Engine (Accepted)
- Shared `AudioContext` singleton for both decks.
- Per-deck signal chain: `AudioBufferSourceNode -> GainNode -> BiquadFilter (low) -> BiquadFilter (mid) -> BiquadFilter (high) -> AnalyserNode -> destination`.
- Full decode-before-play model -- `AudioBuffer` objects are decoded from MP3 files and held in memory.
- Position tracking via arithmetic (`startOffset + (context.currentTime - startedAt) * playbackRate`), updated at 60fps via `requestAnimationFrame`.

### ADR-002: YouTube Download via Express Server + yt-dlp (Accepted)
- Reuse the existing `server/index.js` Express server on port 3001.
- Client polls download status every 2 seconds.
- Downloaded MP3s persist in `server/downloads/` as a cache.
- No WebSocket complexity; polling is adequate for infrequent downloads.

### Data Model Strategy
- `PlaylistEntry` type extended with `sourceType`, `artist` (replaces `channelTitle`), optional `videoId`, optional `file`, optional `audioUrl`.
- `DeckState` type extended with `sourceType`, `trackId` (replaces `videoId`), `waveformPeaks`, `decoding`, `bpmDetecting`.
- `AudioBuffer` objects are never stored in Zustand state (they are non-serializable and very large). They live in the AudioEngine service instance.

### Player Registry Generalization
- `playerRegistry` changes from `Map<DeckId, YT.Player>` to `Map<DeckId, DeckPlayer>` where `DeckPlayer` is a common interface with `seekTo()`, `getCurrentTime()`, `getDuration()`.
- The AudioEngine implements `DeckPlayer`. A thin `YouTubePlayerAdapter` wraps `YT.Player` for backward compatibility.

---

## 3. Story Dependency Graph

```
mp3-001 (Type Extensions)
   |
   +---> mp3-002 (AudioEngine Service)
   |        |
   |        +---> mp3-003 (AudioEngine + Store Integration)
   |                 |
   |                 +---> mp3-004 (MP3 File Picker)
   |                 |        |
   |                 |        +---> mp3-005 (OS Drag-and-Drop)
   |                 |
   |                 +---> mp3-006 (Playback Controls)
   |                 |        |
   |                 |        +---> mp3-007 (Auto-Advance)
   |                 |
   |                 +---> mp3-008 (Waveform Display)
   |                 |
   |                 +---> mp3-009 (3-Band EQ)
   |                 |
   |                 +---> mp3-010 (BPM Detection)
   |
   +---> mp3-011 (UI Cleanup: Remove Load/Queue Buttons)
   |
   +---> mp3-012 (YouTube Download Integration)
   |        |
   |        +---> mp3-013 (Download Progress + Library Tab)
   |
   +---> mp3-014 (Cross-Deck Drag)
```

**Critical path:** mp3-001 -> mp3-002 -> mp3-003 -> mp3-006 -> mp3-007

**Parallel tracks after mp3-003:**
- mp3-004, mp3-005 (file loading)
- mp3-008, mp3-009, mp3-010 (audio features)
- mp3-011 (UI cleanup -- can start after mp3-001)
- mp3-012, mp3-013 (YouTube download -- can start after mp3-003)

---

## 4. Risk Areas

### High Risk
- **PlaylistEntry type breaking change (mp3-001):** Making `videoId` optional and renaming `channelTitle` to `artist` touches every file that constructs or reads a `PlaylistEntry`. TypeScript strict mode will catch compile-time issues, but runtime regressions in playlist persistence or display are possible.
- **AudioContext suspended state:** Chrome/Edge/Firefox block AudioContext until a user gesture. If the first play attempt occurs before `context.resume()`, audio silently fails. The AudioEngine must handle this transparently.

### Medium Risk
- **AudioBuffer memory:** A 10-minute stereo track at 44.1kHz decodes to ~100MB of PCM float data. Two loaded decks consume ~200MB. This is acceptable for desktop but must be documented.
- **playerRegistry generalization:** Changing the registry type from `YT.Player` to `DeckPlayer` will temporarily break TypeScript compilation in `DeckControls.tsx`, `HotCues.tsx`, `LoopControls.tsx`, and other components that call `playerRegistry.get(deckId).seekTo()` -- the method signature changes (YT.Player.seekTo has different overloads than DeckPlayer.seekTo).

### Low Risk
- **BPM detection accuracy:** `bpm-detective` works well for 4/4 electronic music but poorly for irregular tempos. The existing tap-tempo serves as a reliable override.
- **Drag event interference:** OS file drag and in-app @dnd-kit drag are separate interaction paths that must not conflict. Distinguished by checking `event.dataTransfer.types.includes('Files')`.

---

## 5. New Dependencies

| Package | Purpose | Size (gzipped) |
|---|---|---|
| `@dnd-kit/core` | In-app drag-and-drop (reorder, cross-deck) | ~15 kB |
| `@dnd-kit/sortable` | Sortable list abstraction for playlist reorder | ~5 kB |
| `@dnd-kit/utilities` | CSS transform utilities for drag | ~2 kB |
| `bpm-detective` | BPM detection from AudioBuffer | ~2 kB |

No new dependencies are needed for the Web Audio API (browser built-in), file drag-and-drop (native HTML5), or the download service client (plain fetch).
