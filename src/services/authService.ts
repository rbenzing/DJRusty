/**
 * authService.ts — Google Identity Services (GIS) OAuth 2.0 token flow wrapper.
 *
 * Manages the GIS TokenClient lifecycle. The token client is initialized once
 * and stored as a module-level singleton. Tokens are returned via callback —
 * never stored in this service; storage is the caller's responsibility.
 *
 * Security note: this module never touches localStorage or sessionStorage.
 * All token data flows through the callback and is stored in-memory (authStore).
 */

/** Callback signature invoked on successful token acquisition. */
type TokenCallback = (accessToken: string, expiresIn: number) => void;

/**
 * Error handler callback for auth errors.
 * Receives the error code string from GIS.
 */
type ErrorCallback = (errorCode: string) => void;

/** Module-level singleton for the GIS token client. */
let tokenClient: google.accounts.oauth2.TokenClient | null = null;

/** Stored error handler set at initAuth time. */
let onAuthError: ErrorCallback | null = null;

/**
 * Initialise the GIS token client.
 *
 * Must be called after the GIS script is loaded (i.e. window.google is defined).
 * Safe to call multiple times — subsequent calls reinitialise the client, which
 * is needed if the callback reference changes.
 *
 * @param onToken - Called with (accessToken, expiresIn) when auth succeeds.
 * @param onError - Called with an error code string when auth fails.
 */
export function initAuth(onToken: TokenCallback, onError: ErrorCallback): void {
  const clientId = (import.meta as unknown as { env: Record<string, string | undefined> })
    .env.VITE_GOOGLE_CLIENT_ID;

  if (!clientId) {
    console.warn('[authService] VITE_GOOGLE_CLIENT_ID is not set — auth will not function.');
    return;
  }

  if (!window.google?.accounts?.oauth2) {
    console.warn('[authService] GIS not yet loaded — initAuth called too early.');
    return;
  }

  onAuthError = onError;

  tokenClient = window.google!.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/youtube.readonly openid email profile',
    callback: (response) => {
      if (response.error) {
        handleGisError(response.error);
        return;
      }
      onToken(response.access_token, Number(response.expires_in));
    },
  });
}

/**
 * Request an access token from GIS.
 *
 * @param silent - When true, suppress the consent screen for token refresh.
 *   Uses `prompt: ''` which silently refreshes if the user has an active Google
 *   session. When false (default), shows the consent screen on first use.
 */
export function requestToken(silent = false): void {
  if (!tokenClient) {
    console.warn('[authService] requestToken called before initAuth.');
    return;
  }
  tokenClient.requestAccessToken({ prompt: silent ? '' : 'consent' });
}

/**
 * Revoke the given access token at Google's authorization server and invoke
 * the provided callback when done.
 *
 * @param accessToken - The current access token to revoke.
 * @param onRevoked - Called after revocation completes (whether or not it succeeded).
 */
export function signOut(accessToken: string, onRevoked: () => void): void {
  if (!window.google?.accounts?.oauth2) {
    // GIS not available — just invoke callback so the caller clears state
    onRevoked();
    return;
  }
  window.google!.accounts.oauth2.revoke(accessToken, () => {
    onRevoked();
  });
}

/**
 * Returns true if the GIS script has fully loaded and the API is available.
 */
export function isGisReady(): boolean {
  return Boolean(window.google?.accounts?.oauth2);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function handleGisError(errorCode: string): void {
  // 'popup_closed_by_user' is intentional dismissal — no error toast per login-flow spec
  if (errorCode === 'popup_closed_by_user') {
    return;
  }
  if (onAuthError) {
    onAuthError(errorCode);
  } else {
    console.error('[authService] Auth error:', errorCode);
  }
}
