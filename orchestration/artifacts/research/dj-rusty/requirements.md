# Requirements

> Project: `dj-rusty`

## Functional Requirements

### Authentication (P0 — Critical)
| # | Requirement | Priority |
|---|-------------|----------|
| FR-01 | User can sign in with Google account via Google Identity Services (GIS) OAuth 2.0 token flow | P0 |
| FR-02 | On sign-in, request `youtube.readonly` scope to access YouTube Data API v3 | P0 |
| FR-03 | Display signed-in user's avatar and name in the top-right header | P0 |
| FR-04 | User can sign out, clearing auth state and tokens from memory | P0 |
| FR-05 | Unauthenticated users see a sign-in prompt; track browser is disabled until authenticated | P0 |

### Dual Deck Playback (P0 — Critical)
| # | Requirement | Priority |
|---|-------------|----------|
| FR-06 | Two independent YouTube IFrame players (Deck A, Deck B) can play simultaneously on desktop | P0 |
| FR-07 | User can Play / Pause each deck independently | P0 |
| FR-08 | User can set a Cue point (stores current timestamp) and return to it | P0 |
| FR-09 | Spinning vinyl platter animates when playing; animation pauses when deck is paused | P0 |
| FR-10 | Track title and channel name displayed on each deck | P0 |
| FR-11 | Current playback time and total duration displayed on each deck | P0 |

### Mixing Controls (P0 — Critical)
| # | Requirement | Priority |
|---|-------------|----------|
| FR-12 | Crossfader slider adjusts relative volume between Deck A and Deck B | P0 |
| FR-13 | Individual volume fader per deck (0–100%) | P0 |
| FR-14 | Crossfader uses YouTube IFrame API `setVolume()` — no Web Audio API (CORS constraint) | P0 |

### Pitch / Speed Control (P1 — High)
| # | Requirement | Priority |
|---|-------------|----------|
| FR-15 | Pitch slider per deck adjusts playback rate to nearest valid YouTube rate (0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2) | P1 |
| FR-16 | Current playback rate displayed numerically on the deck | P1 |
| FR-17 | Vinyl platter animation speed reflects the current playback rate | P1 |

### BPM (P1 — High)
| # | Requirement | Priority |
|---|-------------|----------|
| FR-18 | Tap-tempo button per deck: user taps the beat; BPM calculated from tap intervals (last 4 taps average) | P1 |
| FR-19 | BPM displayed numerically on each deck | P1 |

### Loop Controls (P1 — High)
| # | Requirement | Priority |
|---|-------------|----------|
| FR-20 | Loop buttons (4-beat, 8-beat, 16-beat) calculate loop duration from current BPM and loop using `seekTo()` | P1 |
| FR-21 | Active loop highlighted; user can exit loop | P1 |

### Hot Cues (P2 — Medium)
| # | Requirement | Priority |
|---|-------------|----------|
| FR-22 | 4 hot cue buttons per deck (set/jump to timestamp) | P2 |
| FR-23 | Set cue: stores current timestamp; Jump cue: seeks to stored timestamp | P2 |
| FR-24 | Hot cues persist per video (stored in localStorage keyed by video ID) | P2 |

### EQ / Effects (P2 — Visual only in v1)
| # | Requirement | Priority |
|---|-------------|----------|
| FR-25 | Visual EQ knobs (Bass / Mid / Treble) per deck — UI controls present | P2 |
| FR-26 | Note in UI that EQ/effects require future audio pipeline upgrade (CORS limitation) | P2 |

### Track Browser (P0 — Critical)
| # | Requirement | Priority |
|---|-------------|----------|
| FR-27 | Search bar to search YouTube (uses YouTube Data API `search.list`) | P0 |
| FR-28 | Results displayed as list with thumbnail, title, channel, duration | P0 |
| FR-29 | "Load to Deck A" / "Load to Deck B" button per result | P0 |
| FR-30 | Browse authenticated user's channel uploads (fetched via `playlistItems.list` on login) | P1 |
| FR-31 | Pagination support (next page button using `pageToken`) | P1 |

### Settings (P1 — High)
| # | Requirement | Priority |
|---|-------------|----------|
| FR-32 | Settings modal: show connected Google account details | P1 |
| FR-33 | Display YouTube channel name and subscriber count | P1 |
| FR-34 | Option to disconnect/sign out | P1 |

---

## Non-Functional Requirements

| # | Requirement | Target |
|---|-------------|--------|
| NFR-01 | **Performance** — Crossfader response latency | < 50ms from slider input to volume change |
| NFR-02 | **Performance** — Initial app load time | < 3s on broadband |
| NFR-03 | **Compatibility** — Desktop browsers supported | Chrome 90+, Firefox 90+, Edge 90+ |
| NFR-04 | **Security** — OAuth tokens stored in memory only, never localStorage or cookies | Required |
| NFR-05 | **Security** — No YouTube media stream proxying or downloading | Required (ToS) |
| NFR-06 | **YouTube ToS Compliance** — IFrame players visible (not hidden) in a mini-player panel | Required |
| NFR-07 | **Accessibility** — Keyboard shortcuts for play/pause, crossfader | Required |
| NFR-08 | **Usability** — Interface operable without reading a manual | Required |
| NFR-09 | **Quota** — YouTube Data API calls minimized; uploads pre-fetched on login, search on demand | Required |

---

## Constraints

- **No backend required** — pure SPA; OAuth token flow (implicit/token) used
- **YouTube IFrame CORS** — Web Audio API cannot wrap cross-origin IFrame audio; crossfading must use `setVolume()` only
- **Pitch control** — limited to discrete YouTube playback rates (not continuously variable)
- **Mobile** — out of scope; iOS enforces single audio source restriction
- **YouTube quota** — 10,000 units/day default; `search.list` costs 100 units/call

---

## Dependencies

- Google Cloud project with OAuth 2.0 Client ID configured
- YouTube Data API v3 enabled in Google Cloud Console
- YouTube IFrame API (loaded from `https://www.youtube.com/iframe_api`)
- Google Identity Services script (`https://accounts.google.com/gsi/client`)
