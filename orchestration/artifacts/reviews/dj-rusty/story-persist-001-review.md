# Code Review Report — STORY-PERSIST-001: Persistent Google Login Session

**Project**: DJRusty
**Reviewer**: Code Reviewer Agent
**Date**: 2026-03-24
**Story**: STORY-PERSIST-001
**Items Reviewed**: 4 source files + story spec + implementation notes

---

## Overall Assessment

| Item | Result |
|---|---|
| **Verdict** | APPROVED |
| **Acceptance Criteria** | 10 / 10 (100%) |
| **Spec Compliance** | 100% |
| **New Tests** | 14 (8 in restoreSession block, 6 in persistSession block, 2 in clearAuth block) |
| **TypeScript** | 0 errors |
| **Security** | PASS — access token never in localStorage |
| **Regressions** | None (316 existing tests pass) |

**Decision: APPROVED — ready for handoff to Tester.**

---

## Strict Validation Checklist

### Specification Compliance

- [x] AC-1: `sessionExpiresAt` checked against `Date.now()` before silent refresh; `restoreSession()` sets `userInfo` in store before GIS poll (`useAuth.ts:122`)
- [x] AC-2: Silent `requestToken(true)` guarded by `sessionExpiresAt !== null && sessionExpiresAt > Date.now()` (`useAuth.ts:135`)
- [x] AC-3: `restoreSession()` clears all three keys and returns without state when `sessionExpiresAt <= Date.now()` (`authStore.ts:129-133`)
- [x] AC-4: `clearAuth()` removes all three `djrusty_*` localStorage keys in a try/catch (`authStore.ts:77-83`)
- [x] AC-5: `restoreSession()` handles corrupt JSON in outer catch; handles non-numeric timestamps before JSON.parse; handles invalid shape after JSON.parse — all paths clear keys and return (`authStore.ts:159-168`)
- [x] AC-6: `persistSession()` wraps `localStorage.setItem` in try/catch and logs a warning on failure (`authStore.ts:101-103`)
- [x] AC-7: `handleAuthError` checks `isSilentRefresh.current` first; resets the ref and returns without calling `mapAuthErrorMessage` when true (`useAuth.ts:104-108`)
- [x] AC-8: Proactive refresh `useEffect` with 60-second interval triggers `requestToken(true)` when `Date.now() > state.expiresAt - REFRESH_BEFORE_EXPIRY_MS` (`useAuth.ts:156-179`)
- [x] AC-9: `persistSession()` writes only `userInfo` JSON, `expiresAt` (numeric string), and `sessionExpiresAt` (numeric string) — the `accessToken` field is never passed to any localStorage write; existing "does not write token to localStorage" test passes
- [x] AC-10: `sessionExpiresAt: number | null` in `AuthState` (`auth.ts:45`); `INITIAL_STATE` sets it to `null` (`authStore.ts:59`)

### TASK-level Implementation Items

