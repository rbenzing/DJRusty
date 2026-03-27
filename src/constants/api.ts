/**
 * YouTube Data API v3 base URL.
 */
export const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Google OAuth user info endpoint.
 */
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

/**
 * YouTube IFrame API script URL.
 * Loaded dynamically via youtubeIframeApi.ts singleton.
 */
export const YOUTUBE_IFRAME_API_URL = 'https://www.youtube.com/iframe_api';

/**
 * YouTube search results per page.
 * 50 is the maximum the YouTube Data API allows for search.list.
 */
export const YOUTUBE_SEARCH_MAX_RESULTS = 50;

/**
 * Genre queries to pre-load into the search cache on sign-in.
 *
 * These match the short genre names users typically type so the first search
 * is served from cache instead of waiting on a network round-trip.
 *
 * Each query costs 101 YouTube API quota units (100 search + 1 video details).
 * Total pre-load cost: 505 units (~5% of default 10,000 daily quota).
 */
export const PRELOAD_QUERIES = [
  'house',
  'techno',
  'drum and bass',
  'hip hop',
  'trance',
] as const;
