# Test Results — STORY-PERSIST-001: Persistent Google Login Session

**Project**: DJRusty
**Tester**: Tester Agent
**Date**: 2026-03-24
**Story**: STORY-PERSIST-001
**Items Tested**: 4 source files (auth.ts, authStore.ts, useAuth.ts, auth.test.ts)
**Duration**: Single pass

---

## Overall Assessment

| Item | Result |
|---|---|
| **Verdict** | PASSED |
| **Acceptance Criteria** | 10 / 10 (100%) |
| **Spec Compliance** | 100% |
| **Test Suite** | 330 / 330 (100%) |
| **TypeScript Check** | 0 errors |
| **Security** | PASS — access token never in localStorage |
| **Regressions** | None detected |
| **Decision** | PASS — ready for deployment |
| **Summary** | All 10 acceptance criteria are satisfied. All 330 tests pass with zero regressions. TypeScript emits no errors. The security boundary (OAuth access token never written to localStorage) is maintained. The 14 new unit tests cover all specified scenarios plus one additional edge case that improves coverage. |

---

## Test Execution Summary

| Category | Count |
|---|---|
| Total tests | 330 |
| Passed | 330 |
| Failed | 0 |
| Blocked | 0 |
| Skipped | 0 |
| New tests (this story) | 14 |
| Pre-existing tests | 316 |

**Test command**: `npm test -- --run`
**Test runner**: Vitest v2.1.9
**Environment**: jsdom

### Test File Results

| File | Tests | Status |
|---|---|---|
| src/test/auth.test.ts | 45 | PASS |
| src/test/stores.test.ts | 39 | PASS |
| src/test/youtube-player.test.ts | 37 | PASS |
| src/test/story-011-hot-cues.test.ts | 27 | PASS |
| src/test/volume-map.test.ts | 26 | PASS |
| src/test/search-store.test.ts | 25 | PASS |
| src/test/parse-duration.test.ts | 23 | PASS |
| src/test/hot-cues.test.ts | 22 | PASS |
| src/test/settings-store.test.ts | 18 | PASS |
| src/test/recently-played.test.ts | 16 | PASS |
| src/test/deck-b.test.ts | 15 | PASS |
| src/test/tap-tempo.test.ts | 15 | PASS |
| src/test/loop-utils.test.ts | 12 | PASS |
| src/test/scaffold.test.ts | 10 | PASS |

---

## TypeScript Check Result

**Command**: `npx tsc --noEmit`
**Result**: PASS — 0 errors, 0 warnings, no output produced.

---

## Acceptance Criteria Validation

### [x] AC-1: Identity survives page refresh

**Status**: PASS
**Evidence**: `useAuth.ts:122` calls `restoreSession()` synchronously before the GIS polling interval begins. `restoreSession()` in `authStore.ts:106-168` reads `djrusty_user_info` from localStorage, validates the shape, and sets `userInfo` in the Zustand store with `signedIn: false`. The user's name and avatar are therefore available in store state before GIS initializes. Test: `restoreSession` describe block — "restores userInfo, expiresAt, and sessionExpiresAt from valid localStorage data" (PASS).

### [x] AC-2: Silent GIS token refresh only when stored session exists

**Status**: PASS
**Evidence**: `useAuth.ts:134-138` reads `sessionExpiresAt` via `useAuthStore.getState()` after GIS loads. The guard `sessionExpiresAt !== null && sessionExpiresAt > Date.now()` ensures `requestToken(true)` is only called when a valid, non-expired session exists. Fresh visitors (no localStorage keys) proceed to sign-in button with no silent refresh. Test: `restoreSession` "returns without setting state when no localStorage keys exist" confirms the store stays clean for fresh visitors.

### [x] AC-3: Expired session clears localStorage

**Status**: PASS
**Evidence**: `authStore.ts:128-133` — when `sessionExpiresAt <= Date.now()`, all three `removeItem` calls execute and `restoreSession` returns without calling `set()`. Test: `restoreSession` — "clears all keys and leaves state unchanged when session is expired" (PASS): sets `djrusty_session_expires_at` to `Date.now() - 1000`, calls `restoreSession()`, asserts `userInfo` is null and all three localStorage keys are null.

### [x] AC-4: Sign-out clears all localStorage entries

**Status**: PASS
**Evidence**: `authStore.ts:75-84` — `clearAuth()` calls `set({ ...INITIAL_STATE })` then removes all three `djrusty_*` keys in a try/catch block. Test: `clearAuth clears localStorage` — "removes all three djrusty_* keys from localStorage" (PASS).

