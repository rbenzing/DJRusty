# Architecture Document -- MP3 Extension

**Project:** mp3-extension
**Phase:** Architecture
**Date:** 2026-03-25
**Status:** Complete

---

## 1. Architecture Overview

### 1.1 Philosophy

DJRusty is a browser-based DJ application built with React + TypeScript + Zustand + Vite. Today it is YouTube-only: each deck wraps a hidden YT.Player IFrame that streams video audio. This architecture extends the app to be **MP3-first** with YouTube as a secondary, download-based source. The core change is introducing a **unified audio engine** backed by the Web Audio API that plays decoded audio buffers -- whether those buffers come from a local MP3 file or a downloaded YouTube track.

### 1.2 High-Level System Diagram

```
+-----------------------------------------------------------------------+
|  Browser (React SPA)                                                   |
|                                                                        |
|  +------------------+     +------------------+     +-----------------+ |
|  |  Deck A UI       |     |    Mixer UI      |     |  Deck B UI      | |
|  |  - DeckDisplay   |     |  - Crossfader    |     |  - DeckDisplay  | |
|  |  - VinylPlatter  |     |  - ChannelFaders |     |  - VinylPlatter | |
|  |  - WaveformView  |     |  - VUMeters      |     |  - WaveformView | |
|  |  - EQPanel       |     |  - MasterVolume  |     |  - EQPanel      | |
|  |  - DeckControls  |     +---------+--------+     |  - DeckControls | |
|  +--------+---------+               |               +--------+--------+ |
|           |                         |                        |          |
|  +--------v---------+     +---------v--------+     +--------v--------+ |
|  |  AudioEngine A   |     |  Zustand Stores  |     |  AudioEngine B  | |
|  |  (Web Audio API) |     |  - deckStore     |     |  (Web Audio API)| |
|  |  - BufferSource  |     |  - playlistStore |     |  - BufferSource | |
|  |  - GainNode      |     |  - mixerStore    |     |  - GainNode     | |
|  |  - EQ Filters    |     |  - authStore     |     |  - EQ Filters   | |
|  |  - AnalyserNode  |     +------------------+     |  - AnalyserNode | |
|  +--------+---------+                               +--------+--------+ |
|           |                                                  |          |
|           +------------------+   +---------------------------+          |
|                              |   |                                      |
|                     +--------v---v--------+                             |
|                     |   AudioContext       |                             |
|                     |   (shared singleton) |                             |
|                     |   -> destination     |                             |
|                     +---------------------+                             |
|                                                                        |
|  +---------------------+         +----------------------------------+  |
|  | Drag-and-Drop Layer |         | YouTube Download Service          | |
|  | (@dnd-kit/core)     |         | (client -> Express server ->     | |
|  | - OS file drop zone |         |  yt-dlp -> MP3 -> fetch -> decode)| |
|  | - Inter-playlist    |         +----------------------------------+  |
|  |   drag & reorder    |                                               |
|  +---------------------+                                               |
+-----------------------------------------------------------------------+
                                    |
                        +-----------v-----------+
                        |  Express Server :3001  |
                        |  /api/download         |
                        |  /api/audio/:videoId   |
                        |  /api/tracks           |
                        +------------------------+
```

### 1.3 Architecture Style

**Modular Monolith** (single-page application). All code ships as one Vite-bundled SPA. The Express server is a local sidecar that runs alongside the dev server for YouTube download functionality. No microservices, no serverless.

---

## 2. Audio Engine Design

### 2.1 Core Concept

Replace the YouTube IFrame player as the primary audio output with a **Web Audio API signal chain**. Each deck gets its own `AudioEngine` instance. The YouTube IFrame players remain in the DOM (YouTube ToS requirement) but are **muted and hidden** -- they are only used for YouTube-sourced tracks where no downloaded MP3 is available yet (fallback mode).

For the primary path: audio files (MP3 from disk or downloaded YouTube MP3) are decoded into `AudioBuffer` objects and played through the Web Audio API graph, which gives us full programmatic control over EQ, gain, playback rate, waveform analysis, and more.

### 2.2 Signal Chain Per Deck

```
AudioBuffer
    |
    v
AudioBufferSourceNode  (playback, rate control via .playbackRate)
    |
    v
GainNode (deck volume, 0.0 - 1.0)
    |
    v
BiquadFilterNode (lowshelf, freq: 320 Hz)  -- EQ Bass
    |
    v
BiquadFilterNode (peaking, freq: 1000 Hz, Q: 0.7)  -- EQ Mid
    |
    v
BiquadFilterNode (highshelf, freq: 3200 Hz)  -- EQ Treble
    |
    v
AnalyserNode (FFT for waveform / VU meter)
    |
    v
AudioContext.destination
```

### 2.3 AudioEngine Interface

