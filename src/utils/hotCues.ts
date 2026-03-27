/**
 * hotCues.ts — Hot cue localStorage persistence utilities.
 * Full implementation here for STORY-001.
 * Used by HotCues component and deckStore in STORY-011.
 *
 * Hot cues are keyed by `trackId` (the deck-store identifier for the loaded track).
 * For YouTube entries, trackId IS the YouTube video ID, so existing persisted cues
 * are automatically compatible — no migration required.
 * For MP3 entries (future stories), trackId will be the PlaylistEntry.id.
 */

const STORAGE_KEY = 'dj-rusty-hot-cues';

/**
 * Internal map type for hot cue storage.
 */
interface HotCueMap {
  [trackId: string]: Record<number, number>;
}

/**
 * Reads stored hot cues for a specific track ID from localStorage.
 *
 * @param trackId - Source-agnostic track identifier (YouTube video ID for YT tracks).
 * @returns A map of cue index (0–7) to timestamp in seconds.
 *          Returns an empty object if no cues are stored for this track.
 */
export function getHotCues(trackId: string): Record<number, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data: HotCueMap = JSON.parse(raw) as HotCueMap;
    return data[trackId] ?? {};
  } catch {
    return {};
  }
}

/**
 * Saves a hot cue timestamp for a specific track ID and cue index.
 *
 * @param trackId - Source-agnostic track identifier (YouTube video ID for YT tracks).
 * @param index - Cue index (0–7).
 * @param timestamp - Timestamp in seconds to store.
 */
export function setHotCue(trackId: string, index: number, timestamp: number): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data: HotCueMap = raw ? (JSON.parse(raw) as HotCueMap) : {};
    const existing = data[trackId] ?? {};
    data[trackId] = { ...existing, [index]: timestamp };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable in some environments; fail silently
  }
}

/**
 * Removes a specific hot cue from localStorage for a given track ID and index.
 *
 * @param trackId - Source-agnostic track identifier (YouTube video ID for YT tracks).
 * @param index - Cue index to remove.
 */
export function clearHotCue(trackId: string, index: number): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data: HotCueMap = JSON.parse(raw) as HotCueMap;
    if (!data[trackId]) return;
    const cues = { ...data[trackId] };
    delete cues[index];
    data[trackId] = cues;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Fail silently
  }
}
