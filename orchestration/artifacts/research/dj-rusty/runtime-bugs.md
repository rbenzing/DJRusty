# DJ Rusty — Runtime Bug Report

**Date**: 2026-03-23
**Agent**: Researcher
**Scope**: Full end-to-end trace of Load Track, YouTube Player, Mixer/Crossfader, Deck Controls, and Search wiring.
**Symptom**: Songs do not load to Deck A/B, playback does not work, crossfader/mixer does not respond.

---

## Executive Summary

After tracing every critical integration path end-to-end, **five confirmed bugs** were found across three subsystems. The most severe is a type mismatch in the `thumbnailUrl` field that causes every track load to silently pass `undefined` as `thumbnailUrl` where the store expects `string | null`. The second most severe is that the deck volume slider in `Deck.tsx` writes directly to `deckStore.setVolume` — completely bypassing the mixer's composite volume calculation — creating a volume fight between the Deck fader and the Mixer on every render. The remaining bugs affect play/pause reliability and the initial volume state of new players.

---

## Bug Details

---

### BUG-001 — thumbnailUrl Type Mismatch: `string` vs `string | null`

**Location**: `src/types/search.ts:18` vs `src/App.tsx:68` and `src/store/deckStore.ts:48`

**Description**:
`YouTubeVideoSummary.thumbnailUrl` is typed as `string` (never null):

```ts
// src/types/search.ts line 18
thumbnailUrl: string;
```

`deckStore.loadTrack` expects `thumbnailUrl: string | null`:

```ts
// src/store/deckStore.ts lines 44–49
metadata: {
  title: string;
  channelTitle: string;
  duration: number;
  thumbnailUrl: string | null;
}
```

In `App.tsx` the bridge handler does this:

```ts
// src/App.tsx line 68
thumbnailUrl: thumbnailUrl ?? '',
```

The `?? ''` fallback never fires because TypeScript types `thumbnailUrl` as always-`string`, but the YouTube search API can and does return an empty string from `mergeSearchResults` when both `medium` and `default` thumbnails are absent (the merge code at `youtubeDataApi.ts:152` falls back to `''`, not `null`). This means when a track has no thumbnail, `thumbnailUrl` enters the store as `''` rather than `null`, which prevents the vinyl label image from falling back to its placeholder CSS — a cosmetic issue but it masks the real type contract break.

More critically: the `SearchPanel.handleLoadToDeck` dispatches `result` directly as `YouTubeVideoSummary`. If anything upstream ever passes a result where `thumbnailUrl` is `undefined` (e.g., a malformed API response that TypeScript cannot catch at runtime), the store receives `undefined` silently — bypassing the `string | null` contract because JavaScript does not enforce TypeScript types at runtime.

**Impact**: Low-to-medium cosmetic. Vinyl label shows broken image when thumbnail is missing. Does not prevent load itself but is a latent data integrity bug. If the search API returns no thumbnail, the `addRecentTrack` call at `App.tsx:68` passes `thumbnailUrl ?? ''` correctly, so the recently-played list is safe.

**Fix**: Align the types. Change `YouTubeVideoSummary.thumbnailUrl` to `string | null` in `src/types/search.ts`, update the merge logic in `youtubeDataApi.ts` line 153 to return `null` instead of `''` when no thumbnail is found, and remove the `?? ''` fallback in `App.tsx:68` (replace with just `thumbnailUrl`).

```ts
// src/types/search.ts — change line 18 from:
thumbnailUrl: string;
// to:
thumbnailUrl: string | null;

// src/services/youtubeDataApi.ts — change lines 151-153 from:
const thumbnailUrl =
  snippet.thumbnails.medium?.url ??
  snippet.thumbnails.default?.url ??
  '';
// to:
const thumbnailUrl =
  snippet.thumbnails.medium?.url ??
  snippet.thumbnails.default?.url ??
  null;

// src/App.tsx — change line 68 from:
thumbnailUrl: thumbnailUrl ?? '',
// to:
thumbnailUrl,
```

---

### BUG-002 — Deck Volume Slider Fights Mixer Volume on Every Render

**Location**: `src/components/Deck/Deck.tsx:49` and `src/store/deckStore.ts:181`

