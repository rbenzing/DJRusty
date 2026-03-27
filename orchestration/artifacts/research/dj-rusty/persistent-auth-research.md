# Persistent Google Login — Research Report

**Date**: 2026-03-24
**Author**: Researcher Agent
**Project**: DJRusty
**Feature**: Persistent Google Login (no popup on every page refresh)

---

## 1. Root Cause Analysis

### Why the Login Popup Appears on Every Page Refresh

The root cause is a deliberate design decision documented in ADR-003: all auth state lives exclusively in the Zustand store, which is in-memory. On page refresh the JavaScript heap is wiped, Zustand resets to `INITIAL_STATE`, and the app has no record that the user was ever signed in.

The `useAuth` hook's `useEffect` fires on every mount (i.e., every page load) and calls `requestToken(true)` — the silent path. The intent of `silent = true` / `prompt: ''` is to attempt a silent token grant using an existing Google session cookie, avoiding the consent screen. However, this is where the behaviour diverges from the intent:

**GIS `prompt: ''` does not guarantee a silent, invisible token grant.** Google's documentation for the implicit/token flow is explicit: `prompt: ''` may still result in a popup window being opened if Google cannot silently determine the user's consent or session state. Specifically:

- If the user has multiple Google accounts, GIS may show an account-picker popup.
- If the user's Google session has expired or does not exist, GIS will show a full sign-in popup.
- If the user has not previously granted the requested scopes, GIS will show a consent popup.
- The `prompt: ''` hint only suppresses the explicit consent re-prompt when the user has a valid, unambiguous session with existing consent. It does not prevent a popup in all cases.

The result is that `requestToken(true)` on every page load can and does produce a popup whenever any of the above conditions are true — which is nearly every page refresh in a typical dev/test cycle where the in-memory token is gone.

**The correct interpretation**: `prompt: ''` is appropriate for token *refresh* (when the user is already authenticated within the same session), not for session *restoration* across page loads.

### The Missing Piece

There is no mechanism to restore user identity across page refreshes. On every load the app is in a clean "not signed in" state, and then immediately attempts GIS silent-refresh — which may silently succeed (good) or may open a popup (bad). The inconsistency of when the popup appears is exactly what makes the current behaviour feel broken to the user.

---

## 2. Proposed Solution Validation

### The Proposal

Store `userInfo` (name, email, picture, sub — non-sensitive) and `expiresAt` (numeric timestamp) in `localStorage`. On app load, restore user identity from `localStorage` if `expiresAt` is in the future. The raw OAuth access token is never written to `localStorage`.

### Security Analysis

The security concern in ADR-003 is **token exfiltration via XSS**. An XSS attack gains meaningful capability if it can steal a live access token and immediately make API calls to YouTube or Google. This is the threat the in-memory-only token policy is designed to prevent.

The proposed data stored in `localStorage` is:

| Field | Sensitivity | XSS Risk |
|---|---|---|
| `sub` | Low — Google's opaque user ID, not a secret | Negligible — useless without a live token |
| `name` | Low — display name, semi-public | Negligible |
| `email` | Medium — PII, but not a credential | Low — attacker already has it if they can run XSS |
| `picture` | Low — public CDN URL | Negligible |
| `expiresAt` | Low — a timestamp | Negligible |

None of these fields grant the ability to make authenticated API calls. The access token itself remains in-memory only. **The proposed approach maintains the security intent of ADR-003.**

The distinction matters: the ADR's rule is "Token not in localStorage" — meaning the OAuth access token. Storing non-sensitive user identity metadata is a different decision and does not violate the spirit of the security policy.

### Validation of the Proposed Behaviour

The proposed flow is sound:

1. **On app load**: check `localStorage` for `djrusty_user_info` and `djrusty_expires_at`.
   - If found and `expiresAt > Date.now()`: restore `userInfo` to the store and mark the user as "identity restored" (but not yet `signedIn` — no live token yet).
   - Attempt silent GIS refresh in the background (`requestToken(true)`).
     - If silent refresh succeeds → full `signedIn` state with live token.
     - If silent refresh fails → user identity remains visible (avatar, name shown) but `signedIn` is false; show Sign In button for the user to click manually. Do not auto-trigger a popup.
