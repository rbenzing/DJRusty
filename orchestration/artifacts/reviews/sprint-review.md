# Sprint Review — DJRusty
**Reviewer**: Code Reviewer Agent
**Date**: 2026-03-24
**Stories Reviewed**: SPRINT-001, SPRINT-002, SPRINT-003, SPRINT-004

---

## SPRINT-001: CHANGES REQUESTED

**Story**: Remove Download Feature (Server + Frontend)

### Summary
The implementation is thorough and correctly removes the download/playlist feature across the entire codebase. All targeted files are deleted and all specified modifications are accurate. However, one test file was missed in the cleanup sweep, leaving two stale fields that are no longer part of `DeckState`. This must be fixed before the story can be approved.

### Critical Finding

**File**: `src/test/youtube-player.test.ts`
**Lines**: 48–49
**Severity**: Major (TypeScript correctness / spec non-compliance)
**Problem**: The `initialDeckState` helper function in this test file still includes `isLocal: false` and `audioUrl: null` in its returned object literal. These two fields were removed from the `DeckState` interface in `src/types/deck.ts` as part of this story. The implementation notes acknowledge that `deck-b.test.ts`, `stores.test.ts`, and `story-011-hot-cues.test.ts` were cleaned up, but `youtube-player.test.ts` was not included in that sweep.

```typescript
// src/test/youtube-player.test.ts — lines 47–50 (current, incorrect)
pitchRateLocked: false,
isLocal: false,       // <-- must be removed
audioUrl: null,       // <-- must be removed
```

**Impact**: While the TypeScript build currently passes (the object literal is used in a `toMatchObject` assertion which is structurally tolerant of extra keys), the presence of these fields is technically incorrect — the fields no longer exist on the type. Any future tightening of the test utility to use strict type assignment (`const x: DeckState = initialDeckState('A')`) would cause a TypeScript error. It also leaves misleading documentation in the test file suggesting these fields are part of the deck model.

**Fix**: Remove `isLocal: false,` and `audioUrl: null,` from the `initialDeckState` function in `src/test/youtube-player.test.ts` (lines 48–49).

### Minor Finding

**File**: `src/components/Search/SearchPanel.tsx`
**Line**: 17
**Severity**: Minor (stale comment)
**Problem**: The module-level JSDoc comment still reads: `Clear (×) button in SearchBar resets query and clears results.` The behavior was intentionally changed so that clear resets the query only, leaving results visible. This is factually wrong documentation.

**Fix**: Update line 17 to: `Clear (×) button in SearchBar resets query only; results persist.`

### Passing Checks
- [x] `downloadService.ts` deleted — confirmed (file not found)
- [x] `playlistStore.ts` deleted — confirmed (file not found)
- [x] `PlaylistTab.tsx` deleted — confirmed (file not found)
- [x] `useLocalAudioPlayer.ts` deleted — confirmed (file not found)
- [x] `types/playlist.ts` deleted — confirmed (file not found)
- [x] `App.tsx` — no `PlaylistTrack` import, no `LoadLocalTrackEventDetail`, no `dj-rusty:load-local-track` listener. `dj-rusty:load-track` listener intact. Correct.
- [x] `SearchPanel.tsx` — `ActiveTab` is `'search' | 'recent'` only. No Playlist tab button, no Playlist tabpanel. No `handleAddToPlaylist`, no `handleLoadLocalToDeck`. `clearResults` not imported or called. Correct.
- [x] `SearchResultList.tsx` — `onAddToPlaylist` prop fully removed from interface, destructuring, and `SearchResult` spread. Correct.
- [x] `SearchResult.tsx` — No `onAddToPlaylist` prop, no `adding` state, no `handleAddToPlaylist`, no download/save button JSX. Correct.
- [x] `deckStore.ts` — No `isLocal`/`audioUrl` in initial state, no `loadLocalTrack` in interface or implementation, no `isLocal`/`audioUrl` in `loadTrack` or `clearTrack` update calls. Correct.
- [x] `types/deck.ts` — `isLocal` and `audioUrl` fields removed. Correct.
- [x] `useYouTubePlayer.ts` — All `isLocal` guards removed from videoId, pitchRate, volume, and playbackState subscriptions. Correct.
- [x] No security issues introduced.
- [x] No regressions to core play/search/recent functionality.