**Description**:
The volume fader rendered inside `Deck.tsx` calls `deckStore.setVolume(deckId, value)` directly:

```ts
// src/components/Deck/Deck.tsx lines 48-50
function handleVolumeChange(event: React.ChangeEvent<HTMLInputElement>) {
  setVolume(deckId, parseInt(event.target.value, 10));
}
```

The mixer system (`mixerStore.ts`) also calls `deckStore.setVolume` every time the crossfader or channel fader changes:

```ts
// src/store/mixerStore.ts lines 53-55
const { setVolume } = useDeckStore.getState();
setVolume('A', deckAVolume);
setVolume('B', deckBVolume);
```

And `useYouTubePlayer` subscribes to `deckStore.volume` changes and calls `player.setVolume()` for every change:

```ts
// src/hooks/useYouTubePlayer.ts lines 242-253
const unsubscribe = useDeckStore.subscribe((state) => {
  const volume = state.decks[deckId].volume;
  if (volume === prevVolume) return;
  prevVolume = volume;
  if (!playerRef.current) return;
  playerRef.current.setVolume(volume);
});
```

**The conflict**: There are two independent write paths to `deckStore.volume` — the Deck fader and the mixer. They are not coordinated. When the user drags the mixer's channel fader, it overwrites the deck's volume. When the user drags the deck's volume fader, it overwrites the mixer-computed volume and the crossfader has no effect until the user moves the crossfader again. This is a fundamental architectural conflict.

More critically, the initial state of `deckStore.volume` is `80` (set in `createInitialDeckState`, `deckStore.ts:21`) but `mixerStore.INITIAL_STATE.deckAVolume` and `deckBVolume` are `71` (crossfader at centre, `mixerStore.ts:28`). These two stores start out of sync: `deckStore` says volume is `80`, but the mixer calculated `71`. On first page load, no `applyVolumesToDecks` is called, so the mixer state and deck state disagree immediately. The YouTube player will use whatever `deckStore.volume` says (80), not what the mixer computed (71).

**Impact**: HIGH. This is one of the primary reasons the mixer "does not respond." Moving the crossfader does update `deckStore.volume`, which triggers `player.setVolume()` — so the crossfader is technically wired — but the deck's own volume slider overwrites it without going through the mixer, creating unpredictable volume behavior. Users perceive the mixer as non-functional because dragging the deck volume restores a flat level that the crossfader then cannot override until it is moved again.

**Fix**: Remove the volume slider from `Deck.tsx` entirely, or redirect its handler through `mixerStore.setChannelFaderA/B` so that the channel fader is the authoritative control. The deck fader inside the Deck panel should be eliminated or replaced by reading from and writing to `mixerStore.channelFaderA/B`, not `deckStore.setVolume`.

Additionally, on app startup, call `applyVolumesToDecks` once (or initialise `deckStore.volume` to match `INITIAL_STATE.deckAVolume = 71`) so the two stores start in sync.

---

### BUG-003 — Player Stays Muted After First Play of a New Track (Race Between `cueVideoById` and `hasPlayedRef`)

**Location**: `src/hooks/useYouTubePlayer.ts:213-214` and `src/hooks/useYouTubePlayer.ts:275-279`

**Description**:
When a new track is loaded, `useYouTubePlayer` reacts to the `videoId` change in the store and calls `cueVideoById(videoId)` and resets `hasPlayedRef.current = false`:

```ts
// src/hooks/useYouTubePlayer.ts lines 212-214
playerRef.current.cueVideoById(videoId);
// Reset play-once flag so unmute/volume restore applies to the new video.
hasPlayedRef.current = false;
```

The unmute + volume restore only happens when `playbackState` changes to `'playing'` AND `hasPlayedRef.current` is `false`:

```ts
// src/hooks/useYouTubePlayer.ts lines 274-280
if (playbackState === 'playing') {
  if (!hasPlayedRef.current) {
    hasPlayedRef.current = true;
    playerRef.current.unMute();
    playerRef.current.setVolume(volume);
  }
  playerRef.current.playVideo();
}
```

