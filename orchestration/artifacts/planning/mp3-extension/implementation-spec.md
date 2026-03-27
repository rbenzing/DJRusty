# Implementation Specification -- MP3 Extension

**Project:** mp3-extension
**Phase:** Planning
**Date:** 2026-03-25

---

## 1. TypeScript Interface Changes

### 1.1 PlaylistEntry (src/types/playlist.ts)

**Current:**
```typescript
export interface PlaylistEntry {
  id: string;
  videoId: string;
  title: string;
  channelTitle: string;
  duration: number;
  thumbnailUrl: string | null;
}
```

**Target:**
```typescript
export type TrackSourceType = 'mp3' | 'youtube';

export interface PlaylistEntry {
  id: string;
  sourceType: TrackSourceType;
  title: string;
  artist: string;              // renamed from channelTitle
  duration: number;
  thumbnailUrl: string | null;
  videoId?: string;            // optional, only for youtube
  file?: File;                 // only for local mp3
  audioUrl?: string;           // blob URL (local) or server URL (downloaded youtube)
}
```

**Breaking change sites:**
- `playlistStore.ts` -- `addTrack`, `loadDeckTrack`, everywhere `entry.videoId` or `entry.channelTitle` is referenced
- `PlaylistTrack.tsx` -- reads `entry.channelTitle` (line 56)
- `SearchPanel.tsx` -- constructs PlaylistEntry objects when calling `addTrack`
- `SearchResult.tsx` -- uses `onQueueToDeck` which eventually constructs entries
- All tests referencing `PlaylistEntry`

### 1.2 DeckState (src/types/deck.ts)

**Fields to rename:**
- `videoId: string | null` -> `trackId: string | null`
- `channelTitle: string` -> `artist: string`

**Fields to add:**
```typescript
sourceType: TrackSourceType | null;   // null when no track loaded
waveformPeaks: Float32Array | null;   // null until waveform analyzed
decoding: boolean;                    // true while AudioBuffer is being decoded
bpmDetecting: boolean;               // true while BPM analysis is running
```

**Impact:** Every file that reads `deck.videoId` or `deck.channelTitle` must be updated. Key files:
- `deckStore.ts` -- `createInitialDeckState`, `loadTrack`, `clearTrack`
- `Deck.tsx` -- `hasTrack` check uses `videoId !== null` (change to `trackId`)
- `DeckDisplay.tsx` -- reads `channelTitle`
- `DeckControls.tsx` -- may reference `videoId` for hot cue keying
- `SearchResult.tsx` -- reads `deckAVideoId` / `deckBVideoId` for "Now Playing" badges
- `useYouTubePlayer.ts` -- subscribes to `videoId` changes

### 1.3 DeckPlayer Interface (src/services/playerRegistry.ts)

**New common interface:**
```typescript
export interface DeckPlayer {
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
}
```

**Registry changes:**
```typescript
const registry = new Map<DeckId, DeckPlayer>();
// register, unregister, get signatures stay the same but typed to DeckPlayer
```

**YouTubePlayerAdapter:**
```typescript
export class YouTubePlayerAdapter implements DeckPlayer {
  constructor(private player: YT.Player) {}
  seekTo(seconds: number, allowSeekAhead = true): void {
    this.player.seekTo(seconds, allowSeekAhead);
  }
  getCurrentTime(): number {
    return this.player.getCurrentTime();
  }
  getDuration(): number {
    return this.player.getDuration();
  }
}
```

### 1.4 AudioEngine Interface (src/services/audioEngine.ts)

```typescript
export interface AudioEngineOptions {
  deckId: 'A' | 'B';
  context: AudioContext;
}

export interface AudioEngine extends DeckPlayer {
  readonly deckId: 'A' | 'B';
  loadBuffer(buffer: AudioBuffer): void;
  play(offsetSeconds?: number): void;
  pause(): void;
  stop(): void;
  seek(seconds: number): void;
  setPlaybackRate(rate: number): void;
  setVolume(volume: number): void;
  setEQ(band: 'low' | 'mid' | 'high', gainDb: number): void;
  getAnalyser(): AnalyserNode;
  isReady(): boolean;
  isPlaying(): boolean;
  onEnded(callback: () => void): void;
  destroy(): void;
}
```

---

## 2. AudioEngine Class Design

### 2.1 Internal State

```typescript
class AudioEngineImpl implements AudioEngine {
  readonly deckId: 'A' | 'B';
  private context: AudioContext;
  private gainNode: GainNode;
  private eqLow: BiquadFilterNode;
  private eqMid: BiquadFilterNode;
  private eqHigh: BiquadFilterNode;
  private analyser: AnalyserNode;
  private sourceNode: AudioBufferSourceNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private playing = false;
  private startedAt = 0;        // AudioContext.currentTime when playback started
  private seekOffset = 0;       // Offset in seconds from start of track
  private playbackRate = 1.0;
  private endedCallback: (() => void) | null = null;
}
```

### 2.2 Signal Chain Setup (constructor)

