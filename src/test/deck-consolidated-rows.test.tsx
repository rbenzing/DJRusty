import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// Deck.tsx calls useAudioEngine(deckId) unconditionally on mount, which
// constructs a real AudioEngineImpl (and thus a real AudioContext). jsdom has
// no AudioContext implementation, so this must be stubbed — mirrors the
// pattern already used in src/test/dnd-library-to-deck.test.tsx.
vi.mock('../hooks/useAudioEngine', () => ({ useAudioEngine: vi.fn() }));

import { Deck } from '../components/Deck/Deck';
import { useDeckStore } from '../store/deckStore';
import styles from '../components/Deck/Deck.module.css';

describe('Deck — Tap BPM / FX / Grid Control consolidated row', () => {
  it('renders TapTempo, EffectsPanel, and GridControl as siblings inside one row wrapper, in that order', () => {
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], trackId: null } },
    });
    const { container } = render(<Deck deckId="A" />);

    const row = container.querySelector(`.${styles.tapFxGridRow}`);
    expect(row).not.toBeNull();
    expect(row?.children.length).toBe(3);

    // TapTempo's own root has the "TAP BPM" label; GridControl's root has an
    // aria-label containing "beat grid"; EffectsPanel's root contains "FX".
    expect(row?.children[0]?.textContent).toContain('TAP BPM');
    expect(row?.children[1]?.textContent).toContain('FX');
    expect(row?.children[2]?.getAttribute('aria-label')).toContain('beat grid');
  });
});
