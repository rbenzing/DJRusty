/**
 * DeckModifiers.tsx — Compact SHIFT + QUANTIZE + ROLL toggle row for a deck.
 * Rendered under the transport. Buttons are small and clearly button-shaped
 * (fixed width, bordered, lit when active) — never a full-width bar.
 *
 * ROLL relocated here from the loop pad panel (Phase 2a) — it's a modifier
 * that changes how the loop pads react (click-toggle vs. hold-to-roll), not
 * a pad itself. Reuses the pre-existing rollMode/setRollMode unchanged.
 */
import { useShallow } from 'zustand/react/shallow';
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import styles from './DeckModifiers.module.css';

interface DeckModifiersProps {
  deckId: 'A' | 'B';
}

export function DeckModifiers({ deckId }: DeckModifiersProps) {
  const { shift, quantize, rollMode } = useDeckStore(
    useShallow((s) => ({
      shift: s.decks[deckId].shift,
      quantize: s.decks[deckId].quantize,
      rollMode: s.decks[deckId].rollMode,
    })),
  );
  const { setShift, setQuantize, setRollMode } = useDeckActions();

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
      <button
        type="button"
        className={`${styles.modBtn} ${rollMode ? styles.modBtnActive : ''}`}
        aria-label={`Loop roll mode for Deck ${deckId}`}
        aria-pressed={rollMode}
        title="ROLL — hold a loop pad to trigger a momentary roll instead of a persistent loop"
        onClick={() => setRollMode(deckId, !rollMode)}
      >
        ROLL
      </button>
    </div>
  );
}

export default DeckModifiers;
