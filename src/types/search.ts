/**
 * Lightweight summary of a track returned from search.
 * Optimized for search results display and can be converted to a PlaylistEntry.
 */
export interface TrackSummary {
  /** Track title. */
  title: string;

  /**
   * Artist / channel name.
   */
  artist: string;

  /** Duration in seconds. */
  duration: number;

  /** URL of the thumbnail, or null if unavailable. */
  thumbnailUrl: string | null;

  /**
   * The original File object selected by the user.
   */
  file?: File;

  /**
   * Pre-signed URL for audio file access.
   */
  audioUrl?: string;
}

/**
 * State slice for the search panel.
 */
export interface SearchState {
  /** Current search query string. */
  query: string;

  /** Search results from the last successful query. */
  results: TrackSummary[];

  /** True while a search request is in-flight. */
  loading: boolean;

  /** Error message from the last failed search, or null if no error. */
  error: string | null;
}
