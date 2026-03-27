/**
 * HotCues.tsx — 8 hot cue buttons per deck.
 *
 * Full implementation for STORY-011.
 *
 * Each button:
 *   - Shows its index number (1–8) when the cue is not set (dim appearance).
 *   - Shows the formatted timestamp when set (brightly lit in cue colour).
 *
 * Interaction model (delegated to HotCueButton):
 *   - Normal click on SET cue    → seekTo(timestamp)
 *   - Shift+click or long-press  → set cue at currentTime, persist to localStorage
 *   - Right-click on SET cue     → clear cue from state + localStorage
 *
 * Persistence:
 *   - setHotCue / clearHotCue utilities from src/utils/hotCues.ts handle localStorage.
 *   - deckStore.setHotCue / clearHotCue update in-memory state.
 *   - loadTrack in deckStore already loads hotCues from localStorage on track load.
 *
 * The component reads currentTime and videoId from deckStore and delegates
 * player.seekTo() to the useYouTubePlayer hook via the playerRef that is
 * exposed through a shared registry (see playerRegistry below).
 *
 * Player seek:
 *   The YT.Player instance is not in Zustand — it lives in a useRef inside
 *   useYouTubePlayer. To perform a seek from outside the hook we use a simple
 *   module-level registry that the hook populates on mount and clears on unmount.
 */
import { useDeck, useDeckStore } from '../../store/deckStore';
import {
  setHotCue as persistSetHotCue,
  clearHotCue as persistClearHotCue,
} from '../../utils/hotCues';
import { playerRegistry } from '../../services/playerRegistry';
import { HotCueButton } from './HotCueButton';
import styles from './HotCues.module.css';

/** Number of hot cue slots per deck. */
const HOT_CUE_COUNT = 8;

interface HotCuesProps {
  deckId: 'A' | 'B';
}

export function HotCues({ deckId }: HotCuesProps) {
  const deck = useDeck(deckId);
  const { setHotCue, clearHotCue } = useDeckStore();

  const { trackId, currentTime, hotCues, playerReady } = deck;
  const hasTrack = trackId !== null;

  /**
   * Set a hot cue at the deck's current playback position.
   * Persists to localStorage and updates in-memory store.
   */
  function handleSet(index: number) {
    if (!trackId) return;
    persistSetHotCue(trackId, index, currentTime);
    setHotCue(deckId, index, currentTime);
  }

  /**
   * Jump to a stored hot cue timestamp via the player's seekTo() method.
   */
  function handleJump(index: number) {
    const timestamp = hotCues[index];
    if (timestamp === undefined) return;
    if (!playerReady) return;

    const player = playerRegistry.get(deckId);
    if (player) {
      player.seekTo(timestamp, true);
    }
  }

  /**
   * Clear a hot cue from localStorage and in-memory state.
   */
  function handleClear(index: number) {
    if (!trackId) return;
    persistClearHotCue(trackId, index);
    clearHotCue(deckId, index);
  }

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>HOT CUES</span>
      <div className={styles.buttons}>
        {Array.from({ length: HOT_CUE_COUNT }, (_, index) => (
          <HotCueButton
            key={index}
            index={index}
            deckId={deckId}
            timestamp={hotCues[index]}
            hasTrack={hasTrack}
            onSet={() => handleSet(index)}
            onJump={() => handleJump(index)}
            onClear={() => handleClear(index)}
          />
        ))}
      </div>
    </div>
  );
}

export default HotCues;
