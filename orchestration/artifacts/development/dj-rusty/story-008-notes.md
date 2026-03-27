# STORY-008 Implementation Notes

> Project: `dj-rusty`
> Story: STORY-008 — Load Track to Deck
> Date: 2026-03-22
> Status: COMPLETE

---

## Implementation Progress

- **Acceptance Criteria**: 9/9 met (100%)
- **Files Created**: 2
- **Files Modified**: 4

---

## Acceptance Criteria Verification

| Criterion | Status | Notes |
|---|---|---|
| Each search result row has "Load A" and "Load B" buttons | DONE | Already implemented in STORY-007; `SearchResult.tsx` has LOAD A/B buttons dispatching `onLoadToDeck` callback |
| Clicking "Load A/B" dispatches `loadTrack(deckId, videoId, {...})` to deck store | DONE | `App.tsx` event listener bridges `dj-rusty:load-track` CustomEvent to `useDeckStore.getState().loadTrack()` |
| Deck store updates: videoId, title, channelTitle, duration, resets currentTime, loopActive, loopStart, loopEnd, bpm | DONE | `deckStore.ts` `loadTrack` action resets all transient state |
| `YouTubePlayer` reacts to `videoId` change: calls `player.cueVideoById(videoId)` | DONE | Already implemented in `useYouTubePlayer.ts` (STORY-003) — subscribes to store and calls `cueVideoById` on change |
| Deck display immediately shows new track title and duration | DONE | `DeckDisplay.tsx` reads from store reactively; title/duration update immediately on store change |
| Vinyl platter stops if it was spinning (deck transitions to 'paused' state) | DONE | `loadTrack` now sets `playbackState: 'paused'` (changed from 'unstarted') |
| Hot cues for the loaded video loaded from localStorage and set in deck state | DONE | `loadTrack` now calls `getHotCues(videoId)` and sets `hotCues` in store |
| If video is unembeddable: deck error state shown, track cleared | DONE | Already handled in `useYouTubePlayer.ts` `handleError` (error codes 101/150) from STORY-003 |
| Thumbnail from search result used as vinyl label image in deck | DONE | `VinylPlatter.tsx` already uses `thumbnailUrl` from store as center label; `loadTrack` stores it |

---

## Files Created

| File | Purpose |
|---|---|
| `src/test/hot-cues.test.ts` | 22 unit tests for `getHotCues`, `setHotCue`, `clearHotCue` utilities |

---

## Files Modified

| File | Change |
|---|---|
| `src/store/deckStore.ts` | Added `getHotCues` import; updated `loadTrack` to set `playbackState: 'paused'` and `hotCues: getHotCues(videoId)` |
| `src/App.tsx` | Added `dj-rusty:load-track` CustomEvent listener in a `useEffect`; bridges SearchPanel event to deck store `loadTrack` |
| `src/test/deck-b.test.ts` | Updated one assertion: `playbackState` after `loadTrack` is now `'paused'` (per STORY-008 AC) instead of `'unstarted'` |

---

## Implementation Details

### Event Bridge Pattern (App.tsx)

`SearchPanel.tsx` (from STORY-007) dispatches `new CustomEvent('dj-rusty:load-track', { detail: { deckId, result } })` where `result` is a `YouTubeVideoSummary`. This keeps the search components decoupled from the deck store.

In STORY-008, `App.tsx` adds a `useEffect` listener that:
1. Receives the `{ deckId, result }` detail
2. Destructures `result` to extract `videoId`, `title`, `channelTitle`, `duration`, `thumbnailUrl`
3. Calls `useDeckStore.getState().loadTrack(deckId, videoId, { title, channelTitle, duration, thumbnailUrl })`

The listener is registered on `window` with proper cleanup on unmount. A typed `LoadTrackEventDetail` interface was added to `App.tsx` to make the cast type-safe.

### loadTrack Action Changes (deckStore.ts)

Two changes were made to `loadTrack`:

1. **`playbackState: 'paused'`** — Changed from `'unstarted'` to `'paused'`. This satisfies the AC "Vinyl platter stops if it was spinning". The `useYouTubePlayer` subscription to playback state changes will call `player.pauseVideo()` when it sees 'paused'. When the YouTube player cues the new video, it fires a `CUED` state event which maps back to `'unstarted'` — so the final resting state after cuing is `'unstarted'`, but the platter animation stops immediately on load because `VinylPlatter` checks `isPlaying === playbackState === 'playing'`.

