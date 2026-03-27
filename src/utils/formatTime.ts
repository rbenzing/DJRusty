/**
 * formatTime.ts — Time display and ISO 8601 duration parsing utilities.
 * Full implementation here for STORY-001.
 * Used by DeckDisplay, SearchResult components, and youtubeDataApi service.
 */

/**
 * Parses an ISO 8601 duration string to total seconds.
 *
 * Examples:
 *   parseDuration('PT1H23M45S') → 5025
 *   parseDuration('PT3M30S')    → 210
 *   parseDuration('PT45S')      → 45
 *   parseDuration('PT2H')       → 7200
 *
 * @param iso - ISO 8601 duration string (YouTube format: PTxHxMxS).
 * @returns Total seconds, or 0 if the string is invalid.
 */
export function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  const seconds = parseInt(match[3] ?? '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Formats a duration in seconds as a MM:SS or H:MM:SS string.
 *
 * Examples:
 *   formatTime(90)   → '1:30'
 *   formatTime(3661) → '1:01:01'
 *   formatTime(0)    → '0:00'
 *
 * @param seconds - Duration in seconds.
 * @returns Human-readable time string.
 */
export function formatTime(seconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, seconds));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  const ss = s.toString().padStart(2, '0');

  if (h > 0) {
    const mm = m.toString().padStart(2, '0');
    return `${h}:${mm}:${ss}`;
  }

  return `${m}:${ss}`;
}