### Required Actions Before Approval
1. Remove `isLocal: false` and `audioUrl: null` from `initialDeckState()` in `src/test/youtube-player.test.ts` (lines 48–49).
2. Update stale comment at `src/components/Search/SearchPanel.tsx` line 17.

---

## SPRINT-002: APPROVED

**Story**: Improve Search (Relevance + Persistence + Load More UX)

### Summary
All three sub-tasks are correctly implemented. The API parameter additions are clean and placed correctly. The `loadingMore` state logic is correct and handles all paths including error paths. The search persistence requirement was already fulfilled by SPRINT-001 and is correctly noted as such.

### Passing Checks
- [x] `src/services/youtubeDataApi.ts` — `videoEmbeddable: 'true'` added at line 200, `videoDuration: 'medium'` added at line 201. Both are placed inside the `search.list` call's params object. All pre-existing params (`part`, `q`, `type`, `maxResults`, `videoCategoryId`, `channelId`, `pageToken`) are present and unchanged. Correct.
- [x] `SearchPanel.tsx` — `handleClear` calls only `setQuery('')`. No `clearResults()` call. No `setHasSearched(false)`. `clearResults` is not destructured from `useSearchStore`. Correct.
- [x] `SearchPanel.tsx` — `const [loadingMore, setLoadingMore] = useState(false)` declared at line 65. Correct.
- [x] `performSearch` — when `pageToken` is truthy, calls `setLoadingMore(true)` and does NOT call `setLoading(true)`. When `pageToken` is falsy, calls `setLoading(true)` only. The `finally` block resets both `setLoading(false)` and `setLoadingMore(false)` unconditionally — correct for error paths.
- [x] Pagination button — `disabled={loadingMore}` attribute present. Button text is `{loadingMore ? 'Loading...' : 'Load Next Page'}`. Button is conditionally rendered by `nextPageToken && !loading` (not `!loading && !loadingMore`), so it remains visible during `loadingMore === true` as required. Correct.
- [x] TypeScript: no `any` abuse; `videoEmbeddable` and `videoDuration` are typed as `string` values in the `Record<string, string | undefined>` params map. Correct.
- [x] No security issues introduced.
- [x] No regressions to existing search/pagination behavior.

### Positive Notes
The note in the implementation document about `setLoading(false)` being a harmless no-op in the `finally` block during pagination paths is correct and keeping it unconditional is the right call — it simplifies the finally block and prevents a latent bug if the conditional path were ever changed.

---

## SPRINT-003: APPROVED

**Story**: Add Skip Back, Skip Forward, and Restart Buttons to Deck Controls

### Summary
All three handler functions and all three button elements are correctly implemented. Guard conditions, seek logic, aria labels, disabled states, and CSS ordering all match the specification exactly. The implementation is consistent with the existing cue button pattern.

### Passing Checks
- [x] `handleRestart` — guards `if (!playerReady || !hasTrack) return`. Seeks to `player.seekTo(0, true)`. Correct.
- [x] `handleSkipBack` — guards match spec. `Math.max(0, currentTime - 15)` floors at zero correctly. `player.seekTo(newTime, true)`. Correct.
- [x] `handleSkipForward` — guards match spec. `player.seekTo(currentTime + 15, true)`. No floor needed (YouTube handles gracefully at end). Correct.
- [x] All three handlers read the player from `playerRegistry.get(deckId)` — consistent with `handleJumpToCue` pattern.
- [x] Restart button — `disabled={!hasTrack || !playerReady}`, `aria-label="Restart Deck {deckId}"`, `title` attribute present. Icon `&#x21BA;` (↺). Correct.
- [x] Skip Back button — `disabled={!hasTrack || !playerReady}`, `aria-label="Skip back 15 seconds on Deck {deckId}"`, `title` attribute present. Icon `&#x23EA;15` (⏪15). Correct.
- [x] Skip Forward button — `disabled={!hasTrack || !playerReady}`, `aria-label="Skip forward 15 seconds on Deck {deckId}"`, `title` attribute present. Icon `15&#x23E9;` (15⏩). Correct.
- [x] CSS `.restartBtn { order: -3 }`, `.skipBackBtn { order: -2 }`, `.skipFwdBtn { order: 2 }`. Existing orders unchanged (`.cueBtn: -1`, `.playBtn: 0`, `.setCueBtn: 1`). No CSS conflicts. Correct.
- [x] Visual layout order confirmed: Restart (-3) | SkipBack (-2) | CUE (-1) | PLAY (0) | SET CUE (1) | SkipFwd (2). Matches spec.
- [x] New buttons inherit `.btn` base class — consistent styling, hover, focus, and disabled states all work without additional CSS rules.
- [x] No security issues introduced.
- [x] No regressions to existing play/pause, cue, or set-cue functionality.