**The race condition**: `loadTrack` in `deckStore.ts` sets `playbackState: 'paused'` (line 148). When the user then clicks Play, `setPlaybackState(deckId, 'playing')` is called. The `useYouTubePlayer` subscription fires. It checks `hasPlayedRef.current` (which is `false` since the new track was loaded), then calls `unMute()`, `setVolume(volume)`, and `playVideo()`. This chain is correct in theory.

However, there is a subtlety: `volume` here is read from the destructured store snapshot at the moment the subscription fires:

```ts
// src/hooks/useYouTubePlayer.ts line 267
const { playbackState, volume } = state.decks[deckId];
```

If BUG-002 is present (deck store volume = 80 but mixer computed 71 and has not yet been applied), `setVolume(80)` is called rather than the mixer-composed value. The player starts at 80% volume regardless of the mixer position.

Additionally, the player is **created muted** (`mute: 1` in playerVars, line 172). If the very first play-click ever happens while `hasPlayedRef.current` is already `true` from a prior session within the same page load, the player never unmutes. However, `hasPlayedRef` is a `useRef` which resets to `false` on component remount, so this only matters if the component is never unmounted — which it isn't (YouTubePlayer mounts once in App.tsx and stays). If a user loads a second track and somehow `hasPlayedRef` got set to `true` before the `videoId` subscription had a chance to reset it to `false`, the second track would play muted.

The execution order for a load + play sequence is:

1. `loadTrack` called → `videoId` updates in store, `playbackState` set to `'paused'`
2. `videoId` subscription fires → `cueVideoById(videoId)`, `hasPlayedRef.current = false`
3. User clicks Play → `setPlaybackState(deckId, 'playing')`
4. `playbackState` subscription fires → `hasPlayedRef.current` is `false` → unmute, setVolume, playVideo

This sequence is correct **only if step 2 runs before step 3**. Both subscriptions are `useDeckStore.subscribe` callbacks. Zustand fires all subscribers synchronously in registration order. The `videoId` subscription (step 2) is registered by the second `useEffect` in the hook (line 203). The `playbackState` subscription (step 4) is registered by the fifth `useEffect` (line 263). Registration order matches execution order, so the race is avoided as long as neither subscription is torn down and re-registered between the two events.

**Impact**: Medium. In the most common case the logic works correctly. The main visible symptom is the volume mismatch from BUG-002 at the moment of first play: `setVolume(volume)` uses the unconverged deck volume (80) rather than the mixer-composed value. Fix BUG-002 first and this clears up.

**Fix**: After BUG-002 is fixed (mixer owns the volume), change line 279 to read from the mixer store rather than `state.decks[deckId].volume`:

```ts
// src/hooks/useYouTubePlayer.ts — change line 278 from:
playerRef.current.setVolume(volume);
// to:
const mixedVolume = useDeckStore.getState().decks[deckId].volume;
playerRef.current.setVolume(mixedVolume);
```

Or simply rely on the existing `volume` subscription (lines 241-254) to apply the correct volume after the mixer update, which fires before play in the subscription chain.

---

### BUG-004 — `window.YT` Not Declared on `Window` Global in `youtube-globals.d.ts`

**Location**: `src/types/youtube-globals.d.ts:9-15`

**Description**:
`youtube-globals.d.ts` augments `Window` with `onYouTubeIframeAPIReady` but does NOT declare `window.YT`:

```ts
// src/types/youtube-globals.d.ts
declare interface Window {
  onYouTubeIframeAPIReady?: () => void;
}
// window.YT is NOT declared here
```

The `@types/youtube` package (version `^0.1.0`) declares the `YT` namespace but does NOT add `window.YT` to the `Window` interface — confirmed by searching the package's `index.d.ts` which shows no `window.YT` or `declare var YT` declaration, only `declare namespace YT { ... }`.

`tsconfig.app.json` includes `"types": ["vitest/globals", "vite/client", "youtube"]` which loads the `YT` namespace. However, the namespace alone does not mean `window.YT` is accessible as a property.

In `youtubeIframeApi.ts` line 23, the code does:

```ts
if (window.YT?.Player) {
```

