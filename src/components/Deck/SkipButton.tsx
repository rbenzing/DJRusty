/**
 * SkipButton.tsx — Skip to next track in the deck's playlist.
 *
 * Disabled when there is no next track queued (currentIndex is already
 * at the end of the playlist or the playlist is empty).
 */
import { usePlaylistStore } from '../../store/playlistStore';
import styles from './SkipButton.module.css';

interface SkipButtonProps {
  deckId: 'A' | 'B';
}

export function SkipButton({ deckId }: SkipButtonProps) {
  const playlist = usePlaylistStore((s) => s.playlists[deckId]);
  const currentIndex = usePlaylistStore((s) => s.currentIndex[deckId]);
  const skipToNext = usePlaylistStore((s) => s.skipToNext);

  const hasNext = currentIndex >= 0 && currentIndex < playlist.length - 1;

  return (
    <button
      type="button"
      className={styles.skipBtn}
      onClick={() => skipToNext(deckId)}
      disabled={!hasNext}
      aria-label={`Skip to next track in Deck ${deckId} playlist`}
      title={hasNext ? 'Skip to next playlist track' : 'No next track in playlist'}
    >
      &#x23ED;
    </button>
  );
}

export default SkipButton;
