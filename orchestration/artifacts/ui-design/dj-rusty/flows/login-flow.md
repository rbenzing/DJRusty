# Login Flow

> Project: `dj-rusty`
> Version: 1.0
> Date: 2026-03-21

---

## 1. Overview

The login flow handles Google OAuth 2.0 authentication via Google Identity Services (GIS). It covers the full lifecycle from the unauthenticated state through successful authentication, token storage, profile fetching, and all error conditions.

The application is a pure SPA with no backend. Tokens are stored in memory only — never in `localStorage`, `sessionStorage`, or cookies.

---

## 2. User Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  APP LOAD                                                            │
│                                                                      │
│  Is GIS script loaded?                                               │
│       │                                                              │
│       ├── No  → Show loading spinner in header                       │
│       │         Load GIS: accounts.google.com/gsi/client            │
│       │         GIS ready → continue                                 │
│       │                                                              │
│       └── Yes → Initialize token client (silent)                     │
│                       │                                              │
│                       ├── Has existing session?                      │
│                       │       │                                      │
│                       │       ├── Yes → Silent token refresh         │
│                       │       │         Token received → AUTO-LOGIN  │
│                       │       │                                      │
│                       │       └── No  → Show unauthenticated state   │
│                       │                                              │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  UNAUTHENTICATED STATE                                               │
│                                                                      │
│  Header shows "Sign in with Google" button                           │
│  Track Browser is disabled (grayed, tooltip shown)                   │
│  Both decks are empty, track-loading buttons hidden                  │
│                                                                      │
│  User clicks "Sign in with Google"                                   │
│       │                                                              │
│       ▼                                                              │
│  tokenClient.requestAccessToken({ prompt: 'consent' })              │
│       │                                                              │
│       ├── Google OAuth popup appears                                 │
│       │   User sees: account selector + permission request           │
│       │   Scope requested: youtube.readonly                          │
│       │                                                              │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  OAUTH CALLBACK — DECISION TREE                                      │
│                                                                      │
│  tokenResponse received?                                             │
│       │                                                              │
│       ├── tokenResponse.error present                                │
│       │       │                                                      │
│       │       ├── error = 'access_denied'                            │
│       │       │     → Toast: "YouTube access required for track      │
│       │       │       browsing. Grant permission to continue."       │
│       │       │     → Stay on unauthenticated state                  │
│       │       │                                                      │
│       │       ├── error = 'popup_closed_by_user'                     │
│       │       │     → No toast (user intentionally closed)           │
│       │       │     → Stay on unauthenticated state                  │
│       │       │                                                      │
│       │       └── error = other                                      │
│       │             → Toast: "Sign-in failed. Please try again."     │
│       │             → Log error to console                           │
│       │             → Stay on unauthenticated state                  │
│       │                                                              │
│       └── tokenResponse.access_token present                         │
│               │                                                      │
│               ▼                                                      │
│         Store token in memory (authStore.accessToken)                │
│         Fetch user profile (Google People API)                       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  POST-AUTH DATA FETCHING                                             │
│                                                                      │
│  Parallel fetch:                                                     │
│    [A] Google People API → name, email, avatar                       │
│    [B] YouTube channels.list?mine=true → channelId, uploads playlist │
│                                                                      │
│  Both succeed?                                                       │
│       │                                                              │
│       ├── [A] fails (People API error)                               │
│       │     → Use fallback name from GIS tokenResponse.email         │
│       │     → Use placeholder avatar (initials icon)                 │
│       │     → Continue to [B]                                        │
│       │                                                              │
│       ├── [B] fails (YouTube API error / no channel)                 │
│       │     → authStore.user set with profile only                   │
│       │     → Track Browser: My Uploads tab shows empty state        │
│       │     → Toast (info): "Could not load your YouTube channel.    │
│       │       Search is still available."                            │
│       │     → Continue to authenticated state                        │
│       │                                                              │
│       └── Both succeed                                               │
│               │                                                      │
│               ▼                                                      │
│         Fetch uploads playlist (first page, max 50)                  │
│         Store uploads in browserStore.uploads                        │
│         Set authStore.isAuthenticated = true                         │
│         Transition to AUTHENTICATED STATE                            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  AUTHENTICATED STATE                                                 │
│                                                                      │
│  Header: avatar + display name visible                               │
│          "Sign in with Google" button hidden                         │
│  Track Browser: enabled, My Uploads tab active and populated         │
│  Decks: empty but ready to receive tracks                            │
│  Load-to-Deck buttons: visible on track rows                         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  TOKEN EXPIRY (background)                                           │
│                                                                      │
│  GIS tokens expire after ~1 hour                                     │
│  Expiry detected when any API call returns 401                       │
│       │                                                              │
│       ▼                                                              │
│  tokenClient.requestAccessToken({ prompt: '' })  (silent refresh)   │
│       │                                                              │
│       ├── Success → update accessToken in memory, retry failed call  │
│       │                                                              │
│       └── Failure (user revoked, session ended)                      │
│             → Toast: "Session expired. Please sign in again."        │
│             → Clear auth state → Return to UNAUTHENTICATED STATE     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  SIGN OUT FLOW                                                       │
│                                                                      │
│  User opens Settings Modal → clicks "Sign Out"                       │
│       │                                                              │
│       ▼                                                              │
│  google.accounts.oauth2.revoke(accessToken, callback)               │
│  Clear authStore (user, accessToken, isAuthenticated)                │
│  Clear browserStore (uploads, searchResults)                         │
│  Stop both YouTube players: deckA.stopVideo(), deckB.stopVideo()     │
│  Clear deckAStore and deckBStore state                               │
│  Close Settings Modal                                                │
│  Return focus to settings gear button                                │
│  Transition to UNAUTHENTICATED STATE                                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Step-by-Step

