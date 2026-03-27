/**
 * PlaylistTrack.tsx — A single row in a deck's playlist panel.
 *
 * Clicking the track info area jumps to that track (loads + plays it).
 * The × button removes the entry from the playlist.
 * The active track is highlighted with a ▶ indicator.
 */
import { formatTime } from '../../utils/formatTime';
import type { PlaylistEntry } from '../../types/playlist';
import styles from './PlaylistTrack.module.css';

interface PlaylistTrackProps {
  entry: PlaylistEntry;
  index: number;
  isActive: boolean;
  deckId: 'A' | 'B';
  onJump: (deckId: 'A' | 'B', index: number) => void;
  onRemove: (deckId: 'A' | 'B', id: string) => void;
}

export function PlaylistTrack({
  entry,
  index,
  isActive,
  deckId,
  onJump,
  onRemove,
}: PlaylistTrackProps) {
  return (
    <li className={`${styles.track} ${isActive ? styles.trackActive : ''}`}>
      <button
        type="button"
        className={styles.trackInfo}
        onClick={() => onJump(deckId, index)}
        aria-label={`Play ${entry.title}`}
        aria-current={isActive ? 'true' : undefined}
      >
        <span className={styles.trackIndex} aria-hidden="true">
          {isActive ? '▶' : String(index + 1)}
        </span>
        {entry.thumbnailUrl && (
          <img
            className={styles.thumb}
            src={entry.thumbnailUrl}
            alt=""
            width={40}
            height={22}
            loading="lazy"
            aria-hidden="true"
          />
        )}
        <span className={styles.trackMeta}>
          <span className={styles.trackTitle} title={entry.title}>
            {entry.title}
          </span>
          <span className={styles.trackChannel}>{entry.artist}</span>
        </span>
        <span className={styles.trackDuration}>{formatTime(entry.duration)}</span>
      </button>
      <button
        type="button"
        className={styles.removeBtn}
        onClick={() => onRemove(deckId, entry.id)}
        aria-label={`Remove ${entry.title} from playlist`}
        title="Remove from playlist"
      >
        ×
      </button>
    </li>
  );
}

export default PlaylistTrack;
