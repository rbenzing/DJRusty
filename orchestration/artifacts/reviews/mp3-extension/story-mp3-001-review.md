# Code Review Report — Story mp3-001: Track Type Extensions

**Project:** mp3-extension
**Story:** mp3-001
**Reviewer:** Code Reviewer Agent
**Date:** 2026-03-25
**Review Scope:** Foundation type refactor — PlaylistEntry, DeckState, deckStore, playlistStore, playerRegistry, useYouTubePlayer, and all consumer components/utilities

---

## Overall Assessment

| Metric | Value |
|---|---|
| **Decision** | REJECTED |
| **Acceptance Criteria Met** | 7 / 11 (64%) |
| **Spec Compliance** | Partial — core type layer is correct; consumer files are largely untouched |
| **Critical Issues** | 6 |
| **Major Issues** | 3 |
| **Minor Issues** | 1 |

---

## Strict Validation Checklist

### Specification Compliance

| Requirement | Status | Notes |
|---|---|---|
| `TrackSourceType = 'mp3' \| 'youtube'` exported from `src/types/playlist.ts` | [x] | Correctly implemented |
| `PlaylistEntry` updated: `sourceType` required, `videoId` optional, `channelTitle` -> `artist`, `file?`, `audioUrl?` | [x] | All fields correct |
| `DeckState` updated: `videoId` -> `trackId`, `channelTitle` -> `artist`, `sourceType`, `waveformPeaks`, `decoding`, `bpmDetecting` | [x] | All fields correct |
| `deckStore.ts`: `createInitialDeckState` includes new fields, `loadTrack` updated, `clearTrack` updated | [x] | Correct |
| `deckStore.ts`: New actions `setDecoding`, `setBpmDetecting`, `setWaveformPeaks` added | [x] | Correct |
| `playlistStore.ts`: `loadDeckTrack` uses `entry.videoId ?? entry.id` as `trackId` and `entry.artist` | [x] | Correct |
| `playerRegistry.ts`: `DeckPlayer` interface, `YouTubePlayerAdapter`, registry typed to `DeckPlayer` | [x] | Correct |
| `useYouTubePlayer.ts`: Registers `YouTubePlayerAdapter`, subscribes to `trackId` instead of `videoId` | [x] | Correct |
| **All components updated to use new field names** | [x] | **FAILED — see Critical Issues** |
| `SearchPanel.tsx` and `SearchResult.tsx` construct `PlaylistEntry` with `sourceType: 'youtube'` and `artist` mapped from `channelTitle` | [x] | **FAILED — see Critical Issues** |
| TypeScript compilation passes with zero errors | [x] | **FAILED — multiple type errors guaranteed** |
| All existing tests pass without modification or updated field names | [x] | **FAILED — tests use old field names** |
| No behavioral regressions | [x] | **FAILED — `App.tsx` calls `loadTrack` with old signature** |

### Code Quality

| Check | Status | Notes |
|---|---|---|
| Readability and clear naming | [x] | New type files are very clean with excellent JSDoc |
| Naming conventions consistent | [x] | `trackId`, `artist`, `sourceType` all clear |
| Function size appropriate | [x] | Functions well-scoped |
| No duplication | [x] | No unnecessary duplication |
| Comments adequate | [x] | JSDoc on all public interfaces |

### Best Practices

| Check | Status | Notes |
|---|---|---|
| TypeScript strict mode adherence | [x] | FAILED — implicit property access on removed fields |
| SOLID principles | [x] | `DeckPlayer` abstraction is good design |
| Error handling | [x] | Adequate |
| No anti-patterns in new code | [x] | Correct |

### Security

| Check | Status | Notes |
|---|---|---|
| No sensitive data exposed | [x] | No tokens or credentials in code |
| No new attack surface | [x] | Pure refactor |

### Testing

| Check | Status | Notes |
|---|---|---|
| Tests updated to use `trackId` / `artist` | [ ] | FAILED — all test files still reference old field names |
| Test coverage adequate | [x] | Coverage exists but tests will fail compilation |

---

## Critical Issues

### CRITICAL-1: `DeckDisplay.tsx` — Destructures removed fields `channelTitle` and `videoId` from `DeckState`

**File:** `src/components/Deck/DeckDisplay.tsx`
**Lines:** 18, 20, 50–51
**Severity:** Critical — TypeScript compilation error

`DeckState` no longer has `channelTitle` or `videoId` fields. The component destructures both, causing a TypeScript error. `hasTrack` is also computed from the removed `videoId` field instead of `trackId`.

