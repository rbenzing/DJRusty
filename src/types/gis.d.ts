/**
 * gis.d.ts — TypeScript type declarations for the Google Identity Services (GIS) SDK.
 *
 * The GIS SDK is loaded via a <script> tag and exposes a global `google` object.
 * These types cover the OAuth 2.0 Token Client used in this project.
 *
 * Reference: https://developers.google.com/identity/oauth2/web/reference/js-reference
 */

/** Configuration for initialising the OAuth 2.0 implicit token client. */
interface GisTokenClientConfig {
  /** The application's OAuth 2.0 client ID. */
  client_id: string;
  /** Space-delimited list of OAuth 2.0 scopes to request. */
  scope: string;
  /** Callback invoked with the token response (success or error). */
  callback: (response: GisTokenResponse) => void;
  /** Optional secondary error callback. */
  error_callback?: (error: { type: string }) => void;
}

/** Response object passed to the token callback. */
interface GisTokenResponse {
  /** The access token string. Present on success. */
  access_token: string;
  /** Token lifetime in seconds. May be a number or numeric string. */
  expires_in: number | string;
  /** Space-delimited list of scopes that were granted. */
  scope: string;
  /** Token type, typically "Bearer". */
  token_type: string;
  /** Error code if the request failed; absent on success. */
  error?: string;
  /** Human-readable description of the error. */
  error_description?: string;
  /** URI pointing to more information about the error. */
  error_uri?: string;
}

/** The GIS OAuth 2.0 token client instance. */
interface GisTokenClient {
  /**
   * Triggers a token request.
   *
   * @param options.prompt - Controls consent screen display:
   *   - `''` — silent refresh (no UI if session active)
   *   - `'consent'` — always show consent screen
   *   - `'select_account'` — show account picker
   */
  requestAccessToken(options?: { prompt?: '' | 'consent' | 'select_account' }): void;
}

/** The `google.accounts.oauth2` API surface. */
interface GisOAuth2Api {
  /**
   * Initialise an OAuth 2.0 implicit token client.
   * Must be called after the GIS script has loaded.
   */
  initTokenClient(config: GisTokenClientConfig): GisTokenClient;

  /**
   * Revoke an access token at Google's authorization server.
   * @param token - The access token to revoke.
   * @param callback - Called after revocation regardless of outcome.
   */
  revoke(token: string, callback: () => void): void;
}

declare namespace google.accounts.oauth2 {
  type TokenClientConfig = GisTokenClientConfig;
  type TokenResponse = GisTokenResponse;
  type TokenClient = GisTokenClient;
  function initTokenClient(config: GisTokenClientConfig): GisTokenClient;
  function revoke(token: string, callback: () => void): void;
}

declare interface Window {
  google?: {
    accounts: {
      oauth2: GisOAuth2Api;
    };
  };
}
