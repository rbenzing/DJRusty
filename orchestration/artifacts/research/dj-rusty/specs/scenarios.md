# User Scenarios

> Project: `dj-rusty`

---

## Scenario 1: First-Time Login

**Actor**: New user
**Goal**: Sign in with Google and access the DJ interface

**Steps**:
1. User opens the app — sees a dark DJ interface with both decks empty and track browser disabled
2. A "Sign in with Google" button is prominent in the top-right header
3. User clicks "Sign in with Google"
4. Google OAuth consent screen appears requesting `youtube.readonly` permission
5. User grants permission
6. App receives access token (stored in memory), fetches user profile (name, avatar) and channel uploads
7. Header updates to show user avatar + name
8. Track browser panel activates — user's recent uploads appear as a default list
9. Decks remain empty; user is now ready to load tracks

**Expected Outcome**: Authenticated, track browser loaded with the user's YouTube uploads

**Edge Cases**:
- User denies permission → show error: "YouTube access required for track browsing"
- Token fetch fails → show retry button
- User has no YouTube channel → search still works; uploads list shows empty state

---

## Scenario 2: Loading a Track onto a Deck

**Actor**: Authenticated user
**Goal**: Load a YouTube video onto Deck A

**Steps**:
1. User sees their uploads listed in the Track Browser panel at the bottom
2. User searches for "house music mix" in the search bar
3. Results appear: thumbnail, title, channel, duration for each video
4. User hovers over result → "Load to Deck A" and "Load to Deck B" buttons appear
5. User clicks "Load to Deck A"
6. Deck A updates: thumbnail/still frame loads into the vinyl label area, track title displays
7. The hidden YouTube IFrame player for Deck A loads the video (cued, not playing)
8. Play button on Deck A becomes active

**Expected Outcome**: Deck A shows the track info; IFrame player is loaded and ready to play

**Edge Cases**:
- Video is unembeddable → show error toast "This video cannot be played" and clear the deck
- Network timeout → show loading spinner with retry

---

## Scenario 3: Mixing Between Two Tracks (Core DJ Flow)

**Actor**: DJ user
**Goal**: Blend smoothly from Track A to Track B

**Steps**:
1. Both Deck A and Deck B have tracks loaded
2. Deck A is playing; Deck B is cued/paused
3. User presses Play on Deck B → both tracks play simultaneously
4. Vinyl platters on both decks spin (Deck A at full speed; Deck B starts)
5. Crossfader is centered (50/50 volume); both decks at moderate volume
6. User gradually drags crossfader toward the right (toward Deck B)
7. App calls `deckA.setVolume(decreasing)` and `deckB.setVolume(increasing)` in real-time
8. User pauses Deck A once Deck B is dominant
9. Deck A's platter slows and stops; Deck B's platter continues spinning

**Expected Outcome**: Smooth volume crossfade from Deck A to Deck B; both platters animate correctly

**Edge Cases**:
- Rapid crossfader movement → debounce or throttle volume calls to avoid API overload
- User moves crossfader to full left (0 to Deck B) → Deck B is muted, not paused

---

## Scenario 4: Using Tap-Tempo BPM

**Actor**: DJ user
**Goal**: Set BPM for Deck A to enable loop calculations

**Steps**:
1. Deck A is playing a track
2. User listens to the beat
3. User taps the "TAP" button on Deck A 4 times in rhythm with the music
4. After the 4th tap, BPM is calculated from the average interval between taps
5. BPM display on Deck A updates (e.g., "128 BPM")
6. User can now use loop buttons (4-beat, 8-beat) which calculate duration from BPM

**Expected Outcome**: BPM displayed; loops available

**Edge Cases**:
- Taps more than 3 seconds apart → reset tap sequence
- Only 1 tap → no BPM shown yet; prompt "Keep tapping..."

---

## Scenario 5: Loop Control

**Actor**: DJ user
**Goal**: Create an 8-beat loop on Deck B

**Steps**:
1. Deck B is playing; BPM is set to 128
2. User presses "8-beat loop" button at the desired loop start point
3. App records `loopStart = currentTime`
4. Calculates `loopLength = (8 / 128) * 60 = 3.75 seconds`
5. Monitors `getCurrentTime()` — when `currentTime >= loopStart + loopLength`, calls `seekTo(loopStart)`
6. Loop active indicator lights up on the button
7. User presses the loop button again to exit the loop

**Expected Outcome**: Audio loops seamlessly at the 8-beat mark

**Edge Cases**:
- BPM not set → loop buttons disabled with tooltip "Set BPM first using TAP"

---

## Scenario 6: Pitch Adjustment

**Actor**: DJ user
**Goal**: Speed up Deck B to match Deck A's tempo

**Steps**:
1. Deck A plays at 1× speed (128 BPM)
2. Deck B plays at 1× speed (120 BPM tap-detected)
3. User moves Deck B's pitch slider upward
4. Slider snaps to nearest available playback rate: 1.25×
5. App calls `deckBPlayer.setPlaybackRate(1.25)`
6. Speed indicator on Deck B updates to "×1.25"
7. Vinyl platter animation on Deck B speeds up proportionally

**Expected Outcome**: Deck B plays at 1.25× speed; platter reflects the change

---

## Scenario 7: Hot Cue Usage

**Actor**: DJ user
**Goal**: Mark and return to a favorite drop point in a track

**Steps**:
1. Deck A is playing; user identifies the drop at 2:34
2. User presses Hot Cue button "1" (set mode) → app stores `{videoId: "...", cue1: 154}` in localStorage
3. Hot Cue 1 button lights up to indicate it's set
4. Track continues; later in the mix user presses Hot Cue 1 again
5. App calls `seekTo(154)` → track jumps back to the drop

**Expected Outcome**: Instant seek to stored cue point; cues persist across page reloads

---

## Scenario 8: Settings & Account Management

**Actor**: Authenticated user
**Goal**: View connected account details and sign out

**Steps**:
1. User clicks the settings gear icon in the header
2. Settings modal opens showing: Google account name, email, avatar; YouTube channel name and subscriber count
3. User clicks "Sign Out"
4. Auth token cleared from memory; user state reset
5. Interface returns to unauthenticated state: sign-in button visible, track browser disabled
6. IFrame players are stopped and cleared

**Expected Outcome**: Clean sign-out; no credentials remain in browser memory
