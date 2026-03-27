# STORY-PERSIST-001: Persistent Google Login Session

**Status**: Ready for Development
**Complexity**: Medium
**Estimated Tasks**: 4
**Dependencies**: None (builds on existing auth infrastructure from STORY-002)
**Source**: `orchestration/artifacts/research/dj-rusty/persistent-auth-research.md`

---

## Objective

Make Google login persistent across page refreshes. After a successful sign-in, the user's identity (name, avatar, email) must survive a full page reload without triggering a Google consent popup. The OAuth access token remains in-memory only (preserving ADR-003 security intent). A silent GIS token refresh is attempted in the background only when a stored session exists. Expired or corrupted sessions degrade gracefully to the current sign-in-button state.

---

## Scope

**In scope:**
- Persist non-sensitive user identity metadata to localStorage
- Restore identity on page load and attempt silent token refresh
- Proactive token refresh 5 minutes before expiry
- Session expiry after 7 days
- Graceful degradation for corrupted/unavailable localStorage
- Unit tests for all new store actions and edge cases

**Out of scope:**
- Storing the OAuth access token in localStorage (explicitly prohibited)
- Changes to `authService.ts` (no modifications needed)
- Changes to UI components (`AuthButton.tsx`, `AuthStatus.tsx` react to store state automatically)
- ADR-003 amendment (separate task)

---

## Acceptance Criteria

- [ ] **AC-1: Identity survives page refresh.** After a successful Google sign-in, refreshing the page displays the user's name and avatar immediately without any popup appearing. The user's `GoogleUserInfo` is read from `localStorage` key `djrusty_user_info` and loaded into the Zustand store before GIS initialization begins.
- [ ] **AC-2: Silent GIS token refresh only when stored session exists.** On page load, `requestToken(true)` is called only when `djrusty_session_expires_at` is in the future. When no stored session exists (fresh visitor), no silent refresh is attempted and no popup appears.
- [ ] **AC-3: Expired session clears localStorage.** When `djrusty_session_expires_at` is in the past on page load, all three `djrusty_*` localStorage keys are removed and the app shows the Sign In button with no silent refresh attempt.
- [ ] **AC-4: Sign-out clears all localStorage entries.** Calling `clearAuth()` removes `djrusty_user_info`, `djrusty_expires_at`, and `djrusty_session_expires_at` from localStorage in addition to resetting the Zustand store to `INITIAL_STATE`.
- [ ] **AC-5: Corrupted localStorage degrades gracefully.** If `djrusty_user_info` contains invalid JSON, or `djrusty_expires_at`/`djrusty_session_expires_at` contain non-numeric values, `restoreSession()` clears the corrupt keys and returns without setting any state. The app behaves as if no stored session exists (shows Sign In button). No error is thrown.
- [ ] **AC-6: Unavailable localStorage degrades gracefully.** If `localStorage.setItem` throws (e.g., Safari private mode), `persistSession()` catches the error and logs a warning. The app continues with in-memory-only auth (current behavior). No error is thrown to the user.
- [ ] **AC-7: Silent refresh failure shows Sign In button.** When `requestToken(true)` fails during a background silent refresh, the error handler does NOT show an error message or clear the stored `userInfo`. The user sees their identity (name, avatar) but `signedIn` remains `false` and the Sign In button is visible. Only explicit sign-in failures (user-initiated via `requestToken(false)`) show error messages.
- [ ] **AC-8: Proactive token refresh before expiry.** When the access token is within 5 minutes of expiry (`Date.now() > expiresAt - 300000`) and the user is signed in, a silent `requestToken(true)` is triggered automatically. This check runs on a periodic interval while the user is signed in.
- [ ] **AC-9: OAuth access token never written to localStorage.** After all changes, no localStorage key contains the raw access token string. The existing test `does not write token to localStorage` continues to pass.
- [ ] **AC-10: sessionExpiresAt field in AuthState.** The `AuthState` interface includes `sessionExpiresAt: number | null` and the Zustand store's `INITIAL_STATE` sets it to `null`.

