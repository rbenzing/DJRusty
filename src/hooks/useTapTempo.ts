/**
 * useTapTempo.ts — BPM tap calculation hook.
 * Stub for STORY-001. Full implementation in STORY-010.
 */

/**
 * Returns a `tap` function that, when called repeatedly, calculates BPM
 * from the intervals between taps and updates the deck store.
 *
 * @param deckId - Which deck to update with the calculated BPM.
 */
export function useTapTempo(_deckId: 'A' | 'B'): { tap: () => void; reset: () => void } {
  // Full implementation in STORY-010
  return {
    tap: () => undefined,
    reset: () => undefined,
  };
}
