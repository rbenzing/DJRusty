/**
 * auth.test.ts — Unit tests for authStore actions.
 *
 * Covers STORY-002 acceptance criteria:
 * - setToken stores token and marks signedIn true
 * - setToken correctly calculates expiresAt from expiresIn
 * - setUserInfo stores user profile fields
 * - clearAuth resets all state to initial values (token must not be recoverable)
 * - setChannelName stores and clears channel name
 * - signedIn state transitions: signed-out → signed-in → signed-out
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useAuthStore } from '../store/authStore';
import type { GoogleUserInfo } from '../types/auth';

const MOCK_USER: GoogleUserInfo = {
  sub: 'google-uid-12345',
  name: 'DJ Rusty',
  email: 'dj.rusty@example.com',
  picture: 'https://lh3.googleusercontent.com/a/example',
};

const MOCK_TOKEN = 'ya29.mock_access_token_abcdef';
const MOCK_EXPIRES_IN = 3600; // 1 hour

/** Reset store to initial values and clear localStorage before each test. */
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

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('authStore — initial state', () => {
  it('starts with accessToken null', () => {
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('starts with signedIn false', () => {
    expect(useAuthStore.getState().signedIn).toBe(false);
  });

  it('starts with expiresAt null', () => {
    expect(useAuthStore.getState().expiresAt).toBeNull();
  });

  it('starts with userInfo null', () => {
    expect(useAuthStore.getState().userInfo).toBeNull();
  });

  it('starts with channelName null', () => {
    expect(useAuthStore.getState().channelName).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setToken
// ---------------------------------------------------------------------------

describe('authStore — setToken', () => {
  it('stores the access token', () => {
    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, MOCK_EXPIRES_IN);
    });

    expect(useAuthStore.getState().accessToken).toBe(MOCK_TOKEN);
  });

  it('sets signedIn to true', () => {
    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, MOCK_EXPIRES_IN);
    });

    expect(useAuthStore.getState().signedIn).toBe(true);
  });

  it('calculates expiresAt as current time plus expiresIn milliseconds', () => {
    const before = Date.now();
    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, MOCK_EXPIRES_IN);
    });
    const after = Date.now();

    const { expiresAt } = useAuthStore.getState();
    expect(expiresAt).not.toBeNull();
    expect(expiresAt!).toBeGreaterThanOrEqual(before + MOCK_EXPIRES_IN * 1000);
    expect(expiresAt!).toBeLessThanOrEqual(after + MOCK_EXPIRES_IN * 1000);
  });

  it('expiresAt is approximately 1 hour in the future for a 3600s token', () => {
    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, 3600);
    });

    const { expiresAt } = useAuthStore.getState();
    const oneHourMs = 3600 * 1000;
    const tolerance = 1000; // 1 second tolerance for test execution time
    expect(expiresAt!).toBeGreaterThan(Date.now() + oneHourMs - tolerance);
    expect(expiresAt!).toBeLessThanOrEqual(Date.now() + oneHourMs + tolerance);
  });

  it('does not write token to localStorage', () => {
    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, MOCK_EXPIRES_IN);
    });

    // Token must remain exclusively in memory
    const stored = Object.keys(localStorage).map((k) => localStorage.getItem(k)).join('');
    expect(stored).not.toContain(MOCK_TOKEN);
  });

  it('overwrites a previous token when called a second time', () => {
    act(() => {
      useAuthStore.getState().setToken('ya29.first_token', 3600);
    });
    act(() => {
      useAuthStore.getState().setToken('ya29.second_token', 3600);
    });

    expect(useAuthStore.getState().accessToken).toBe('ya29.second_token');
  });
});

// ---------------------------------------------------------------------------
// setUserInfo
// ---------------------------------------------------------------------------

describe('authStore — setUserInfo', () => {
  it('stores the user display name', () => {
    act(() => {
      useAuthStore.getState().setUserInfo(MOCK_USER);
    });

    expect(useAuthStore.getState().userInfo?.name).toBe('DJ Rusty');
  });

  it('stores the user email', () => {
    act(() => {
      useAuthStore.getState().setUserInfo(MOCK_USER);
    });

    expect(useAuthStore.getState().userInfo?.email).toBe('dj.rusty@example.com');
  });

  it('stores the user picture URL', () => {
    act(() => {
      useAuthStore.getState().setUserInfo(MOCK_USER);
    });

    expect(useAuthStore.getState().userInfo?.picture).toBe(
      'https://lh3.googleusercontent.com/a/example',
    );
  });

  it('stores the user sub (unique ID)', () => {
    act(() => {
      useAuthStore.getState().setUserInfo(MOCK_USER);
    });

    expect(useAuthStore.getState().userInfo?.sub).toBe('google-uid-12345');
  });

  it('does not change signedIn state when called alone', () => {
    act(() => {
      useAuthStore.getState().setUserInfo(MOCK_USER);
    });

    // setUserInfo alone should not mark the user as signed in
    expect(useAuthStore.getState().signedIn).toBe(false);
  });

  it('can be called after setToken without losing token state', () => {
    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, MOCK_EXPIRES_IN);
      useAuthStore.getState().setUserInfo(MOCK_USER);
    });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe(MOCK_TOKEN);
    expect(state.signedIn).toBe(true);
    expect(state.userInfo?.name).toBe('DJ Rusty');
  });
});

