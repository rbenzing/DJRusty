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
import { useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { initAuth, requestToken, signOut as gisSignOut, isGisReady } from '../services/authService';
import type { GoogleUserInfo } from '../types/auth';

const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const GIS_POLL_INTERVAL_MS = 100;
const GIS_POLL_MAX_ATTEMPTS = 50; // 5 seconds total
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const REFRESH_CHECK_INTERVAL_MS = 60 * 1000;     // check every 60 seconds

/**
 * Map GIS error codes to user-friendly messages.
 * Returns null for errors that should be silently ignored.
 */
function mapAuthErrorMessage(errorCode: string): string | null {
  switch (errorCode) {
    case 'access_denied':
      return 'YouTube access required for track browsing. Grant permission to continue.';
    case 'popup_blocked':
      return 'Pop-up was blocked. Please allow pop-ups for this site and try again.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}

/**
 * Fetch user profile from Google's OpenID Connect userinfo endpoint.
 *
 * @param accessToken - Valid OAuth access token.
 * @returns Resolved GoogleUserInfo or null on failure.
 */
async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo | null> {
  try {
    const response = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      console.warn('[useAuth] userinfo fetch failed:', response.status);
      return null;
    }

    const data = (await response.json()) as GoogleUserInfo;
    return data;
  } catch (error) {
    console.warn('[useAuth] userinfo fetch error:', error);
    return null;
  }
}

/**
 * Returns auth state and sign-in/sign-out actions.
 *
 * Mount this hook once at the app root (App.tsx) to initialise GIS and
 * set up silent token refresh. Downstream components can also call this
 * hook to read auth state — the hook will not re-initialise GIS.
 */
export function useAuth() {
  const {
    signedIn, userInfo, accessToken, expiresAt,
    setToken, setUserInfo, clearAuth,
    restoreSession,
  } = useAuthStore();
  const isInitialised = useRef(false);
  const isSilentRefresh = useRef(false);

  /** Called by GIS when auth succeeds — stores token, fetches profile, and persists session. */
  const handleTokenReceived = useCallback(
    async (token: string, expiresIn: number) => {
      setToken(token, expiresIn);

      const profile = await fetchUserInfo(token);
      if (profile) {
        setUserInfo(profile);
        isSilentRefresh.current = false;
        // Call persistSession via getState() to read the latest committed state
        useAuthStore.getState().persistSession();
      } else {
        isSilentRefresh.current = false;
      }
    },
    [setToken, setUserInfo],
  );

  /** Called by GIS when auth fails — suppresses errors during silent refresh. */
  const handleAuthError = useCallback((errorCode: string) => {
    // During silent refresh, suppress all error messages — just leave user at sign-in button
    if (isSilentRefresh.current) {
      console.debug('[useAuth] Silent refresh failed (expected if no active Google session):', errorCode);
      isSilentRefresh.current = false;
      return;
    }

    const message = mapAuthErrorMessage(errorCode);
    if (message) {
      // Toast system is implemented in STORY-014; for now log a console warning
      console.warn('[useAuth] Auth error:', errorCode, '-', message);
    }
  }, []);

  /** Initialise GIS once after mount, polling until window.google is available. */
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

    // Clean up the polling interval on unmount (e.g. in React StrictMode double-invoke)
    return () => {
      clearInterval(poll);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks are stable; deps intentionally omitted to prevent re-init
  }, []);

  /** Proactive token refresh: check every 60 seconds, refresh 5 minutes before expiry. */
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

  /**
   * Trigger explicit sign-in (shows Google consent screen).
   * Reinitialises the token client so the latest callbacks are registered.
   */
  const signIn = useCallback(() => {
    if (!isGisReady()) {
      console.warn('[useAuth] GIS not ready — cannot sign in yet.');
      return;
    }
    isSilentRefresh.current = false;
    // Re-initialise to ensure callbacks are current before requesting
    initAuth(handleTokenReceived, handleAuthError);
    requestToken(false);
  }, [handleTokenReceived, handleAuthError]);

  /**
   * Sign the user out: revoke token at Google, then clear all auth state.
   */
  const signOut = useCallback(() => {
    const currentToken = useAuthStore.getState().accessToken;

    if (currentToken) {
      gisSignOut(currentToken, () => {
        clearAuth();
      });
    } else {
      clearAuth();
    }
  }, [clearAuth]);

  return {
    signedIn,
    userInfo,
    accessToken,
    signIn,
    signOut,
  };
}