### Positive Notes
The `min-width` values for the new buttons (36px for restart, 40px for skip back/forward) are well-considered — the restart button contains a single character and can be narrower, while the skip buttons include the "15" label suffix and require the extra width. This shows attention to UX detail.

---

## SPRINT-004: APPROVED

**Story**: Update EQ Panel Tooltip and Badge to Explain CORS Limitation

### Summary
All three text changes are correctly applied. Badge text is updated to "Visual Only" (without the "(v1)" suffix). Both tooltip strings have been rewritten to explain the cross-origin iframe limitation without making version promises. No logic, state, or interaction behavior has been altered.

### Passing Checks
- [x] Badge span text (line 168): reads `Visual Only` — no "(v1)" suffix. Correct.
- [x] Badge `title` attribute (line 166): explains cross-origin iframe, states values are stored and ready for future mode, makes no version promise. Correct.
- [x] Knob `title` attribute (line 134): reads `Visual only — cross-origin iframe audio cannot be processed`. No "v2" reference. Correct.
- [x] Knob `aria-label` (line 129): still ends with `(visual only)`. No change made as specified. Correct.
- [x] File-level JSDoc comment updated to reflect CORS rationale. Correct.
- [x] `.v1Badge` CSS class name intentionally left unchanged — renaming it is out of scope. This is a reasonable call noted in the implementation notes.
- [x] EQ knob interaction (drag, arrow keys, double-click reset) — no changes to handlers. Correct.
- [x] EQ values still stored in `deckStore` via `setEq` — no changes to state management. Correct.
- [x] No security issues introduced.
- [x] No regressions possible from text-only changes.

### Minor Observation (Not Blocking)
`src/types/deck.ts` line 68 still contains the JSDoc comment `/** EQ knob values in dB (visual only in v1). Range: -12 to +12. */` — the "in v1" language is inconsistent with the updated messaging in SPRINT-004. This was not in scope for the story and is not a blocking issue, but should be addressed in a follow-up cleanup pass.

---

## Overall: CHANGES REQUESTED

**Blocking story**: SPRINT-001 requires fixes before this sprint can be fully approved.

### Issue Summary

| Story | Status | Blocking Issues |
|-------|--------|-----------------|
| SPRINT-001 | CHANGES REQUESTED | 1 Major: stale `isLocal`/`audioUrl` in `youtube-player.test.ts`; 1 Minor: stale comment in `SearchPanel.tsx` |
| SPRINT-002 | APPROVED | None |
| SPRINT-003 | APPROVED | None |
| SPRINT-004 | APPROVED | None |

### Required Developer Actions (SPRINT-001)

**Fix 1 (Major) — `src/test/youtube-player.test.ts`, lines 48–49**
Remove the two stale lines from the `initialDeckState` helper:
```typescript
isLocal: false,   // remove this line
audioUrl: null,   // remove this line
```

**Fix 2 (Minor) — `src/components/Search/SearchPanel.tsx`, line 17**
Change the stale module comment from:
```
 *   - Clear (×) button in SearchBar resets query and clears results.
```
To:
```
 *   - Clear (×) button in SearchBar resets query only; results persist.
```

Once these two fixes are applied and the build/tests remain green, SPRINT-001 should be returned for final approval. SPRINT-002, SPRINT-003, and SPRINT-004 do not require any rework.
