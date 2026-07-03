/**
 * PadGridHotCue.tsx — HOT CUE pad-mode panel, rendered inside PadGrid.
 *
 * 8 hot cue pads in a 2x4 grid. Extracted from the pre-PadGrid HotCues.tsx —
 * interaction model (delegated to HotCueButton) and quantize-on-SET behavior
 * are unchanged:
 *   - Normal click on SET cue    → seekTo(timestamp)
 *   - Shift+click or long-press  → set cue at current (quantized) time
 *   - Right-click on SET cue     → clear cue
 */
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import {
  setHotCue as persistSetHotCue,
  clearHotCue as persistClearHotCue,
} from '../../utils/hotCues';
import { getActivePlayer } from '../../services/playerRegistry';
import { snapToGrid } from '../../utils/quantize';
import { HotCueButton } from './HotCueButton';
import styles from './PadGridHotCue.module.css';

/** Number of hot cue slots per deck. */
const HOT_CUE_COUNT = 8;

interface PadGridHotCueProps {
  deckId: 'A' | 'B';
}

export function PadGridHotCue({ deckId }: PadGridHotCueProps) {
  const { setHotCue, clearHotCue } = useDeckActions();

  const trackId = useDeckStore((s) => s.decks[deckId].trackId);
  const hotCues = useDeckStore((s) => s.decks[deckId].hotCues);
  const playerReady = useDeckStore((s) => s.decks[deckId].playerReady);
  const hasTrack = trackId !== null;

  /** Set a hot cue at the deck's current (quantized, if on) playback position. */
  function handleSet(index: number) {
    if (!trackId) return;
    const deck = useDeckStore.getState().decks[deckId];
    let t = deck.currentTime;
    if (deck.quantize && deck.bpm && deck.anchor !== null) {
      t = snapToGrid({ bpm: deck.bpm, anchor: deck.anchor }, t);
    }
    persistSetHotCue(trackId, index, t);
    setHotCue(deckId, index, t);
  }

  /** Jump to a stored hot cue timestamp via the player's seekTo() method. */
  function handleJump(index: number) {
    const timestamp = hotCues[index];
    if (timestamp === undefined) return;
    if (!playerReady) return;

    const player = getActivePlayer(deckId);
    if (player) {
      player.seekTo(timestamp, true);
    }
  }

  /** Clear a hot cue from localStorage and in-memory state. */
  function handleClear(index: number) {
    if (!trackId) return;
    persistClearHotCue(trackId, index);
    clearHotCue(deckId, index);
  }

  return (
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
  );
}

export default PadGridHotCue;
