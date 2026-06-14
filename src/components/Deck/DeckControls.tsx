/**
 * DeckControls.tsx — Transport controls: Play/Pause, Cue (CDJ-style), Restart.
 *
 * CDJ transport behaviour (Phase 3 Task 3.3):
 * - PLAY button: dispatches PLAY event → toggles PLAYING / PAUSED via the transport machine.
 * - CUE button (momentary):
 *     pointerDown  → CUE_PRESS  (while CUED: starts preview play; while PLAYING: jumps to cue & pauses; while PAUSED: sets cue)
 *     pointerUp / pointerLeave → CUE_RELEASE (ends preview, returns to cue)
 *
 * Restart button seeks to 0 (unchanged, Task 5.2 will handle skip buttons).
 * Skip ±15 s buttons are preserved unchanged.
 * Hot cue panel (indices 0–3, long-press, right-click) handled by HotCues.tsx (STORY-011).
 */
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import { usePlaylistStore } from '../../store/playlistStore';
import { getActivePlayer } from '../../services/playerRegistry';
import { SyncButton } from './SyncButton';
import { SkipButton } from './SkipButton';
import styles from './DeckControls.module.css';

interface DeckControlsProps {
  deckId: 'A' | 'B';
}

export function DeckControls({ deckId }: DeckControlsProps) {
  const { setPlaybackState, clearTrack, dispatchTransport } = useDeckActions();
  const clearPlaylist = usePlaylistStore((s) => s.clearPlaylist);

  const transportState = useDeckStore((s) => s.decks[deckId].transportState);
  const trackId = useDeckStore((s) => s.decks[deckId].trackId);
  const playerReady = useDeckStore((s) => s.decks[deckId].playerReady);
  const sourceType = useDeckStore((s) => s.decks[deckId].sourceType);
  const isPlaying = transportState === 'PLAYING' || transportState === 'PREVIEW';
  const hasTrack = trackId !== null;

  function handleRestart() {
    if (!playerReady || !hasTrack) return;
    const player = getActivePlayer(deckId, sourceType);
    if (player) {
      player.seekTo(0, true);
    }
  }

  function handleSkipBack() {
    if (!playerReady || !hasTrack) return;
    const player = getActivePlayer(deckId, sourceType);
    if (player) {
      const currentTime = useDeckStore.getState().decks[deckId].currentTime;
      const newTime = Math.max(0, currentTime - 15);
      player.seekTo(newTime, true);
    }
  }

  function handleSkipForward() {
    if (!playerReady || !hasTrack) return;
    const player = getActivePlayer(deckId, sourceType);
    if (player) {
      const currentTime = useDeckStore.getState().decks[deckId].currentTime;
      player.seekTo(currentTime + 15, true);
    }
  }

  const playLabel = isPlaying ? `Pause Deck ${deckId}` : `Play Deck ${deckId}`;
  const playIcon = isPlaying ? '❚❚' : '▶';

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

      {/* CDJ CUE button — momentary: pointerDown starts preview/jump-to-cue/set-cue; pointerUp/Leave ends preview */}
      <button
        type="button"
        className={`${styles.btn} ${styles.cueBtn}`}
        onPointerDown={() => { if (hasTrack) dispatchTransport(deckId, { type: 'CUE_PRESS' }); }}
        onPointerUp={() => { if (hasTrack) dispatchTransport(deckId, { type: 'CUE_RELEASE' }); }}
        onPointerLeave={() => { if (hasTrack) dispatchTransport(deckId, { type: 'CUE_RELEASE' }); }}
        disabled={!hasTrack}
        aria-label={`Cue Deck ${deckId}`}
        title="CDJ Cue — hold to preview, release to return to cue"
      >
        CUE
      </button>

      {/* Play/Pause button — dispatches PLAY event through the transport machine */}
      <button
        type="button"
        className={`${styles.btn} ${styles.playBtn} ${isPlaying ? styles.playBtnActive : ''}`}
        onClick={() => { if (hasTrack) dispatchTransport(deckId, { type: 'PLAY' }); }}
        disabled={!hasTrack}
        aria-label={playLabel}
        aria-pressed={isPlaying}
      >
        {playIcon}
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
