/**
 * recentlyPlayed.ts — Utility for tracking recently loaded tracks.
 *
 * Persists the last MAX_RECENT tracks in localStorage.
 * Each entry is keyed by videoId; loading the same track again moves it to
 * the top of the list rather than creating a duplicate.
 */

const STORAGE_KEY = 'dj-rusty-recently-played';
const MAX_RECENT = 10;

/**
 * A snapshot of a track that was loaded onto a deck.
 */
export interface RecentTrack {
  /** YouTube video ID. */
  videoId: string;
  /** Video title. */
  title: string;
  /** Channel / artist name. */
  channelTitle: string;
  /** Duration in seconds. */
  duration: number;
  /** URL of the standard-resolution thumbnail, or null if unavailable. */
  thumbnailUrl: string | null;
  /** Unix timestamp (ms) when the track was loaded. */
  loadedAt: number;
}

/**
 * Add a track to the recently-played list.
 *
 * If the track already exists it is moved to the front.
 * The list is capped at MAX_RECENT entries.
 * localStorage write errors (e.g. quota exceeded) are silently swallowed.
 */
export function addRecentTrack(track: RecentTrack): void {
  const existing = getRecentTracks();
  // Remove any existing entry for the same videoId (deduplication).
  const filtered = existing.filter((t) => t.videoId !== track.videoId);
  const updated = [track, ...filtered].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Silently ignore quota / security errors.
  }
}

/**
 * Return the recently-played list (most recent first).
 * Returns an empty array if nothing is stored or the stored value is corrupt.
 */
export function getRecentTracks(): RecentTrack[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentTrack[];
  } catch {
    return [];
  }
}

/**
 * Clear the entire recently-played list.
 */
export function clearRecentTracks(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently ignore.
  }
}