```typescript
// src/services/audioEngine.ts

export interface AudioEngineOptions {
  /** Which deck this engine belongs to. */
  deckId: 'A' | 'B';
  /** Shared AudioContext (one per app). */
  context: AudioContext;
}

export interface AudioEngine {
  /** The deck this engine serves. */
  readonly deckId: 'A' | 'B';

  /** Load an AudioBuffer (decoded MP3 data) into this engine. */
  loadBuffer(buffer: AudioBuffer): void;

  /** Start playback from the given offset in seconds. */
  play(offsetSeconds?: number): void;

  /** Pause playback, remembering current position. */
  pause(): void;

  /** Stop playback and reset position to 0. */
  stop(): void;

  /** Seek to a specific position in seconds. */
  seek(seconds: number): void;

  /** Get the current playback position in seconds. */
  getCurrentTime(): number;

  /** Get the total duration of the loaded buffer in seconds. */
  getDuration(): number;

  /** Set the playback rate (0.5 - 2.0, matching existing PitchRate type). */
  setPlaybackRate(rate: number): void;

  /** Set the volume (0-100 integer, converted internally to 0.0-1.0 gain). */
  setVolume(volume: number): void;

  /** Set EQ band gain in dB (-12 to +12). */
  setEQ(band: 'low' | 'mid' | 'high', gainDb: number): void;

  /** Get the AnalyserNode for waveform/VU visualization. */
  getAnalyser(): AnalyserNode;

  /** Get time-domain waveform data (Uint8Array of 2048 samples). */
  getWaveformData(): Uint8Array;

  /** Whether a buffer is loaded and ready to play. */
  isReady(): boolean;

  /** Whether playback is currently active. */
  isPlaying(): boolean;

  /** Dispose all Web Audio nodes. */
  destroy(): void;
}
```

### 2.4 AudioContext Singleton

```typescript
// src/services/audioContext.ts

let audioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/** Resume context after user gesture (browser autoplay policy). */
export async function ensureAudioContextResumed(): Promise<void> {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}
```

### 2.5 Implementation Notes

- **AudioBufferSourceNode is single-use**: each time playback starts, a new source node must be created and connected to the graph. The GainNode, BiquadFilterNodes, and AnalyserNode persist across play/pause cycles.
- **Position tracking**: The Web Audio API does not expose a "currentTime of playback" directly. Track it as `startOffset + (audioContext.currentTime - startedAt) * playbackRate`. Update the deckStore at 60fps via `requestAnimationFrame` (smoother than the current 250ms setInterval).
- **Loop enforcement**: Check position each animation frame; when `currentTime >= loopEnd`, call `seek(loopStart)`.
- **Playback rate**: Set via `sourceNode.playbackRate.value`. Unlike YouTube which quantizes to discrete rates, Web Audio API supports continuous values. Keep the existing `PitchRate` discrete steps for the slider but allow the engine to accept any float.

---

## 3. Data Model Changes

### 3.1 Track Type (new)

```typescript
// src/types/track.ts

export type TrackSourceType = 'mp3' | 'youtube';

/**
 * Unified track metadata, independent of source.
 * Used in playlists, deck state, and display.
 */
export interface Track {
  /** Unique identifier. For MP3: generated UUID. For YouTube: videoId. */
  id: string;

  /** Where this track came from. */
  sourceType: TrackSourceType;

  /** Display title. For MP3: parsed from filename or ID3 tag. For YouTube: video title. */
  title: string;

  /** Artist / channel name. For MP3: parsed from ID3 tag or 'Local File'. For YouTube: channelTitle. */
  artist: string;

  /** Duration in seconds. For MP3: computed from AudioBuffer. For YouTube: from API. */
  duration: number;

  /** Thumbnail / album art URL. Nullable. */
  thumbnailUrl: string | null;

  /** BPM (beats per minute). Null until detected. */
  bpm: number | null;

  // --- Source-specific fields ---

  /** YouTube video ID. Only set when sourceType === 'youtube'. */
  videoId?: string;

  /** The decoded AudioBuffer for Web Audio playback. Null until decoded. */
  audioBuffer?: AudioBuffer;

  /** Pre-computed waveform peaks for rendering (downsampled to ~800 points). */
  waveformPeaks?: Float32Array;
}
```

### 3.2 PlaylistEntry Changes

```typescript
// src/types/playlist.ts (updated)

/**
 * A single entry in a deck's playlist queue.
 * Extended to support both MP3 and YouTube sources.
 */
export interface PlaylistEntry {
  /** Unique entry identifier (not the track ID -- same track can appear multiple times). */
  id: string;

  /** Source type of this entry. */
  sourceType: TrackSourceType;

  /** Display title. */
  title: string;

  /** Artist / channel name. */
  artist: string;

  /** Duration in seconds. */
  duration: number;

  /** Thumbnail URL. Nullable. */
  thumbnailUrl: string | null;

  // --- Source-specific ---

  /** YouTube video ID. Set when sourceType === 'youtube'. */
  videoId?: string;

  /** Reference to the File object for local MP3s. Used to re-decode if needed. */
  file?: File;

  /** URL for the audio source (blob URL for local files, server URL for downloaded YT). */
  audioUrl?: string;
}
```

