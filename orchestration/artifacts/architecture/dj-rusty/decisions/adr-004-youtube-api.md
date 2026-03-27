# ADR-004: YouTube API Integration Strategy

**Date**: 2026-03-21
**Status**: Accepted
**Deciders**: Architecture Agent

---

## Context

DJRusty requires two distinct YouTube API integrations:

1. **YouTube IFrame Player API** — embedding and controlling YouTube video/audio playback.
2. **YouTube Data API v3** — searching YouTube and retrieving video metadata.

These are entirely separate APIs with different loading mechanisms, authentication requirements, and constraints.

---

## Decision

### API 1: YouTube IFrame Player API

**Loading**: Singleton script loader (`src/services/youtubeIframeApi.ts`) injects `https://www.youtube.com/iframe_api` once. Exposes a Promise resolving when `YT.Player` is available.

**Two Independent Player Instances**: Deck A and Deck B each have their own `YT.Player` instance mounted to separate DOM nodes (`<div id="yt-player-a">`, `<div id="yt-player-b">`). Players are created on mount, destroyed on unmount.

**Events Consumed**:

| Event | Handler |
|---|---|
| `onReady` | Set `playerReady: true` in deck store |
| `onStateChange` | Map `YT.PlayerState` → `playbackState` in deck store |
| `onError` | Set error state; display to user |
| `onPlaybackRateChange` | Confirm actual rate; update `pitchRate` in deck store |

**State Polling**: `player.getCurrentTime()` polled every 250ms while `PLAYING`. Interval cleared on pause/end/unmount.

**Pitch Rate Constants**:
```typescript
export const PITCH_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type PitchRate = typeof PITCH_RATES[number];
```

**Player instances stored in `useRef`**, not Zustand — they are imperative objects with methods, not serialisable state.

---

### API 2: YouTube Data API v3

**Base URL**: `https://www.googleapis.com/youtube/v3/`

**Authentication**: OAuth access token from `authStore`. Falls back to API key for unauthenticated requests.

**Search Flow** (two-step to get durations):
1. `GET /search?part=snippet&q={query}&type=video&maxResults=20` — 100 quota units
2. `GET /videos?part=contentDetails,snippet&id={id1,id2,...}` — 1 quota unit (batched)
3. Merge results into `YouTubeVideoSummary[]` and write to `searchStore`.

The two-step approach is required because `search` does not return `contentDetails.duration`.

**Quota**:
| Operation | Cost |
|---|---|
| `search.list` | 100 units |
| `videos.list` | 1 unit (any batch size) |

~99 searches/day within the 10,000 unit default quota.

**Error Handling** — explicit handling for:
- `quotaExceeded` — display quota exhaustion message
- `keyInvalid` — display API key configuration error
- `forbidden` — prompt re-authentication
- `videoNotFound` — display not-found state

---

## Rationale

### Why two separate integrations?
The IFrame API is imperative (controls a DOM element via postMessage). The Data API is a REST API (called via `fetch`, returns JSON). They must be loaded and used differently. Conflating them would produce an incoherent abstraction.

### Why batch the `videos` call after `search`?
Option A: One `videos` call per result = 100 + 20 = 120 units, 20 parallel requests.
Option B: One batched `videos` call = 100 + 1 = 101 units, 1 request.
Option B is quota-efficient and simpler. Chosen.

### Why poll `getCurrentTime` rather than using events?
The IFrame API does not emit `timeupdate`-equivalent events. `getCurrentTime()` must be polled. 250ms provides smooth display (4 updates/second) without excessive postMessage overhead.

### Why store player instances in refs, not Zustand?
`YT.Player` instances are imperative objects with methods and internal browser state. Zustand is designed for serialisable state. Storing method-bearing objects in Zustand breaks time-travel debugging and state serialisation.

---

## Consequences

- IFrame API singleton must be initialised early in app lifecycle (called in `App.tsx` on mount).
- `onYouTubeIframeAPIReady` global callback must not be overwritten — singleton loader uses safe append pattern.
- ISO 8601 duration parsing (`PT3M45S` → 225 seconds) must be unit-tested.
- Quota errors must surface clearly in the UI — silent failures are unacceptable.
- If `player.getAvailablePlaybackRates()` returns empty array (some videos restrict rates), pitch control must be disabled and labelled accordingly.

---

## Alternatives Not Chosen

| Option | Reason Rejected |
|---|---|
| YouTube oEmbed API | Does not provide duration or detailed metadata |
| Polling `videos` per result individually | Wastes quota; 20× more requests |
| Storing player instances in Zustand | Anti-pattern; objects with methods not serialisable |
| 100ms polling for currentTime | Excessive postMessage overhead |
| 1000ms polling for currentTime | Too infrequent; display looks choppy |
