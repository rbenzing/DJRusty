/**
 * GridControl.tsx — Hardware-style beat-grid control.
 *
 * TAP DOWNBEAT: stamps the grid anchor at the current playhead and confirms
 * the grid (sets gridConfirmed = true).
 *
 * NUDGE ◀ / ▶: shifts the anchor ±5 ms to fine-tune alignment.
 *
 * Status label reflects current grid state: "grid set", "grid unconfirmed",
 * or "no bpm".
 *
 * Disabled when no track is loaded or BPM has not been detected/tapped yet.
 */
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import styles from './GridControl.module.css';

const NUDGE_MS = 0.005; // 5 ms in seconds

interface GridControlProps {
  deckId: 'A' | 'B';
}

export function GridControl({ deckId }: GridControlProps) {
  const { setGrid, nudgeGrid } = useDeckActions();
  const bpm = useDeckStore((s) => s.decks[deckId].bpm);
  const anchor = useDeckStore((s) => s.decks[deckId].anchor);
  const confirmed = useDeckStore((s) => s.decks[deckId].gridConfirmed);
  const trackId = useDeckStore((s) => s.decks[deckId].trackId);
  const tapDisabled = !trackId || bpm === null;
  const nudgeDisabled = anchor === null;

  const tapDownbeat = () => {
    const { currentTime, bpm: b } = useDeckStore.getState().decks[deckId];
    if (b === null) return;
    setGrid(deckId, b, currentTime); // stamp anchor at playhead, confirm grid
  };

  // Full phrase is preserved for assistive tech via the .sr-only span below;
  // the visible text is abbreviated so the status fits without forcing the
  // row's GridControl section wider than its neighbors at the 1366px floor.
  const statusText = confirmed ? 'grid set' : bpm !== null ? 'grid unconfirmed' : 'no bpm';
  const statusShort = confirmed ? 'SET' : bpm !== null ? 'UNSET' : 'NO BPM';

  return (
    <div className={styles.grid} aria-label={`Deck ${deckId} beat grid`}>
      <button
        className={styles.tapBtn}
        disabled={tapDisabled}
        aria-label={`Tap downbeat on Deck ${deckId}`}
        onClick={tapDownbeat}
      >
        TAP
      </button>
      <button
        className={styles.nudgeBtn}
        disabled={nudgeDisabled}
        aria-label={`Nudge grid earlier on Deck ${deckId}`}
        onClick={() => nudgeGrid(deckId, -NUDGE_MS)}
      >
        ◀
      </button>
      <button
        className={styles.nudgeBtn}
        disabled={nudgeDisabled}
        aria-label={`Nudge grid later on Deck ${deckId}`}
        onClick={() => nudgeGrid(deckId, NUDGE_MS)}
      >
        ▶
      </button>
      <span className={styles.status}>
        <span aria-hidden="true">{statusShort}</span>
        <span className="sr-only">{statusText}</span>
      </span>
    </div>
  );
}