### [x] AC-5: Corrupted localStorage degrades gracefully

**Status**: PASS
**Evidence**: Three corruption paths are covered:
- Invalid JSON: caught by the outer `catch` block at `authStore.ts:159-168`, which removes all three keys.
- Non-numeric timestamps: caught at `authStore.ts:120-126` via `isNaN()` check before `JSON.parse`, removes all three keys.
- Invalid shape (missing required fields): caught at `authStore.ts:140-149` via explicit string-type checks for `sub`, `name`, `email`, `picture`.
All three paths clear corrupt keys and return without setting any state. No error is thrown.
Tests: "clears all keys when userInfo JSON is corrupted", "clears all keys when expiresAt is not a number", "clears all keys when userInfo shape is invalid" — all PASS.

### [x] AC-6: Unavailable localStorage degrades gracefully

**Status**: PASS
**Evidence**: `persistSession()` at `authStore.ts:97-103` wraps all three `localStorage.setItem` calls in a try/catch that logs `console.warn` and silently continues. `restoreSession()` outer try/catch at `authStore.ts:159-168` handles `localStorage.getItem` throwing by clearing keys (with a nested try/catch in case `removeItem` also throws). Test: `restoreSession` — "does not throw when localStorage is unavailable (throws on getItem)" uses `vi.spyOn(Storage.prototype, 'getItem')` to simulate private-mode storage throwing — asserts no exception is propagated (PASS).

### [x] AC-7: Silent refresh failure shows Sign In button

**Status**: PASS
**Evidence**: `useAuth.ts:102-115` — `handleAuthError` checks `isSilentRefresh.current` first. When true: logs a debug message, resets the ref to false, and returns without calling `mapAuthErrorMessage` or any user-visible error display. The user sees their restored identity (name, avatar from `restoreSession`) but `signedIn` remains false. Explicit sign-in errors still surface via the normal `mapAuthErrorMessage` path.

### [x] AC-8: Proactive token refresh before expiry

**Status**: PASS
**Evidence**: `useAuth.ts:155-179` — a `useEffect` depending on `[signedIn, expiresAt, handleTokenReceived, handleAuthError]` sets up a `setInterval` with `REFRESH_CHECK_INTERVAL_MS` (60 seconds). Each tick calls `checkExpiry()` which reads `useAuthStore.getState()` fresh (avoids stale closures) and triggers `initAuth` + `requestToken(true)` when `Date.now() > state.expiresAt - REFRESH_BEFORE_EXPIRY_MS` (within 5 minutes of expiry). The interval is cleaned up on unmount via the effect's return function.

### [x] AC-9: OAuth access token never written to localStorage

**Status**: PASS
**Evidence**: `persistSession()` at `authStore.ts:90-104` reads only `userInfo` and `expiresAt` from `get()`. The `accessToken` field is never referenced in any `localStorage.setItem` call. Tests: "does not write the access token to localStorage" in the `persistSession` block (PASS) and the pre-existing "does not write token to localStorage" in the `setToken` block (PASS) — both confirm no localStorage value contains `MOCK_TOKEN`.

### [x] AC-10: sessionExpiresAt field in AuthState

**Status**: PASS
**Evidence**: `src/types/auth.ts:45` — `sessionExpiresAt: number | null` is declared in the `AuthState` interface between `signedIn` and `channelName`. `authStore.ts:59` — `INITIAL_STATE` sets `sessionExpiresAt: null`. Test: `clearAuth clears localStorage` — "resets sessionExpiresAt to null in the store" (PASS).

---

## Specification Compliance Validation

### Spec After (STORY-PERSIST-001) Compliance