```typescript
// Line 18 — BROKEN: destructures channelTitle and videoId which no longer exist
const { title, channelTitle, bpm, currentTime, duration, pitchRate, videoId } = deck;

// Line 20 — BROKEN: hasTrack derived from removed videoId
const hasTrack = videoId !== null;

// Lines 50–51 — BROKEN: renders channelTitle which no longer exists
<div className={styles.channelName} title={channelTitle}>
  {channelTitle}
```

**Required fix:**
```typescript
const { title, artist, bpm, currentTime, duration, pitchRate, trackId } = deck;
const hasTrack = trackId !== null;
// ...
<div className={styles.channelName} title={artist}>
  {artist}
```

---

### CRITICAL-2: `PlaylistTrack.tsx` — Renders removed field `entry.channelTitle`

**File:** `src/components/Playlist/PlaylistTrack.tsx`
**Line:** 56
**Severity:** Critical — TypeScript compilation error

`PlaylistEntry.channelTitle` was renamed to `artist`. The component renders the old field name.

```typescript
// Line 56 — BROKEN: channelTitle does not exist on PlaylistEntry
<span className={styles.trackChannel}>{entry.channelTitle}</span>
```

**Required fix:**
```typescript
<span className={styles.trackChannel}>{entry.artist}</span>
```

---

### CRITICAL-3: `SearchPanel.tsx` — `handleQueueToDeck` constructs `PlaylistEntry` with `channelTitle` and without `sourceType`

**File:** `src/components/Search/SearchPanel.tsx`
**Lines:** 162–168
**Severity:** Critical — TypeScript compilation error and runtime defect

The `handleQueueToDeck` function calls `addTrack` with an object that (a) uses the removed `channelTitle` field instead of `artist`, and (b) omits the now-required `sourceType` field.

```typescript
// Lines 162–168 — BROKEN
function handleQueueToDeck(deckId: 'A' | 'B', result: YouTubeVideoSummary) {
  usePlaylistStore.getState().addTrack(deckId, {
    videoId: result.videoId,
    title: result.title,
    channelTitle: result.channelTitle,   // field does not exist on PlaylistEntry
    duration: result.duration,
    thumbnailUrl: result.thumbnailUrl,
    // sourceType is MISSING — required field
  });
}
```

**Required fix:**
```typescript
function handleQueueToDeck(deckId: 'A' | 'B', result: YouTubeVideoSummary) {
  usePlaylistStore.getState().addTrack(deckId, {
    sourceType: 'youtube',
    videoId: result.videoId,
    title: result.title,
    artist: result.channelTitle,
    duration: result.duration,
    thumbnailUrl: result.thumbnailUrl,
  });
}
```

---

### CRITICAL-4: `SearchResult.tsx` — Reads removed field `state.decks.A.videoId` and `state.decks.B.videoId` from `DeckState`

**File:** `src/components/Search/SearchResult.tsx`
**Lines:** 35–39
**Severity:** Critical — TypeScript compilation error; "Now Playing" badges will never show

`DeckState.videoId` was renamed to `trackId`. The component reads the old field name from the store.

```typescript
// Lines 35–36 — BROKEN: videoId does not exist on DeckState
const deckAVideoId = useDeckStore((state) => state.decks.A.videoId);
const deckBVideoId = useDeckStore((state) => state.decks.B.videoId);

// Lines 38–39 — badge logic broken as a result
const loadedOnA = deckAVideoId === videoId;
const loadedOnB = deckBVideoId === videoId;
```

**Required fix:**
```typescript
const deckATrackId = useDeckStore((state) => state.decks.A.trackId);
const deckBTrackId = useDeckStore((state) => state.decks.B.trackId);
const loadedOnA = deckATrackId === result.videoId;
const loadedOnB = deckBTrackId === result.videoId;
```

---

### CRITICAL-5: `App.tsx` — Calls `loadTrack` with old signature (`channelTitle`) and missing `sourceType`

**File:** `src/App.tsx`
**Lines:** 80–86
**Severity:** Critical — TypeScript compilation error and broken YouTube load-track event handler

The `dj-rusty:load-track` event handler in `App.tsx` destructures `channelTitle` from the event detail and passes it directly to `loadTrack` using the old metadata shape. Both `channelTitle` and the missing `sourceType` cause errors.