**Migration note:** The old `PlaylistEntry` had `videoId` (required), `channelTitle`. The new one makes `videoId` optional and renames `channelTitle` to `artist`. All existing code that references `entry.videoId` must be updated to handle the optional case, and `entry.channelTitle` must be renamed to `entry.artist`.

### 3.3 DeckState Changes

```typescript
// src/types/deck.ts (additions/changes)

export interface DeckState {
  deckId: 'A' | 'B';

  // --- CHANGED: Generalized from YouTube-only ---
  /** Unique track identifier. For YouTube: videoId. For MP3: generated UUID. */
  trackId: string | null;            // was: videoId: string | null

  /** Source type of the currently loaded track. */
  sourceType: TrackSourceType | null; // NEW

  title: string;
  artist: string;                    // was: channelTitle: string
  duration: number;
  currentTime: number;
  thumbnailUrl: string | null;
  playbackState: PlaybackState;
  pitchRate: PitchRate;
  bpm: number | null;
  volume: number;

  // --- Loop, hot cue, slip, roll fields unchanged ---
  loopActive: boolean;
  loopStart: number | null;
  loopEnd: number | null;
  loopBeatCount: 1 | 2 | 4 | 8 | null;
  beatJumpSize: number;
  playerReady: boolean;
  hotCues: Record<number, number>;

  // --- EQ: still stored here, now wired to actual audio processing ---
  eqLow: number;
  eqMid: number;
  eqHigh: number;

  error: string | null;
  pitchRateLocked: boolean;
  synced: boolean;
  slipMode: boolean;
  slipPosition: number | null;
  slipStartTime: number | null;
  slipStartPosition: number | null;
  rollMode: boolean;
  rollStartWallClock: number | null;
  rollStartPosition: number | null;
  autoPlayOnLoad: boolean;

  // --- NEW: MP3-specific ---
  /** Pre-computed waveform peaks for the waveform display component. */
  waveformPeaks: Float32Array | null; // NEW

  /** Whether the audio buffer is currently being decoded. */
  decoding: boolean;                  // NEW
}
```

---

## 4. Service Layer Design

### 4.1 New Services

| Service | File | Purpose |
|---|---|---|
| `audioEngine.ts` | `src/services/audioEngine.ts` | Web Audio API playback engine (one instance per deck) |
| `audioContext.ts` | `src/services/audioContext.ts` | Shared AudioContext singleton |
| `audioDecoder.ts` | `src/services/audioDecoder.ts` | Decode MP3 File / ArrayBuffer into AudioBuffer |
| `waveformAnalyzer.ts` | `src/services/waveformAnalyzer.ts` | Extract waveform peaks from AudioBuffer for display |
| `bpmDetector.ts` | `src/services/bpmDetector.ts` | Detect BPM from AudioBuffer using autocorrelation |
| `downloadService.ts` | `src/services/downloadService.ts` | Client-side API for the Express download server |

### 4.2 audioDecoder.ts

```typescript
// src/services/audioDecoder.ts

import { getAudioContext } from './audioContext';

/**
 * Decode an audio file into an AudioBuffer.
 * Works with both File objects (from drag-drop / file picker) and
 * ArrayBuffer (from fetch of downloaded YouTube audio).
 */
export async function decodeAudioFile(
  source: File | ArrayBuffer
): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const arrayBuffer = source instanceof File
    ? await source.arrayBuffer()
    : source;
  return ctx.decodeAudioData(arrayBuffer);
}
```

### 4.3 waveformAnalyzer.ts

```typescript
// src/services/waveformAnalyzer.ts

/**
 * Extract downsampled waveform peaks from an AudioBuffer.
 * Returns a Float32Array of ~800 peak values (0.0 - 1.0) for rendering.
 *
 * Algorithm: divide the buffer into N buckets, take the max absolute
 * sample value in each bucket.
 */
export function extractWaveformPeaks(
  buffer: AudioBuffer,
  targetPoints: number = 800
): Float32Array {
  const channelData = buffer.getChannelData(0); // mono or left channel
  const bucketSize = Math.floor(channelData.length / targetPoints);
  const peaks = new Float32Array(targetPoints);

  for (let i = 0; i < targetPoints; i++) {
    let max = 0;
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, channelData.length);
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    peaks[i] = max;
  }

  return peaks;
}
```

### 4.4 bpmDetector.ts

```typescript
// src/services/bpmDetector.ts

/**
 * Detect BPM from an AudioBuffer using onset-based autocorrelation.
 *
 * Strategy:
 * 1. Resample to mono and downsample to ~22050 Hz for performance.
 * 2. Compute energy in overlapping windows (onset detection function).
 * 3. Autocorrelate the onset function.
 * 4. Find the peak in the autocorrelation that corresponds to 60-180 BPM.
 *
 * Returns a number (BPM) or null if detection fails.
 * This runs in a Web Worker to avoid blocking the UI thread.
 */
export async function detectBPM(buffer: AudioBuffer): Promise<number | null> {
  // Implementation will use an OfflineAudioContext to process audio data
  // without playing it, then apply autocorrelation in a worker.
  // ...
}
```

