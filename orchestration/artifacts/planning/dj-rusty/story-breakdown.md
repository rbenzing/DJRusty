# Story Breakdown

> Project: `dj-rusty`
> Date: 2026-03-21
> Total Stories: 14

---

## STORY-001: Project Scaffolding

**Complexity**: S
**Dependencies**: None

### Description
Bootstrap the Vite + React + TypeScript project with Zustand, CSS Modules, environment variable setup, and Vitest test configuration. Establish the full directory structure from architecture.md.

### Acceptance Criteria
- [ ] `npm create vite@latest dj-rusty -- --template react-ts` scaffolded
- [ ] Zustand 4.x installed
- [ ] `@types/youtube`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom` installed
- [ ] `.env.example` with `VITE_GOOGLE_CLIENT_ID` and `VITE_YOUTUBE_API_KEY` variables
- [ ] `vite.config.ts` configured with jsdom test environment
- [ ] `src/test/setup.ts` with `YT` global mock
- [ ] Full `src/` directory structure created (empty files/folders matching architecture.md §4)
- [ ] All Zustand store slice files created with empty shells (`deckStore.ts`, `mixerStore.ts`, `searchStore.ts`, `authStore.ts`)
- [ ] All type definition files created (`deck.ts`, `mixer.ts`, `search.ts`, `auth.ts`, `youtube.ts`)
- [ ] `src/constants/pitchRates.ts` with `PITCH_RATES` constant and `PitchRate` type
- [ ] `npm run dev` starts without errors
- [ ] `npm test` runs (0 tests, but no errors)
- [ ] `npm run build` completes without TypeScript errors

### Technical Notes
- Use strict TypeScript (`"strict": true` in tsconfig)
- CSS reset in `src/index.css`; design tokens (CSS custom properties) in `:root` from design-system.md
- App background: `#0a0a0a`; font: Rajdhani or system monospace for LCD displays

---

## STORY-002: Google SSO Authentication

**Complexity**: M
**Dependencies**: STORY-001

### Description
Implement Google Identity Services (GIS) OAuth 2.0 token flow. User can sign in with Google, receive a YouTube-scoped access token stored in memory, and sign out.

### Acceptance Criteria
- [ ] GIS script tag in `index.html`
- [ ] `authService.ts` implemented: `initAuth()`, `requestToken()`, `signOut()`
- [ ] `authStore.ts` implemented with slices: `accessToken`, `expiresAt`, `userInfo`, `signedIn` + actions
- [ ] `useAuth.ts` hook wraps `authService` and syncs to `authStore`
- [ ] `AuthButton.tsx` renders "Sign in with Google" when unauthenticated; shows user avatar + name when signed in
- [ ] `AuthStatus.tsx` shows email and profile picture
- [ ] Token stored in Zustand memory only — never written to `localStorage`
- [ ] Sign-out clears `authStore` completely
- [ ] On auth error (popup blocked, user cancels): show toast notification
- [ ] `VITE_GOOGLE_CLIENT_ID` loaded via `import.meta.env`
- [ ] Unit tests for `authStore` actions

### Technical Notes
- Use `google.accounts.oauth2.initTokenClient()` with `scope: 'https://www.googleapis.com/auth/youtube.readonly'`
- `requestAccessToken({ prompt: '' })` for silent refresh when session active
- User info fetched from `https://www.googleapis.com/oauth2/v3/userinfo` after token received
- Type: `interface GoogleUserInfo { name: string; email: string; picture: string; sub: string }`

---

## STORY-003: YouTube IFrame API Integration

**Complexity**: M
**Dependencies**: STORY-001

### Description
Implement the YouTube IFrame API singleton loader and `useYouTubePlayer` hook. Create the `YouTubePlayer` component that mounts an invisible player in the DOM and exposes imperative controls.

