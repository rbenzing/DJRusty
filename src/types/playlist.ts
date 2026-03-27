/**
 * playlist.ts — Types for the per-deck playlist / track queue feature.
 */

/**
 * Discriminates between local MP3 files and YouTube stream tracks.
 */
export type TrackSourceType = 'mp3' | 'youtube';

/**
 * A single entry in a deck's playlist queue.
 * Stores full track metadata so the entry is self-contained for display.
 *
 * Note: `id` is a unique entry identifier — the same video may appear
 * more than once in a playlist, each time with a different `id`.
 *
 * YouTube entries populate `videoId`; MP3 entries populate `file` and/or `audioUrl`.
 * Both entry types share `title`, `artist`, `duration`, `thumbnailUrl`, and `sourceType`.
 */
export interface PlaylistEntry {
  /** Unique entry identifier (not the video ID). */
  id: string;

  /** Discriminates between 'youtube' and 'mp3' source entries. */
  sourceType: TrackSourceType;

  /** Track title. */
  title: string;

  /**
   * Artist / channel name.
   * Renamed from `channelTitle` for source-agnostic naming.
   */
  artist: string;

  /** Total duration in seconds. */
  duration: number;

  /** Thumbnail URL, or null when unavailable. */
  thumbnailUrl: string | null;

  // ── YouTube-only fields ────────────────────────────────────────────────

  /** YouTube video ID. Present only for sourceType 'youtube'. */
  videoId?: string;

  // ── MP3-only fields (populated by future stories) ─────────────────────

  /**
   * The original File object selected by the user.
   * Present only for sourceType 'mp3'. Set by mp3-004/mp3-005.
   */
  file?: File;

  /**
   * Blob URL (local MP3) or server URL (downloaded YouTube audio).
   * Set once the audio is ready to stream. Populated by mp3-004 and mp3-012.
   */
  audioUrl?: string;
}