// ---------------------------------------------------------------------------
// setChannelName
// ---------------------------------------------------------------------------

describe('authStore — setChannelName', () => {
  it('stores the channel name', () => {
    act(() => {
      useAuthStore.getState().setChannelName('DJ Rusty Official');
    });

    expect(useAuthStore.getState().channelName).toBe('DJ Rusty Official');
  });

  it('accepts null to clear the channel name', () => {
    act(() => {
      useAuthStore.getState().setChannelName('DJ Rusty Official');
    });
    act(() => {
      useAuthStore.getState().setChannelName(null);
    });

    expect(useAuthStore.getState().channelName).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// clearAuth
// ---------------------------------------------------------------------------

describe('authStore — clearAuth', () => {
  it('sets accessToken to null', () => {
    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, MOCK_EXPIRES_IN);
      useAuthStore.getState().clearAuth();
    });

    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('sets signedIn to false', () => {
    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, MOCK_EXPIRES_IN);
      useAuthStore.getState().clearAuth();
    });

    expect(useAuthStore.getState().signedIn).toBe(false);
  });

  it('sets expiresAt to null', () => {
    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, MOCK_EXPIRES_IN);
      useAuthStore.getState().clearAuth();
    });

    expect(useAuthStore.getState().expiresAt).toBeNull();
  });

  it('sets userInfo to null', () => {
    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, MOCK_EXPIRES_IN);
      useAuthStore.getState().setUserInfo(MOCK_USER);
      useAuthStore.getState().clearAuth();
    });

    expect(useAuthStore.getState().userInfo).toBeNull();
  });

  it('sets channelName to null', () => {
    act(() => {
      useAuthStore.getState().setChannelName('My Channel');
      useAuthStore.getState().clearAuth();
    });

    expect(useAuthStore.getState().channelName).toBeNull();
  });

  it('the token cannot be recovered after clearAuth', () => {
    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, MOCK_EXPIRES_IN);
      useAuthStore.getState().clearAuth();
    });

    // Token must be permanently gone from the store
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('is safe to call when already signed out', () => {
    // Should not throw; idempotent clear
    expect(() => {
      act(() => {
        useAuthStore.getState().clearAuth();
      });
    }).not.toThrow();

    expect(useAuthStore.getState().signedIn).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// State transition: full sign-in → sign-out cycle
// ---------------------------------------------------------------------------

describe('authStore — sign-in / sign-out state transition', () => {
  it('transitions from signed-out to signed-in after setToken', () => {
    expect(useAuthStore.getState().signedIn).toBe(false);

    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, MOCK_EXPIRES_IN);
    });

    expect(useAuthStore.getState().signedIn).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe(MOCK_TOKEN);
  });

  it('returns to signed-out state after clearAuth', () => {
    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, MOCK_EXPIRES_IN);
      useAuthStore.getState().setUserInfo(MOCK_USER);
      useAuthStore.getState().setChannelName('My Channel');
    });

    expect(useAuthStore.getState().signedIn).toBe(true);

    act(() => {
      useAuthStore.getState().clearAuth();
    });

    const finalState = useAuthStore.getState();
    expect(finalState.signedIn).toBe(false);
    expect(finalState.accessToken).toBeNull();
    expect(finalState.expiresAt).toBeNull();
    expect(finalState.userInfo).toBeNull();
    expect(finalState.channelName).toBeNull();
  });

  it('can complete a second sign-in cycle after sign-out', () => {
    // First cycle
    act(() => {
      useAuthStore.getState().setToken('ya29.first', 3600);
      useAuthStore.getState().setUserInfo(MOCK_USER);
      useAuthStore.getState().clearAuth();
    });

    // Second cycle
    act(() => {
      useAuthStore.getState().setToken('ya29.second', 3600);
      useAuthStore.getState().setUserInfo({ ...MOCK_USER, name: 'DJ Rusty 2' });
    });

    const state = useAuthStore.getState();
    expect(state.signedIn).toBe(true);
    expect(state.accessToken).toBe('ya29.second');
    expect(state.userInfo?.name).toBe('DJ Rusty 2');
  });
});

// ---------------------------------------------------------------------------
// persistSession
// ---------------------------------------------------------------------------