---

## Technical Specification

### Constants

Define these at the top of `src/store/authStore.ts`:

```typescript
const STORAGE_KEY_USER_INFO = 'djrusty_user_info';
const STORAGE_KEY_EXPIRES_AT = 'djrusty_expires_at';
const STORAGE_KEY_SESSION_EXPIRES_AT = 'djrusty_session_expires_at';
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
```

Define this constant at the top of `src/hooks/useAuth.ts`:

```typescript
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const REFRESH_CHECK_INTERVAL_MS = 60 * 1000;     // check every 60 seconds
```

### localStorage Keys

| Key | Type | Content | Written By | Cleared By |
|---|---|---|---|---|
| `djrusty_user_info` | JSON string | `{ sub, name, email, picture }` | `persistSession()` | `clearAuth()` |
| `djrusty_expires_at` | Numeric string | Unix timestamp ms (token expiry) | `persistSession()` | `clearAuth()` |
| `djrusty_session_expires_at` | Numeric string | Unix timestamp ms (session expiry, 7 days) | `persistSession()` | `clearAuth()` |

---

## Task Breakdown

### TASK-1: Add `sessionExpiresAt` to AuthState type

**File to modify:** `src/types/auth.ts`
**Complexity:** Trivial
**Dependencies:** None

**Implementation steps:**

1. Add `sessionExpiresAt` field to the `AuthState` interface, after the `signedIn` field:

```typescript
/**
 * Session expiry time as a Unix timestamp in milliseconds, or null if no session.
 * Set to 7 days from last successful sign-in. Used to gate localStorage
 * identity restoration — distinct from the access token's expiresAt.
 */
sessionExpiresAt: number | null;
```

2. Update the JSDoc comment on the `AuthState` interface. Remove or amend the line that says "Token is stored in memory only -- never written to localStorage." to instead say:

```typescript
/**
 * State slice for Google authentication.
 * The OAuth access token is stored in memory only — never written to localStorage.
 * Non-sensitive user identity metadata (name, email, picture, sub) is persisted
 * to localStorage for session restoration across page refreshes.
 */
```

**Acceptance criteria:**
- [ ] `AuthState` has `sessionExpiresAt: number | null`
- [ ] JSDoc accurately describes the localStorage policy

---

### TASK-2: Add `persistSession()`, `restoreSession()`, and update `clearAuth()` in authStore

**File to modify:** `src/store/authStore.ts`
**Complexity:** Medium
**Dependencies:** TASK-1

**Implementation steps:**

1. Add the four storage key constants and `SESSION_EXPIRY_MS` constant at module level, above the `AuthStoreActions` interface:

```typescript
const STORAGE_KEY_USER_INFO = 'djrusty_user_info';
const STORAGE_KEY_EXPIRES_AT = 'djrusty_expires_at';
const STORAGE_KEY_SESSION_EXPIRES_AT = 'djrusty_session_expires_at';
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
```

2. Add `sessionExpiresAt: null` to `INITIAL_STATE`.

3. Add three new actions to the `AuthStoreActions` interface:

```typescript
/**
 * Write the current userInfo, expiresAt, and sessionExpiresAt to localStorage.
 * Must be called only after both token and userInfo are set in the store.
 * Wraps localStorage.setItem in try/catch — no-ops if storage is unavailable.
 */
persistSession: () => void;

/**
 * Read localStorage keys and restore session state if valid.
 * Validates JSON parsing and numeric timestamps. On any corruption,
 * clears the offending keys and returns without setting state.
 */
restoreSession: () => void;

/**
 * Set the session expiry timestamp in the store.
 */
setSessionExpiry: (sessionExpiresAt: number) => void;
```

4. Implement `persistSession` action:

```typescript
persistSession: () => {
  const { userInfo, expiresAt } = get();
  if (!userInfo || !expiresAt) return;

  const sessionExpiresAt = Date.now() + SESSION_EXPIRY_MS;
  set({ sessionExpiresAt });

  try {
    localStorage.setItem(STORAGE_KEY_USER_INFO, JSON.stringify(userInfo));
    localStorage.setItem(STORAGE_KEY_EXPIRES_AT, String(expiresAt));
    localStorage.setItem(STORAGE_KEY_SESSION_EXPIRES_AT, String(sessionExpiresAt));
  } catch (e) {
    console.warn('[authStore] localStorage write failed — session will not persist:', e);
  }
},
```

Note: The store creator must use `(set, get) => ({` instead of `(set) => ({` to access `get()`.

5. Implement `restoreSession` action:

```typescript
restoreSession: () => {
  try {
    const userInfoRaw = localStorage.getItem(STORAGE_KEY_USER_INFO);
    const expiresAtRaw = localStorage.getItem(STORAGE_KEY_EXPIRES_AT);
    const sessionExpiresAtRaw = localStorage.getItem(STORAGE_KEY_SESSION_EXPIRES_AT);

    // All three keys must be present
    if (!userInfoRaw || !expiresAtRaw || !sessionExpiresAtRaw) {
      return;
    }

    const sessionExpiresAt = Number(sessionExpiresAtRaw);
    const expiresAt = Number(expiresAtRaw);

    // Validate numeric timestamps
    if (isNaN(sessionExpiresAt) || isNaN(expiresAt)) {
      localStorage.removeItem(STORAGE_KEY_USER_INFO);
      localStorage.removeItem(STORAGE_KEY_EXPIRES_AT);
      localStorage.removeItem(STORAGE_KEY_SESSION_EXPIRES_AT);
      return;
    }

    // Session expired — clear and return
    if (sessionExpiresAt <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY_USER_INFO);
      localStorage.removeItem(STORAGE_KEY_EXPIRES_AT);
      localStorage.removeItem(STORAGE_KEY_SESSION_EXPIRES_AT);
      return;
    }

    // Parse userInfo JSON
    const userInfo = JSON.parse(userInfoRaw);

    // Basic shape validation: must have sub, name, email, picture as strings
    if (
      typeof userInfo.sub !== 'string' ||
      typeof userInfo.name !== 'string' ||
      typeof userInfo.email !== 'string' ||
      typeof userInfo.picture !== 'string'
    ) {
      localStorage.removeItem(STORAGE_KEY_USER_INFO);
      localStorage.removeItem(STORAGE_KEY_EXPIRES_AT);
      localStorage.removeItem(STORAGE_KEY_SESSION_EXPIRES_AT);
      return;
    }

    // Restore identity to store — signedIn remains false (no live token yet)
    set({
      userInfo,
      expiresAt,
      sessionExpiresAt,
      signedIn: false,
    });
  } catch {
    // JSON.parse failed or localStorage threw — clear corrupt data
    try {
      localStorage.removeItem(STORAGE_KEY_USER_INFO);
      localStorage.removeItem(STORAGE_KEY_EXPIRES_AT);
      localStorage.removeItem(STORAGE_KEY_SESSION_EXPIRES_AT);
    } catch {
      // localStorage itself is unavailable — nothing to do
    }
  }
},
```

6. Implement `setSessionExpiry` action:

```typescript
setSessionExpiry: (sessionExpiresAt) => {
  set({ sessionExpiresAt });
},
```

7. Update `clearAuth` to also clear localStorage:

```typescript
clearAuth: () => {
  set({ ...INITIAL_STATE });
  try {
    localStorage.removeItem(STORAGE_KEY_USER_INFO);
    localStorage.removeItem(STORAGE_KEY_EXPIRES_AT);
    localStorage.removeItem(STORAGE_KEY_SESSION_EXPIRES_AT);
  } catch {
    // localStorage unavailable — in-memory clear is sufficient
  }
},
```

8. Change the `create` callback signature from `(set) => ({` to `(set, get) => ({` to support `persistSession` reading current state via `get()`.