2. **On successful sign-in**: write `userInfo` and `expiresAt` to `localStorage`.
3. **On sign-out**: clear `djrusty_user_info` and `djrusty_expires_at` from `localStorage` and clear Zustand state.
4. **On natural expiry**: when `expiresAt` is in the past on app load, clear stale `localStorage` entries and show Sign In button.

This eliminates the involuntary popup entirely. The only popups that appear are those the user explicitly triggers by clicking Sign In.

### One Refinement to the Proposal

The proposal stores `expiresAt` derived from the GIS `expires_in` value (~3600 seconds). This is the access token's lifetime, not a "remembered session" lifetime. Once the token expires (typically 1 hour after sign-in), the user would need to click Sign In on next page load.

A separate, longer `djrusty_session_expires_at` could be set to a configurable "remembered session" duration (e.g., 7 days from last sign-in). The `djrusty_expires_at` value would still reflect the current token's expiry for proactive refresh logic, but the session expiry would be the gate for showing identity vs. showing a blank state.

See Section 4 for the expiry window recommendation.

---

## 3. Silent Refresh Behaviour — Where Is `requestToken(false)` Called on Load?

Reviewing `useAuth.ts` line 108: on mount, `requestToken(true)` is called (the silent path, `prompt: ''`). This is the correct intent.

The explicit sign-in path at line 136 calls `requestToken(false)` (which uses `prompt: 'consent'`) — this is correct and only triggered by a user clicking the Sign In button.

**There is no code path that calls `requestToken(false)` automatically on page load.** The popup problem is caused entirely by `requestToken(true)` / `prompt: ''` opening a popup in GIS when silent token acquisition fails — as described in Section 1.

**Fix**: After implementing localStorage persistence, the auto-call to `requestToken(true)` on mount should only fire when there is stored identity to refresh (i.e., `localStorage` has valid, non-expired session data). When no stored identity exists, skip the silent refresh attempt entirely. This prevents GIS from unexpectedly opening a popup on a fresh visit.

---

## 4. Token Expiry Handling and Proactive Refresh

### Current State

`expiresAt` is stored in the Zustand store (line 43, `authStore.ts`) but is never consulted before making API calls. There is no proactive refresh logic. The only expiry handling is reactive — a 401 from the YouTube API would be the signal, but even then there is no code to handle it (the user would see a failed API call with no recovery prompt).

### Recommendation

Implement a two-level expiry system:

**Level 1 — Proactive token refresh (prevent mid-session expiry)**

Before making any YouTube API call, check `expiresAt` in the store. If the token expires within a **5-minute window** (300,000 ms), trigger `requestToken(true)` silently. The 5-minute window gives GIS time to complete the silent refresh before the token actually expires.

```
PROACTIVE_REFRESH_WINDOW_MS = 5 * 60 * 1000  // 5 minutes
if (expiresAt !== null && Date.now() > expiresAt - PROACTIVE_REFRESH_WINDOW_MS) {
  requestToken(true)
}
```

This check can live in a utility function in `authService.ts` or `useAuth.ts` and be called by whichever hook makes YouTube API requests.

**Level 2 — Session expiry (localStorage persistence window)**

Set `djrusty_session_expires_at` to `Date.now() + 7 * 24 * 60 * 60 * 1000` (7 days) on successful sign-in. This is independent of the access token lifetime. On app load, check this value first — if it is in the past, treat the session as expired, clear `localStorage`, and show Sign In with no silent refresh attempt.

**Recommended expiry window**: 7 days for the "remembered" session. This aligns with common app expectations (similar to how Gmail and Google Drive behave). This value can be made configurable via an environment variable if needed.

---

## 5. Exact localStorage Keys

Use a consistent `djrusty_` prefix to namespace all entries and prevent collisions with other libraries or future features.

