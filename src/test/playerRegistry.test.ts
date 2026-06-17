import { describe, it, expect, beforeEach, vi } from 'vitest';
import { playerRegistry, getActivePlayer } from '../services/playerRegistry';
import type { DeckPlayer } from '../services/playerRegistry';

function mockPlayer(): DeckPlayer {
  return { seekTo: vi.fn(), getCurrentTime: () => 0, getDuration: () => 0 };
}

describe('playerRegistry (single backend)', () => {
  beforeEach(() => { playerRegistry.unregister('A'); playerRegistry.unregister('B'); });

  it('registers and resolves a deck player by deckId', () => {
    const p = mockPlayer();
    playerRegistry.register('A', p);
    expect(getActivePlayer('A')).toBe(p);
    expect(getActivePlayer('B')).toBeUndefined();
  });

  it('unregister removes the player', () => {
    playerRegistry.register('A', mockPlayer());
    playerRegistry.unregister('A');
    expect(getActivePlayer('A')).toBeUndefined();
  });
});