**Acceptance criteria:**
- [ ] `persistSession()` writes all three keys to localStorage when userInfo and expiresAt are present
- [ ] `persistSession()` no-ops silently when userInfo or expiresAt is null
- [ ] `persistSession()` catches and logs localStorage write failures
- [ ] `restoreSession()` sets userInfo, expiresAt, sessionExpiresAt in store when all keys are valid
- [ ] `restoreSession()` does NOT set `signedIn` to true (leaves as false)
- [ ] `restoreSession()` clears corrupt keys and returns without setting state on invalid JSON
- [ ] `restoreSession()` clears expired session keys and returns without setting state
- [ ] `restoreSession()` handles missing keys gracefully (returns without action)
- [ ] `restoreSession()` handles localStorage unavailability without throwing
- [ ] `clearAuth()` removes all three `djrusty_*` keys from localStorage
- [ ] `clearAuth()` still resets Zustand state to INITIAL_STATE (including `sessionExpiresAt: null`)
- [ ] `INITIAL_STATE` includes `sessionExpiresAt: null`

---

### TASK-3: Update `useAuth` hook for session restoration, conditional silent refresh, silent error handling, and proactive refresh

**File to modify:** `src/hooks/useAuth.ts`
**Complexity:** Medium-High
**Dependencies:** TASK-2

**Implementation steps:**

1. Add constants at the top of the file (below existing constants):

```typescript
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const REFRESH_CHECK_INTERVAL_MS = 60 * 1000;     // check every 60 seconds
```

2. Update the destructured values from `useAuthStore` to include the new actions:

```typescript
const {
  signedIn, userInfo, accessToken, expiresAt,
  setToken, setUserInfo, clearAuth,
  persistSession, restoreSession,
} = useAuthStore();
```

3. Add a `isSilentRefresh` ref:

```typescript
const isSilentRefresh = useRef(false);
```

4. Update `handleTokenReceived` to call `persistSession()` after setting both token and userInfo:

```typescript
const handleTokenReceived = useCallback(
  async (token: string, expiresIn: number) => {
    setToken(token, expiresIn);

    const profile = await fetchUserInfo(token);
    if (profile) {
      setUserInfo(profile);
      // Persist session after both token and userInfo are set in the store
      // Use setTimeout(0) to ensure Zustand state is committed before reading via get()
      setTimeout(() => {
        useAuthStore.getState().persistSession();
      }, 0);
    }
  },
  [setToken, setUserInfo],
);
```