```typescript
// Line 80 — destructures channelTitle from event result
const { videoId, title, channelTitle, duration, thumbnailUrl } = result;

// Lines 81–86 — BROKEN: calls loadTrack with old parameter shape
useDeckStore.getState().loadTrack(deckId, videoId, {
  title,
  channelTitle,        // field does not exist in new loadTrack metadata type
  duration,
  thumbnailUrl,
  // sourceType is MISSING — required field
});
```

**Required fix:**
```typescript
const { videoId, title, channelTitle, duration, thumbnailUrl } = result;
useDeckStore.getState().loadTrack(deckId, videoId, {
  sourceType: 'youtube',
  title,
  artist: channelTitle,
  duration,
  thumbnailUrl,
});
```

---

### CRITICAL-6: `HotCues.tsx` and `DeckControls.tsx` — Read removed field `videoId` from `DeckState`

**File:** `src/components/Deck/HotCues.tsx`
**Lines:** 49–50, 57–58, 80–81
**Severity:** Critical — TypeScript compilation error; hot cue set/clear completely broken

**File:** `src/components/Deck/DeckControls.tsx`
**Lines:** 34, 36, 55–56
**Severity:** Critical — TypeScript compilation error; cue-point button broken

`HotCues.tsx` destructures `videoId` from `DeckState` (does not exist) and passes it to `persistSetHotCue` / `persistClearHotCue`. The `hasTrack` guard also checks the old field. `DeckControls.tsx` has the same pattern.

`HotCues.tsx` required fix (lines 49–81):
```typescript
const { trackId, currentTime, hotCues, playerReady } = deck;
const hasTrack = trackId !== null;

function handleSet(index: number) {
  if (!trackId) return;
  persistSetHotCue(trackId, index, currentTime);
  setHotCue(deckId, index, currentTime);
}

function handleClear(index: number) {
  if (!trackId) return;
  persistClearHotCue(trackId, index);
  clearHotCue(deckId, index);
}
```

`DeckControls.tsx` required fix: replace every reference to `videoId` with `trackId`.

---

## Major Issues

### MAJOR-1: `BeatJump.tsx` — Reads removed field `videoId` from `DeckState`

**File:** `src/components/Deck/BeatJump.tsx`
**Line:** 29, 32
**Severity:** Major — TypeScript compilation error; beat jump disabled state always wrong

```typescript
// Line 29 — BROKEN
const { bpm, currentTime, duration, beatJumpSize, videoId, playerReady } = useDeck(deckId);
// Line 32 — BROKEN: videoId does not exist
const isDisabled = !videoId || !bpm || bpm === 0 || !playerReady;
```

**Required fix:**
```typescript
const { bpm, currentTime, duration, beatJumpSize, trackId, playerReady } = useDeck(deckId);
const isDisabled = !trackId || !bpm || bpm === 0 || !playerReady;
```

---

### MAJOR-2: `useKeyboardShortcuts.ts` — Reads removed field `videoId` from `DeckState`

**File:** `src/hooks/useKeyboardShortcuts.ts`
**Lines:** 42, 65, 72, 100–110
**Severity:** Major — TypeScript compilation error; keyboard shortcut guards broken

Multiple guards check `deck.videoId` for null — this field was renamed to `trackId`. Hot cue persistence calls also pass `videoId` to `persistSetHotCue`.

**Required fix:** Replace all `deck.videoId` / `deckA.videoId` / `deckB.videoId` references with `deck.trackId` / `deckA.trackId` / `deckB.trackId`. Replace `persistSetHotCue(deckA.videoId, ...)` with `persistSetHotCue(deckA.trackId, ...)`.

---

### MAJOR-3: All test files still use old field names — tests will fail to compile

**Files:** `src/test/stores.test.ts`, `src/test/deck-b.test.ts`, `src/test/youtube-player.test.ts`, `src/test/story-011-hot-cues.test.ts`, `src/test/story-dj-003-8-hot-cues.test.ts`, `src/test/keyboardShortcuts.test.ts`, `src/test/slip-mode.test.ts`, `src/test/playlist-store.test.ts`
**Severity:** Major — acceptance criterion "All existing tests pass" is not met

Every test file that constructs or destructures `DeckState` or calls `loadTrack` uses the old field names (`videoId`, `channelTitle`) and the old `loadTrack` parameter shape (no `sourceType`, no `artist`). They will all fail TypeScript compilation once the type changes are in place.

Each affected test file must be updated to:
- Use `trackId` instead of `videoId` in `DeckState` destructuring and assertions
- Use `artist` instead of `channelTitle` in `DeckState` destructuring and assertions
- Pass `sourceType: 'youtube'` to `loadTrack` metadata
- Pass `artist` instead of `channelTitle` to `loadTrack` metadata

