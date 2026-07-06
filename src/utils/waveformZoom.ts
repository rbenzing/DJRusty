/**
 * waveformZoom.ts — shared zoom-level constants for the per-deck waveform display.
 */

/**
 * VISIBLE_HALF values (bars each side of the playhead) for each zoom level,
 * narrowest/most-zoomed-in first, widest/whole-track last. Visible bar totals
 * are (value * 2 + 1): 41, 121, 361, 601, 1001 — out of the fixed 1000-bar
 * TOTAL_BARS in DeckWaveform.tsx (so the last level shows the entire track).
 */
export const WAVEFORM_ZOOM_LEVELS = [20, 60, 180, 300, 500] as const;

/** Index into WAVEFORM_ZOOM_LEVELS matching today's fixed 180-bar-half default. */
export const DEFAULT_WAVEFORM_ZOOM_INDEX = 2;
