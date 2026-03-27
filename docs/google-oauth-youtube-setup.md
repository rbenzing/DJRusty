# Google OAuth & YouTube API Setup Guide

This guide walks through configuring Google OAuth 2.0 and the YouTube Data API v3 for DJRusty.

---

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

---

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top of the page
3. Click **New Project**
4. Enter a project name (e.g., `DJRusty`)
5. Click **Create**
6. Make sure the new project is selected in the project dropdown

---

## Step 2: Enable the YouTube Data API v3

1. In the Google Cloud Console, go to **APIs & Services > Library**
   - Or navigate directly: [API Library](https://console.cloud.google.com/apis/library)
2. Search for **YouTube Data API v3**
3. Click on it, then click **Enable**

---

## Step 3: Configure the OAuth Consent Screen

Before creating credentials, you must configure the consent screen that users see when signing in.

1. Go to **APIs & Services > OAuth consent screen**
2. Select **External** as the user type (unless you have a Google Workspace org), then click **Create**
3. Fill in the required fields:
   - **App name**: `DJRusty` (or your preferred name)
   - **User support email**: your email address
   - **Developer contact information**: your email address
4. Click **Save and Continue**

### Add Scopes

1. Click **Add or Remove Scopes**
2. Search for and select these scopes:
   - `https://www.googleapis.com/auth/youtube.readonly` — View your YouTube account (read-only)
   - `https://www.googleapis.com/auth/userinfo.email` — View your email address
   - `https://www.googleapis.com/auth/userinfo.profile` — View your basic profile info
3. Click **Update**, then **Save and Continue**

### Add Test Users (Required While in "Testing" Status)

While the app is in "Testing" mode (before Google verification), only test users can sign in.

1. Click **Add Users**
2. Enter the Google email addresses of anyone who needs to test the app
3. Click **Save and Continue**

> **Note:** You can add up to 100 test users. To allow any Google account to sign in, you would need to submit the app for verification (see [Publishing Your App](#publishing-your-app-optional) below).

---

## Step 4: Create an OAuth 2.0 Client ID

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Select **Web application** as the application type
4. Enter a name (e.g., `DJRusty Web Client`)

### Configure Authorized JavaScript Origins

Add every origin where the app will run:

| Environment | Origin |
|-------------|--------|
| Local dev   | `http://localhost:5173` |
| Local dev (alt) | `http://localhost:3000` |
| Production  | `https://yourdomain.com` |

### Configure Authorized Redirect URIs

For the Google Identity Services (GIS) token flow used by DJRusty, redirect URIs are not strictly required. However, if prompted, add the same origins listed above.

5. Click **Create**
6. A dialog shows your **Client ID** and **Client Secret**
   - Copy the **Client ID** (you'll need it in Step 5)
   - The Client Secret is **not needed** — DJRusty uses the implicit/token flow (no backend)

---

## Step 5: Create a YouTube Data API Key

The API key is a fallback for unauthenticated YouTube searches (when the user hasn't signed in).

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > API key**
3. Copy the generated key

### Restrict the API Key (Recommended)

1. Click on the newly created API key to edit it
2. Under **Application restrictions**, select **HTTP referrers (websites)**
3. Add your allowed referrers:
   - `http://localhost:5173/*`
   - `http://localhost:3000/*`
   - `https://yourdomain.com/*`
4. Under **API restrictions**, select **Restrict key**
5. Choose **YouTube Data API v3** from the dropdown
6. Click **Save**

---

## Step 6: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in the values:
   ```env
   # Google OAuth 2.0 Client ID (from Step 4)
   VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com

   # YouTube Data API v3 Key (from Step 5)
   VITE_YOUTUBE_API_KEY=your-api-key-here
   ```

3. Start or restart the dev server:
   ```bash
   npm run dev
   ```

> **Important:** The `.env` file is git-ignored and must never be committed. It contains your credentials.

---

## How Authentication Works in DJRusty

### Overview

DJRusty uses **Google Identity Services (GIS)** with the **OAuth 2.0 Token Flow** (implicit grant). This is a client-side-only flow — no backend server is involved.

### Flow Diagram

```
User clicks "Sign in with Google"
        │
        ▼
GIS SDK opens Google OAuth popup
        │
        ▼
User grants consent (youtube.readonly scope)
        │
        ▼
Google returns access_token (valid ~1 hour)
        │
        ▼
App fetches user profile from Google userinfo endpoint
        │
        ▼
Token stored in memory (Zustand store, NOT localStorage)
        │
        ▼
YouTube API calls use Bearer token in Authorization header
        │
        ▼
On sign-out: token revoked at Google, memory cleared
```

### Key Design Decisions

- **In-memory token storage only** — the access token is never written to `localStorage` or `sessionStorage`. This prevents XSS attacks from stealing tokens, but means users must re-authenticate after refreshing the page.
- **Silent refresh on load** — the app attempts a silent token refresh on startup. If the user has an active Google session, they may be signed in automatically without seeing a popup.
- **API key fallback** — YouTube searches work without sign-in using the API key, but with lower quota and no personalization.

### OAuth Scope

The app requests a single scope:

```
https://www.googleapis.com/auth/youtube.readonly
```

This grants read-only access to YouTube data (search, video metadata). It does **not** allow uploading, modifying, or deleting any content.

---

## YouTube API Integration

### APIs Used

| API | Purpose | Quota Cost |
|-----|---------|------------|
| `search.list` | Find videos by search query | 100 units/call |
| `videos.list` | Get video duration & metadata | 1 unit/call |
| YouTube IFrame Player API | Embed and control video playback | Free (no quota) |

### Quota

The YouTube Data API has a daily quota of **10,000 units** per project by default. Each search costs ~101 units (100 for search + 1 for video details). This allows approximately **99 searches per day**.

To increase your quota:
1. Go to **APIs & Services > YouTube Data API v3 > Quotas**
2. Click **Edit Quotas** or apply for a quota increase

### Two Authentication Modes

| Mode | Header | When Used |
|------|--------|-----------|
| OAuth | `Authorization: Bearer <token>` | User is signed in |
| API Key | `?key=<api-key>` query parameter | User is not signed in |

---

## Troubleshooting

### "Access blocked: This app's request is invalid" (Error 400)

- Your **Authorized JavaScript Origins** don't match the URL where the app is running
- Make sure `http://localhost:5173` (or whatever port Vite is using) is listed in the OAuth client settings

### "Access blocked: DJRusty has not completed the Google verification process"

- The app is in **Testing** mode and the current Google account is not in the test users list
- Add the account to **OAuth consent screen > Test users**

### "YouTube API quota exceeded"

- You've hit the daily 10,000-unit quota limit
- Wait until the quota resets (midnight Pacific Time) or request a quota increase

### "API key invalid"

- The `VITE_YOUTUBE_API_KEY` value in `.env` is wrong or the key has been deleted/regenerated
- Check [Credentials](https://console.cloud.google.com/apis/credentials) in Cloud Console

### Sign-in popup closes immediately / no token received

- Check the browser console for errors
- Ensure the GIS script is loading: look for `https://accounts.google.com/gsi/client` in the Network tab
- Verify `VITE_GOOGLE_CLIENT_ID` is set correctly in `.env`

### "popup_blocked" error

- The browser blocked the Google sign-in popup
- Allow popups for `localhost` (or your domain) in browser settings

### Token lost on page refresh

- This is expected behavior — tokens are stored in memory only for security
- The app will attempt a silent refresh on reload; if the user has an active Google session, sign-in may be automatic

---

## Publishing Your App (Optional)

While in "Testing" mode, only accounts listed as test users can sign in. To allow any Google account:

1. Go to **OAuth consent screen**
2. Click **Publish App**
3. If your app uses sensitive scopes (like `youtube.readonly`), Google may require a review
4. Follow Google's [OAuth verification requirements](https://support.google.com/cloud/answer/9110914)

For personal/development use, staying in "Testing" mode with your own account added as a test user is sufficient.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| [.env.example](.env.example) | Environment variable template |
| [src/services/authService.ts](src/services/authService.ts) | GIS OAuth token lifecycle (init, request, revoke) |
| [src/hooks/useAuth.ts](src/hooks/useAuth.ts) | Auth hook — initialization, sign-in/out, profile fetch |
| [src/store/authStore.ts](src/store/authStore.ts) | Auth state management (Zustand) |
| [src/services/youtubeDataApi.ts](src/services/youtubeDataApi.ts) | YouTube search & video metadata API |
| [src/services/youtubeIframeApi.ts](src/services/youtubeIframeApi.ts) | YouTube IFrame Player loader |
| [src/types/gis.d.ts](src/types/gis.d.ts) | TypeScript types for Google Identity Services |
| [src/constants/api.ts](src/constants/api.ts) | API endpoint constants |
| [index.html](index.html) | GIS `<script>` tag |