### 4.5 downloadService.ts

```typescript
// src/services/downloadService.ts

const SERVER_BASE = 'http://localhost:3001';

export interface DownloadedTrack {
  videoId: string;
  title: string;
  channelTitle: string;
  duration: number;
  thumbnailUrl: string | null;
  audioUrl: string;
  downloadedAt: number;
  status: 'downloading' | 'ready' | 'error';
  error?: string;
}

/** List all downloaded tracks from the server manifest. */
export async function listDownloadedTracks(): Promise<DownloadedTrack[]> {
  const res = await fetch(`${SERVER_BASE}/api/tracks`);
  return res.json();
}

/** Initiate a download for a YouTube video. Returns immediately with status. */
export async function downloadTrack(params: {
  videoId: string;
  title: string;
  channelTitle: string;
  duration: number;
  thumbnailUrl: string | null;
}): Promise<DownloadedTrack> {
  const res = await fetch(`${SERVER_BASE}/api/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json();
}

/** Poll the download status of a specific video. */
export async function getDownloadStatus(
  videoId: string
): Promise<{ status: string; error?: string }> {
  const res = await fetch(`${SERVER_BASE}/api/tracks/${videoId}/status`);
  return res.json();
}

/** Fetch the audio file as an ArrayBuffer for decoding. */
export async function fetchAudioBuffer(videoId: string): Promise<ArrayBuffer> {
  const res = await fetch(`${SERVER_BASE}/api/audio/${videoId}`);
  return res.arrayBuffer();
}

/** Delete a downloaded track from the server. */
export async function deleteDownloadedTrack(videoId: string): Promise<void> {
  await fetch(`${SERVER_BASE}/api/tracks/${videoId}`, { method: 'DELETE' });
}
```

### 4.6 playerRegistry Changes

The existing `playerRegistry` is typed to `YT.Player`. It must be generalized to a common interface:

```typescript
// src/services/playerRegistry.ts (updated)

type DeckId = 'A' | 'B';

/**
 * Common player interface that both AudioEngine and YT.Player adapter satisfy.
 * Used by components that need imperative seek (HotCues, LoopControls, etc.).
 */
export interface DeckPlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
}

const registry = new Map<DeckId, DeckPlayer>();

export const playerRegistry = {
  register(deckId: DeckId, player: DeckPlayer): void {
    registry.set(deckId, player);
  },
  unregister(deckId: DeckId): void {
    registry.delete(deckId);
  },
  get(deckId: DeckId): DeckPlayer | undefined {
    return registry.get(deckId);
  },
};
```

The `AudioEngine` class will implement `DeckPlayer`. For backward compatibility during migration, a thin `YouTubePlayerAdapter` wraps `YT.Player` to satisfy the same interface.

---

## 5. Store Architecture Changes

### 5.1 deckStore.ts

**Key changes:**

1. Rename `videoId` to `trackId` throughout.
2. Rename `channelTitle` to `artist` throughout.
3. Add `sourceType`, `waveformPeaks`, `decoding` fields.
4. Change `loadTrack` signature:

```typescript
loadTrack: (
  deckId: 'A' | 'B',
  trackId: string,
  metadata: {
    sourceType: TrackSourceType;
    title: string;
    artist: string;
    duration: number;
    thumbnailUrl: string | null;
    waveformPeaks?: Float32Array;
    bpm?: number | null;
  },
  autoPlay?: boolean,
) => void;
```

5. EQ `setEq` action remains unchanged in signature but now drives real audio processing (the `useAudioEngine` hook subscribes to EQ changes and calls `audioEngine.setEQ()`).

### 5.2 playlistStore.ts

**Key changes:**

1. `loadDeckTrack` helper must adapt to the new `loadTrack` signature.
2. `addTrack` accepts the updated `PlaylistEntry` shape (with `sourceType`, `artist`, optional `videoId`, optional `file`).
3. When adding an MP3 track as the first entry, it must trigger decode + load rather than `cueVideoById`.

### 5.3 New: audioEngineStore.ts (optional, consider merging into deckStore)

After analysis, there is no need for a separate store. The `AudioEngine` instances are imperative objects (like `YT.Player`) and live in refs inside the `useAudioEngine` hook. Reactive state (currentTime, playbackState, EQ values, waveformPeaks) lives in `deckStore` where it already exists.

---

## 6. Hooks Architecture

### 6.1 useAudioEngine (new)

Replaces `useYouTubePlayer` as the primary playback hook for MP3-source tracks.

```typescript
// src/hooks/useAudioEngine.ts