describe('authStore — persistSession', () => {
  it('writes djrusty_user_info, djrusty_expires_at, and djrusty_session_expires_at to localStorage', () => {
    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, MOCK_EXPIRES_IN);
      useAuthStore.getState().setUserInfo(MOCK_USER);
      useAuthStore.getState().persistSession();
    });

    expect(localStorage.getItem('djrusty_user_info')).toBe(JSON.stringify(MOCK_USER));
    expect(localStorage.getItem('djrusty_expires_at')).not.toBeNull();
    expect(localStorage.getItem('djrusty_session_expires_at')).not.toBeNull();
  });

  it('sets sessionExpiresAt in the store to approximately 7 days from now', () => {
    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, MOCK_EXPIRES_IN);
      useAuthStore.getState().setUserInfo(MOCK_USER);
      useAuthStore.getState().persistSession();
    });

    const { sessionExpiresAt } = useAuthStore.getState();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const tolerance = 2000; // 2 second tolerance for test execution time
    expect(sessionExpiresAt).not.toBeNull();
    expect(sessionExpiresAt!).toBeGreaterThan(Date.now() + sevenDaysMs - tolerance);
    expect(sessionExpiresAt!).toBeLessThanOrEqual(Date.now() + sevenDaysMs + tolerance);
  });

  it('writes djrusty_expires_at as a numeric string close to Date.now() + expiresIn*1000', () => {
    const before = Date.now();
    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, MOCK_EXPIRES_IN);
      useAuthStore.getState().setUserInfo(MOCK_USER);
      useAuthStore.getState().persistSession();
    });
    const after = Date.now();

    const storedExpiresAt = Number(localStorage.getItem('djrusty_expires_at'));
    expect(storedExpiresAt).toBeGreaterThanOrEqual(before + MOCK_EXPIRES_IN * 1000);
    expect(storedExpiresAt).toBeLessThanOrEqual(after + MOCK_EXPIRES_IN * 1000);
  });

  it('does nothing when userInfo is null', () => {
    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, MOCK_EXPIRES_IN);
      // do NOT call setUserInfo
      useAuthStore.getState().persistSession();
    });

    expect(localStorage.getItem('djrusty_user_info')).toBeNull();
    expect(localStorage.getItem('djrusty_expires_at')).toBeNull();
    expect(localStorage.getItem('djrusty_session_expires_at')).toBeNull();
  });

  it('does nothing when expiresAt is null', () => {
    act(() => {
      useAuthStore.getState().setUserInfo(MOCK_USER);
      // do NOT call setToken
      useAuthStore.getState().persistSession();
    });

    expect(localStorage.getItem('djrusty_user_info')).toBeNull();
    expect(localStorage.getItem('djrusty_expires_at')).toBeNull();
    expect(localStorage.getItem('djrusty_session_expires_at')).toBeNull();
  });

  it('does not write the access token to localStorage', () => {
    act(() => {
      useAuthStore.getState().setToken(MOCK_TOKEN, MOCK_EXPIRES_IN);
      useAuthStore.getState().setUserInfo(MOCK_USER);
      useAuthStore.getState().persistSession();
    });

    const allStored = Object.keys(localStorage)
      .map((k) => localStorage.getItem(k))
      .join('');
    expect(allStored).not.toContain(MOCK_TOKEN);
  });
});

// ---------------------------------------------------------------------------
// restoreSession
// ---------------------------------------------------------------------------

