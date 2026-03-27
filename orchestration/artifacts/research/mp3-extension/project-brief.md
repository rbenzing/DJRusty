# Project Brief — MP3 Extension

**Project Name:** mp3-extension
**Date:** 2026-03-25
**Status:** Research Phase — In Progress

---

## Goal

Extend DJRusty from a YouTube-only DJ app to a hybrid MP3-first / YouTube-supported DJ platform, unlocking a full suite of Serato-like audio features previously impossible with streamed video.

---

## User Request Summary

1. **MP3 as default playback** — play local MP3 files by default instead of YouTube videos
2. **YouTube still supported** — download videos from authenticated channel via YouTube Data API + OAuth token; play as audio
3. **MP3 feature expansion** — research and implement everything possible with direct MP3 access (EQ, waveform, BPM analysis, cue points, etc.)
4. **Drag & drop** — drag MP3 files into playlists; drag tracks between Deck A / Deck B playlists
5. **UI cleanup:**
   - Remove "Load A" / "Load B" buttons → replace with "Add to Playlist A" / "Add to Playlist B"
   - Remove A+ / B+ buttons (duplicates of the above)

---

## Agent Assessment

| Agent | Involvement | Justification |
|---|---|---|
| **Researcher** | Full | New tech domain (Web Audio API, MP3 drag-drop, YT OAuth download); requirements need full exploration |
| **Architect** | Full | New audio engine alongside existing YT player; dual-source architecture; data model changes |
| **UI Designer** | Full | Drag-drop UI, waveform display, EQ controls, playlist UI changes; significant component redesign |
| **Planner** | Full | Multi-story breakdown across audio engine, YT integration, UI overhaul, new features |
| **Developer** | Full | Substantial new code: audio engine, YT downloader, drag-drop, EQ, waveform |
| **Code Reviewer** | Full | All new/modified source code must be reviewed |
| **Tester** | Full | All new functionality must be validated |

**Workflow Mode: A (Full)**

---

## Success Criteria

- [ ] MP3 files load and play in both decks
- [ ] YouTube videos still load (downloaded via OAuth API) and play as audio
- [ ] Waveform displayed for MP3 tracks
- [ ] BPM detected for MP3 tracks
- [ ] EQ (low/mid/high) controls work on MP3 audio
- [ ] Drag MP3 file from OS file explorer into Deck A or Deck B playlist
- [ ] Drag tracks between Deck A and Deck B playlists
- [ ] Load A / Load B removed; replaced with playlist add action
- [ ] A+ / B+ buttons removed
- [ ] Auto-advance still works
- [ ] No regressions on existing functionality

---

## Constraints

- Existing tech stack: React + TypeScript + Vite + Zustand
- Must not break existing YouTube playback while migrating to MP3-first
- OAuth token for YouTube is user-managed (already in auth system)
- Target: desktop Electron or web browser (TBD — researcher to confirm)

---

## Out of Scope

- Mobile support
- Cloud storage of MP3 files
- Serato hardware integration

