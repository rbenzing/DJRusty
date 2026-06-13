import { useEffect, useRef } from 'react';
import { getActivePlayer } from '../services/playerRegistry';
import { useDeckStore } from '../store/deckStore';

/** Smooth playhead from the active player's clock, updated each rAF into a ref (NOT Zustand). */
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
