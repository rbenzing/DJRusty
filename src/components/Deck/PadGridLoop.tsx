/**
 * PadGridLoop.tsx — LOOP pad-mode panel, rendered inside PadGrid.
 *
 * 8 pads in a 2x4 grid: IN, OUT, 1B, 2B, 4B, 8B, RELOOP, EXIT. Extracted
 * from the pre-PadGrid LoopControls.tsx. The ROLL *toggle* moved to
 * DeckModifiers (it's a modifier, not a pad) — but the roll-mode
 * press/release behavior of the beat-length pads is unchanged here: while
 * rollMode is on, holding a beat-length pad starts/ends a loop roll instead
 * of click-toggling a persistent loop.
 *
 * SHIFT + a loop-length button while a loop is active halves/doubles the
 * active loop instead of absolute-selecting the clicked length (unchanged
 * from Phase 1).
 */
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import { shiftedLoopBeatCount } from '../../utils/loopMath';
import styles from './PadGridLoop.module.css';

/** Beat counts available as loop lengths. */
const BEAT_COUNTS = [1, 2, 4, 8] as const;
type BeatCount = (typeof BEAT_COUNTS)[number];

interface PadGridLoopProps {
  deckId: 'A' | 'B';
}

export function PadGridLoop({ deckId }: PadGridLoopProps) {
  const bpm = useDeckStore((s) => s.decks[deckId].bpm);
  const loopActive = useDeckStore((s) => s.decks[deckId].loopActive);
  const loopBeatCount = useDeckStore((s) => s.decks[deckId].loopBeatCount);
  const rollMode = useDeckStore((s) => s.decks[deckId].rollMode);
  const playbackState = useDeckStore((s) => s.decks[deckId].playbackState);
  const manualLoopIn = useDeckStore((s) => s.decks[deckId].manualLoopIn);
  const lastManualLoop = useDeckStore((s) => s.decks[deckId].lastManualLoop);
  const shift = useDeckStore((s) => s.decks[deckId].shift);
  const { activateLoopBeat, deactivateLoop, startRoll, endRoll, setLoopIn, setLoopOut, reloop } = useDeckActions();

  const bpmIsSet = bpm !== null;
  const isPlaying = playbackState === 'playing';
  const disabledTitle = 'Set BPM using Tap Tempo first';
  const notPlayingTitle = 'Start playback to use loop roll';

  function handleLoopButton(beatCount: BeatCount) {
    if (!bpmIsSet) return;

    // SHIFT + a loop-length button while a loop is active: halve/double the
    // active loop instead of absolute-selecting the clicked length.
    if (shift && loopActive && loopBeatCount !== null) {
      const result = shiftedLoopBeatCount(loopBeatCount, beatCount);
      if (result === 'deactivate') {
        deactivateLoop(deckId);
      } else {
        activateLoopBeat(deckId, result);
      }
      return;
    }

    // Pressing the same active beat count exits the loop; any other count
    // activates that beat length (replacing any existing loop).
    if (loopActive && loopBeatCount === beatCount) {
      deactivateLoop(deckId);
    } else {
      activateLoopBeat(deckId, beatCount);
    }
  }

  function handleExit() {
    deactivateLoop(deckId);
  }

  // Roll behavior disabled when BPM not set or deck not playing.
  const rollDisabled = !bpmIsSet || !isPlaying;

  function getRollButtonTitle(beatCount: BeatCount): string {
    if (!bpmIsSet) return disabledTitle;
    if (!isPlaying) return notPlayingTitle;
    return `${beatCount}-beat loop roll`;
  }

  return (
    <div className={styles.buttons}>
      {/* Manual loop in/out */}
      <button
        type="button"
        className={[styles.loopBtn, manualLoopIn !== null ? styles.loopBtnActive : ''].filter(Boolean).join(' ')}
        onClick={() => setLoopIn(deckId)}
        aria-label={`Set loop in on Deck ${deckId}`}
        aria-pressed={manualLoopIn !== null}
        title="Set loop in-point"
      >
        IN
      </button>
      <button
        type="button"
        className={[styles.loopBtn, manualLoopIn === null ? styles.loopBtnDisabled : ''].filter(Boolean).join(' ')}
        onClick={() => setLoopOut(deckId)}
        disabled={manualLoopIn === null}
        aria-label={`Set loop out on Deck ${deckId}`}
        title="Set loop out-point and start looping"
      >
        OUT
      </button>
      {BEAT_COUNTS.map((beatCount) => {
        const isActive = loopActive && loopBeatCount === beatCount;

        if (rollMode) {
          // Roll mode: press-hold behavior
          return (
            <button
              key={beatCount}
              type="button"
              className={[
                styles.loopBtn,
                isActive ? styles.loopBtnActive : '',
                rollDisabled ? styles.loopBtnDisabled : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={rollDisabled}
              aria-label={`${beatCount}-beat loop roll on Deck ${deckId}`}
              aria-pressed={isActive}
              title={getRollButtonTitle(beatCount)}
              onMouseDown={() => {
                if (rollDisabled) return;
                startRoll(deckId, beatCount);
              }}
              onMouseUp={() => {
                if (rollDisabled) return;
                endRoll(deckId);
              }}
              onMouseLeave={() => {
                // End roll if cursor leaves while button is held down.
                endRoll(deckId);
              }}
              onTouchStart={(e) => {
                e.preventDefault(); // prevent synthetic mousedown
                if (rollDisabled) return;
                startRoll(deckId, beatCount);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                if (rollDisabled) return;
                endRoll(deckId);
              }}
              onClick={(e) => {
                // Suppress click in roll mode — mousedown/mouseup handle everything.
                e.preventDefault();
              }}
            >
              {beatCount}B
            </button>
          );
        }

        // Normal mode: click-to-toggle
        return (
          <button
            key={beatCount}
            type="button"
            className={[
              styles.loopBtn,
              isActive ? styles.loopBtnActive : '',
              !bpmIsSet ? styles.loopBtnDisabled : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => handleLoopButton(beatCount)}
            disabled={!bpmIsSet}
            aria-label={`${beatCount}-beat loop on Deck ${deckId}`}
            aria-pressed={isActive}
            title={bpmIsSet ? `${beatCount}-beat loop` : disabledTitle}
          >
            {beatCount}B
          </button>
        );
      })}

      {/* RELOOP — re-arm the last manual loop */}
      <button
        type="button"
        className={[styles.loopBtn, !lastManualLoop ? styles.loopBtnDisabled : ''].filter(Boolean).join(' ')}
        onClick={() => reloop(deckId)}
        disabled={!lastManualLoop}
        aria-label={`Reloop on Deck ${deckId}`}
        aria-pressed={loopActive && loopBeatCount === null}
        title="Re-arm the last manual loop"
      >
        RELOOP
      </button>

      {/* EXIT button — always clickable; dims when no loop is active */}
      <button
        type="button"
        className={[styles.exitBtn, !loopActive ? styles.exitBtnDim : '']
          .filter(Boolean)
          .join(' ')}
        onClick={handleExit}
        aria-label={`Exit loop on Deck ${deckId}`}
        title="Exit loop"
      >
        EXIT
      </button>
    </div>
  );
}

export default PadGridLoop;