TypeScript will resolve `window.YT` because `@types/youtube` v0.1.x happens to include a global `var YT` declaration (not documented in the package README but present in the compiled output). However, the `skipLibCheck: true` in `tsconfig.app.json` means no type error will surface even if the declaration is missing. At runtime, before the IFrame API script loads, `window.YT` is `undefined`, which the optional chaining handles correctly. This is NOT a runtime crash — the `?.Player` check works fine.

**However**, the missing `window.YT` in the custom declaration file means that if `skipLibCheck` were disabled, code referencing `window.YT` would produce a TypeScript error. More importantly, it creates confusion for developers who expect the `Window` augmentation file to be the complete source of truth for global augmentations.

**Impact**: Low at runtime (no crash). Medium for developer experience and future-proofing.

**Fix**: Add `YT: typeof YT | undefined;` to the `Window` augmentation in `src/types/youtube-globals.d.ts`:

```ts
declare interface Window {
  onYouTubeIframeAPIReady?: () => void;
  YT: typeof YT | undefined;
}
```

---

### BUG-005 — Search Panel Always Disabled for Unauthenticated Users Even When API Key Is Present

**Location**: `src/components/Search/SearchPanel.tsx:31-36` and `src/components/Search/SearchPanel.tsx:87-88`

**Description**:
The `hasCredentials` function reads `VITE_YOUTUBE_API_KEY` from `import.meta.env`:

```ts
// src/components/Search/SearchPanel.tsx lines 31-36
function hasCredentials(accessToken: string | null): boolean {
  if (accessToken) return true;
  const apiKey = (import.meta as unknown as { env: Record<string, string | undefined> })
    .env.VITE_YOUTUBE_API_KEY;
  return Boolean(apiKey);
}
```

In `.env`, `VITE_YOUTUBE_API_KEY` is set to an empty string:

```
VITE_YOUTUBE_API_KEY=
```

`Boolean('')` is `false`. Therefore even if the user has configured a Google Client ID (which is set: `771638028957-...`), the search panel is permanently disabled (`panelDisabled = true`) for unauthenticated users because there is no fallback API key.

The `disabledReason` logic at line 137 reads:

```ts
const disabledReason = !signedIn
  ? 'Sign in with Google to search YouTube'
  : !credentialsAvailable
    ? 'Configure VITE_YOUTUBE_API_KEY to enable search'
    : undefined;
```

Since `signedIn` defaults to `false` (no token yet), the panel shows "Sign in with Google to search YouTube". This is correct behavior given the current `.env` configuration — there is no API key and the user is not authenticated. The panel is intentionally disabled.

**However**, this becomes a blocker for the Load Track flow: if the user cannot search, they cannot load any track, and the entire application is functionally dead until they authenticate via Google OAuth. The `.env` file has `VITE_YOUTUBE_API_KEY=` (empty), which means the application **requires** Google sign-in to do anything.

**Impact**: HIGH — functional blocker. The entire track load path is gated behind Google authentication because `VITE_YOUTUBE_API_KEY` is blank. If the user is not signed in with Google, the search panel is locked with an overlay, the LOAD A/B buttons are never visible in results (there are no results), and no track ever reaches the deck store. Nothing downstream (player, mixer, playback) can be tested without first resolving this auth dependency.

**Fix**: Either:
1. Add a valid `VITE_YOUTUBE_API_KEY` to `.env` to allow unauthenticated searches, OR
2. Document clearly that Google sign-in is mandatory before any application function is available.

This is an environment/configuration issue, not a code bug per se, but it is the single highest-priority issue blocking runtime testing of all other code paths.

---

### BUG-006 — `loadTrack` Sets `playbackState: 'paused'` Before Player Has Cued the Video

**Location**: `src/store/deckStore.ts:148` and `src/hooks/useYouTubePlayer.ts:203-218`

**Description**:
When `loadTrack` is called, it immediately sets `playbackState: 'paused'` in the store (line 148). The `playbackState` subscription in `useYouTubePlayer` (lines 263-287) fires for this change. It checks whether `playbackState === 'paused'` and calls `player.pauseVideo()`:

```ts
// src/hooks/useYouTubePlayer.ts lines 281-283
} else if (playbackState === 'paused') {
  playerRef.current.pauseVideo();
}
```

