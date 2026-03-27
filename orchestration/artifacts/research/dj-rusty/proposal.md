# Proposal

> Project: `dj-rusty`

## Why We're Doing This

DJs and music enthusiasts want a browser-based mixing experience that lets them spin, blend, and crossfade between YouTube tracks without needing expensive hardware or installed software. This project delivers a professional-grade DJ interface in the browser, authenticated with the user's Google account for seamless YouTube library access.

## What We're Building

A single-page web application that mimics a **Numark MP3-style dual-deck DJ controller**:
- Two virtual turntable decks (A and B) with spinning vinyl animation
- YouTube video playback on each deck via the IFrame API
- Crossfader and per-deck volume mixing
- Google SSO login + YouTube channel/library browsing
- BPM display (tap-tempo) and pitch rate adjustment
- Visual EQ knobs and effects controls

## Goals

1. Deliver a realistic, professional-looking DJ interface in the browser
2. Enable authenticated YouTube video search and playback on two simultaneous decks
3. Support crossfading and volume control between decks using YouTube IFrame API's native volume methods
4. Provide Google SSO login with YouTube read-only scope
5. Allow users to browse their own YouTube channel uploads and search YouTube

## Success Criteria

- [ ] User can log in with Google SSO and access their YouTube account
- [ ] User can search YouTube and load videos onto Deck A or Deck B
- [ ] Both decks play simultaneously in desktop Chrome/Firefox/Edge
- [ ] Crossfader smoothly adjusts relative volume between decks (0–100 on each player)
- [ ] Vinyl platter animates (spins when playing, pauses when stopped)
- [ ] BPM is displayable via tap-tempo input
- [ ] Pitch can be adjusted to nearest available YouTube playback rate (0.25–2×)
- [ ] UI is dark-themed and visually resembles professional DJ software
- [ ] YouTube player attribution and branding requirements are met (ToS compliant)

## Out of Scope

- Mobile / iOS support (iOS enforces single-audio-source restriction)
- True Web Audio API EQ / effects processing on YouTube audio (blocked by cross-origin CORS — see technical-constraints.md)
- Audio recording or export
- Downloading or caching YouTube media streams (ToS violation)
- BPM auto-detection from audio stream (CORS-blocked; tap-tempo used instead)
- Backend server (pure SPA with no server-side code)
- Waveform analysis of YouTube audio