/**
 * Manages an AudioEngine instance for a single deck.
 *
 * Responsibilities:
 * - Creates the AudioEngine on mount, registers it in playerRegistry.
 * - Subscribes to deckStore for: trackId, playbackState, pitchRate, volume, EQ changes.
 * - When a new MP3 track is loaded (trackId changes + sourceType === 'mp3'),
 *   decodes the audio file, extracts waveform, detects BPM, loads buffer.
 * - Polls getCurrentTime() via requestAnimationFrame for smooth waveform scrubbing.
 * - Handles loop boundary enforcement.
 * - Auto-advances playlist on track end.
 * - Destroys the engine on unmount.
 */
export function useAudioEngine(deckId: 'A' | 'B'): void;
```

### 6.2 useYouTubePlayer (modified)

Remains for YouTube-fallback mode only (when a YouTube track is played without a downloaded MP3). Behavior changes:

- Only activates when `sourceType === 'youtube'` AND no local audio is available.
- Muted and used purely for audio extraction fallback.
- Long-term, YouTube tracks always go through the download server, so this hook becomes a degraded fallback.

### 6.3 useDeckPlayer (new facade hook)

```typescript
// src/hooks/useDeckPlayer.ts

/**
 * Facade hook that selects the correct player hook based on the deck's sourceType.
 * Components call this instead of useAudioEngine/useYouTubePlayer directly.
 *
 * For sourceType === 'mp3': delegates to useAudioEngine.
 * For sourceType === 'youtube' (no downloaded audio): delegates to useYouTubePlayer.
 */
export function useDeckPlayer(deckId: 'A' | 'B'): void;
```

### 6.4 useFileDrop (new)

```typescript
// src/hooks/useFileDrop.ts

/**
 * Handles HTML5 drag-and-drop of OS files onto a drop zone element.
 *
 * Returns:
 * - dropRef: RefObject to attach to the drop zone element
 * - isDragOver: boolean for visual feedback
 *
 * When files are dropped:
 * 1. Filters for audio files (audio/mpeg, audio/mp3, audio/wav, etc.)
 * 2. For each valid file, creates a PlaylistEntry with sourceType: 'mp3'
 * 3. Adds entries to the target deck's playlist via playlistStore.addTrack()
 */
export function useFileDrop(deckId: 'A' | 'B'): {
  dropRef: React.RefObject<HTMLDivElement>;
  isDragOver: boolean;
};
```

---

## 7. Component Architecture Changes

### 7.1 Components to Remove

| Component/Element | Location | Reason |
|---|---|---|
| LOAD A / LOAD B buttons | `SearchResult.tsx` | Replaced by playlist-only workflow. Users add tracks to playlists, not directly to decks. |

### 7.2 Components to Modify

| Component | Changes |
|---|---|
| `SearchResult.tsx` | Remove LOAD A / LOAD B buttons. Rename +A/+B buttons to "Add A" / "Add B" (primary action). Add "Download" button for YouTube tracks (triggers server download). |
| `PlaylistPanel.tsx` | Add drop zone for OS file drag-and-drop. Add drag handles for reordering. Add drag-to-other-deck support. |
| `PlaylistTrack.tsx` | Add drag handle. Show source type icon (musical note for MP3, YouTube icon for YT). Show BPM if detected. |
| `EQPanel.tsx` | Remove "Visual Only" badge and tooltip. EQ now drives real audio processing for MP3 tracks. Keep visual-only note for YouTube-fallback tracks. |
| `Deck.tsx` | Add `WaveformDisplay` component between DeckDisplay and VinylPlatter. Update empty state text (remove "click LOAD" reference). |
| `DeckDisplay.tsx` | Show "artist" instead of "channelTitle". Show BPM from automatic detection (in addition to tap-tempo). |
| `YouTubePlayer.tsx` | Conditional rendering: only mount when the deck's sourceType is 'youtube' AND no downloaded audio. |
| `App.tsx` | Remove direct `dj-rusty:load-track` CustomEvent listener (track loading now goes through playlists exclusively). Initialize AudioContext on first user interaction. Mount `useDeckPlayer` hooks instead of raw YouTube players. |

### 7.3 New Components

| Component | File | Purpose |
|---|---|---|
| `WaveformDisplay` | `src/components/Deck/WaveformDisplay.tsx` | Canvas-based waveform visualization. Renders waveformPeaks from deckStore. Shows playback position cursor, loop region, hot cue markers. |
| `FileDropZone` | `src/components/Playlist/FileDropZone.tsx` | Visual drop zone overlay for OS file drag-and-drop onto a playlist. Shows "Drop MP3 files here" feedback. |
| `DownloadButton` | `src/components/Search/DownloadButton.tsx` | Button on YouTube search results that triggers a download via the Express server. Shows download progress status. |
| `DownloadedTracksPanel` | `src/components/Search/DownloadedTracksPanel.tsx` | New tab in SearchPanel showing all downloaded YouTube tracks available for offline use. |

### 7.4 Component Tree (Deck A, simplified)

```
App
  |-- useDeckPlayer('A')        // facade hook
  |-- useDeckPlayer('B')        // facade hook
  |-- DndContext                 // @dnd-kit context provider
  |
  +-- Deck (deckId="A")
  |     +-- DeckDisplay
  |     +-- WaveformDisplay      // NEW
  |     +-- VinylPlatter
  |     +-- DeckControls
  |     +-- HotCues
  |     +-- LoopControls
  |     +-- SlipButton
  |     +-- BeatJump
  |     +-- TapTempo
  |     +-- PitchSlider
  |     +-- EQPanel              // now functional for MP3
  |     +-- Volume fader
  |
  +-- Mixer
  |
  +-- Deck (deckId="B")
  |     +-- (same as A)
  |
  +-- SearchPanel
        +-- SearchBar
        +-- Tab: Search
        |     +-- SearchResultList
        |           +-- SearchResult  // no more LOAD A/B; +A/+B + Download
        +-- Tab: Recent
        +-- Tab: Playlist
        |     +-- PlaylistPanel
        |           +-- PlaylistDeckCol (A)
        |           |     +-- FileDropZone          // NEW
        |           |     +-- PlaylistTrack (draggable)
        |           +-- PlaylistDeckCol (B)
        |                 +-- FileDropZone          // NEW
        |                 +-- PlaylistTrack (draggable)
        +-- Tab: Downloads        // NEW
              +-- DownloadedTracksPanel