### Acceptance Criteria
- [ ] `youtubeIframeApi.ts` singleton loader: script injected once, returns Promise resolving when `YT.Player` is available
- [ ] `useYouTubePlayer(deckId, containerRef)` hook implemented
- [ ] `YT.Player` instance created, stored in `useRef` (never in Zustand)
- [ ] `onReady` → sets `playerReady: true` in `deckStore` for the deck
- [ ] `onStateChange` → maps YT state to `playbackState` enum in deck store
- [ ] `onError` codes 101/150 → deck error state + toast "Video cannot be embedded"
- [ ] `currentTime` polled every 250ms while `PLAYING`; poll cleared on pause/end/unmount
- [ ] `playVideo()`, `pauseVideo()`, `seekTo()` callable from store actions via playerRef
- [ ] `setVolume()` callable from crossfader/mixer changes
- [ ] `setPlaybackRate()` called when `pitchRate` changes in deck store
- [ ] `cueVideoById(videoId)` called when `videoId` changes in deck store
- [ ] Player initialized with `mute: 1` (autoplay policy); `unMute()` + `setVolume()` called on first Play press
- [ ] Player DOM container is `width="1" height="1"` (hidden but present in DOM for ToS compliance)
- [ ] `player.destroy()` called on component unmount
- [ ] Unit tests for singleton loader (mock script injection)

