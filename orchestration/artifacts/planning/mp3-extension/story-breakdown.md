# Story Breakdown -- MP3 Extension

**Project:** mp3-extension
**Phase:** Planning
**Date:** 2026-03-25
**Total Stories:** 14

---

## Table of Contents

| ID | Title | Priority | Complexity | Dependencies |
|---|---|---|---|---|
| mp3-001 | Track Type Extensions | P1 | M | None |
| mp3-002 | AudioEngine Service | P1 | L | mp3-001 |
| mp3-003 | AudioEngine + Store Integration | P1 | L | mp3-002 |
| mp3-004 | MP3 File Picker | P1 | S | mp3-003 |
| mp3-005 | OS File Drag-and-Drop into Playlist | P1 | M | mp3-003 |
| mp3-006 | Playback Controls with MP3 | P1 | M | mp3-003 |
| mp3-007 | Auto-Advance with MP3 Tracks | P1 | S | mp3-006 |
| mp3-008 | Waveform Display | P1 | L | mp3-003 |
| mp3-009 | 3-Band EQ (Functional) | P1 | M | mp3-003 |
| mp3-010 | BPM Detection | P1 | M | mp3-003 |
| mp3-011 | UI Cleanup: Remove Load A/B Buttons | P1 | S | mp3-001 |
| mp3-012 | YouTube Download Integration | P1 | L | mp3-003 |
| mp3-013 | Download Progress and Library Tab | P2 | M | mp3-012 |
| mp3-014 | Cross-Deck Playlist Drag | P2 | M | mp3-005 |

---

## Phase 1: Foundation

### mp3-001 -- Track Type Extensions
**Priority:** P1 | **Complexity:** M | **Dependencies:** None

Extend the core data types (`PlaylistEntry`, `DeckState`, `DeckPlayer` interface) to support dual-source (MP3 + YouTube) tracks. This is a pure type and interface change -- no new features, no new UI. Every subsequent story depends on these types being in place.

### mp3-002 -- AudioEngine Service
**Priority:** P1 | **Complexity:** L | **Dependencies:** mp3-001

Build the Web Audio API audio engine service: `AudioContext` singleton, per-deck `AudioEngine` class with the full signal chain (source -> gain -> EQ filters -> analyser -> destination), play/pause/stop/seek lifecycle, playback rate control, and position tracking.

### mp3-003 -- AudioEngine + Store Integration
**Priority:** P1 | **Complexity:** L | **Dependencies:** mp3-002

Create the `useAudioEngine` hook that bridges the AudioEngine service to the Zustand deckStore. Subscribe to store changes (playbackState, volume, pitchRate, EQ, loop) and push them to the engine. Push engine state (currentTime) back to the store at 60fps. Register the engine in `playerRegistry` so HotCues, LoopControls, and DeckControls can seek imperatively. Create `useDeckPlayer` facade hook.

---

## Phase 2: Core MP3 Playback

### mp3-004 -- MP3 File Picker
**Priority:** P1 | **Complexity:** S | **Dependencies:** mp3-003

Add a "Browse Files" button to the PlaylistPanel header that opens an `<input type="file" accept=".mp3,audio/mpeg" multiple>`. Selected files create `PlaylistEntry` objects with `sourceType: 'mp3'` and add them to the target deck's playlist.

### mp3-005 -- OS File Drag-and-Drop into Playlist
**Priority:** P1 | **Complexity:** M | **Dependencies:** mp3-003

Implement the `DropZone` component wrapping each deck column in PlaylistPanel. Handle `dragenter/dragover/dragleave/drop` events for OS file drops. Validate MP3 file type. Show visual feedback (valid/invalid drag states). Add dropped files to the playlist.

### mp3-006 -- Playback Controls with MP3
**Priority:** P1 | **Complexity:** M | **Dependencies:** mp3-003

Wire all existing deck transport controls (play/pause, cue, set cue, skip +/-15s, restart, skip next, hot cues, loops, slip mode, beat jump) to work with the MP3 AudioEngine. Ensure the `useAudioEngine` hook correctly responds to all deckStore state changes and `playerRegistry` seek calls.

### mp3-007 -- Auto-Advance with MP3 Tracks
**Priority:** P1 | **Complexity:** S | **Dependencies:** mp3-006

When an MP3 track ends (AudioBufferSourceNode fires `onended`), call `playlistStore.skipToNext(deckId)` to advance to the next track. The next track must decode its audio, load the buffer, and auto-play. Ensure `loadDeckTrack` works correctly for both MP3 and YouTube source types.

---

## Phase 3: Audio Features

### mp3-008 -- Waveform Display
**Priority:** P1 | **Complexity:** L | **Dependencies:** mp3-003

Build the `WaveformDisplay` canvas component. Extract waveform peaks from the AudioBuffer on load. Render amplitude bars with deck-colored fills. Animate the playhead at 60fps. Support click-to-seek interaction. Handle empty, loading, and ready states. Include accessible hidden range input for keyboard seek.

### mp3-009 -- 3-Band EQ (Functional)
**Priority:** P1 | **Complexity:** M | **Dependencies:** mp3-003

Wire the existing deckStore EQ values (`eqLow`, `eqMid`, `eqHigh`) to the AudioEngine's BiquadFilterNode chain. Remove the "Visual Only" badge from EQPanel. Update aria-labels and titles. The EQ knobs already work in the UI; this story makes them produce actual audio effects.

### mp3-010 -- BPM Detection
**Priority:** P1 | **Complexity:** M | **Dependencies:** mp3-003

Implement automatic BPM detection using `bpm-detective`. Run analysis in a Web Worker to avoid blocking the UI. Store detected BPM in deckStore. Add `bpmDetecting` state field for UI loading indicator. Update DeckDisplay to show spinner while detecting. Tap-tempo override remains functional.

---

## Phase 4: YouTube Download Integration

### mp3-012 -- YouTube Download Integration
**Priority:** P1 | **Complexity:** L | **Dependencies:** mp3-003

Build `downloadService.ts` client-side API for the Express server. When a YouTube track is added to a playlist, check if it has been downloaded; if not, initiate download via `POST /api/download`. When download completes, fetch the MP3 as an ArrayBuffer, decode it, and load it into the AudioEngine. YouTube tracks play through Web Audio just like local MP3s.

### mp3-013 -- Download Progress and Library Tab
**Priority:** P2 | **Complexity:** M | **Dependencies:** mp3-012

Show download progress indicator on playlist entries that are downloading. Add a "Downloads" tab to the SearchPanel showing all previously downloaded tracks from the server manifest. Users can add downloaded tracks to playlists directly.

---

## Phase 5: UI Cleanup and Polish

### mp3-011 -- UI Cleanup: Remove Load A/B Buttons
**Priority:** P1 | **Complexity:** S | **Dependencies:** mp3-001

Remove the LOAD A / LOAD B buttons from `SearchResult.tsx`. Remove the `onLoadToDeck` prop chain through `SearchResultList.tsx` and `SearchPanel.tsx`. Remove the `dj-rusty:load-track` CustomEvent listener from `App.tsx`. Update the empty state hint text in `Deck.tsx`. Widen the +A/+B buttons to be the primary add action.

### mp3-014 -- Cross-Deck Playlist Drag
**Priority:** P2 | **Complexity:** M | **Dependencies:** mp3-005

Implement in-app drag-and-drop using `@dnd-kit/core` and `@dnd-kit/sortable`. Enable reordering tracks within a deck's playlist. Enable moving a track from one deck's playlist to the other. Add drag handles to PlaylistTrack rows. Add `reorderTrack` and `moveTrack` actions to playlistStore.