```

---

## 8. YouTube Download Flow

### 8.1 Flow Diagram

```
User searches YouTube in SearchPanel
    |
    v
SearchResult shows "Download" button for each result
    |
    v (user clicks Download)
    |
downloadService.downloadTrack(videoId, title, ...)
    |
    v
Express server POST /api/download
    |-- spawns yt-dlp -x --audio-format mp3
    |-- writes to server/downloads/{videoId}.mp3
    |-- updates manifest.json (status: downloading -> ready)
    |
    v (client polls /api/tracks/:videoId/status every 2s)
    |
When status === 'ready':
    |
    v
Track appears in "Downloads" tab
User can add downloaded track to any playlist (+A / +B)
    |
    v (when added to playlist and selected for playback)
    |
downloadService.fetchAudioBuffer(videoId)
    |-- GET /api/audio/{videoId} -> ArrayBuffer
    |
    v
audioDecoder.decodeAudioFile(arrayBuffer) -> AudioBuffer
    |
    v
waveformAnalyzer.extractWaveformPeaks(buffer) -> Float32Array
bpmDetector.detectBPM(buffer) -> number | null
    |
    v
audioEngine.loadBuffer(buffer)
audioEngine.play()
```

### 8.2 Caching Strategy

- **Server-side**: Downloaded MP3 files persist in `server/downloads/` indefinitely. The manifest.json tracks metadata.
- **Client-side**: Decoded `AudioBuffer` objects are held in memory while a track is loaded in a deck. They are not persisted to IndexedDB in v1 (too large, and re-decode is fast).
- **Waveform peaks** could be cached in IndexedDB keyed by trackId for instant redisplay. Consider for v2.

---

## 9. Drag-and-Drop Architecture

### 9.1 Library Choice

Use **@dnd-kit/core** + **@dnd-kit/sortable** for in-app drag-and-drop (reordering within playlists, moving between playlists). Use native **HTML5 Drag and Drop API** for OS file drops (because @dnd-kit does not handle OS file drags).

### 9.2 Drop Zones

1. **OS File Drop (HTML5 native)**
   - Target: Each PlaylistPanel deck column
   - Events: `dragenter`, `dragover`, `dragleave`, `drop`
   - On drop: Read `event.dataTransfer.files`, filter for audio MIME types, create PlaylistEntry objects, add to playlist
   - Visual: Semi-transparent overlay with "Drop MP3 files here" text

2. **In-App Track Drag (@dnd-kit)**
   - Source: Each PlaylistTrack row (draggable)
   - Targets: PlaylistPanel deck columns (droppable), PlaylistTrack rows (sortable)
   - Data: `{ entryId: string, sourceDeckId: 'A' | 'B', index: number }`
   - Operations:
     - **Reorder within same playlist**: SortableContext handles this. On `onDragEnd`, reorder the array in playlistStore.
     - **Move to other playlist**: When dropped on the other deck's column, remove from source playlist and add to target.

### 9.3 DnD Context Hierarchy

```
<DndContext onDragEnd={handleDragEnd} sensors={sensors}>
  <SortableContext items={playlistAIds} strategy={verticalListSortingStrategy}>
    <PlaylistDeckColumn deckId="A">
      {playlistA.map(entry => <SortablePlaylistTrack key={entry.id} ... />)}
    </PlaylistDeckColumn>
  </SortableContext>

  <SortableContext items={playlistBIds} strategy={verticalListSortingStrategy}>
    <PlaylistDeckColumn deckId="B">
      {playlistB.map(entry => <SortablePlaylistTrack key={entry.id} ... />)}
    </PlaylistDeckColumn>
  </SortableContext>

  <DragOverlay>
    {activeTrack && <PlaylistTrackDragPreview entry={activeTrack} />}
  </DragOverlay>
