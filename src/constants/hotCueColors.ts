/**
 * Per-index accent colours for the 8 hot cues (0-based indices).
 *
 * Lives in its own module (not the component file) so that importing the
 * palette doesn't break React Fast Refresh, which requires component files
 * to export only components.
 */
export const HOT_CUE_COLORS: readonly string[] = [
  '#ff4444', // index 0 — red
  '#ff9900', // index 1 — orange
  '#44ff44', // index 2 — green
  '#4488ff', // index 3 — blue
  '#cc44ff', // index 4 — purple
  '#ff44aa', // index 5 — pink
  '#ffcc00', // index 6 — gold
  '#cccccc', // index 7 — white
];
