/**
 * User profile data fetched from Google's userinfo endpoint after sign-in.
 */
export interface GoogleUserInfo {
  /** Google account subject identifier (unique user ID). */
  sub: string;

  /** Display name. */
  name: string;

  /** Email address. */
  email: string;

  /** URL of the profile picture. */
  picture: string;
}

/**
 * State slice for Google authentication.
 * The OAuth access token is stored in memory only — never written to localStorage.
 * Non-sensitive user identity metadata (name, email, picture, sub) is persisted
 * to localStorage for session restoration across page refreshes.
 */
export interface AuthState {
  /** OAuth 2.0 access token, or null if not signed in. */
  accessToken: string | null;

  /**
   * Token expiry time as a Unix timestamp in milliseconds, or null if no token.
   * Derived from the `expires_in` value returned by GIS.
   */
  expiresAt: number | null;

  /** Authenticated user's profile information, or null if not signed in. */
  userInfo: GoogleUserInfo | null;

  /** True when the user is authenticated and has a valid (non-expired) token. */
  signedIn: boolean;

  /**
   * Session expiry time as a Unix timestamp in milliseconds, or null if no session.
   * Set to 7 days from last successful sign-in. Used to gate localStorage
   * identity restoration — distinct from the access token's expiresAt.
   */
  sessionExpiresAt: number | null;

  /**
   * YouTube channel display name fetched after sign-in, or null if unavailable.
   * Stored here to avoid re-fetching on every render.
   */
  channelName: string | null;
}
