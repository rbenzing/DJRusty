/**
 * DeckModifiers.tsx — Compact SHIFT + QUANTIZE toggle row for a deck.
 * Rendered under the transport. Buttons are small and clearly button-shaped
 * (fixed width, bordered, lit when active) — never a full-width bar.
 */
import { useShallow } from 'zustand/react/shallow';
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import styles from './DeckModifiers.module.css';

interface DeckModifiersProps {
  deckId: 'A' | 'B';
}

export function DeckModifiers({ deckId }: DeckModifiersProps) {
  const { shift, quantize } = useDeckStore(
    useShallow((s) => ({ shift: s.decks[deckId].shift, quantize: s.decks[deckId].quantize })),
  );
  const { setShift, setQuantize } = useDeckActions();

  return (
    <div className={styles.row}>
      <button
        type="button"
        className={`${styles.modBtn} ${shift ? styles.modBtnActive : ''}`}
        aria-label={`Shift modifier for Deck ${deckId}`}
        aria-pressed={shift}
        title="SHIFT — hold-alternative for secondary functions"
        onClick={() => setShift(deckId, !shift)}
      >
        SHIFT
      </button>
      <button
        type="button"
        className={`${styles.modBtn} ${quantize ? styles.modBtnActive : ''}`}
        aria-label={`Quantize for Deck ${deckId}`}
        aria-pressed={quantize}
        title="QUANTIZE — snap cues & loops to the beat grid"
        onClick={() => setQuantize(deckId, !quantize)}
      >
        Q
      </button>
    </div>
  );
}

export default DeckModifiers;
