/**
 * DeckControls.tsx — Transport controls: Restart, Cue (CDJ-style), Play/Pause, Sync, eject.
 *
 * CDJ transport behaviour (Phase 3 Task 3.3):
 * - PLAY button: dispatches PLAY event → toggles PLAYING / PAUSED via the transport machine.
 * - CUE button (momentary):
 *     pointerDown  → CUE_PRESS  (while CUED: starts preview play; while PLAYING: jumps to cue & pauses; while PAUSED: sets cue)
 *     pointerUp / pointerLeave → CUE_RELEASE (ends preview, returns to cue)
 *
 * Restart button seeks to 0. Fixed ±15 s skip buttons removed in Task 5.2 — use the
 * grid-snapped BeatJump controls instead.
 * Hot cue panel (indices 0–3, long-press, right-click) handled by PadGridHotCue.tsx (via PadGrid).
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
  const isPlaying = transportState === 'PLAYING' || transportState === 'PREVIEW';
  const hasTrack = trackId !== null;

  function handleRestart() {
    if (!playerReady || !hasTrack) return;
    const player = getActivePlayer(deckId);
    if (!player) return;
    const deck = useDeckStore.getState().decks[deckId];
    const target = deck.shift && deck.cuePoint !== null ? deck.cuePoint : 0;
    player.seekTo(target, true);
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