| Requirement | Status | Evidence |
|---|---|---|
| `STORAGE_KEY_USER_INFO = 'djrusty_user_info'` | [x] PASS | `authStore.ts:4` |
| `STORAGE_KEY_EXPIRES_AT = 'djrusty_expires_at'` | [x] PASS | `authStore.ts:5` |
| `STORAGE_KEY_SESSION_EXPIRES_AT = 'djrusty_session_expires_at'` | [x] PASS | `authStore.ts:6` |
| `SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000` | [x] PASS | `authStore.ts:7` |
| `REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000` | [x] PASS | `useAuth.ts:24` |
| `REFRESH_CHECK_INTERVAL_MS = 60 * 1000` | [x] PASS | `useAuth.ts:25` |
| Store creator signature `(set, get) =>` | [x] PASS | `authStore.ts:63` |
| `sessionExpiresAt: null` in `INITIAL_STATE` | [x] PASS | `authStore.ts:59` |
| `persistSession` action implemented | [x] PASS | `authStore.ts:90-104` |
| `restoreSession` action implemented | [x] PASS | `authStore.ts:106-169` |
| `setSessionExpiry` action implemented | [x] PASS | `authStore.ts:171-173` |
| `clearAuth` removes all three localStorage keys | [x] PASS | `authStore.ts:77-83` |
| `isSilentRefresh` ref in `useAuth` | [x] PASS | `useAuth.ts:81` |
| `restoreSession()` called before GIS poll | [x] PASS | `useAuth.ts:122` |
| Conditional `requestToken(true)` on session check | [x] PASS | `useAuth.ts:134-138` |
| `handleAuthError` suppresses silent refresh errors | [x] PASS | `useAuth.ts:102-115` |
| `persistSession()` called via `getState()` after sign-in | [x] PASS | `useAuth.ts:93` |
| Proactive refresh `useEffect` with cleanup | [x] PASS | `useAuth.ts:155-179` |
| `signIn` resets `isSilentRefresh.current = false` | [x] PASS | `useAuth.ts:190` |
| JSDoc on `AuthState` updated | [x] PASS | `auth.ts:18-23` |
| JSDoc on `useAuth.ts` updated | [x] PASS | `useAuth.ts:1-15` |
| `beforeEach` includes `sessionExpiresAt: null` + `localStorage.clear()` | [x] PASS | `auth.test.ts:28-38` |
| 14 new unit tests across 3 describe blocks | [x] PASS | `auth.test.ts:355-584` |

---

## localStorage Key Verification

The following exact keys are confirmed used in the implementation:

| Key | Written By | Cleared By | Contains Access Token? |
|---|---|---|---|
| `djrusty_user_info` | `persistSession()` | `clearAuth()`, `restoreSession()` (on corruption/expiry) | NO — JSON of `{sub, name, email, picture}` only |
| `djrusty_expires_at` | `persistSession()` | `clearAuth()`, `restoreSession()` (on corruption/expiry) | NO — numeric string timestamp only |
| `djrusty_session_expires_at` | `persistSession()` | `clearAuth()`, `restoreSession()` (on corruption/expiry) | NO — numeric string timestamp only |

Access token (`accessToken` field from the store) is confirmed NEVER passed to `localStorage.setItem` in any code path.

---

## Try/Catch Coverage Verification

All localStorage operations are confirmed wrapped:

| Operation | Location | Wrapped? |
|---|---|---|
| `localStorage.setItem` (user_info) | `authStore.ts:98` | [x] YES — try/catch at lines 97-103 |
| `localStorage.setItem` (expires_at) | `authStore.ts:99` | [x] YES — same try/catch |
| `localStorage.setItem` (session_expires_at) | `authStore.ts:100` | [x] YES — same try/catch |
| `localStorage.getItem` (all three in restoreSession) | `authStore.ts:108-110` | [x] YES — outer try/catch at lines 107-168 |
| `localStorage.removeItem` (in clearAuth) | `authStore.ts:78-80` | [x] YES — try/catch at lines 77-83 |
| `localStorage.removeItem` (in restoreSession expired path) | `authStore.ts:130-132` | [x] YES — inside outer try block |
| `localStorage.removeItem` (in restoreSession NaN path) | `authStore.ts:122-124` | [x] YES — inside outer try block |
| `localStorage.removeItem` (in restoreSession shape-invalid path) | `authStore.ts:146-148` | [x] YES — inside outer try block |
| `localStorage.removeItem` (in outer catch) | `authStore.ts:161-163` | [x] YES — nested try/catch at lines 160-166 |

---

## New Test Coverage Detail

### authStore — persistSession (6 tests, all PASS)

| Test | Status |
|---|---|
| Writes all three keys to localStorage | [x] PASS |
| Sets sessionExpiresAt in store to ~7 days from now | [x] PASS |
| Writes djrusty_expires_at as numeric string | [x] PASS |
| Does nothing when userInfo is null | [x] PASS |
| Does nothing when expiresAt is null | [x] PASS |
| Does not write the access token to localStorage | [x] PASS |

### authStore — restoreSession (8 tests, all PASS)