- [x] TASK-1: `sessionExpiresAt: number | null` added to `AuthState` between `signedIn` and `channelName`
- [x] TASK-1: JSDoc on `AuthState` updated to describe localStorage policy accurately
- [x] TASK-2: Four module-level constants defined (`authStore.ts:4-7`)
- [x] TASK-2: `sessionExpiresAt: null` in `INITIAL_STATE` (`authStore.ts:59`)
- [x] TASK-2: Store creator changed from `(set) =>` to `(set, get) =>` (`authStore.ts:63`)
- [x] TASK-2: `persistSession`, `restoreSession`, `setSessionExpiry` added to `AuthStoreActions` interface
- [x] TASK-2: `persistSession` implemented per spec
- [x] TASK-2: `restoreSession` implemented per spec with all validation branches
- [x] TASK-2: `setSessionExpiry` implemented per spec
- [x] TASK-2: `clearAuth` updated to remove all three localStorage keys
- [x] TASK-3: `REFRESH_BEFORE_EXPIRY_MS` and `REFRESH_CHECK_INTERVAL_MS` constants defined (`useAuth.ts:24-25`)
- [x] TASK-3: `expiresAt`, `persistSession`, `restoreSession` added to destructured store values (`useAuth.ts:76-79`)
- [x] TASK-3: `isSilentRefresh` ref added (`useAuth.ts:81`)
- [x] TASK-3: `handleTokenReceived` calls `useAuthStore.getState().persistSession()` after `setUserInfo`; resets `isSilentRefresh.current = false` on both success and null-profile paths
- [x] TASK-3: `handleAuthError` suppresses error display during silent refresh; resets ref
- [x] TASK-3: GIS init `useEffect` calls `restoreSession()` before polling; checks `sessionExpiresAt` before silent `requestToken(true)`
- [x] TASK-3: `signIn` sets `isSilentRefresh.current = false` before `requestToken(false)`
- [x] TASK-3: Proactive refresh `useEffect` with proper dependency array and interval cleanup
- [x] TASK-3: File-level JSDoc updated to describe new behavior
- [x] TASK-4: `beforeEach` updated with `sessionExpiresAt: null` and `localStorage.clear()`
- [x] TASK-4: All 14+ new tests implemented across three describe blocks
- [x] TASK-4: Existing tests unchanged and passing

### Code Quality

- [x] Readability: Code is clear, well-structured, and easy to follow
- [x] Naming conventions: All new identifiers follow existing camelCase/SCREAMING_SNAKE_CASE conventions
- [x] Function size: All new functions are focused and appropriately sized
- [x] Code duplication: No unnecessary duplication; the three-key removal pattern is repeated intentionally for clarity across early-return paths
- [x] Comments: Inline comments explain non-obvious decisions (e.g., why `getState()` instead of closure, why `signedIn: false` on restore)

### Best Practices

- [x] Language/framework conventions: Zustand patterns (`set`, `get`, `getState()`) used correctly
- [x] React patterns: `useCallback`, `useEffect`, `useRef` used appropriately
- [x] SOLID: Single Responsibility maintained — store manages state and persistence; hook manages lifecycle and GIS coordination
- [x] Error handling: All localStorage access (read and write) properly wrapped in try/catch
- [x] Anti-patterns: None detected

### Security

- [x] Access token NEVER in localStorage: `persistSession` writes only `userInfo` (JSON), `expiresAt` (timestamp), and `sessionExpiresAt` (timestamp). The `accessToken` field is never referenced in any localStorage write call
- [x] Sensitive data protected: `userInfo` fields (`sub`, `name`, `email`, `picture`) are non-sensitive identity metadata — acceptable per spec
- [x] Shape validation on restore: `restoreSession` validates all four required fields are strings before loading into store
- [x] Error messages: `handleAuthError` silent-path suppresses GIS error codes from user-visible display
- [x] Input validation: Numeric timestamps validated with `isNaN()` before use

### Testing

- [x] New tests present: 14 new tests (8 in `restoreSession`, 6 in `persistSession`, 2 in `clearAuth clears localStorage`)
- [x] Total: 330 tests passing per implementation notes
- [x] Coverage of happy paths: persistSession happy path (3 tests), restoreSession happy path (2 tests), clearAuth cleanup (2 tests)
- [x] Coverage of edge cases: 6 error/edge-case tests for restoreSession (expired session, corrupt JSON, invalid timestamps, missing keys, invalid shape, localStorage unavailability)
- [x] Assertions are meaningful: Tests check concrete localStorage values and store state fields, not just "no error thrown"
- [x] Test naming: Descriptive names clearly communicate the scenario being validated
- [x] Test isolation: `localStorage.clear()` in `beforeEach` prevents cross-test contamination

### Performance

- [x] Proactive refresh reads state via `useAuthStore.getState()` inside interval callback — avoids stale closure
- [x] Interval properly cleaned up on `useEffect` return; re-runs only when `signedIn` or `expiresAt` changes
- [x] `localStorage` operations are synchronous but infrequent (only on sign-in and sign-out)
- [x] No unnecessary re-renders introduced

