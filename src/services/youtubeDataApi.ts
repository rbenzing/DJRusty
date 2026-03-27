/**
 * youtubeDataApi.ts — YouTube Data API v3 fetch wrapper.
 *
 * Implements the two-step search flow:
 *   Step 1: search.list  — returns video IDs + snippet (100 quota units per call)
 *   Step 2: videos.list  — fetches contentDetails for duration (1 quota unit per call)
 *
 * Error codes handled:
 *   quotaExceeded — daily quota limit hit
 *   forbidden     — OAuth scope insufficient or video restricted
 *   keyInvalid    — API key is missing or invalid
 */

import { parseDuration } from '../utils/formatTime';
import type { TrackSummary } from '../types/search';

const BASE = 'https://www.googleapis.com/youtube/v3';

/** Maps YouTube API error reason codes to user-friendly messages. */
const ERROR_MESSAGES: Record<string, string> = {
  quotaExceeded: 'YouTube API quota exceeded. Try again tomorrow.',
  forbidden: 'Access forbidden. Please sign in and try again.',
  keyInvalid: 'API key invalid. Please check your configuration.',
};

/**
 * Builds URL search params from an object, omitting undefined values.
 */
function buildParams(params: Record<string, string | undefined>): URLSearchParams {
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      urlParams.set(key, value);
    }
  }
  return urlParams;
}

/**
 * Performs a fetch to a YouTube Data API endpoint.
 *
 * Auth strategy:
 *   - If `token` is a non-empty string: uses Bearer Authorization header (OAuth).
 *   - Otherwise: appends VITE_YOUTUBE_API_KEY as `key` query param.
 *
 * @throws Error with a human-readable message on API errors.
 */
async function apiFetch(
  endpoint: string,
  token: string | null,
  params: Record<string, string | undefined>,
): Promise<unknown> {
  const queryParams = buildParams(params);

  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    const apiKey = (import.meta as unknown as { env: Record<string, string | undefined> })
      .env.VITE_YOUTUBE_API_KEY;
    if (apiKey) {
      queryParams.set('key', apiKey);
    }
  }

  const url = `${endpoint}?${queryParams.toString()}`;
  const response = await fetch(url, { headers });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const reason: string =
      (body as { error?: { errors?: Array<{ reason?: string }> } } | null)
        ?.error?.errors?.[0]?.reason ?? '';

    const message =
      ERROR_MESSAGES[reason] ??
      `YouTube API error: ${response.status} ${response.statusText}`;

    throw new Error(message);
  }

  return response.json();
}

/**
 * Raw YouTube search.list response item shape (only fields we use).
 */
interface SearchItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      medium?: { url: string };
      default?: { url: string };
    };
  };
}

/**
 * Raw YouTube videos.list response item shape (only fields we use).
 */
interface VideoDetailItem {
  id: string;
  contentDetails: { duration: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      medium?: { url: string };
      default?: { url: string };
    };
  };
}

interface SearchListResponse {
  nextPageToken?: string;
  items: SearchItem[];
}

interface VideoListResponse {
  items: VideoDetailItem[];
}

/**
 * Merges search.list results with videos.list duration details.
 *
 * Uses the videos.list snippet as the authoritative source for title/channel/
 * thumbnail so that both steps are consistent. Falls back to search.list snippet
 * if a video ID is somehow missing from the detail response.
 */
function mergeSearchResults(
  searchRes: SearchListResponse,
  detailsRes: VideoListResponse,
): { results: TrackSummary[]; nextPageToken: string | null } {
  const detailMap = new Map<string, VideoDetailItem>();
  for (const item of detailsRes.items) {
    detailMap.set(item.id, item);
  }

  const results: TrackSummary[] = [];

  for (const searchItem of searchRes.items) {
    const videoId = searchItem.id.videoId;
    const detail = detailMap.get(videoId);

    const snippet = detail?.snippet ?? searchItem.snippet;
    const durationIso = detail?.contentDetails?.duration ?? 'PT0S';
    const thumbnailUrl =
      snippet.thumbnails.medium?.url ??
      snippet.thumbnails.default?.url ??
      null;

    results.push({
      sourceType: 'youtube',
      videoId,
      title: snippet.title,
      artist: snippet.channelTitle,
      duration: parseDuration(durationIso),
      thumbnailUrl,
    });
  }

  return {
    results,
    nextPageToken: searchRes.nextPageToken ?? null,
  };
}

/**
 * Searches YouTube for videos matching `query`.
 *
 * Two-step flow:
 *   1. `search.list` with `type=video` — retrieves up to 50 video IDs + snippets.
 *      YouTube searches titles, descriptions, and tags by default.
 *      No category or duration filters are applied so that DJ mixes/sets of
 *      any length (short edits through multi-hour recordings) are included.
 *   2. `videos.list` to batch-fetch `contentDetails` (duration) for all IDs.
 *
 * Why no videoCategoryId filter:
 *   DJ sets are commonly filed under Entertainment (24) or People & Blogs (22),
 *   not Music (10), depending on the uploader. Filtering by category 10 silently
 *   drops the majority of relevant content.
 *
 * Why no videoDuration filter:
 *   YouTube's 'medium' duration band covers 4–20 minutes. Most DJ sets, live
 *   recordings, and podcast-style mixes are 30 min–2 hr+ ('long' band). The
 *   filter was excluding virtually all DJ mix content.
 *
 * @param query      - Search term entered by the user.
 * @param token      - OAuth access token, or null to fall back to API key.
 * @param pageToken  - Optional next-page token from a previous search call.
 * @returns Merged list of video summaries and optional next-page token.
 * @throws Error with a user-readable message on API failure.
 */
export async function searchVideos(
  query: string,
  token: string | null,
  pageToken?: string,
): Promise<{ results: TrackSummary[]; nextPageToken: string | null }> {
  // Step 1: search.list — retrieve video IDs and basic snippet data.
  // Scoped to the configured channel when VITE_YOUTUBE_CHANNEL_ID is set.
  const channelId = (import.meta as unknown as { env: Record<string, string | undefined> })
    .env.VITE_YOUTUBE_CHANNEL_ID;

  const searchRes = (await apiFetch(`${BASE}/search`, token, {
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: '50',
    videoEmbeddable: 'true',
    order: 'relevance',
    channelId: channelId ?? undefined,
    pageToken,
  })) as SearchListResponse;

  if (!searchRes.items || searchRes.items.length === 0) {
    return { results: [], nextPageToken: null };
  }

  const videoIds = searchRes.items.map((i) => i.id.videoId).join(',');

  // Step 2: videos.list — batch-fetch contentDetails (duration) for all IDs.
  const detailsRes = (await apiFetch(`${BASE}/videos`, token, {
    part: 'contentDetails,snippet',
    id: videoIds,
  })) as VideoListResponse;

  return mergeSearchResults(searchRes, detailsRes);
}
