/**
 * DeckControls.tsx — Transport controls: Play/Pause, Cue (jump), Set Cue.
 *
 * Play/Pause: toggles playbackState by dispatching to deckStore.
 * Cue (Jump to Cue): seeks to hotCues[0] via playerRegistry.seekTo().
 * Set Cue: stores the current time as hotCues[0] and persists to localStorage.
 *
 * The Cue button uses hot cue index 0 as the "main cue point" per the spec.
 * Full hot cue interactions (indices 0–3, long-press, right-click) are handled
 * by the HotCues component (STORY-011).
 *
 * Note: Actual player seek/play/pause commands are handled by useYouTubePlayer
 * which subscribes to deckStore.playbackState changes and issues IFrame API calls.
 * Seek is issued directly via playerRegistry to keep Zustand state clean.
 */
import { useDeck, useDeckStore } from '../../store/deckStore';
import { usePlaylistStore } from '../../store/playlistStore';
import { playerRegistry } from '../../services/playerRegistry';
import {
  setHotCue as persistSetHotCue,
} from '../../utils/hotCues';
import { formatTime } from '../../utils/formatTime';
import { SyncButton } from './SyncButton';
import { SkipButton } from './SkipButton';
import styles from './DeckControls.module.css';

interface DeckControlsProps {
  deckId: 'A' | 'B';
}

export function DeckControls({ deckId }: DeckControlsProps) {
  const deck = useDeck(deckId);
  const { setPlaybackState, setHotCue, clearTrack } = useDeckStore();
  const clearPlaylist = usePlaylistStore((s) => s.clearPlaylist);

  const { playbackState, trackId, currentTime, hotCues, playerReady } = deck;
  const isPlaying = playbackState === 'playing';
  const hasTrack = trackId !== null;

  // Cue point is stored at index 0 of hotCues (the "main cue" per spec).
  // The full 4-button hot cue panel is handled by HotCues.tsx (STORY-011).
  const cuePoint: number | undefined = hotCues[0];
  const hasCue = cuePoint !== undefined;

  function handlePlayPause() {
    if (!hasTrack) return;
    if (isPlaying) {
      setPlaybackState(deckId, 'paused');
    } else {
      setPlaybackState(deckId, 'playing');
    }
  }

  function handleSetCue() {
    if (!hasTrack) return;
    // Persist to localStorage and update in-memory store.
    if (trackId) {
      persistSetHotCue(trackId, 0, currentTime);
    }
    setHotCue(deckId, 0, currentTime);
  }

  function handleJumpToCue() {
    if (!hasCue || cuePoint === undefined) return;
    if (!playerReady) return;
    // Seek via the player registry — direct imperative call to the YT.Player.
    const player = playerRegistry.get(deckId);
    if (player) {
      player.seekTo(cuePoint, true);
    }
  }

  function handleRestart() {
    if (!playerReady || !hasTrack) return;
    const player = playerRegistry.get(deckId);
    if (player) {
      player.seekTo(0, true);
    }
  }

  function handleSkipBack() {
    if (!playerReady || !hasTrack) return;
    const player = playerRegistry.get(deckId);
    if (player) {
      const newTime = Math.max(0, currentTime - 15);
      player.seekTo(newTime, true);
    }
  }

  function handleSkipForward() {
    if (!playerReady || !hasTrack) return;
    const player = playerRegistry.get(deckId);
    if (player) {
      player.seekTo(currentTime + 15, true);
    }
  }

  const playLabel = isPlaying ? 'Pause' : 'Play';
  const playIcon = isPlaying ? '\u275a\u275a' : '\u25b6';

  return (
    <div className={styles.controls}>
      {/* Restart button — seeks to position 0 */}
      <button
        type="button"
        className={`${styles.btn} ${styles.restartBtn}`}
        onClick={handleRestart}
        disabled={!hasTrack || !playerReady}
        aria-label={`Restart Deck ${deckId}`}
        title="Restart track from the beginning"
      >
        &#x21BA;
      </button>

      {/* Skip Back button — seeks back 15 seconds */}
      <button
        type="button"
        className={`${styles.btn} ${styles.skipBackBtn}`}
        onClick={handleSkipBack}
        disabled={!hasTrack || !playerReady}
        aria-label={`Skip back 15 seconds on Deck ${deckId}`}
        title="Skip back 15 seconds"
      >
        &#x23EA;15
      </button>

      {/* Jump to Cue button */}
      <button
        type="button"
        className={`${styles.btn} ${styles.cueBtn}`}
        onClick={handleJumpToCue}
        disabled={!hasCue}
        aria-label={`Jump to cue point on Deck ${deckId}`}
        title={hasCue && cuePoint !== undefined ? `Jump to ${formatTime(cuePoint)}` : 'No cue set'}
      >
        &#x23EE; CUE
      </button>

      {/* Play/Pause button */}
      <button
        type="button"
        className={`${styles.btn} ${styles.playBtn} ${isPlaying ? styles.playBtnActive : ''}`}
        onClick={handlePlayPause}
        disabled={!hasTrack}
        aria-label={`${playLabel} Deck ${deckId}`}
        aria-pressed={isPlaying}
      >
        {playIcon}
      </button>

      {/* Set Cue button */}
      <button
        type="button"
        className={`${styles.btn} ${styles.setCueBtn}`}
        onClick={handleSetCue}
        disabled={!hasTrack}
        aria-label={`Set cue point on Deck ${deckId}`}
      >
        SET CUE
      </button>

      {/* Skip Forward button — seeks forward 15 seconds */}
      <button
        type="button"
        className={`${styles.btn} ${styles.skipFwdBtn}`}
        onClick={handleSkipForward}
        disabled={!hasTrack || !playerReady}
        aria-label={`Skip forward 15 seconds on Deck ${deckId}`}
        title="Skip forward 15 seconds"
      >
        15&#x23E9;
      </button>

      {/* Beat sync button */}
      <SyncButton deckId={deckId} />

      {/* Skip to next playlist track */}
      <SkipButton deckId={deckId} />

      {/* Eject / clear deck */}
      <button
        type="button"
        className={`${styles.btn} ${styles.ejectBtn}`}
        onClick={() => {
          if (!hasTrack) return;
          setPlaybackState(deckId, 'paused');
          clearTrack(deckId);
          clearPlaylist(deckId);
        }}
        disabled={!hasTrack}
        aria-label={`Eject track from Deck ${deckId}`}
        title="Eject — clear deck and playlist"
      >
        ⏏
      </button>
    </div>
  );
}

export default DeckControls;
