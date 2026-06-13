import { useEffect, useRef } from 'react';
import { getActivePlayer } from '../services/playerRegistry';
import { useDeckStore } from '../store/deckStore';

/**
 * Smooth playhead from the active player's clock, updated each rAF into a ref (NOT Zustand).
 *
 * Callers must read `.current` live inside their own rAF or draw loop each frame —
 * destructuring the number at render time produces a stale snapshot that won't update.
 */
export function usePlayhead(deckId: 'A' | 'B'): { current: number } {
  const ref = useRef(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const { sourceType } = useDeckStore.getState().decks[deckId];
      const player = getActivePlayer(deckId, sourceType);
      if (player) ref.current = player.getCurrentTime();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deckId]);
  return ref;
}
