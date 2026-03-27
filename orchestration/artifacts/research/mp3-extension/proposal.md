# Proposal — MP3 Extension

**Project:** mp3-extension
**Date:** 2026-03-25
**Phase:** Research

---

## Why We're Doing This

DJRusty currently plays audio exclusively through the YouTube IFrame API. Because the player runs inside a cross-origin `<iframe>`, the browser's Web Audio API cannot access the audio stream. This has forced all audio-processing features — EQ, waveform visualization, BPM detection, real loop enforcement — to be either absent or visual-only placeholders. The EQ knobs in the current UI are explicitly labelled "Visual Only" for this reason.

By adding direct MP3 file support the application can own the audio pipeline through the Web Audio API, enabling a full Serato-like feature set. YouTube support is preserved by routing downloaded YouTube audio (via the existing `server/` Express process that already uses `yt-dlp`) through the same MP3/Web Audio pipeline.

---

## What's Changing

| Area | Before | After |
|---|---|---|
| Primary audio source | YouTube IFrame embedded player | Local MP3 files via Web Audio API |
| YouTube support | IFrame streaming | Download to MP3 via existing `server/` + `yt-dlp` → plays via Web Audio API |
| EQ | Visual-only knobs (no audio effect) | Functional BiquadFilterNode chains (Low / Mid / High) |
| Waveform | Not present | Canvas-rendered waveform from decoded AudioBuffer |
| BPM | Manual tap-tempo only | Automatic BPM detection on load + tap-tempo override |
| Cue points | Stored as timestamps, seek via YT API | Stored as timestamps, seek via AudioBufferSourceNode offset |
| Hot cues | 8 stored timestamps per videoId | 8 stored timestamps per trackId (video or file) |
| Loops | Enforced by 250ms poll + seekTo | Native AudioBufferSourceNode loopStart / loopEnd (sample-accurate) |
| Playlist entry | `videoId` + YouTube metadata | Extended with `sourceType`, `filePath`, `audioUrl` fields |
| Load A / Load B | Buttons in SearchResult component | Removed; replaced with "Add to Playlist A/B" |
| A+ / B+ buttons | Separate queue buttons in SearchResult | Merged into "Add to Playlist A/B" (+ buttons removed) |
| In-app drag | Not present | Drag track between Deck A and Deck B playlist panels |
| File drag-drop | Not present | OS file drag into deck playlist area |

---

## Migration Context

- **Source:** YouTube IFrame API single-source playback
- **Target:** Web Audio API dual-source playback (local MP3 + downloaded YouTube MP3)
- **Migration Type:** Feature expansion with backwards compatibility; YouTube playlists continue to work during transition

---

## Goals

1. Play local MP3 files in both decks via the browser's Web Audio API.
2. Preserve YouTube playback by routing downloaded YouTube audio through the same Web Audio pipeline.
3. Enable functional EQ (3-band BiquadFilterNode) on all MP3 audio.
4. Display a waveform for MP3 tracks rendered from the decoded AudioBuffer.
5. Detect BPM automatically on track load.
6. Support cue points, hot cues, and sample-accurate loops through Web Audio API primitives.
7. Enable OS file drag-and-drop into deck playlist areas.
8. Enable in-app drag of tracks between Deck A and Deck B playlist panels.
9. Remove the "LOAD A" / "LOAD B" buttons and the "+A" / "+B" buttons from SearchResult.
10. Extend the download server (`server/index.js`) to serve library management endpoints that the frontend can poll.

---

## Success Criteria

- [ ] MP3 files load and play in both decks via Web Audio API
- [ ] YouTube video audio downloaded via `server/` yt-dlp endpoint and plays in both decks
- [ ] EQ knobs (Low/Mid/High) have audible effect on MP3 audio
- [ ] Waveform visualization rendered for MP3 tracks
- [ ] BPM auto-detected on MP3 track load; displayed in BpmDisplay
- [ ] Cue points and 8 hot cues work for MP3 tracks
- [ ] Sample-accurate loops enforce via AudioBufferSourceNode loopStart/loopEnd
- [ ] OS file drag-and-drop adds track to Deck A or Deck B playlist
- [ ] In-app drag moves / copies track between Deck A and Deck B playlists
- [ ] "LOAD A" / "LOAD B" buttons removed from SearchResult
- [ ] "+A" / "+B" buttons removed from SearchResult
- [ ] Auto-advance (skipToNext on track end) still works for MP3 tracks
- [ ] Pitch / playback rate control works on MP3 tracks
- [ ] No regressions on existing YouTube search, authentication, hot cues, loops, slip mode, beat sync

---

## Out of Scope

- Mobile browser support
- Cloud storage of MP3 files
- Serato hardware controller integration
- Key detection / key lock (phase vocoder) — deferred to a future phase
- Scratch simulation — deferred
- Reverb / convolution FX — deferred
- Gain normalization / auto-gain — deferred
- Streaming YouTube audio directly without download (against YouTube ToS and technically unreliable)