**Important note on the `persistSession` call**: Because `setToken` and `setUserInfo` are Zustand `set()` calls and `persistSession` reads from `get()`, the state is synchronously available. However, to be safe and explicit, call `useAuthStore.getState().persistSession()` directly (bypasses the hook's potentially stale closure). The `setTimeout(0)` is a defensive measure -- if testing shows it is unnecessary, remove it and call `useAuthStore.getState().persistSession()` directly.

5. Update `handleAuthError` to check `isSilentRefresh` ref:

```typescript
const handleAuthError = useCallback((errorCode: string) => {
  // During silent refresh, suppress all error messages — just leave user at sign-in button
  if (isSilentRefresh.current) {
    console.debug('[useAuth] Silent refresh failed (expected if no active Google session):', errorCode);
    return;
  }

  const message = mapAuthErrorMessage(errorCode);
  if (message) {
    console.warn('[useAuth] Auth error:', errorCode, '-', message);
  }
}, []);
```

6. Update the GIS initialization `useEffect` to restore session first, then conditionally call silent refresh:

```typescript
useEffect(() => {
  if (isInitialised.current) return;

  // Step 1: Restore session from localStorage BEFORE GIS init
  restoreSession();

  let attempts = 0;
  const poll = setInterval(() => {
    attempts++;

    if (isGisReady()) {
      clearInterval(poll);
      isInitialised.current = true;
      initAuth(handleTokenReceived, handleAuthError);

      // Step 2: Only attempt silent refresh if a stored session exists
      const { sessionExpiresAt } = useAuthStore.getState();
      if (sessionExpiresAt !== null && sessionExpiresAt > Date.now()) {
        isSilentRefresh.current = true;
        requestToken(true);
      }
      return;
    }

    if (attempts >= GIS_POLL_MAX_ATTEMPTS) {
      clearInterval(poll);
      console.warn('[useAuth] GIS script did not load within the expected time.');
    }
  }, GIS_POLL_INTERVAL_MS);

  return () => {
    clearInterval(poll);
  };
// eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks are stable; deps intentionally omitted to prevent re-init
}, []);
```

7. Update `signIn` to set `isSilentRefresh` to false before explicit sign-in:

```typescript
const signIn = useCallback(() => {
  if (!isGisReady()) {
    console.warn('[useAuth] GIS not ready — cannot sign in yet.');
    return;
  }
  isSilentRefresh.current = false;
  initAuth(handleTokenReceived, handleAuthError);
  requestToken(false);
}, [handleTokenReceived, handleAuthError]);
```

8. Add a `useEffect` for proactive token refresh. This effect sets up an interval that checks token expiry while the user is signed in:

```typescript
useEffect(() => {
  if (!signedIn || expiresAt === null) return;

  const checkExpiry = () => {
    const state = useAuthStore.getState();
    if (
      state.signedIn &&
      state.expiresAt !== null &&
      Date.now() > state.expiresAt - REFRESH_BEFORE_EXPIRY_MS
    ) {
      isSilentRefresh.current = true;
      if (isGisReady()) {
        initAuth(handleTokenReceived, handleAuthError);
        requestToken(true);
      }
    }
  };

  const interval = setInterval(checkExpiry, REFRESH_CHECK_INTERVAL_MS);

  return () => {
    clearInterval(interval);
  };
}, [signedIn, expiresAt, handleTokenReceived, handleAuthError]);
```

9. Update the `signOut` callback — no change needed. `clearAuth()` already handles localStorage cleanup (from TASK-2). The existing implementation is correct.

10. Update the JSDoc comment at the top of the file. Remove or amend the line "This hook never writes to localStorage, sessionStorage, or cookies." to accurately describe the new behavior:

```typescript
/**
 * useAuth.ts — React hook that wraps authService and syncs auth state to authStore.
 *
 * Responsibilities:
 * - Restores user identity from localStorage on mount (before GIS loads)
 * - Initialises the GIS token client once after GIS script loads
 * - Attempts silent token refresh only when a stored session exists
 * - Fetches user profile from Google's userinfo endpoint after token is received
 * - Persists non-sensitive user identity to localStorage after successful sign-in
 * - Proactively refreshes tokens 5 minutes before expiry
 * - Exposes signIn / signOut actions and reactive auth state
 *
 * Security note: The OAuth access token is never persisted to localStorage.
 * Only non-sensitive identity metadata (name, email, picture, sub) is stored.
 */
```

**Acceptance criteria:**
- [ ] `restoreSession()` is called before GIS polling begins
- [ ] `requestToken(true)` is only called on mount when `sessionExpiresAt` is in the future
- [ ] No silent refresh attempt is made when no stored session exists (fresh visitor)
- [ ] `isSilentRefresh` ref is `true` during silent refresh, `false` during explicit sign-in
- [ ] `handleAuthError` suppresses error messages during silent refresh
- [ ] `handleAuthError` shows error messages during explicit sign-in
- [ ] `persistSession()` is called after both `setToken` and `setUserInfo` complete in `handleTokenReceived`
- [ ] Proactive refresh interval is set up when `signedIn` is true and `expiresAt` is not null
- [ ] Proactive refresh triggers `requestToken(true)` when within 5 minutes of expiry
- [ ] Proactive refresh interval is cleaned up on unmount or when signedIn becomes false

---

### TASK-4: Add unit tests for session persistence

**File to modify:** `src/test/auth.test.ts`
**Complexity:** Medium
**Dependencies:** TASK-2

**Implementation steps:**

1. Add localStorage mock setup to the `beforeEach` block. Clear localStorage before each test to prevent cross-contamination:

```typescript
beforeEach(() => {
  useAuthStore.setState({
    accessToken: null,
    expiresAt: null,
    userInfo: null,
    signedIn: false,
    channelName: null,
    sessionExpiresAt: null,
  });
  localStorage.clear();
});
```

2. Add a new describe block: `authStore -- persistSession`:

**Test: writes all three keys to localStorage when userInfo and expiresAt are set**
- Call `setToken(MOCK_TOKEN, MOCK_EXPIRES_IN)` then `setUserInfo(MOCK_USER)` then `persistSession()`
- Assert `localStorage.getItem('djrusty_user_info')` equals `JSON.stringify(MOCK_USER)`
- Assert `localStorage.getItem('djrusty_expires_at')` is a numeric string close to `Date.now() + 3600000`
- Assert `localStorage.getItem('djrusty_session_expires_at')` is a numeric string close to `Date.now() + 7 * 24 * 60 * 60 * 1000`

**Test: sets sessionExpiresAt in store**
- Call `setToken` then `setUserInfo` then `persistSession()`
- Assert `useAuthStore.getState().sessionExpiresAt` is a number close to `Date.now() + 7 * 24 * 60 * 60 * 1000`

**Test: no-ops when userInfo is null**
- Call `setToken(MOCK_TOKEN, MOCK_EXPIRES_IN)` (but NOT setUserInfo) then `persistSession()`
- Assert all three localStorage keys are `null`

**Test: no-ops when expiresAt is null**
- Call `setUserInfo(MOCK_USER)` (but NOT setToken) then `persistSession()`
- Assert all three localStorage keys are `null`

**Test: does not write access token to localStorage**
- Call `setToken(MOCK_TOKEN, MOCK_EXPIRES_IN)` then `setUserInfo(MOCK_USER)` then `persistSession()`
- Assert no localStorage value contains `MOCK_TOKEN`

3. Add a new describe block: `authStore -- restoreSession`:

**Test: restores userInfo and expiresAt from valid localStorage data**
- Set all three localStorage keys with valid data (userInfo JSON, future expiresAt, future sessionExpiresAt)
- Call `restoreSession()`
- Assert `useAuthStore.getState().userInfo` deeply equals the stored user info
- Assert `useAuthStore.getState().expiresAt` equals the stored expiresAt
- Assert `useAuthStore.getState().sessionExpiresAt` equals the stored sessionExpiresAt

**Test: does NOT set signedIn to true**
- Set valid localStorage keys and call `restoreSession()`
- Assert `useAuthStore.getState().signedIn` is `false`

**Test: clears keys and returns without state change when session is expired**
- Set localStorage with `djrusty_session_expires_at` in the past (`Date.now() - 1000`)
- Call `restoreSession()`
- Assert `useAuthStore.getState().userInfo` is `null`
- Assert `localStorage.getItem('djrusty_user_info')` is `null`
- Assert `localStorage.getItem('djrusty_expires_at')` is `null`
- Assert `localStorage.getItem('djrusty_session_expires_at')` is `null`

**Test: clears keys on corrupted userInfo JSON**
- Set `localStorage.setItem('djrusty_user_info', 'not-valid-json')`
- Set valid expiresAt and sessionExpiresAt
- Call `restoreSession()`
- Assert `useAuthStore.getState().userInfo` is `null`
- Assert all three localStorage keys are `null`

**Test: clears keys on invalid numeric timestamps**
- Set valid userInfo JSON
- Set `localStorage.setItem('djrusty_expires_at', 'not-a-number')`
- Set valid sessionExpiresAt
- Call `restoreSession()`
- Assert `useAuthStore.getState().userInfo` is `null`
- Assert all three localStorage keys are `null`

**Test: returns without action when no keys exist**
- Do not set any localStorage keys
- Call `restoreSession()`
- Assert `useAuthStore.getState().userInfo` is `null`
- Assert `useAuthStore.getState().signedIn` is `false`

**Test: clears keys when userInfo shape is invalid (missing required field)**
- Set `localStorage.setItem('djrusty_user_info', JSON.stringify({ sub: '123' }))` (missing name, email, picture)
- Set valid expiresAt and sessionExpiresAt
- Call `restoreSession()`
- Assert `useAuthStore.getState().userInfo` is `null`
- Assert all three localStorage keys are `null`

4. Add a new describe block: `authStore -- clearAuth clears localStorage`:

**Test: removes all three djrusty keys from localStorage**
- Set all three localStorage keys with valid data
- Call `clearAuth()`
- Assert `localStorage.getItem('djrusty_user_info')` is `null`
- Assert `localStorage.getItem('djrusty_expires_at')` is `null`
- Assert `localStorage.getItem('djrusty_session_expires_at')` is `null`

**Test: resets sessionExpiresAt to null in store**
- Set store state with a non-null sessionExpiresAt
- Call `clearAuth()`
- Assert `useAuthStore.getState().sessionExpiresAt` is `null`

5. Update the existing `beforeEach` to include `sessionExpiresAt: null` in the state reset (as shown in step 1).

**Acceptance criteria:**
- [ ] All new tests pass with `vitest`
- [ ] All existing tests continue to pass (no regressions)
- [ ] Tests cover: persist happy path, persist no-ops, restore happy path, restore with expired session, restore with corrupt JSON, restore with invalid timestamps, restore with missing keys, restore with invalid shape, clearAuth localStorage cleanup
- [ ] No test writes the actual OAuth access token to localStorage

---

## Files to Create/Modify

| File | Action | Task |
|---|---|---|
| `src/types/auth.ts` | Modify | TASK-1 |
| `src/store/authStore.ts` | Modify | TASK-2 |
| `src/hooks/useAuth.ts` | Modify | TASK-3 |
| `src/test/auth.test.ts` | Modify | TASK-4 |

No new files are created. No files are deleted.

---

## Implementation Order

```
TASK-1 (types)  -->  TASK-2 (store)  -->  TASK-3 (hook)
                                     -->  TASK-4 (tests)
```

TASK-3 and TASK-4 can be implemented in parallel after TASK-2 is complete, but TASK-4 tests the store directly and does not depend on TASK-3. TASK-3 depends on TASK-2 for the new store actions.

---

## Testing Specification

### Unit Tests (TASK-4)

All tests run with Vitest. Tests use the real Zustand store (not mocked) and the jsdom localStorage (available in Vitest's jsdom environment).

| Test Category | Count | Description |
|---|---|---|
| persistSession happy path | 3 | Writes keys, sets sessionExpiresAt, does not write access token |
| persistSession no-ops | 2 | No-op when userInfo null, no-op when expiresAt null |
| restoreSession happy path | 2 | Restores state, does not set signedIn |
| restoreSession edge cases | 5 | Expired session, corrupt JSON, invalid timestamps, missing keys, invalid shape |
| clearAuth localStorage | 2 | Removes keys, resets sessionExpiresAt |
| **Total new tests** | **14** | |

### Manual Validation (for Tester Agent)

1. Sign in with Google, refresh the page -- avatar and name appear immediately, no popup.
2. Sign in, wait for page refresh, observe network tab for silent GIS token request.
3. Clear `djrusty_session_expires_at` from localStorage (or set to past timestamp), refresh -- Sign In button appears.
4. Sign in, click Sign Out, check localStorage -- all `djrusty_*` keys removed.
5. Corrupt `djrusty_user_info` in localStorage to invalid JSON, refresh -- Sign In button appears, no console errors thrown.
6. Open Safari private mode, sign in -- app works but localStorage write is silently skipped.

---

## Verification Checklist

Before marking this story as complete, verify:

- [ ] All 14 new unit tests pass
- [ ] All existing auth tests still pass (no regressions)
- [ ] `npm run build` (or equivalent) succeeds with no type errors
- [ ] `npm run lint` passes with no new warnings
- [ ] No OAuth access token appears in any localStorage key
- [ ] Page refresh after sign-in shows user identity without popup
- [ ] Fresh visit (no localStorage keys) shows Sign In button with no popup
- [ ] Sign-out clears all `djrusty_*` localStorage keys