### Step 1: App Initialisation

**Trigger**: Page load

**Actions**:
1. React app mounts. `App.tsx` renders with `isAuthenticated: false`.
2. `useEffect` in the auth initializer component loads the GIS script:
   ```html
   <script src="https://accounts.google.com/gsi/client" async></script>
   ```
3. Once `window.google.accounts.oauth2` is available, initialize the token client:
   ```js
   const tokenClient = google.accounts.oauth2.initTokenClient({
     client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
     scope: 'https://www.googleapis.com/auth/youtube.readonly',
     callback: handleTokenResponse,
   });
   ```
4. Attempt a silent token request to see if an existing Google session exists:
   ```js
   tokenClient.requestAccessToken({ prompt: '' });
   ```
5. If this returns a token silently (user previously consented) → auto-login flow
6. If this fails (no session) → show unauthenticated UI, wait for user action

**UI State**: Header shows "Sign in with Google" button. Track browser shows the sign-in prompt.

---

### Step 2: User Initiates Sign-In

**Trigger**: User clicks "Sign in with Google" button

**Actions**:
1. Button enters loading state: `aria-busy="true"`, spinner icon added, button text changes to "Signing in..."
2. Call:
   ```js
   tokenClient.requestAccessToken({ prompt: 'consent' });
   ```
3. Google OAuth 2.0 popup opens (browser-managed popup window)
4. User sees: Google account selector (if multiple accounts) → Permission request screen showing `youtube.readonly` scope

**UI State**: Button is disabled and shows loading. App otherwise unchanged.

---

### Step 3: Google OAuth Callback

**Trigger**: User completes or dismisses the OAuth popup

**Case A: User grants permission**
- `handleTokenResponse` is called with `tokenResponse.access_token`
- Proceed to Step 4

**Case B: User denies permission**
- `tokenResponse.error = 'access_denied'`
- Show error toast: `"YouTube access required for track browsing. Grant permission to continue."`
- Reset sign-in button to normal state
- Stay on unauthenticated state

**Case C: User closes popup**
- `tokenResponse.error = 'popup_closed_by_user'`
- No toast (user intentionally dismissed)
- Reset sign-in button to normal state
- Stay on unauthenticated state

**Case D: Other error**
- `tokenResponse.error = (other value)`
- Show error toast: `"Sign-in failed. Please try again."`
- Log full error to console
- Reset sign-in button to normal state
- Stay on unauthenticated state

---

### Step 4: Token Received — Store & Fetch Profile

**Trigger**: `handleTokenResponse` called with a valid access token