---

## Minor Issues

### MINOR-1: `SearchPanel.tsx` — `recentTrackToSummary` helper at line 42–49 maps `RecentTrack` to `YouTubeVideoSummary` which still has `channelTitle`

**File:** `src/components/Search/SearchPanel.tsx`
**Lines:** 42–49
**Severity:** Minor — this mapping is technically correct because `RecentTrack.channelTitle` maps to `YouTubeVideoSummary.channelTitle` (both are YouTube-domain types that legitimately retain the `channelTitle` name). This is not a bug, but it should be noted that `RecentTrack` in `src/utils/recentlyPlayed.ts` also retains `channelTitle` — this is acceptable since `RecentTrack` is a YouTube-specific persisted type, not a `PlaylistEntry`.

No fix required, but document that `RecentTrack` is intentionally YouTube-specific and should not be used as a source for `PlaylistEntry.artist` without explicit field mapping.

---

## Positive Highlights

- `src/types/playlist.ts` — The new type definition is clean, well-documented with JSDoc, and the discriminated union approach using `sourceType` is architecturally sound. The optional field structure for `videoId`, `file`, and `audioUrl` correctly models the three track source variants.
- `src/types/deck.ts` — The import of `TrackSourceType` from `playlist.ts` (no re-exporting the literal union) is correct. All new fields (`waveformPeaks`, `decoding`, `bpmDetecting`) have accurate JSDoc noting which future story populates them.
- `src/store/deckStore.ts` — The `loadTrack` implementation correctly resets all new fields when a track loads. The comment explaining hot cue key compatibility is valuable. The `clearTrack` action correctly resets all new fields including `sourceType: null` and `waveformPeaks: null`.
- `src/store/playlistStore.ts` — The `loadDeckTrack` helper correctly uses `entry.videoId ?? entry.id` as `trackId` with a clear explanatory comment. The `sourceType` is correctly passed through.
- `src/services/playerRegistry.ts` — The `DeckPlayer` abstraction is well-designed. `YouTubePlayerAdapter` is a clean, minimal adapter with `allowSeekAhead` defaulting to `true` (matching the spec). The registry is typed to `DeckPlayer`, enabling future MP3 AudioEngine instances without changing the registry API.
- `src/hooks/useYouTubePlayer.ts` — Correctly registers a `YouTubePlayerAdapter` (not raw `YT.Player`), subscribes to `trackId`, and guards YouTube-only activation with `sourceType !== 'youtube'`. The hot-cue compatibility note in the comment is accurate.
- `src/utils/hotCues.ts` — All three functions now accept `trackId: string` (renamed from `videoId`) with clear JSDoc explaining backward compatibility for YouTube entries.

---

## File-by-File Review

| File | Status | Notes |
|---|---|---|
| `src/types/playlist.ts` | PASS | Fully spec-compliant |
| `src/types/deck.ts` | PASS | Fully spec-compliant |
| `src/store/deckStore.ts` | PASS | Fully spec-compliant including new actions |
| `src/store/playlistStore.ts` | PASS | Correct `trackId` derivation and `sourceType` pass-through |
| `src/services/playerRegistry.ts` | PASS | `DeckPlayer`, `YouTubePlayerAdapter`, and typed registry all correct |
| `src/hooks/useYouTubePlayer.ts` | PASS | Subscribes to `trackId`, registers adapter, guards by `sourceType` |
| `src/components/Deck/Deck.tsx` | PASS | Correctly uses `trackId` for `hasTrack` check |
| `src/components/Deck/DeckDisplay.tsx` | FAIL | Uses removed `channelTitle` and `videoId` (CRITICAL-1) |
| `src/components/Deck/HotCues.tsx` | FAIL | Uses removed `videoId` throughout (CRITICAL-6) |
| `src/components/Deck/DeckControls.tsx` | FAIL | Uses removed `videoId` (CRITICAL-6) |
| `src/components/Deck/BeatJump.tsx` | FAIL | Uses removed `videoId` (MAJOR-1) |
| `src/components/Playlist/PlaylistTrack.tsx` | FAIL | Renders removed `entry.channelTitle` (CRITICAL-2) |
| `src/components/Search/SearchPanel.tsx` | FAIL | `handleQueueToDeck` uses `channelTitle`, missing `sourceType` (CRITICAL-3) |
| `src/components/Search/SearchResult.tsx` | FAIL | Reads `state.decks.A.videoId` from store (CRITICAL-4) |
| `src/App.tsx` | FAIL | `loadTrack` called with old signature (CRITICAL-5) |
| `src/hooks/useKeyboardShortcuts.ts` | FAIL | Uses removed `videoId` throughout (MAJOR-2) |
| `src/utils/hotCues.ts` | PASS | Correctly uses `trackId` |
| `src/test/*.test.ts` (8 files) | FAIL | Old field names throughout (MAJOR-3) |

