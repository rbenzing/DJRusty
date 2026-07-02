/**
 * BeatmatchGuide.tsx — Read-only tempo + phase alignment indicator between decks.
 * Mirrors the controller's beatmatch LED ladder. Purely visual; no audio.
 */
import { useShallow } from 'zustand/react/shallow';
import { useDeckStore } from '../../store/deckStore';
import { beatmatchReadout, type DeckBeatState } from '../../utils/beatmatch';
import styles from './BeatmatchGuide.module.css';

function pick(d: {
  bpm: number | null; pitchRate: number; anchor: number | null; currentTime: number;
}): DeckBeatState {
  return { bpm: d.bpm, pitchRate: d.pitchRate, anchor: d.anchor, currentTime: d.currentTime };
}

export function BeatmatchGuide() {
  const readout = useDeckStore(
    useShallow((s) => beatmatchReadout(pick(s.decks.A), pick(s.decks.B))),
  );

  // Tempo marker: clamp ±8 BPM to the bar half-width.
  const tempoPct = Math.max(-1, Math.min(1, readout.tempoDeltaBpm / 8)) * 50 + 50;
  // Phase marker: phaseOffset is [-0.5, 0.5) → map to 0..100%.
  const phasePct = (readout.phaseOffset + 0.5) * 100;

  return (
    <div
      className={styles.guide}
      aria-label="Beatmatch guide"
      data-has-grids={readout.hasGrids ? 'true' : 'false'}
    >
      <div className={styles.label}>BEATMATCH</div>
      {readout.hasGrids ? (
        <>
          <div className={styles.track} aria-hidden="true">
            <span className={styles.center} />
            <span className={styles.marker} style={{ left: `${tempoPct}%` }} />
          </div>
          <div className={styles.track} aria-hidden="true">
            <span className={styles.center} />
            <span className={styles.markerPhase} style={{ left: `${phasePct}%` }} />
          </div>
        </>
      ) : (
        <div className={styles.idle}>no grid</div>
      )}
    </div>
  );
}

export default BeatmatchGuide;