```
AudioBufferSourceNode (created per play/seek)
  -> gainNode (persistent)
  -> eqLow BiquadFilterNode (lowshelf, 320 Hz) (persistent)
  -> eqMid BiquadFilterNode (peaking, 1000 Hz, Q: 0.7) (persistent)
  -> eqHigh BiquadFilterNode (highshelf, 3200 Hz) (persistent)
  -> analyser AnalyserNode (persistent)
  -> context.destination
```

### 2.3 Play/Pause/Seek Pattern

**play(offset?):**
1. Call `ensureAudioContextResumed()`.
2. If a sourceNode exists, stop and disconnect it.
3. Create new `AudioBufferSourceNode`, set `buffer`, `playbackRate.value`.
4. Connect to gainNode.
5. If loop active: set `loop = true`, `loopStart`, `loopEnd`.
6. Set `onended` handler (only fires when not manually stopped).
7. Call `sourceNode.start(0, offset ?? seekOffset)`.
8. Record `startedAt = context.currentTime`, `seekOffset = offset ?? seekOffset`.
9. Set `playing = true`.

**pause():**
1. Compute `seekOffset = getCurrentTime()`.
2. Stop and disconnect sourceNode. Set to null.
3. Set `playing = false`.

**seek(seconds):**
1. Compute new offset.
2. If playing: stop current, create new node, start at new offset.
3. If paused: just update `seekOffset`.

**getCurrentTime():**
```typescript
if (!playing) return seekOffset;
return seekOffset + (context.currentTime - startedAt) * playbackRate;
```

---

## 3. Store Changes

### 3.1 deckStore.ts

**loadTrack signature change:**
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

**New actions to add:**
```typescript
setDecoding: (deckId: 'A' | 'B', decoding: boolean) => void;
setBpmDetecting: (deckId: 'A' | 'B', detecting: boolean) => void;
setWaveformPeaks: (deckId: 'A' | 'B', peaks: Float32Array | null) => void;
setSourceType: (deckId: 'A' | 'B', sourceType: TrackSourceType | null) => void;
```

**Internal changes:**
- All references to `videoId` field renamed to `trackId`
- All references to `channelTitle` field renamed to `artist`
- `createInitialDeckState` adds `sourceType: null`, `waveformPeaks: null`, `decoding: false`, `bpmDetecting: false`
- `clearTrack` resets all new fields
- `getHotCues(videoId)` call in `loadTrack` changes to `getHotCues(trackId)`

### 3.2 playlistStore.ts

**loadDeckTrack change:**
```typescript
function loadDeckTrack(deckId: 'A' | 'B', entry: PlaylistEntry, autoPlay: boolean): void {
  useDeckStore.getState().loadTrack(
    deckId,
    entry.videoId ?? entry.id,  // trackId
    {
      sourceType: entry.sourceType,
      title: entry.title,
      artist: entry.artist,
      duration: entry.duration,
      thumbnailUrl: entry.thumbnailUrl,
    },
    autoPlay,
  );
}
```

**New actions:**
```typescript
reorderTrack: (deckId: 'A' | 'B', fromIndex: number, toIndex: number) => void;
moveTrackToDeck: (fromDeck: 'A' | 'B', toDeck: 'A' | 'B', entryId: string) => void;
```

---

## 4. New Files to Create

### Services
| File | Purpose |
|---|---|
| `src/services/audioContext.ts` | Shared AudioContext singleton + `ensureAudioContextResumed()` |
| `src/services/audioEngine.ts` | AudioEngine class implementation |
| `src/services/audioDecoder.ts` | `decodeAudioFile(source: File | ArrayBuffer): Promise<AudioBuffer>` |
| `src/services/waveformAnalyzer.ts` | `extractWaveformPeaks(buffer: AudioBuffer, points?: number): Float32Array` |
| `src/services/bpmDetector.ts` | `detectBPM(buffer: AudioBuffer): Promise<number | null>` |
| `src/services/downloadService.ts` | Client-side API for Express download server |

### Hooks
| File | Purpose |
|---|---|
| `src/hooks/useAudioEngine.ts` | Bridges AudioEngine to deckStore per deck |
| `src/hooks/useDeckPlayer.ts` | Facade selecting AudioEngine vs YouTube player |
| `src/hooks/useFileDrop.ts` | OS file drag-and-drop handling |

### Components
| File | Purpose |
|---|---|
| `src/components/Deck/WaveformDisplay.tsx` | Canvas waveform visualization |
| `src/components/Deck/WaveformDisplay.module.css` | Waveform styles |
| `src/components/Playlist/DropZone.tsx` | File drop zone wrapper |
| `src/components/Playlist/DropZone.module.css` | Drop zone styles |
| `src/components/Search/DownloadButton.tsx` | YouTube download trigger button |
| `src/components/Search/DownloadedTracksPanel.tsx` | Downloaded tracks library tab |

### Workers
| File | Purpose |
|---|---|
| `src/workers/bpmWorker.ts` | Web Worker for BPM detection off main thread |

---

## 5. Files to Modify

### Types
| File | Changes |
|---|---|
| `src/types/playlist.ts` | Add `TrackSourceType`, restructure `PlaylistEntry` |
| `src/types/deck.ts` | Rename `videoId`->`trackId`, `channelTitle`->`artist`, add new fields |

