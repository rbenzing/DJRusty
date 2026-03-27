/**
 * SlipButton.tsx — Toggle button for slip mode on a single deck.
 *
 * Slip mode maintains a shadow playhead that advances in real time while
 * the audible playhead is trapped in a loop. On loop exit, the deck snaps
 * to the shadow position for seamless continuation.
 */
import { useDeck, useDeckStore } from '../../store/deckStore';
import styles from './SlipButton.module.css';

interface SlipButtonProps {
  deckId: 'A' | 'B';
}

export function SlipButton({ deckId }: SlipButtonProps) {
  const { slipMode } = useDeck(deckId);

  function handleClick() {
    useDeckStore.getState().setSlipMode(deckId, !slipMode);
  }

  return (
    <button
      type="button"
      className={[styles.slipBtn, slipMode ? styles.slipBtnActive : '']
        .filter(Boolean)
        .join(' ')}
      onClick={handleClick}
      aria-pressed={slipMode}
      aria-label={`Slip mode on Deck ${deckId}`}
      title={slipMode ? 'Slip mode on' : 'Slip mode off'}
    >
      SLIP
    </button>
  );
}

export default SlipButton;