---

## Acceptance Criteria Verification

| Criterion | Status | Detail |
|---|---|---|
| `TrackSourceType` exported | PASS | |
| `PlaylistEntry` updated (sourceType, optional videoId, artist, file?, audioUrl?) | PASS | |
| `DeckState` updated (trackId, sourceType, artist, waveformPeaks, decoding, bpmDetecting) | PASS | |
| `deckStore.ts` updated (new fields, new loadTrack signature, internal renames) | PASS | |
| `playlistStore.ts` updated (loadDeckTrack with new signature) | PASS | |
| `playerRegistry.ts` updated (DeckPlayer, YouTubePlayerAdapter) | PASS | |
| `useYouTubePlayer.ts` updated (registers adapter, subscribes to trackId) | PASS | |
| All components updated to use new field names | FAIL | DeckDisplay, HotCues, DeckControls, BeatJump, PlaylistTrack not updated |
| SearchPanel and SearchResult construct PlaylistEntry with sourceType and artist | FAIL | SearchPanel.handleQueueToDeck and App.tsx still use old shape |
| TypeScript compilation passes with zero errors | FAIL | Multiple type errors across component and hook files |
| All existing tests pass | FAIL | All test files referencing DeckState or loadTrack use old field names |

---

## Recommendations

### Immediate (Required Before Approval)

1. Update `src/components/Deck/DeckDisplay.tsx` — rename `channelTitle` -> `artist`, `videoId` -> `trackId` in destructure and JSX (CRITICAL-1)
2. Update `src/components/Playlist/PlaylistTrack.tsx` — rename `entry.channelTitle` -> `entry.artist` (CRITICAL-2)
3. Update `src/components/Search/SearchPanel.tsx` — fix `handleQueueToDeck` to pass `sourceType: 'youtube'` and `artist: result.channelTitle` (CRITICAL-3)
4. Update `src/components/Search/SearchResult.tsx` — rename `state.decks.A.videoId` -> `state.decks.A.trackId`, same for B (CRITICAL-4)
5. Update `src/App.tsx` — fix `loadTrack` call to pass `sourceType: 'youtube'` and `artist: channelTitle` (CRITICAL-5)
6. Update `src/components/Deck/HotCues.tsx` and `src/components/Deck/DeckControls.tsx` — rename `videoId` -> `trackId` in all uses (CRITICAL-6)
7. Update `src/components/Deck/BeatJump.tsx` — rename `videoId` -> `trackId` (MAJOR-1)
8. Update `src/hooks/useKeyboardShortcuts.ts` — rename all `videoId` references to `trackId` (MAJOR-2)
9. Update all failing test files to use `trackId`/`artist` field names and the new `loadTrack` metadata shape including `sourceType` (MAJOR-3)

### Future Improvements

- Consider adding a `setSourceType` action to `deckStore` as specified in the implementation spec (section 3.1 new actions) — it was listed in the spec but not implemented. It is not needed for this story but should be added to the backlog for completeness.
- The `reorderTrack` and `moveTrackToDeck` actions listed in `playlistStore` spec (section 3.2) are also absent — confirm these are deferred to a later story.

---

## Metrics

| Metric | Value |
|---|---|
| Files reviewed | 20 |
| Files passing | 9 |
| Files failing | 11 |
| Critical issues | 6 |
| Major issues | 3 |
| Minor issues | 1 |
| Acceptance criteria met | 7 / 11 |
| Review date | 2026-03-25 |

---

## Decision: REJECTED

The core type layer (`playlist.ts`, `deck.ts`, `deckStore.ts`, `playlistStore.ts`, `playerRegistry.ts`, `useYouTubePlayer.ts`, `hotCues.ts`) is correctly implemented and of high quality.

However, the consumer layer — all components and hooks that read from `DeckState` or construct `PlaylistEntry` objects — was not updated. Six critical TypeScript errors and three major issues mean the build will not compile and the app will not function correctly. All existing tests will also fail. The story cannot be considered complete until all consumer files are updated and the TypeScript build passes with zero errors.
