/**
 * DeckDisplay.tsx — Track title, channel name, time/rate row.
 *
 * Reads deck state from deckStore via the deckId prop.
 * Displays: deck label + BPM header, track title, channel name,
 * and a time/pitch-rate row below the platter.
 */
import { useDeck } from '../../store/deckStore';
import { formatTime } from '../../utils/formatTime';
import styles from './DeckDisplay.module.css';

interface DeckDisplayProps {
  deckId: 'A' | 'B';
}

export function DeckDisplay({ deckId }: DeckDisplayProps) {
  const deck = useDeck(deckId);
  const { title, artist, bpm, currentTime, duration, pitchRate, trackId } = deck;

  const hasTrack = trackId !== null;
  const bpmSet = bpm !== null;
  const bpmLabel = bpmSet ? `${bpm} BPM` : '-- BPM';
  const timeLabel = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  const rateLabel = `\u00d7${pitchRate.toFixed(2)}`;

  return (
    <div className={styles.display}>
      {/* Deck label + BPM row */}
      <div className={styles.headerRow}>
        <span className={styles.deckLabel}>DECK {deckId}</span>
        <span
          className={`${styles.bpmValue} ${bpmSet ? '' : styles.bpmValueUnset}`}
          aria-live="polite"
          aria-label={`BPM: ${bpmLabel}`}
        >
          {bpmLabel}
        </span>
      </div>

      {/* Track title */}
      <div
        className={`${styles.trackTitle} ${hasTrack ? '' : styles.trackTitleEmpty}`}
        title={hasTrack ? title : undefined}
      >
        {hasTrack ? title || 'Untitled' : 'No track loaded'}
      </div>

      {/* Channel name */}
      {hasTrack && (
        <div className={styles.channelName} title={artist}>
          {artist}
        </div>
      )}

      {/* Time / pitch rate row */}
      <div className={styles.timeRow}>
        <span className={styles.timeDisplay} aria-label={`Time: ${timeLabel}`}>
          {timeLabel}
        </span>
        <span className={styles.pitchRate} aria-label={`Pitch rate: ${rateLabel}`}>
          {rateLabel}
        </span>
      </div>
    </div>
  );
}

export default DeckDisplay;
