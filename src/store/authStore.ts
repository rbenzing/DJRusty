import { create } from 'zustand';
import type { AuthState, GoogleUserInfo } from '../types/auth';
import { clearSearchCache } from '../utils/searchCache';

const STORAGE_KEY_USER_INFO = 'djrusty_user_info';
const STORAGE_KEY_EXPIRES_AT = 'djrusty_expires_at';
const STORAGE_KEY_SESSION_EXPIRES_AT = 'djrusty_session_expires_at';
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface AuthStoreActions {
  /**
   * Store a newly received access token and mark the user as signed in.
   * @param accessToken - The OAuth 2.0 access token string.
   * @param expiresIn - Token lifetime in seconds (typically 3600).
   */
  setToken: (accessToken: string, expiresIn: number) => void;

  /** Store the authenticated user's profile information. */
  setUserInfo: (userInfo: GoogleUserInfo) => void;

  /**
   * Clear all auth state — called on sign-out.
   * Also removes all djrusty_* keys from localStorage.
   */
  clearAuth: () => void;

  /**
   * Store the user's YouTube channel display name.
   * @param name - The channel title, or null if unavailable.
   */
  setChannelName: (name: string | null) => void;

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
}

type AuthStore = AuthState & AuthStoreActions;

const INITIAL_STATE: AuthState = {
  accessToken: null,
  expiresAt: null,
  userInfo: null,
  signedIn: false,
  sessionExpiresAt: null,
  channelName: null,
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  ...INITIAL_STATE,

  setToken: (accessToken, expiresIn) => {
    const expiresAt = Date.now() + expiresIn * 1000;
    set({ accessToken, expiresAt, signedIn: true });
  },

  setUserInfo: (userInfo) => {
    set({ userInfo });
  },

  clearAuth: () => {
    set({ ...INITIAL_STATE });
    // STORY-SEARCH-001: Clear search cache on sign-out
    clearSearchCache();
    try {
      localStorage.removeItem(STORAGE_KEY_USER_INFO);
      localStorage.removeItem(STORAGE_KEY_EXPIRES_AT);
      localStorage.removeItem(STORAGE_KEY_SESSION_EXPIRES_AT);
    } catch {
      // localStorage unavailable — in-memory clear is sufficient
    }
  },

  setChannelName: (name) => {
    set({ channelName: name });
  },

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
      const userInfo = JSON.parse(userInfoRaw) as GoogleUserInfo;

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

  setSessionExpiry: (sessionExpiresAt) => {
    set({ sessionExpiresAt });
  },
}));