**Actions**:
1. Store token in memory: `authStore.setAccessToken(tokenResponse.access_token)`
2. Record expiry: `authStore.setTokenExpiry(Date.now() + (tokenResponse.expires_in * 1000))`
3. Immediately fire two parallel fetch requests:

**Fetch A — Google Profile:**
```
GET https://people.googleapis.com/v1/people/me
  ?personFields=names,emailAddresses,photos
  Authorization: Bearer {access_token}
```
Parse: `name = names[0].displayValue`, `email = emailAddresses[0].value`, `avatar = photos[0].url`

**Fetch B — YouTube Channel:**
```
GET https://www.googleapis.com/youtube/v3/channels
  ?part=snippet,contentDetails
  &mine=true
  Authorization: Bearer {access_token}
```
Parse: `channelId`, `channelTitle`, `subscriberCount`, `uploadsPlaylistId = contentDetails.relatedPlaylists.uploads`

4. Show loading indicator in header (brief spinner replacing the sign-in button area)

---

### Step 5: Fetch Uploads

**Trigger**: YouTube channel fetch succeeded and `uploadsPlaylistId` is available

**Action**:
```
GET https://www.googleapis.com/youtube/v3/playlistItems
  ?part=snippet
  &playlistId={uploadsPlaylistId}
  &maxResults=50
  Authorization: Bearer {access_token}
```

Parse each item: `videoId`, `title`, `channelTitle`, `thumbnailUrl`, `publishedAt`

Store results in `browserStore.uploads`. Store `nextPageToken` if present for pagination.

---

### Step 6: Authenticated State Activated

**Trigger**: Profile data stored and initial uploads (or empty state) confirmed

**Actions**:
1. `authStore.setIsAuthenticated(true)`
2. `authStore.setUser({ name, email, avatar, channelTitle, subscriberCount })`
3. Header updates:
   - Sign-in button replaced by: `[avatar] Jane Smith`
   - Loading spinner dismissed
4. Track Browser:
   - Enabled (no longer grayed)
   - "My Uploads" tab is active and populated with results
   - If zero uploads: empty state message shown
5. Both decks: unchanged (empty), but load buttons will appear when tracks are browsed
6. Live region announcement: `"Signed in as Jane Smith. Your YouTube uploads are loaded."`

---

### Step 7: Token Refresh (Background — Automatic)

**Trigger**: Any API call returns HTTP 401, or `Date.now() > tokenExpiry - 120000` (2 minutes before expiry)

**Actions**:
1. Pause the failing request
2. Attempt silent refresh:
   ```js
   tokenClient.requestAccessToken({ prompt: '' });
   ```
3. **On success**: Update `authStore.accessToken`, retry the paused request
4. **On failure**: Token is unrecoverable
   - Show assertive toast: `"Session expired. Please sign in again."`
   - Trigger full sign-out (Step 8 — except skip `revoke()` call since session is already gone)

---

### Step 8: Sign Out

**Trigger**: User clicks "Sign Out" in Settings Modal

**Actions (in order)**:
1. Call `google.accounts.oauth2.revoke(accessToken, () => {})` to revoke the token at Google
2. Clear all in-memory state:
   - `authStore.clear()` → clears user, accessToken, isAuthenticated
   - `browserStore.clear()` → clears uploads, searchResults, pageToken
   - `deckAStore.clear()` → clears videoId, title, isPlaying, cuePoint, hotCues, bpm, loop
   - `deckBStore.clear()` → same
   - `mixerStore.reset()` → crossfader back to 50
3. Stop both YouTube players:
   ```js
   deckAPlayer?.stopVideo();
   deckBPlayer?.stopVideo();
   ```
4. Close the Settings Modal
5. Return focus to the settings gear icon in the header
6. Transition UI to unauthenticated state:
   - Header: avatar/name replaced by "Sign in with Google" button
   - Track browser: disabled, sign-in prompt shown
   - Decks: cleared to empty state

---

## 4. UI States Reference

### 4.1 Header — Unauthenticated

```
┌─────────────────────────────────────────────────────────────┐
│  DJ RUSTY            [⚙]      [Sign in with Google]        │
└─────────────────────────────────────────────────────────────┘
```