describe('authStore — restoreSession', () => {
  const FUTURE_EXPIRES_AT = String(Date.now() + 3600 * 1000);
  const FUTURE_SESSION_EXPIRES_AT = String(Date.now() + 7 * 24 * 60 * 60 * 1000);

  it('restores userInfo, expiresAt, and sessionExpiresAt from valid localStorage data', () => {
    localStorage.setItem('djrusty_user_info', JSON.stringify(MOCK_USER));
    localStorage.setItem('djrusty_expires_at', FUTURE_EXPIRES_AT);
    localStorage.setItem('djrusty_session_expires_at', FUTURE_SESSION_EXPIRES_AT);

    act(() => {
      useAuthStore.getState().restoreSession();
    });

    const state = useAuthStore.getState();
    expect(state.userInfo).toEqual(MOCK_USER);
    expect(state.expiresAt).toBe(Number(FUTURE_EXPIRES_AT));
    expect(state.sessionExpiresAt).toBe(Number(FUTURE_SESSION_EXPIRES_AT));
  });

  it('does NOT set signedIn to true when restoring a session', () => {
    localStorage.setItem('djrusty_user_info', JSON.stringify(MOCK_USER));
    localStorage.setItem('djrusty_expires_at', FUTURE_EXPIRES_AT);
    localStorage.setItem('djrusty_session_expires_at', FUTURE_SESSION_EXPIRES_AT);

    act(() => {
      useAuthStore.getState().restoreSession();
    });

    expect(useAuthStore.getState().signedIn).toBe(false);
  });

  it('clears all keys and leaves state unchanged when session is expired', () => {
    const pastSessionExpiresAt = String(Date.now() - 1000);
    localStorage.setItem('djrusty_user_info', JSON.stringify(MOCK_USER));
    localStorage.setItem('djrusty_expires_at', FUTURE_EXPIRES_AT);
    localStorage.setItem('djrusty_session_expires_at', pastSessionExpiresAt);

    act(() => {
      useAuthStore.getState().restoreSession();
    });

    expect(useAuthStore.getState().userInfo).toBeNull();
    expect(localStorage.getItem('djrusty_user_info')).toBeNull();
    expect(localStorage.getItem('djrusty_expires_at')).toBeNull();
    expect(localStorage.getItem('djrusty_session_expires_at')).toBeNull();
  });

  it('clears all keys and leaves state unchanged when userInfo JSON is corrupted', () => {
    localStorage.setItem('djrusty_user_info', 'not-valid-json');
    localStorage.setItem('djrusty_expires_at', FUTURE_EXPIRES_AT);
    localStorage.setItem('djrusty_session_expires_at', FUTURE_SESSION_EXPIRES_AT);

    act(() => {
      useAuthStore.getState().restoreSession();
    });

    expect(useAuthStore.getState().userInfo).toBeNull();
    expect(localStorage.getItem('djrusty_user_info')).toBeNull();
    expect(localStorage.getItem('djrusty_expires_at')).toBeNull();
    expect(localStorage.getItem('djrusty_session_expires_at')).toBeNull();
  });

  it('clears all keys and leaves state unchanged when expiresAt is not a number', () => {
    localStorage.setItem('djrusty_user_info', JSON.stringify(MOCK_USER));
    localStorage.setItem('djrusty_expires_at', 'not-a-number');
    localStorage.setItem('djrusty_session_expires_at', FUTURE_SESSION_EXPIRES_AT);

    act(() => {
      useAuthStore.getState().restoreSession();
    });

    expect(useAuthStore.getState().userInfo).toBeNull();
    expect(localStorage.getItem('djrusty_user_info')).toBeNull();
    expect(localStorage.getItem('djrusty_expires_at')).toBeNull();
    expect(localStorage.getItem('djrusty_session_expires_at')).toBeNull();
  });

  it('returns without setting state when no localStorage keys exist', () => {
    act(() => {
      useAuthStore.getState().restoreSession();
    });

    expect(useAuthStore.getState().userInfo).toBeNull();
    expect(useAuthStore.getState().signedIn).toBe(false);
  });

  it('clears all keys when userInfo shape is invalid (missing required fields)', () => {
    localStorage.setItem('djrusty_user_info', JSON.stringify({ sub: '123' }));
    localStorage.setItem('djrusty_expires_at', FUTURE_EXPIRES_AT);
    localStorage.setItem('djrusty_session_expires_at', FUTURE_SESSION_EXPIRES_AT);

    act(() => {
      useAuthStore.getState().restoreSession();
    });

    expect(useAuthStore.getState().userInfo).toBeNull();
    expect(localStorage.getItem('djrusty_user_info')).toBeNull();
    expect(localStorage.getItem('djrusty_expires_at')).toBeNull();
    expect(localStorage.getItem('djrusty_session_expires_at')).toBeNull();
  });

  it('does not throw when localStorage is unavailable (throws on getItem)', () => {
    const originalGetItem = localStorage.getItem.bind(localStorage);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });

    expect(() => {
      act(() => {
        useAuthStore.getState().restoreSession();
      });
    }).not.toThrow();

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(originalGetItem);
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// clearAuth — localStorage cleanup
// ---------------------------------------------------------------------------

describe('authStore — clearAuth clears localStorage', () => {
  it('removes all three djrusty_* keys from localStorage', () => {
    localStorage.setItem('djrusty_user_info', JSON.stringify(MOCK_USER));
    localStorage.setItem('djrusty_expires_at', String(Date.now() + 3600 * 1000));
    localStorage.setItem('djrusty_session_expires_at', String(Date.now() + 7 * 24 * 60 * 60 * 1000));

    act(() => {
      useAuthStore.getState().clearAuth();
    });

    expect(localStorage.getItem('djrusty_user_info')).toBeNull();
    expect(localStorage.getItem('djrusty_expires_at')).toBeNull();
    expect(localStorage.getItem('djrusty_session_expires_at')).toBeNull();
  });

  it('resets sessionExpiresAt to null in the store', () => {
    act(() => {
      useAuthStore.setState({ sessionExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
      useAuthStore.getState().clearAuth();
    });

    expect(useAuthStore.getState().sessionExpiresAt).toBeNull();
  });
});