</DndContext>
```

### 9.4 playlistStore Additions

```typescript
// New actions on playlistStore:

/** Reorder a track within the same playlist (drag-to-sort). */
reorderTrack(deckId: 'A' | 'B', fromIndex: number, toIndex: number): void;

/** Move a track from one deck's playlist to another. */
moveTrack(fromDeckId: 'A' | 'B', toDeckId: 'A' | 'B', entryId: string): void;

/** Add multiple tracks at once (for OS file drop with multiple files). */
addTracks(deckId: 'A' | 'B', entries: Omit<PlaylistEntry, 'id'>[]): void;
```

---

## 10. MP3-Enabled Features

### 10.1 Features for This Project

| Feature | Description | Implementation |
|---|---|---|
| **EQ (3-band)** | Low/Mid/High shelf/peak filters | BiquadFilterNodes in AudioEngine signal chain. Already have UI knobs; wire to real audio. |
| **Waveform Display** | Visual waveform bar chart with playback cursor | New `WaveformDisplay` canvas component. Data from `extractWaveformPeaks()`. |
| **BPM Detection** | Automatic BPM analysis on load | `detectBPM()` service using autocorrelation. Result stored in deckStore.bpm. |
| **Cue Points** | Set/recall positions in the track | Already implemented as HotCues. No change needed -- they work on any `seek()` call. |

### 10.2 Features Deferred to Future

| Feature | Reason for Deferral |
|---|---|
| **Key Detection** | Requires pitch detection algorithm (complex DSP); not critical for MVP. |
| **Beatgrid / Quantized Loops** | Depends on accurate BPM + downbeat detection; needs iterative refinement. |
| **Effects (reverb, delay, flanger)** | Requires additional Web Audio nodes; scope creep for this project. |
| **Recording / Mix Export** | Requires MediaRecorder + AudioContext.createMediaStreamDestination(); separate feature. |
| **Crossfade Automation** | Automatic crossfade between tracks; nice-to-have but not core to MP3 support. |
| **ID3 Tag Parsing** | Reading artist/title/album art from MP3 metadata; use a library like music-metadata-browser. Defer to polish phase. |

---

## 11. Migration Strategy

### 11.1 Phased Approach

**Phase 1: Audio Engine Foundation**
- Implement `AudioEngine`, `audioContext`, `audioDecoder`, `waveformAnalyzer`
- Implement `useAudioEngine` hook
- Generalize `playerRegistry` to `DeckPlayer` interface
- Update `DeckState` type (rename videoId -> trackId, channelTitle -> artist, add new fields)
- Update `deckStore` and `playlistStore` for new data model

**Phase 2: MP3 Playback**
- Implement OS file drag-and-drop (HTML5 native)
- Wire EQ knobs to actual BiquadFilterNodes
- Build WaveformDisplay component
- Implement BPM detection
- Remove LOAD A/B buttons from SearchResult

**Phase 3: YouTube Download Integration**
- Build `downloadService` client
- Add Download button to SearchResult
- Add Downloads tab to SearchPanel
- Wire downloaded YouTube tracks through the same AudioEngine

**Phase 4: Drag-and-Drop Polish**
- Add @dnd-kit for in-app playlist reordering and cross-deck moves
- Add FileDropZone visual component

### 11.2 Backward Compatibility

During migration:
- The YouTube IFrame players remain mounted and functional
- `useYouTubePlayer` continues to work for YouTube-source tracks
- Both playback paths coexist: old (IFrame) and new (Web Audio)
- `useDeckPlayer` facade routes to the correct engine based on `sourceType`
- The `playerRegistry` accepts both `AudioEngine` and `YouTubePlayerAdapter`

### 11.3 Risk Mitigation

| Risk | Mitigation |
|---|---|
| AudioContext not resuming (browser autoplay policy) | Call `ensureAudioContextResumed()` on first user interaction (click/keypress). |
| Large MP3 files causing OOM when decoded | AudioBuffer for a 10-min 320kbps MP3 is ~100MB PCM. This is fine for desktop browsers. Add a file size warning for files > 200MB. |
| yt-dlp not installed on user's machine | Server already handles this gracefully (ENOENT error). Show clear "Install yt-dlp" instructions in the Downloads tab. |
| Web Worker for BPM detection | If Web Workers are unavailable, fall back to main-thread detection with a loading indicator. |

---

## 12. External Integrations

| System | Purpose | Interface |
|---|---|---|
| YouTube Data API v3 | Search videos, list channel content | REST (existing `youtubeDataApi.ts`) |
| YouTube IFrame API | Fallback audio playback for non-downloaded YT tracks | IFrame embed (existing `useYouTubePlayer`) |
| Google Identity Services | OAuth 2.0 for YouTube API access | JS SDK (existing `authService.ts`) |
| Express Server (localhost:3001) | yt-dlp download proxy, audio file serving | REST (existing `server/index.js`) |
| Web Audio API | Primary audio engine for MP3 and decoded tracks | Browser API (new) |

---

## 13. Architecture Principles

1. **MP3-first, YouTube-supported**: Local MP3 files are the primary use case. YouTube is a content source that downloads to MP3 before playback.
2. **Unified audio path**: Both MP3 and downloaded YouTube audio flow through the same Web Audio API engine, ensuring consistent behavior for EQ, waveform, BPM, and all features.
3. **Incremental migration**: The YouTube IFrame player is not removed; it becomes a fallback. No big-bang rewrite.
4. **State in Zustand, imperative objects in refs**: AudioEngine instances (like YT.Player before them) are imperative and live in React refs. Reactive state (position, playback state, EQ) lives in Zustand stores.
5. **Separation of concerns**: Services are pure logic (audioEngine, audioDecoder, bpmDetector). Hooks are React bridges. Stores are state containers. Components are UI.
6. **Progressive enhancement**: Features degrade gracefully. No AudioContext? YouTube IFrame still works. No yt-dlp? User can still drag local MP3s.
7. **No cloud dependencies for MP3**: Local MP3 playback works without internet, without authentication, without the Express server.

---

## 14. New Dependencies

| Package | Purpose | Size |
|---|---|---|
| `@dnd-kit/core` | Drag-and-drop primitives | ~30KB |
| `@dnd-kit/sortable` | Sortable list behavior | ~10KB |
| `@dnd-kit/utilities` | DnD utilities | ~5KB |

No other new npm dependencies are required. The Web Audio API, File API, and HTML5 Drag and Drop API are all browser-native. BPM detection and waveform analysis are implemented from scratch (no external DSP libraries needed for the algorithms used).

---

## 15. File Structure (New/Changed)

```
src/
  services/
    audioEngine.ts          NEW - Web Audio playback engine
    audioContext.ts          NEW - AudioContext singleton
    audioDecoder.ts          NEW - File/ArrayBuffer -> AudioBuffer
    waveformAnalyzer.ts      NEW - AudioBuffer -> waveform peaks
    bpmDetector.ts           NEW - AudioBuffer -> BPM
    downloadService.ts       NEW - Express server API client
    playerRegistry.ts        MODIFIED - generalized to DeckPlayer interface
    youtubeIframeApi.ts      UNCHANGED
    youtubeDataApi.ts        UNCHANGED
    authService.ts           UNCHANGED

  hooks/
    useAudioEngine.ts        NEW - Web Audio engine lifecycle hook
    useDeckPlayer.ts         NEW - facade selecting audio engine or YT player
    useFileDrop.ts           NEW - OS file drag-and-drop hook
    useYouTubePlayer.ts      MODIFIED - fallback only for non-downloaded YT
    useTapTempo.ts           UNCHANGED
    useCrossfade.ts          UNCHANGED
    useSearchPreload.ts      UNCHANGED
    useAuth.ts               UNCHANGED
    useKeyboardShortcuts.ts  UNCHANGED

  types/
    track.ts                 NEW - Track, TrackSourceType types
    playlist.ts              MODIFIED - updated PlaylistEntry
    deck.ts                  MODIFIED - updated DeckState
    search.ts                UNCHANGED
    auth.ts                  UNCHANGED
    mixer.ts                 UNCHANGED

  store/
    deckStore.ts             MODIFIED - new fields, renamed fields
    playlistStore.ts         MODIFIED - new actions, updated types
    mixerStore.ts            MODIFIED - volume routing to AudioEngine
    authStore.ts             UNCHANGED
    searchStore.ts           UNCHANGED
    settingsStore.ts         UNCHANGED

  components/
    Deck/
      WaveformDisplay.tsx    NEW - canvas waveform visualization
      WaveformDisplay.module.css  NEW
      EQPanel.tsx            MODIFIED - remove "visual only" badge
      Deck.tsx               MODIFIED - add WaveformDisplay, update empty state
      DeckDisplay.tsx        MODIFIED - show artist instead of channelTitle
      YouTubePlayer.tsx      MODIFIED - conditional mount
      (all others)           UNCHANGED or minor prop name updates

    Playlist/
      FileDropZone.tsx       NEW - drop zone overlay component
      FileDropZone.module.css  NEW
      PlaylistPanel.tsx      MODIFIED - add drop zones, DnD context
      PlaylistTrack.tsx      MODIFIED - draggable, source type icon

    Search/
      SearchResult.tsx       MODIFIED - remove LOAD A/B, add Download btn
      DownloadButton.tsx     NEW - download trigger with status
      DownloadedTracksPanel.tsx  NEW - list of downloaded tracks
      SearchPanel.tsx        MODIFIED - add Downloads tab
```