| Test | Status |
|---|---|
| Restores userInfo, expiresAt, sessionExpiresAt from valid data | [x] PASS |
| Does NOT set signedIn to true | [x] PASS |
| Clears all keys when session is expired | [x] PASS |
| Clears all keys when userInfo JSON is corrupted | [x] PASS |
| Clears all keys when expiresAt is not a number | [x] PASS |
| Returns without state change when no keys exist | [x] PASS |
| Clears all keys when userInfo shape is invalid | [x] PASS |
| Does not throw when localStorage.getItem throws | [x] PASS |

Note: The spec specifies 7 tests in this block. The implementation includes 8 — the extra test directly validates AC-6 (unavailable localStorage). This is an acceptable and beneficial addition.

### authStore — clearAuth clears localStorage (2 tests, all PASS)

| Test | Status |
|---|---|
| Removes all three djrusty_* keys from localStorage | [x] PASS |
| Resets sessionExpiresAt to null in the store | [x] PASS |

---

## Regression Test Results

All 316 pre-existing tests continue to pass with no regressions detected:

| Test File | Pre-existing Tests | Status |
|---|---|---|
| auth.test.ts (original tests) | 31 | [x] PASS |
| stores.test.ts | 39 | [x] PASS |
| youtube-player.test.ts | 37 | [x] PASS |
| story-011-hot-cues.test.ts | 27 | [x] PASS |
| volume-map.test.ts | 26 | [x] PASS |
| search-store.test.ts | 25 | [x] PASS |
| parse-duration.test.ts | 23 | [x] PASS |
| hot-cues.test.ts | 22 | [x] PASS |
| settings-store.test.ts | 18 | [x] PASS |
| recently-played.test.ts | 16 | [x] PASS |
| deck-b.test.ts | 15 | [x] PASS |
| tap-tempo.test.ts | 15 | [x] PASS |
| loop-utils.test.ts | 12 | [x] PASS |
| scaffold.test.ts | 10 | [x] PASS |

Confirmed: the pre-existing "does not write token to localStorage" test in `setToken` block passes, validating AC-9 did not regress.

---

## Security Testing

| Check | Status | Notes |
|---|---|---|
| Access token never in localStorage | [x] PASS | `persistSession` reads only `userInfo` and `expiresAt` from store; `accessToken` field not referenced |
| userInfo shape validation on restore | [x] PASS | All four fields (`sub`, `name`, `email`, `picture`) checked as strings before loading |
| Numeric timestamp validation | [x] PASS | `isNaN()` check prevents NaN timestamps from entering the store |
| Corrupt data removed on detection | [x] PASS | All corruption paths call `removeItem` x3 before returning |
| Error suppression during silent refresh | [x] PASS | GIS error codes not surfaced to user during background token refresh |
| localStorage unavailability handled | [x] PASS | Both read and write failures caught; app continues with in-memory-only auth |

---

## Issues Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| Major | 0 |
| Minor | 0 |

No bugs found. No bug report file required.

---

## Deviations from Spec (Informational — All Acceptable)

Three minor deviations were identified and documented by the developer. None represent defects.

1. **Extra restoreSession test (8 vs 7 specified)**: The extra test validates AC-6 (localStorage unavailability) directly. Net positive — improves coverage.
2. **`setTimeout(0)` omitted from `persistSession` call**: Zustand `set()` is synchronous; direct `getState().persistSession()` call is correct and cleaner.
3. **`isSilentRefresh.current = false` reset on profile-fetch failure path**: Defensive improvement that prevents the ref staying stuck at `true` if `fetchUserInfo` returns null during silent refresh.

---

## Recommendations

### Immediate (before deployment)
None required. The implementation is complete and all quality gates are satisfied.

### Future Improvements (post-story)
1. **ADR-003 amendment**: The Architecture Decision Record should be updated to reflect that non-sensitive identity metadata is now persisted to localStorage. This was noted as out of scope for this story.
2. **ESLint environment**: The `eslint` binary is missing from `node_modules/.bin/`. This pre-existing issue means `npm run lint` does not run. It should be resolved in a separate maintenance task.
3. **`setSessionExpiry` usage review**: The action is exposed on `AuthStoreActions` per spec but not called internally or externally in the current codebase. If unused after subsequent stories, consider removing it to keep the API lean.

---

## Sign-Off

| Field | Value |
|---|---|
| **Tester** | Tester Agent |
| **Date** | 2026-03-24 |
| **Status** | PASSED |
| **Confidence Level** | HIGH |
| **Deployment Recommendation** | APPROVED FOR DEPLOYMENT |

All 10 acceptance criteria validated. 330/330 tests passing. TypeScript clean. Security boundary intact. No critical or major issues found.
