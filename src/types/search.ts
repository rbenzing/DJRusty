import type { TrackSourceType } from './playlist';

/**
 * Lightweight summary of a track returned from search (supports both YouTube and MP3).
 * Optimized for search results display and can be converted to a PlaylistEntry.
 */
export interface TrackSummary {
  /** Discriminates between 'youtube' and 'mp3' source tracks. */
  sourceType: TrackSourceType;

  /** Track title. */
  title: string;

  /**
   * Artist / channel name.
   * Renamed from `channelTitle` for source-agnostic naming.
   */
  artist: string;

  /** Duration in seconds. */
  duration: number;

  /** URL of the thumbnail, or null if unavailable. */
  thumbnailUrl: string | null;

  // ── YouTube-only fields ────────────────────────────────────────────────

  /** YouTube video ID. Present only for sourceType 'youtube'. */
  videoId?: string;

  // ── MP3-only fields (populated by future stories) ─────────────────────

  /**
   * The original File object selected by the user.
   * Present only for sourceType 'mp3'.
   */
  file?: File;

  /**
   * Pre-signed URL for MP3 file access.
   * Present only for sourceType 'mp3'.
   */
  audioUrl?: string;
}

/**
 * State slice for the unified search panel (supports YouTube and MP3).
 */
export interface SearchState {
  /** Current search query string. */
  query: string;

  /** Search results from the last successful query. */
  results: TrackSummary[];

  /** YouTube API next page token for pagination, or null if no more pages. */
  nextPageToken: string | null;

  /** True while a search request is in-flight. */
  loading: boolean;

  /** Error message from the last failed search, or null if no error. */
  error: string | null;
}