| Key | Type | Content | Purpose |
|---|---|---|---|
| `djrusty_user_info` | JSON string | `{ sub, name, email, picture }` | Restore user identity display on load |
| `djrusty_expires_at` | Number string | Unix timestamp in ms | Token expiry — used for proactive refresh trigger |
| `djrusty_session_expires_at` | Number string | Unix timestamp in ms | Session expiry — gate for restoring identity vs. showing blank state |

Notes:
- Store `djrusty_user_info` as `JSON.stringify(userInfo)` and parse with `JSON.parse` wrapped in try/catch.
- Store numeric timestamps as `String(timestamp)` and parse with `Number(value)` — avoids JSON overhead for simple values.
- All three keys should be written atomically on successful sign-in and cleared atomically on sign-out.

---

## 6. What Changes Are Needed to ADR-003

ADR-003 currently states (Consequences section):

> "Token lost on page refresh — re-authentication required each session."

And the Rationale section states:

> "...the token is never persisted to disk and is lost on page refresh. This is the deliberate security trade-off — users re-authenticate each session."

And Alternatives Not Chosen:

> "Token in localStorage — XSS token exfiltration risk"

### Required ADR Update

The ADR needs an amendment (or a superseding ADR-004) that:

1. **Clarifies the security boundary**: The restriction is on the OAuth *access token*, not on non-sensitive user identity metadata. The access token remains in-memory only.

2. **Documents the new localStorage usage**: Explicitly states what is stored, why it is acceptable, and what threat it does and does not introduce.

3. **Updates the Consequences section**: Replace "re-authentication required each session" with the new behaviour: "User identity persists across page refreshes for up to 7 days. A silent GIS token refresh is attempted on load; if it fails, the user sees their identity but must click Sign In to restore full API access."

4. **Updates the Alternatives Not Chosen table**: Add a row clarifying that *user identity metadata* in localStorage is now accepted, explicitly distinguished from token storage.

The preferred approach is to **amend ADR-003 in-place** with an "Amendment" section dated 2026-03-24, rather than creating a new ADR, since this is a refinement of the same decision rather than a reversal.

---

## 7. Files That Need to Change

| File | Change Required |
|---|---|
| `src/types/auth.ts` | Add optional `sessionExpiresAt: number \| null` field to `AuthState`. Document that this is the localStorage session window, distinct from the access token's `expiresAt`. |
| `src/store/authStore.ts` | Add `setSessionExpiry` action. Update `clearAuth` to also clear the three `djrusty_*` localStorage keys. Update `setToken` or add a new `persistSession` action that writes `djrusty_user_info`, `djrusty_expires_at`, and `djrusty_session_expires_at` to localStorage. Add a `restoreSession` action that reads and validates localStorage on initialisation. |
| `src/hooks/useAuth.ts` | On mount: before calling `requestToken(true)`, check `localStorage` for a valid session. Restore `userInfo` from `localStorage` if session is valid. Only call `requestToken(true)` when a stored session exists. Do not trigger silent refresh on a fresh (no stored session) page load. Add proactive refresh logic: check `expiresAt` before API calls and trigger silent refresh within the 5-minute window. Update `handleTokenReceived` to write to `localStorage` after setting the store. Update `signOut` to clear `localStorage`. |
| `src/services/authService.ts` | No changes required. The service is correctly scoped to the GIS lifecycle and token request mechanics. |
| `src/components/Auth/AuthButton.tsx` | No changes required. Reactively renders based on `signedIn` and `userInfo` from the store — will automatically reflect the restored identity once the store is updated. |
| `src/components/Auth/AuthStatus.tsx` | No changes required. Same reactive pattern as `AuthButton.tsx`. |
| `orchestration/artifacts/architecture/dj-rusty/decisions/adr-003-auth-approach.md` | Add Amendment section as described in Section 6. |

---

## 8. Edge Cases and Risks

### Edge Case: Corrupted localStorage Data

