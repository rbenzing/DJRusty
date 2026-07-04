/**
 * playerRegistry.ts — Module-level map of deckId → Web Audio engine.
 * The engine instance lives in a useRef inside useAudioEngine (never in Zustand).
 * Components/store look up the deck's player here to issue imperative commands.
 */
type DeckId = 'A' | 'B';

export interface DeckPlayer {
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setLoop?(startSec: number, endSec: number): void;
  clearLoop?(): void;
  isLooping?(): boolean;
  beginScratch?(): void;
  updateScratchRate?(rate: number): void;
  endScratch?(resumeAt?: number): void;
  setBendMultiplier?(multiplier: number): void;
}

const registry = new Map<DeckId, DeckPlayer>();

export const playerRegistry = {
  register(deckId: DeckId, player: DeckPlayer): void { registry.set(deckId, player); },
  unregister(deckId: DeckId): void { registry.delete(deckId); },
};

/** The Web Audio engine registered for this deck, or undefined if none. */
export function getActivePlayer(deckId: DeckId): DeckPlayer | undefined {
  return registry.get(deckId);
}