- "Sign in with Google" uses Google's standard button styling
- Settings gear is always visible (but settings modal shows minimal content when unauthenticated)

### 4.2 Header — Sign-In In Progress

```
┌─────────────────────────────────────────────────────────────┐
│  DJ RUSTY            [⚙]      [⟳ Signing in...]           │
└─────────────────────────────────────────────────────────────┘
```

- Button shows spinner icon + "Signing in..." text
- Button is disabled

### 4.3 Header — Authenticated

```
┌─────────────────────────────────────────────────────────────┐
│  DJ RUSTY            [⚙]      [👤 Jane Smith]              │
└─────────────────────────────────────────────────────────────┘
```

- Avatar (32px circle) + truncated display name
- Clicking opens Settings Modal

### 4.4 Track Browser — Unauthenticated

```
┌────────────────────────────────────────────────────────┐
│  [🔍 Search YouTube...           ]  [SEARCH]           │
│  (search disabled, 50% opacity)                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│    Sign in with Google to browse your YouTube          │
│    uploads and search for tracks.                      │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 4.5 Track Browser — Loading After Sign-In

```
┌────────────────────────────────────────────────────────┐
│  [🔍 Search YouTube...           ]  [SEARCH]           │
├────────────────────────────────────────────────────────┤
│  MY UPLOADS ▸ Search Results                           │
├────────────────────────────────────────────────────────┤
│                                                        │
│              ⟳  Loading your uploads...               │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 4.6 Track Browser — Authenticated with Uploads

```
┌────────────────────────────────────────────────────────┐
│  [🔍 Search YouTube...           ]  [SEARCH]           │
├────────────────────────────────────────────────────────┤
│  MY UPLOADS ▸ Search Results                           │
├────────────────────────────────────────────────────────┤
│  [thumb] House Mix Vol.3  ·  DJ Example  ·  45:32      │
│          [LOAD A]  [LOAD B]                            │
│  [thumb] Techno Session  ·  DJ Example  ·  1:02:10    │
│          [LOAD A]  [LOAD B]                            │
│  ...                                                   │
└────────────────────────────────────────────────────────┘
```

---

## 5. Error States and Edge Cases

| Scenario | UI Response |
|----------|-------------|
| GIS script fails to load | Toast (error): "Failed to load Google Sign-In. Refresh the page to try again." Sign-in button shows error state. |
| User has no Google account | OAuth popup handles this naturally — Google prompts account creation or login |
| User denies `youtube.readonly` scope | Toast (error): "YouTube access required for track browsing. Grant permission to continue." |
| Popup blocked by browser | Toast (warning): "Pop-up was blocked. Please allow pop-ups for this site and try again." |
| Google API network error | Toast (error): "Connection error. Check your network and try again." Retry button in toast. |
| YouTube channel has 0 uploads | My Uploads tab shows: "No uploads found on your YouTube channel." Search still works. |
| Token expires mid-session | Silent refresh attempted automatically. If it fails: toast + forced sign-out. |
| User revokes access externally | Next API call returns 401 → silent refresh fails → forced sign-out with toast. |
| Multiple rapid sign-in clicks | Debounce button: disabled for 2 seconds after first click. Only one OAuth popup allowed at a time. |

---

## 6. Security Notes

- **Token storage**: Access token stored exclusively in Zustand in-memory store. Never written to `localStorage`, `sessionStorage`, `IndexedDB`, or cookies.
- **Token scope**: Only `https://www.googleapis.com/auth/youtube.readonly` — read-only YouTube access. No write permissions requested.
- **Revocation**: `google.accounts.oauth2.revoke()` called on sign-out to immediately invalidate the token at Google's authorization server.
- **PKCE / CSRF**: GIS token client handles these internally for the implicit token flow.
- **XSS risk mitigation**: No token in persistent storage means XSS cannot steal the token across sessions. The token is only live during the active browser tab session.
- **Client ID exposure**: `VITE_GOOGLE_CLIENT_ID` is a public OAuth client ID — this is intentional and safe for SPA use. It is not a secret. Authorized JavaScript origins in Google Cloud Console restrict its use to the configured domain(s).