### Stores
| File | Changes |
|---|---|
| `src/store/deckStore.ts` | Rename fields, new actions, update `loadTrack` signature |
| `src/store/playlistStore.ts` | Update `loadDeckTrack`, add `reorderTrack`/`moveTrackToDeck` |

### Services
| File | Changes |
|---|---|
| `src/services/playerRegistry.ts` | Add `DeckPlayer` interface, change `Map` type, add `YouTubePlayerAdapter` |

### Hooks
| File | Changes |
|---|---|
| `src/hooks/useYouTubePlayer.ts` | Wrap in `YouTubePlayerAdapter` for registry, subscribe to `trackId` instead of `videoId`, only activate for youtube source type |

### Components
| File | Changes |
|---|---|
| `src/components/Deck/Deck.tsx` | Add `WaveformDisplay`, update `hasTrack` check (`trackId`), update empty state text |
| `src/components/Deck/DeckDisplay.tsx` | Read `artist` instead of `channelTitle`, add BPM detecting spinner |
| `src/components/Deck/EQPanel.tsx` | Remove "Visual Only" badge and CSS class, update aria-labels |
| `src/components/Deck/HotCues.tsx` | Use `trackId` for hot cue storage key |
| `src/components/Search/SearchResult.tsx` | Remove LOAD A/B buttons, remove `onLoadToDeck` prop, widen +A/+B buttons |
| `src/components/Search/SearchResultList.tsx` | Remove `onLoadToDeck` prop threading |
| `src/components/Search/SearchPanel.tsx` | Remove `handleLoadToDeck`, remove `onLoadToDeck` prop, add Downloads tab |
| `src/components/Playlist/PlaylistPanel.tsx` | Wrap deck columns in `DropZone`, add file picker button, update empty state text |
| `src/components/Playlist/PlaylistTrack.tsx` | Read `artist` instead of `channelTitle`, add source type badge, add drag handle |
| `src/App.tsx` | Remove `dj-rusty:load-track` listener, initialize AudioContext on first interaction, mount `useDeckPlayer` hooks |

### Styles
| File | Changes |
|---|---|
| `src/index.css` | Add waveform and drop zone CSS custom property tokens |
| `src/components/Search/SearchResult.module.css` | Remove `.loadBtn` classes, widen `.saveBtn` |
| `src/components/Deck/EQPanel.module.css` | Remove `.v1Badge` class |
| `src/components/Playlist/PlaylistTrack.module.css` | Add drag handle, source badge, move button styles |
| `src/components/Playlist/PlaylistPanel.module.css` | Add file picker button styles |

### Utilities
| File | Changes |
|---|---|
| `src/utils/hotCues.ts` | Accept `trackId: string` instead of `videoId: string` |

---

## 6. Dependencies to Add

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "bpm-detective": "^5.0.0"
  }
}
```

Web Audio API, File API, HTML5 Drag and Drop, and Web Workers are all browser built-in -- no packages needed.

---

## 7. Implementation Order and Dependencies

```
Phase 1 (Foundation):
  mp3-001 -> mp3-002 -> mp3-003

Phase 2 (Core Playback -- parallel after mp3-003):
  mp3-004 (file picker)
  mp3-005 (OS drag-drop)
  mp3-006 (playback controls) -> mp3-007 (auto-advance)

Phase 3 (Audio Features -- parallel after mp3-003):
  mp3-008 (waveform)
  mp3-009 (EQ)
  mp3-010 (BPM)

Phase 4 (YouTube Download -- after mp3-003):
  mp3-012 -> mp3-013

Phase 5 (UI Cleanup -- mp3-011 after mp3-001, mp3-014 after mp3-005):
  mp3-011 (remove Load A/B)
  mp3-014 (cross-deck drag)
```

---

## 8. Testing Strategy

### Unit Tests
- AudioEngine: play/pause/seek lifecycle, position tracking, EQ parameter setting, loop enforcement, playback rate
- audioDecoder: mock AudioContext.decodeAudioData, verify File and ArrayBuffer paths
- waveformAnalyzer: verify peak extraction from a known Float32Array
- bpmDetector: verify BPM detection returns a number in the 60-200 range for a known signal
- downloadService: mock fetch responses for all endpoints
- playlistStore: verify addTrack with mp3 sourceType, reorderTrack, moveTrackToDeck
- deckStore: verify new fields, loadTrack with new signature

### Integration Tests
- Load MP3 file via file picker -> appears in playlist -> loads in deck -> playback starts
- Drop MP3 file onto deck B column -> appears in deck B playlist
- YouTube search result -> add to playlist -> download initiated -> download completes -> track plays via Web Audio
- EQ knob drag -> BiquadFilterNode gain updates
- Track ends -> auto-advance to next track in playlist

### Component Tests
- WaveformDisplay: renders canvas, shows loading state, click-to-seek dispatches onSeek
- DropZone: shows valid/invalid drag states, rejects non-MP3 files
- SearchResult: no LOAD A/B buttons present, +A/+B buttons work
- PlaylistTrack: shows source type badge, drag handle visible on hover
