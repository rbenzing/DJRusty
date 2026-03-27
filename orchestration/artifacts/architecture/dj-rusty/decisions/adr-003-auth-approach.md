# ADR-003: Authentication Approach

**Date**: 2026-03-21
**Status**: Accepted
**Deciders**: Architecture Agent

---

## Context

DJRusty requires access to the YouTube Data API v3 to search for tracks and retrieve video metadata. The app has no backend server. This constrains authentication options significantly.

### Requirements
- Users can search YouTube and retrieve track metadata
- Per-user OAuth tokens preferred to distribute API quota
- Works entirely client-side (no server round-trips for token exchange)
- OAuth tokens stored securely — not in localStorage (XSS risk)

---

## Decision

Use **Google Identity Services (GIS) JavaScript SDK** with the **OAuth 2.0 Token (Implicit) Flow**.

### Flow Summary

1. Load GIS SDK (`accounts.google.com/gsi/client`).
2. On user action, call `google.accounts.oauth2.initTokenClient()` with required scopes.
3. GIS opens popup to Google's OAuth endpoint.
4. Google returns access token directly to browser callback — no server exchange.
5. Token stored in-memory in Zustand `authStore` — **not** in `localStorage` or `sessionStorage`.
6. All YouTube Data API calls include `Authorization: Bearer <token>`.
7. On token expiry (3600s), 401 response detected → user prompted to re-authenticate.

### Scopes

```
https://www.googleapis.com/auth/youtube.readonly
```

Minimum required scope — read-only YouTube access.

### API Key

`VITE_YOUTUBE_API_KEY` environment variable included as fallback for unauthenticated public content search. Acknowledged as public-facing; mitigated by HTTP referrer restriction in Google Cloud Console.

---

## Rationale

### Why Token Flow (Implicit) rather than Authorization Code Flow?
Authorization Code Flow requires a backend to receive the code and exchange it for tokens using the client secret. DJRusty has no backend. Token Flow is the standard approach for SPAs with no backend.

### Why GIS rather than raw OAuth 2.0?
GIS is Google's current recommended library for OAuth in JavaScript SPAs. It replaces the deprecated `gapi.auth2`. It handles the popup flow cleanly and is actively maintained by Google.

### Why not store token in localStorage?
Tokens in `localStorage` are accessible to any JavaScript on the origin, including XSS-injected scripts. In-memory storage (Zustand module-level variable) means the token is never persisted to disk and is lost on page refresh. This is the deliberate security trade-off — users re-authenticate each session.

### API Key Exposure
Accepted risk for a no-backend SPA. Mitigated by:
- HTTP referrer restriction on key in Google Cloud Console
- Key only grants `youtube.readonly` — no write operations
- Quota limits serve as rate-limiting

---

## Consequences

- Users must sign in with Google to use the full application.
- Token lost on page refresh — re-authentication required each session.
- GIS SDK loaded asynchronously; auth UI handles "SDK not yet loaded" state.
- OAuth client ID must have correct Authorized JavaScript Origins in Google Cloud Console.
- API key must have HTTP referrer restrictions before public deployment.

---

## Alternatives Not Chosen

| Option | Reason Rejected |
|---|---|
| OAuth Authorization Code Flow | Requires backend server; out of scope |
| API key only (no OAuth) | Single shared quota; no per-user attribution |
| Firebase Authentication | Unnecessary dependency for simple Google sign-in |
| Token in localStorage | XSS token exfiltration risk |
| Token in sessionStorage | Still accessible to JS; unnecessary risk |
