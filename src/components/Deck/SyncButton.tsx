/**
 * SyncButton.tsx — Beat-sync button for a single deck.
 *
 * When pressed, snaps this deck's pitch rate to the closest PITCH_RATES
 * value that makes this deck's effective BPM match the other deck's BPM.
 * Shows a lit LED when synced. Disabled when either deck has no BPM.
 *
 * The existing useYouTubePlayer pitchRate subscription applies the rate
 * change to the YouTube player automatically — no direct player API calls
 * are needed here.
 */
import { useDeck, useDeckStore } from '../../store/deckStore';
import { calculateSyncRate } from '../../utils/beatSync';
import styles from './SyncButton.module.css';

interface SyncButtonProps {
  deckId: 'A' | 'B';
}

export function SyncButton({ deckId }: SyncButtonProps) {
  const thisDeck = useDeck(deckId);
  const otherDeckId = deckId === 'A' ? 'B' : 'A';
  const otherDeck = useDeck(otherDeckId);
  const { setPitchRate, setSynced } = useDeckStore();

  const thisBpm = thisDeck.bpm;
  const otherBpm = otherDeck.bpm;
  const isSynced = thisDeck.synced;

  // Disabled when either deck has no BPM (null or 0)
  const isDisabled = !thisBpm || !otherBpm;

  function handleSync() {
    if (isDisabled) return;

    const rate = calculateSyncRate(thisBpm, otherBpm);
    if (rate === null) return;

    setPitchRate(deckId, rate);
    setSynced(deckId, true);
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