2. **`hotCues: getHotCues(videoId)`** — Changed from `hotCues: {}`. The `getHotCues` utility reads from localStorage keyed by `'dj-rusty-hot-cues'`. Returns `{}` if no cues are stored for that video (graceful empty).

### Pre-existing Work Verified

The following components already fully implemented their STORY-008 responsibilities from prior stories:

- **`SearchResult.tsx`** — LOAD A/LOAD B buttons present, aria-labels set, `onLoadToDeck` callback dispatched
- **`VinylPlatter.tsx`** — `thumbnailUrl` prop already used as center label `<img>` with CSS circular clip; falls back to "DR" text
- **`useYouTubePlayer.ts`** — Already subscribes to `videoId` changes and calls `player.cueVideoById(videoId)` (STORY-003). Also resets `hasPlayedRef` so the mute/unmute autoplay policy applies correctly to the new video
- **Unembeddable video handling** — `handleError` in `useYouTubePlayer.ts` already catches error codes 101/150, calls `setError(deckId, 'Video cannot be embedded')` and sets `playbackState: 'unstarted'` (STORY-003)

### Hot Cues Utility (src/utils/hotCues.ts)

The utility was already fully implemented from STORY-001. It includes try/catch guards around all localStorage operations to handle:
- Unavailable localStorage (e.g. private mode restrictions)
- Malformed JSON in storage
- `QuotaExceededError` on `setItem`

### Test Coverage

22 new tests in `src/test/hot-cues.test.ts` covering:
- `getHotCues`: empty storage, missing video ID, stored cues, multiple videos, malformed JSON, multiple indices
- `setHotCue`: new storage, multiple cues, overwrite existing, isolation, preservation of existing cues, zero timestamp, quota exceeded error handling
- `clearHotCue`: remove specific index, non-existent video ID, empty storage, isolation, non-existent index, empty object after last cue cleared
- Integration: full round-trip set → get → clear → get, multiple videos coexisting

---

## Build Status

| Check | Result |
|---|---|
| `npm test` | PASS — 224 tests, 0 failures |
| TypeScript | Clean (no new type errors introduced) |

---

## Specification Compliance

| Spec | Compliance |
|---|---|
| `story-breakdown.md §STORY-008` (9 acceptance criteria) | 100% |
| `implementation-spec.md §8` (Hot Cues localStorage) | 100% |
| `implementation-spec.md §14` (Unembeddable Video Handling) | 100% (pre-existing from STORY-003) |
| STORY-007 CustomEvent pattern | 100% (event detail shape matched and handled) |

---

## Known Issues

None. All acceptance criteria are met, build is clean, all 224 tests pass.

---

## Notes for Code Reviewer

1. The `loadTrack` action now sets `playbackState: 'paused'` instead of `'unstarted'`. This is intentional per STORY-008 AC ("vinyl platter stops — deck transitions to 'paused' state"). The YouTube player will subsequently fire a `CUED` event when `cueVideoById` completes, which maps back to `'unstarted'` in the store. The net effect is: platter stops immediately on load, player eventually settles to 'unstarted'.

2. The `deck-b.test.ts` assertion for `playbackState` after `loadTrack` was updated from `'unstarted'` to `'paused'` — this is a spec-driven change, not a regression.

3. The `dj-rusty:load-track` event detail shape coming from `SearchPanel.tsx` is `{ deckId, result: YouTubeVideoSummary }` (not the flat `{ deckId, videoId, title, ... }` shape described in the task brief). The `App.tsx` listener correctly destructures `result` before calling `loadTrack`. The `LoadTrackEventDetail` interface documents this contract.

4. `src/utils/hotCues.ts` was already complete from STORY-001. No changes were needed.

5. `useYouTubePlayer.ts`, `VinylPlatter.tsx`, `SearchResult.tsx` were all already wired correctly from prior stories. STORY-008 only required connecting the event bridge in `App.tsx` and fixing `loadTrack` to load hot cues and set correct playback state.