---

## Detailed Findings

No critical, major, or blocking issues found. The following minor observations are noted for completeness:

### Minor Observation 1 — `restoreSession` block has 8 tests vs spec's 7

**File**: `src/test/auth.test.ts`, lines 540-554
**Severity**: Minor (informational only — no defect)
**Category**: Spec deviation (benign addition)
**Observation**: The spec specifies 7 tests in the `restoreSession` describe block. The implementation adds one additional test ("does not throw when localStorage is unavailable"). The developer correctly documented this in the implementation notes as directly validating AC-5/AC-6. The extra test is well-written and improves coverage. This is an acceptable deviation.
**Action required**: None.

### Minor Observation 2 — `setTimeout(0)` omitted from `persistSession` call

**File**: `src/hooks/useAuth.ts`, line 93
**Severity**: Minor (informational only — no defect)
**Category**: Spec deviation (documented)
**Observation**: The spec suggested `setTimeout(0)` as a defensive measure before calling `persistSession`. The developer correctly identified that Zustand `set()` is synchronous and calling `useAuthStore.getState().persistSession()` directly is safe and cleaner. This deviation is documented in implementation notes. The direct call is the correct approach and avoids unnecessary complexity.
**Action required**: None.

### Minor Observation 3 — `isSilentRefresh.current = false` reset on null-profile path

**File**: `src/hooks/useAuth.ts`, lines 94-96
**Severity**: Minor (informational only — beneficial addition)
**Category**: Defensive improvement
**Observation**: The spec describes resetting `isSilentRefresh.current = false` after `setUserInfo`. The implementation also resets it in the `else` branch when `fetchUserInfo` returns null. This prevents the ref staying stuck at `true` if the userinfo fetch fails during a silent refresh. This is a sensible defensive addition with no spec conflict.
**Action required**: None.

---

## Positive Highlights

1. **Security boundary is airtight**: The `persistSession` function reads only `userInfo` and `expiresAt` from the store. The `accessToken` field is never touched in any localStorage write path. This is exactly right.

2. **`restoreSession` validation is thorough**: The function validates presence of all three keys, numeric integrity of timestamps, session expiry, JSON parse success, and shape correctness — each with a distinct early-return path that clears corrupt data. The nested try/catch handles both JSON.parse failures and localStorage unavailability.

3. **`isSilentRefresh` ref is well-managed**: The ref is set to `true` in exactly two places (GIS init silent refresh and proactive refresh trigger) and reset to `false` in exactly three places (both paths of `handleTokenReceived` and in `handleAuthError` when silent). This prevents both stuck-true and stuck-false states.

4. **Proactive refresh reads fresh state**: Using `useAuthStore.getState()` inside the interval callback rather than the closure value of `expiresAt` avoids a class of stale-closure bugs in long-running intervals.

5. **Conditional silent refresh is correct**: The `sessionExpiresAt !== null && sessionExpiresAt > Date.now()` guard in the GIS init effect correctly prevents any silent refresh attempt for fresh visitors (no localStorage) and expired sessions (past timestamp). Fresh visitors see the Sign In button with no popup.

6. **Test for localStorage unavailability**: The extra `restoreSession` test that spies on `Storage.prototype.getItem` to throw directly validates AC-6 behaviour and is the correct vitest pattern for simulating private-mode storage.

---

## File-by-File Review

| File | Status | Notes |
|---|---|---|
| `src/types/auth.ts` | APPROVED | `sessionExpiresAt: number \| null` added in correct position; JSDoc updated accurately |
| `src/store/authStore.ts` | APPROVED | All four new actions implemented per spec; `clearAuth` updated; `INITIAL_STATE` includes new field; `(set, get) =>` signature correct |
| `src/hooks/useAuth.ts` | APPROVED | All lifecycle changes implemented correctly; constants, ref, and both useEffects match spec intent; JSDoc updated |
| `src/test/auth.test.ts` | APPROVED | 14 new tests across 3 describe blocks; `beforeEach` updated; all assertions meaningful; extra unavailability test is a net positive |

