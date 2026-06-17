/**
 * SyncButton.tsx — Beat-sync button for a single deck.
 *
 * When pressed, performs hardware-accurate SYNC via syncToDeck:
 *   1. Sets this deck's pitch to the exact continuous ratio matching the other
 *      deck's effective tempo (not snapped to discrete PITCH_RATES).
 *   2. Performs a one-shot downbeat phase alignment seek.
 * Shows a lit LED when synced. Disabled when either deck has no BPM.
 *
 * The pitchRate subscription in useAudioEngine applies the rate change
 * to the audio engine automatically — no direct player API calls are needed here.
 */
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import styles from './SyncButton.module.css';

interface SyncButtonProps {
  deckId: 'A' | 'B';
}

export function SyncButton({ deckId }: SyncButtonProps) {
  const otherDeckId = deckId === 'A' ? 'B' : 'A';
  const { syncToDeck } = useDeckActions();

  const thisBpm = useDeckStore((s) => s.decks[deckId].bpm);
  const otherBpm = useDeckStore((s) => s.decks[otherDeckId].bpm);
  const isSynced = useDeckStore((s) => s.decks[deckId].synced);

  // Disabled when either deck has no BPM (null or 0)
  const isDisabled = !thisBpm || !otherBpm;

  function handleSync() {
    if (isDisabled) return;
    syncToDeck(deckId, otherDeckId);
  }

  return (
    <button
      type="button"
      className={`${styles.syncBtn} ${isSynced ? styles.syncBtnActive : ''}`}
      onClick={handleSync}
      disabled={isDisabled}
      aria-label={`Sync Deck ${deckId} BPM to Deck ${otherDeckId}`}
      aria-pressed={isSynced}
      title={
        isDisabled
          ? 'Both decks must have a BPM set (use TAP)'
          : isSynced
            ? 'Beat sync active'
            : `Sync to Deck ${otherDeckId} BPM`
      }
    >
      <span className={styles.syncLed} />
      SYNC
    </button>
  );
}

export default SyncButton;
