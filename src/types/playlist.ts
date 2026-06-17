/**
 * playlist.ts — Types for the per-deck playlist / track queue feature.
 */

/**
 * A single entry in a deck's playlist queue.
 * Stores full track metadata so the entry is self-contained for display.
 *
 * Note: `id` is a unique entry identifier — the same track may appear
 * more than once in a playlist, each time with a different `id`.
 */
export interface PlaylistEntry {
  /** Unique entry identifier. */
  id: string;

  /** Track title. */
  title: string;

  /**
   * Artist / channel name.
   */
  artist: string;

  /** Total duration in seconds. */
  duration: number;

  /** Thumbnail URL, or null when unavailable. */
  thumbnailUrl: string | null;

  /**
   * The original File object selected by the user.
   */
  file?: File;

  /**
   * Blob URL (local MP3) or server URL (downloaded audio).
   * Set once the audio is ready to stream.
   */
  audioUrl?: string;
}