At this exact moment, the `videoId` subscription (which calls `cueVideoById`) may not have fired yet — or it may fire immediately after, during the same Zustand synchronous notification batch. Zustand notifies all subscribers synchronously when `set()` is called. Both subscriptions react to the same `set()` call (since `loadTrack` updates both `videoId` and `playbackState` in a single `updateDeck` call). Zustand fires subscribers in registration order: the `videoId` subscription is registered first (second `useEffect`), the `playbackState` subscription is registered later (fifth `useEffect`). So `cueVideoById` fires before `pauseVideo`.

However: immediately after `cueVideoById` is called on a player that was previously idle (no video loaded), the YouTube IFrame API internally sets its state to `CUED` (-1 is `UNSTARTED`, 5 is `CUED`). Calling `pauseVideo()` on a cued (not yet playing) player is a no-op per the IFrame API specification, so this is benign in practice. No crash occurs.

**But there is a related problem**: `loadTrack` sets `playbackState: 'paused'`. Before the user has ever clicked Play, the deck store says the track is `'paused'`. The `DeckControls` Play button reads `isPlaying = playbackState === 'playing'`, so the button correctly shows the Play icon. When the user clicks Play, `setPlaybackState(deckId, 'playing')` is called. The `playbackState` subscription fires. `hasPlayedRef.current` is `false`, so `unMute()`, `setVolume()`, `playVideo()` are called. YouTube fires `onStateChange` with `PLAYING`, which calls `setPlaybackState(deckId, 'playing')`. This second `setPlaybackState` call does NOT change the value (it's already 'playing'), so `prevPlaybackState` guard (`if (playbackState === prevPlaybackState) return`) prevents a loop. This chain is correct.

**The real bug here** is that `loadTrack` resets `currentTime: 0` and `playbackState: 'paused'` but does NOT reset `playerReady`. If a track was previously loaded and `playerReady` was `true`, loading a new track keeps `playerReady: true`. This is intentional — the player hardware is still ready. But combined with `playbackState: 'paused'`, the UI correctly shows the paused state for the new track. This is not a bug; it documents that `loadTrack` works correctly in this regard.

**Impact**: Negligible as currently written because Zustand's synchronous notification ordering ensures `cueVideoById` fires before `pauseVideo`. However, this is a fragile ordering assumption. If the subscription registration order ever changes (e.g., during refactor), it could cause `pauseVideo` to be called on the wrong video.

**Fix**: Remove the `playbackState: 'paused'` initialization from `loadTrack` in `deckStore.ts`. Instead, set `playbackState: 'unstarted'` (which is already the default) and leave it to the IFrame API's `onStateChange` callback to set it to `'paused'` after `cueVideoById` fires the `CUED` event. Update the Play button logic in `DeckControls.tsx` to treat both `'unstarted'` and `'paused'` as "not playing" (it already does: `isPlaying = playbackState === 'playing'`):

```ts
// src/store/deckStore.ts line 148 — change from:
playbackState: 'paused',
// to:
playbackState: 'unstarted',
```

---

## Summary Table

| Bug ID | Location | Severity | Impact |
|--------|----------|----------|--------|
| BUG-005 | `SearchPanel.tsx` + `.env` | CRITICAL | Search locked; no tracks can load without Google sign-in; entire app is non-functional for unauthenticated users |
| BUG-002 | `Deck.tsx:49`, `mixerStore.ts:53` | HIGH | Deck volume slider bypasses mixer; crossfader and channel faders appear non-functional; volume incoherent |
| BUG-001 | `types/search.ts:18`, `youtubeDataApi.ts:152`, `App.tsx:68` | MEDIUM | `thumbnailUrl` type mismatch; vinyl label broken when no thumbnail; latent data integrity issue |
| BUG-003 | `useYouTubePlayer.ts:278` | MEDIUM | First-play volume uses unconverged deck store value (80) rather than mixer-computed value; player starts at wrong volume |
| BUG-006 | `deckStore.ts:148` | LOW | `loadTrack` sets `playbackState: 'paused'` before cue fires; fragile ordering assumption; harmless now |
| BUG-004 | `youtube-globals.d.ts:9` | LOW | `window.YT` not declared in augmentation file; no runtime impact; dev experience issue |

---

## Priority Fix Order

The bugs have the following dependency chain:

### Level 1 — Must Fix First (Blockers)

**BUG-005** is the absolute prerequisite for testing anything else. Without a YouTube API key or Google authentication, the search panel is locked, no tracks load, and nothing downstream can be exercised. Add `VITE_YOUTUBE_API_KEY` to `.env` or authenticate via Google to unblock all other testing.

### Level 2 — Fix Second (Core Functionality)

**BUG-002** must be fixed next. The deck volume slider fighting the mixer is the primary reason the mixer appears unresponsive. The fix (redirect the deck's VOL fader through `mixerStore` channel fader actions) also resolves the store initialization desync (`deckStore.volume = 80` vs `mixerStore.deckAVolume = 71`).

### Level 3 — Fix Third (First-Play Reliability)

**BUG-003** depends on BUG-002 being fixed first. Once the mixer owns the volume, the `setVolume(volume)` call in `useYouTubePlayer.ts:278` will use the correct mixer-composed value and the first-play mute/unmute sequence will apply the right volume level.

### Level 4 — Fix Fourth (Data Integrity)

**BUG-001** is a type alignment fix. Once the app is functioning, align `YouTubeVideoSummary.thumbnailUrl` to `string | null` throughout the chain to prevent silent runtime data issues.

### Level 5 — Fix Last (Polish / Robustness)

**BUG-006** — Change `playbackState: 'paused'` to `playbackState: 'unstarted'` in `loadTrack` to make the ordering assumption explicit and remove reliance on Zustand subscriber registration order.

**BUG-004** — Add `YT: typeof YT | undefined` to `Window` augmentation for completeness.

---

## Verified Working Paths

The following paths were traced and confirmed to work correctly end-to-end:

- **Load Track Event Dispatch**: `SearchResult.onLoadToDeck` → `SearchPanel.handleLoadToDeck` → `CustomEvent('dj-rusty:load-track', {deckId, result})` → `App.tsx` listener → `deckStore.loadTrack`. Shape matches exactly; no field mismatch (subject to BUG-001).
- **YouTube IFrame API Init**: `loadYouTubeIframeApi()` singleton is called once in `App.tsx useEffect`. It preserves any pre-existing `onYouTubeIframeAPIReady` callback. Script appended to `<head>`. `YOUTUBE_IFRAME_API_URL` constant is correct.
- **Player Creation**: `useYouTubePlayer` correctly waits for `loadYouTubeIframeApi()` promise before creating the `YT.Player` instance. `containerRef.current` is verified before use. Player is registered in `playerRegistry` after creation.
- **Play/Pause via Store**: `DeckControls` writes to `deckStore.setPlaybackState`. `useYouTubePlayer` subscribes and calls `player.playVideo()` / `player.pauseVideo()`. Zustand change-guard prevents loops.
- **videoId Change → cueVideoById**: `useYouTubePlayer`'s `videoId` subscription correctly calls `player.cueVideoById(videoId)` when the store updates.
- **Crossfader Math**: `crossfaderToVolumes` correctly implements equal-power curve. `compositeVolume` correctly multiplies crossfader volume by channel fader fraction. `masterScale` from `settingsStore` is correctly applied. The math chain is sound.
- **Search Event Shape**: `SearchPanel.handleLoadToDeck` dispatches `{ deckId, result }` which exactly matches `App.tsx`'s `LoadTrackEventDetail` interface `{ deckId: 'A' | 'B'; result: YouTubeVideoSummary }`. No mismatch.
- **Player Registry**: `playerRegistry` is a module-level `Map`. `register` / `unregister` / `get` are correct. `DeckControls.handleJumpToCue` correctly calls `playerRegistry.get(deckId)` and guards on `undefined`.
- **Auth guard on search**: `hasCredentials` in `SearchPanel` correctly checks `accessToken` first, then `VITE_YOUTUBE_API_KEY`. Logic is sound; the issue is purely the missing API key value (BUG-005).