### Technical Notes
- `window.onYouTubeIframeAPIReady` must use safe append pattern (don't overwrite existing callback)
- `loadYouTubeIframeApi()` called in `App.tsx` useEffect on mount
- Player container divs: `id="yt-player-a"` and `id="yt-player-b"`

---

## STORY-004: Deck A UI Shell

**Complexity**: L
**Dependencies**: STORY-001, STORY-003

### Description
Build the complete Deck A visual component with vinyl platter animation, transport controls, track info display, and all deck control panels. Connected to Deck A's Zustand store slice.

### Acceptance Criteria
- [ ] `Deck.tsx` container renders the full deck layout matching ui-spec.md
- [ ] Vinyl platter (`VinylPlatter.tsx`): CSS keyframe spin animation
  - [ ] Spins when `playbackState === 'playing'`
  - [ ] Paused when `playbackState === 'paused'` or `'unstarted'`
  - [ ] Animation speed reflects `pitchRate` (`animation-duration: ${1.8/pitchRate}s`)
  - [ ] Dark vinyl disc design with grooves and center label (CSS gradient)
- [ ] `DeckDisplay.tsx`: track title, channel name, current time / total duration
- [ ] `DeckControls.tsx`: Play/Pause button, Cue button (stores/returns to cue point)
- [ ] `PitchSlider.tsx`: stepped slider snapping to 8 `PITCH_RATES` values; displays current rate (e.g. "×1.00")
- [ ] `BpmDisplay.tsx`: LCD-style display showing BPM (or "---" if not set)
- [ ] `TapTempo.tsx`: TAP button; calculates BPM from tap intervals using `TapTempoCalculator`
- [ ] `EQPanel.tsx`: three visual rotary knobs (Low/Mid/High), labelled "Visual Only (v1)"
- [ ] Volume fader (vertical slider, 0–100)
- [ ] Empty state: deck shows "No Track Loaded" with load instructions
- [ ] Buffering state: spinner overlay on platter
- [ ] Error state: error message displayed on deck
- [ ] All Deck A state reads from `deckStore` (`deckId: 'A'`)
- [ ] Unit tests for `TapTempoCalculator` utility

### Technical Notes
- Rotary knob interaction: mouse drag (vertical movement = rotation change)
- Use CSS custom property `--platter-state` and `--platter-duration` for animation control
- EQ knobs must have `title="Visual Only — EQ processing coming in v2"` tooltip

---

## STORY-005: Deck B UI Shell

**Complexity**: S
**Dependencies**: STORY-004

### Description
Deck B is identical to Deck A in structure, connected to Deck B's store slice. Deck B has a distinct accent colour (red/orange vs. blue for Deck A) per design-system.md.

### Acceptance Criteria
- [ ] Deck B renders with same component structure as Deck A
- [ ] Deck B state reads from `deckStore` (`deckId: 'B'`)
- [ ] `YouTubePlayer` component mounted for Deck B (`id="yt-player-b"`)
- [ ] Deck B accent colour: `--deck-b-accent` token applied
- [ ] Both decks visible simultaneously in the 3-column layout
- [ ] Visual differentiation: "A" label on Deck A, "B" label on Deck B

### Technical Notes
- `Deck.tsx` accepts `deckId: 'A' | 'B'` prop — no code duplication
- CSS accent colour swap via `data-deck="a"` / `data-deck="b"` attribute on container

---

## STORY-006: Mixer Panel + Crossfader

**Complexity**: M
**Dependencies**: STORY-003, STORY-004, STORY-005

### Description
Build the center mixer panel with crossfader, per-deck channel volume knobs, and VU meter visualization. Wire up the constant-power crossfade curve to `setVolume()` on both IFrame players.

### Acceptance Criteria
- [ ] `Mixer.tsx` renders in center column between Deck A and Deck B
- [ ] `Crossfader.tsx`: horizontal slider `[0, 1]`; updates `mixerStore.crossfaderPosition`
- [ ] `crossfaderToVolumes(position)` utility implemented (constant-power curve)
- [ ] On crossfader change: `playerA.setVolume(compositeVolume(volA, chanA))` and `playerB.setVolume(compositeVolume(volB, chanB))` called
- [ ] Per-deck channel volume faders in mixer (in addition to deck volume faders)
- [ ] `VUMeter.tsx`: animated level bars (visual-only, based on volume level not actual audio)
- [ ] Crossfader center position (0.5) = both decks at ~71% (equal power)
- [ ] Crossfader full left (0.0) = Deck A at 100%, Deck B at 0%
- [ ] Crossfader full right (1.0) = Deck A at 0%, Deck B at 100%
- [ ] Volume changes applied within 50ms of user interaction
- [ ] `mixerStore.ts` fully implemented with crossfader and volume state
- [ ] Unit tests for `crossfaderToVolumes` and `compositeVolume` utilities

### Technical Notes
- VU meter uses volume value from store, not audio analysis (CORS constraint)
- Beat Sync button present but disabled with tooltip "Coming in v2 — requires audio analysis"

---

## STORY-007: YouTube Data API + Search Panel

**Complexity**: M
**Dependencies**: STORY-002

### Description
Implement YouTube Data API v3 integration for track search. Build the search panel with results list including thumbnail, title, channel, and duration.

### Acceptance Criteria
- [ ] `youtubeDataApi.ts` implemented:
  - [ ] `searchVideos(query, token, pageToken?)` — two-step (search.list + videos.list batch)
  - [ ] `parseDuration(iso8601)` — converts `PT1H23M45S` to seconds
  - [ ] Error handling for `quotaExceeded`, `forbidden`, `keyInvalid`
- [ ] `searchStore.ts` fully implemented: `query`, `results`, `nextPageToken`, `loading`, `error`
- [ ] `SearchPanel.tsx` renders at bottom of app
- [ ] Search bar with submit on Enter or button click
- [ ] Results list: thumbnail, title, channel name, formatted duration
- [ ] Loading skeleton while fetching
- [ ] Error state with message (including quota exceeded message)
- [ ] Empty state: "No results" or "Search for a track to get started"
- [ ] "Load Next Page" button when `nextPageToken` present
- [ ] Track browser disabled (greyed out) when user is not authenticated
- [ ] `VITE_YOUTUBE_API_KEY` used as fallback for unauthenticated searches
- [ ] Unit tests for `parseDuration` utility
- [ ] Unit tests for `searchStore` actions

### Technical Notes
- `videoCategoryId: '10'` (Music) in search params to filter to music content
- Debounce search: don't trigger on every keystroke — wait for Enter or button press
- Cache last search results in `searchStore` to avoid re-fetching on scroll/navigate

---

## STORY-008: Load Track to Deck

**Complexity**: M
**Dependencies**: STORY-003, STORY-004, STORY-007

### Description
Connect the search results panel to the deck players. User clicks "Load to Deck A" or "Load to Deck B" on a search result and the track loads into that deck.

### Acceptance Criteria
- [ ] Each search result row has "Load A" and "Load B" buttons
- [ ] Clicking "Load A/B" dispatches `loadTrack(deckId, videoId, { title, channelTitle, duration })` to deck store
- [ ] Deck store updates: `videoId`, `title`, `channelTitle`, `duration`, resets `currentTime`, `loopActive`, `loopStart`, `loopEnd`, `bpm`
- [ ] `YouTubePlayer` component reacts to `videoId` change: calls `player.cueVideoById(videoId)` (pre-loads without auto-play)
- [ ] Deck display immediately shows new track title and duration
- [ ] Vinyl platter stops if it was spinning (deck transitions to 'paused' state)
- [ ] Hot cues for the loaded video loaded from localStorage and set in deck state
- [ ] If video is unembeddable: deck error state shown, track cleared
- [ ] Thumbnail from search result used as vinyl label image in deck

### Technical Notes
- `cueVideoById` (not `loadVideoById`) to avoid autoplay without user gesture
- Store `thumbnailUrl` in deck state for use as platter center label

---

## STORY-009: Pitch Control

**Complexity**: S
**Dependencies**: STORY-004, STORY-005, STORY-003

### Description
Wire up the pitch slider to `setPlaybackRate()` on the IFrame player. Sync vinyl platter animation speed to the current playback rate.

### Acceptance Criteria
- [ ] Pitch slider in each deck allows selecting from 8 discrete values (PITCH_RATES)
- [ ] Slider position maps to PITCH_RATES index (left = 0.25×, center = 1×, right = 2×)
- [ ] On pitch change: `player.setPlaybackRate(rate)` called
- [ ] `onPlaybackRateChange` event confirms actual rate; `deckStore.pitchRate` updated
- [ ] If `player.getAvailablePlaybackRates()` returns `[1]` only: pitch slider disabled, labelled "Rate locked by video"
- [ ] Vinyl platter `animation-duration` updates immediately on pitch change
- [ ] Rate displayed as "×0.75", "×1.00", "×1.25" etc. on deck
- [ ] Reset to 1× button next to slider

### Technical Notes
- Some videos may not support all playback rates — always use `getAvailablePlaybackRates()` to constrain slider options after player is ready

---

## STORY-010: Tap-Tempo BPM + Loop Controls

**Complexity**: M
**Dependencies**: STORY-004, STORY-005

### Description
Implement tap-tempo BPM calculation and beat-synced loop controls on each deck.

### Acceptance Criteria
- [ ] `TapTempoCalculator` class in `src/utils/tapTempo.ts`
- [ ] `useTapTempo(deckId)` hook wraps calculator and updates `deckStore.bpm`
- [ ] TAP button: each tap records timestamp; BPM calculated after 2nd tap; updates after each subsequent tap
- [ ] BPM resets after 3 seconds of inactivity between taps
- [ ] BPM display: shows numeric BPM (e.g. "128") or "---" if not set; LCD-style monospace font
- [ ] Loop buttons: 4-beat, 8-beat, 16-beat
- [ ] Loop buttons disabled and tooltipped "Set BPM first" when `bpm === null`
- [ ] Pressing loop button: records `loopStart = currentTime`, calculates `loopEnd = loopStart + (beatCount/bpm)*60`
- [ ] Active loop: 250ms `currentTime` poll checks if `currentTime >= loopEnd`; if so calls `player.seekTo(loopStart)`
- [ ] Active loop button highlighted; pressing again exits loop (clears `loopActive`)
- [ ] Loop exits automatically when deck is paused
- [ ] Unit tests for `TapTempoCalculator`
- [ ] Unit tests for loop boundary calculation

### Technical Notes
- Loop `seekTo(loopStart, true)` — `allowSeekAhead: true` prevents buffering pause
- Keep loop check lightweight: only runs when `loopActive === true`

---

## STORY-011: Hot Cues

**Complexity**: S
**Dependencies**: STORY-008

### Description
Implement 4 hot cue buttons per deck that store and recall timestamp positions. Cues persist in localStorage keyed by video ID.

### Acceptance Criteria
- [ ] 4 hot cue buttons per deck labelled 1–4
- [ ] Unset cues: dim appearance, press = SET mode (stores `currentTime` as cue)
- [ ] Set cues: lit/colored appearance, press = JUMP mode (calls `seekTo(cueTimestamp)`)
- [ ] Long-press (500ms) on a set cue = CLEAR the cue
- [ ] Cues stored in localStorage via `setHotCue(videoId, index, timestamp)` utility
- [ ] On track load: `getHotCues(videoId)` loaded into deck state
- [ ] Cues persist across page reloads (localStorage survives refresh)
- [ ] Unit tests for `getHotCues` and `setHotCue` utilities

### Technical Notes
- Hot cue colors: Cue 1 = cyan, Cue 2 = green, Cue 3 = yellow, Cue 4 = red (matches DJ convention)
- If no video loaded: hot cue buttons disabled

---

## STORY-012: EQ Panel (Visual Only)

**Complexity**: S
**Dependencies**: STORY-004, STORY-005

### Description
Add interactive EQ knobs (Low/Mid/High) to each deck. These are visual-only in v1 — they do not affect audio — but are clearly labelled as such and persist their values in deck state for future use.

### Acceptance Criteria
- [ ] Three rotary knobs per deck: Low, Mid, High
- [ ] Knob range: -12 to +12 dB (visual scale only)
- [ ] Default position: center (0 dB)
- [ ] Drag interaction: vertical mouse movement rotates knob
- [ ] Values stored in `deckStore` (`eqLow`, `eqMid`, `eqHigh`)
- [ ] "Visual Only (v1)" badge or tooltip on each knob
- [ ] Knob visual: CSS gradient disc with indicator marker line
- [ ] Keyboard accessible: focus + arrow keys adjust value

### Technical Notes
- No audio effect — values stored for future v2 Web Audio EQ implementation
- `EQKnob` component is reusable (used 3× per deck × 2 decks = 6 instances)

---

## STORY-013: Settings Modal

**Complexity**: S
**Dependencies**: STORY-002

### Description
Build the settings modal accessible from the header. Shows connected Google account details and provides sign-out functionality.

### Acceptance Criteria
- [ ] Settings gear icon in header opens `SettingsModal.tsx`
- [ ] Modal shows: user avatar, display name, email
- [ ] YouTube channel name fetched from `GET /youtube/v3/channels?mine=true`
- [ ] "Sign Out" button: calls `authService.signOut()`, clears `authStore`, closes modal, disables track browser
- [ ] Modal closes on Escape key or clicking backdrop
- [ ] Focus trapped inside modal when open
- [ ] `<dialog>` element used for native accessibility
- [ ] `uiStore.settingsOpen` boolean controls visibility

### Technical Notes
- Channel info fetched once on sign-in and cached in `authStore`
- `channels.list` costs 1 quota unit

---

## STORY-014: Polish, Accessibility & Testing

**Complexity**: M
**Dependencies**: All previous stories complete

### Description
Final accessibility pass, keyboard shortcut implementation, responsive layout tweaks, and comprehensive test coverage. Ensure WCAG 2.1 AA compliance per accessibility.md.

### Acceptance Criteria

**Keyboard Shortcuts**:
- [ ] `Space` = Play/Pause focused deck (or Deck A by default)
- [ ] `Q` = Play/Pause Deck A; `W` = Play/Pause Deck B
- [ ] `←`/`→` arrow keys = move crossfader by 5%
- [ ] `1`–`4` = trigger hot cues on focused deck
- [ ] `T` = tap tempo on focused deck
- [ ] All shortcuts documented in UI (keyboard shortcut tooltip or help modal)

**Accessibility**:
- [ ] All interactive controls have descriptive `aria-label` attributes
- [ ] Sliders use `<input type="range">` with `aria-valuetext` showing human-readable value
- [ ] Vinyl platter has `aria-hidden="true"` (decorative)
- [ ] Live regions (`aria-live="polite"`) for track loaded, BPM updated notifications
- [ ] All color contrast pairs pass WCAG AA (4.5:1 for text, 3:1 for UI components)
- [ ] `prefers-reduced-motion` media query: stops vinyl spin, disables CSS transitions
- [ ] Focus visible on all interactive elements
- [ ] Tab order logical: Header → Deck A controls → Mixer → Deck B controls → Search

**Testing**:
- [ ] Unit tests achieve ≥80% coverage on utilities (`tapTempo`, `volumeMap`, `formatTime`, `hotCues`, `pitchRates`)
- [ ] Integration tests for `authStore`, `deckStore`, `mixerStore`, `searchStore`
- [ ] Component tests for `Crossfader`, `PitchSlider`, `TapTempo`, `AuthButton`
- [ ] `npm run build` completes with zero TypeScript errors
- [ ] `npm test` passes with zero failures

### Technical Notes
- Use `useHotkeys` library or manual `keydown` event listener on `document`
- Test `TapTempoCalculator` edge cases: single tap (no BPM), rapid taps, reset after inactivity