`JSON.parse` on a corrupted or tampered `djrusty_user_info` value will throw. All localStorage reads must be wrapped in try/catch. On any parse error, treat as if no stored session exists, clear the offending keys, and fall back to the Sign In button.

### Edge Case: localStorage Unavailable

In private/incognito mode, localStorage may throw on write (Safari) or be silently unavailable. The `localStorage.setItem` call must be wrapped in try/catch. If unavailable, gracefully degrade to the current in-memory-only behaviour (no persistent session, but no error). The app must not crash.

### Edge Case: Profile Picture URL Expiry

Google's profile picture URLs (the `picture` field from the userinfo endpoint) are served from `lh3.googleusercontent.com`. These URLs do not expire in practice, but they may return a 404 if the user has deleted their Google account or changed their profile picture significantly. The `<img>` tag in `AuthButton.tsx` should have an `onError` handler that falls back to a generic avatar icon rather than a broken image.

### Edge Case: Token Refresh During Silent GIS Failure

If `requestToken(true)` fails silently (GIS returns an error without showing a popup — e.g., `access_denied` for a revoked session), the current `handleAuthError` logs a warning. With the new flow, a silent refresh failure must *not* clear the stored `userInfo` — the user should still see their name and avatar, just with `signedIn: false`. The error handler must distinguish between "silent refresh failed" (keep identity) and "explicit sign-out" (clear everything).

This means `handleAuthError` needs context about whether it was called during a silent refresh attempt or an explicit sign-in attempt. One clean approach: use a `isSilentRefresh` ref in `useAuth` that is set to `true` before `requestToken(true)` and `false` before `requestToken(false)`. The error handler checks this ref and behaves accordingly.

### Risk: `sub` Mismatch After Account Switch

If a user has multiple Google accounts and the silent GIS refresh returns a token for a *different* account than what is stored in `djrusty_user_info`, the app will show the wrong identity until `fetchUserInfo` completes with the new token. After `fetchUserInfo` succeeds, the store and localStorage should be updated with the new account's identity. No user action is needed, but the UI may briefly show stale identity data. This is acceptable behaviour.

### Risk: Extended Session Beyond Token Validity

The 7-day session window means the user's avatar and name are shown even when their access token has expired and silent refresh has failed. This is the intended UX (show identity, prompt to re-authenticate with a click). However, it must be clearly communicated in the UI — the Sign In button must be visible and prominent when `signedIn` is false, even when `userInfo` is present. The current `AuthButton.tsx` already handles this correctly: it shows the Sign In button when `!signedIn || !userInfo`. The logic needs updating to: show user button when `userInfo` is present (regardless of `signedIn`), but overlay or accompany it with a "Reconnect" indicator when `signedIn` is false. This is a UX decision that the Architect should resolve — either approach (hide user button when token expired, or show with reconnect state) is defensible.

### Risk: No Refresh Token in Implicit Flow

The OAuth 2.0 implicit/token flow does not issue refresh tokens — this is a fundamental protocol constraint, not a code issue. Silent refresh via GIS `prompt: ''` works only when the user has an active Google session in their browser. If the user has signed out of Google, closed their browser entirely, or their Google session has expired, the silent refresh will fail and a popup-based re-authentication is required. The 7-day session window is therefore a "best-effort" persistence — it is not a guarantee. This is the correct and unavoidable behaviour for a no-backend SPA using the implicit flow.

---

## 9. Summary Recommendation

The proposed approach is **sound and should be implemented**. It:
- Eliminates the involuntary popup on page refresh.
- Maintains the ADR-003 security principle (no raw access token in localStorage).
- Stores only non-sensitive user identity metadata in localStorage.
- Degrades gracefully when GIS silent refresh fails (show identity, prompt to click Sign In).
- Has a clear, auditable security boundary.

The only meaningful addition to the proposal is the **separate session expiry key** (`djrusty_session_expires_at` at 7 days) to bound how long identity is shown, and the **proactive refresh window** (5 minutes before `expiresAt`) to prevent mid-session API call failures.

ADR-003 should be amended to document the refined policy before implementation begins.