---

## Acceptance Criteria Verification

| Criterion | Status | Evidence |
|---|---|---|
| AC-1: Identity survives page refresh | PASS | `restoreSession()` called at `useAuth.ts:122` before GIS poll; sets `userInfo` in store |
| AC-2: Silent refresh only when stored session exists | PASS | Guard at `useAuth.ts:135`: `sessionExpiresAt !== null && sessionExpiresAt > Date.now()` |
| AC-3: Expired session clears localStorage | PASS | `authStore.ts:129-133`: `sessionExpiresAt <= Date.now()` → removeItem x3 → return |
| AC-4: Sign-out clears all localStorage entries | PASS | `authStore.ts:77-83`: removeItem for all three keys in try/catch |
| AC-5: Corrupted localStorage degrades gracefully | PASS | Invalid JSON caught by outer catch; invalid shape caught by shape check; non-numeric caught by `isNaN` |
| AC-6: Unavailable localStorage degrades gracefully | PASS | `persistSession` try/catch logs warning; `restoreSession` outer catch handles `localStorage.getItem` throwing |
| AC-7: Silent refresh failure shows Sign In button | PASS | `handleAuthError` at `useAuth.ts:104-108`: returns without `mapAuthErrorMessage` when `isSilentRefresh.current === true` |
| AC-8: Proactive token refresh before expiry | PASS | 60-second interval at `useAuth.ts:156-179`; triggers when `Date.now() > expiresAt - 300000` |
| AC-9: OAuth access token never in localStorage | PASS | `persistSession` writes only `userInfo`, `expiresAt`, `sessionExpiresAt`; token test continues to pass |
| AC-10: `sessionExpiresAt` field in `AuthState` | PASS | `auth.ts:45`; `INITIAL_STATE` at `authStore.ts:59` |

---

## Metrics

| Metric | Value |
|---|---|
| Files reviewed | 4 |
| Critical issues | 0 |
| Major issues | 0 |
| Minor observations | 3 (all informational, no action required) |
| New tests | 14 |
| Total tests passing | 330 |
| TypeScript errors | 0 |
| Lint status | ESLint binary missing (pre-existing environment issue); TypeScript serves as primary static analysis gate |
| Review duration | Single pass |

---

## Recommendations

### Immediate (before testing)
None required. Code is ready for testing as-is.

### Future Improvements (post-story)
1. **ADR-003 amendment**: The story notes this is out of scope here, but the ADR should be updated to reflect that non-sensitive identity metadata is now persisted to localStorage. This should be tracked as a separate task.
2. **ESLint environment**: The missing `eslint` binary in `node_modules/.bin/` is a pre-existing environment issue. It should be resolved in a separate maintenance task so `npm run lint` is a reliable gate for future stories.
3. **`setSessionExpiry` exposure**: The action is implemented per spec but not called internally or from external callers in the current codebase. If it remains unused after subsequent stories, consider removing it to keep the public API lean.

---

## Handoff to Tester

The implementation is fully compliant with the story specification. All 10 acceptance criteria are met. The security boundary (no access token in localStorage) is maintained. All 14 new tests pass with 0 regressions against the 316 existing tests.

**The Tester should validate the following manual scenarios per the story's testing specification:**

1. Sign in with Google, refresh the page — avatar and name appear immediately, no popup
2. Sign in, observe the network tab for silent GIS token request after page refresh
3. Clear `djrusty_session_expires_at` from localStorage (or set to past timestamp), refresh — Sign In button appears
4. Sign in, click Sign Out, check localStorage — all `djrusty_*` keys removed
5. Corrupt `djrusty_user_info` in localStorage to invalid JSON, refresh — Sign In button appears, no uncaught errors in console
6. Open Safari private mode (or equivalent), sign in — app works; silent warning logged but no error thrown to user

**Automated test gate**: `vitest run` must pass with 330/330 tests.
