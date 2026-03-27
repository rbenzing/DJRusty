/**
 * LoopControls.tsx — Beat-synced loop buttons for a single deck.
 *
 * Renders four loop-length buttons (1, 2, 4, 8 beats), an EXIT button, and
 * a ROLL toggle button.
 *
 * Normal mode (rollMode === false):
 *   Pressing a loop button activates/deactivates a beat loop.
 *   EXIT clears any active loop.
 *
 * Roll mode (rollMode === true):
 *   Hold (mousedown/touchstart) a loop button → starts a loop roll for that beat count.
 *   Release (mouseup/touchend/mouseleave) → ends the roll and seeks to computed position.
 *   Only works while the deck is playing and BPM is set.
 *
 * The active loop button is highlighted using loopBeatCount from the store.
 * Pressing EXIT sets loopActive = false, clearing the loop regardless of mode.
 */
import { useDeck, useDeckStore } from '../../store/deckStore';
import styles from './LoopControls.module.css';

/** Beat counts available as loop lengths. */
const BEAT_COUNTS = [1, 2, 4, 8] as const;
type BeatCount = (typeof BEAT_COUNTS)[number];

interface LoopControlsProps {
  deckId: 'A' | 'B';
}

export function LoopControls({ deckId }: LoopControlsProps) {
  const { bpm, loopActive, loopBeatCount, rollMode, playbackState } = useDeck(deckId);
  const { activateLoopBeat, deactivateLoop, setRollMode, startRoll, endRoll } = useDeckStore();

  const bpmIsSet = bpm !== null;
  const isPlaying = playbackState === 'playing';
  const disabledTitle = 'Set BPM using Tap Tempo first';
  const notPlayingTitle = 'Start playback to use loop roll';

  function handleLoopButton(beatCount: BeatCount) {
    if (!bpmIsSet) return;
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

  function handleRollToggle() {
    setRollMode(deckId, !rollMode);
  }

  // Roll button disabled when BPM not set or deck not playing.
  const rollDisabled = !bpmIsSet || !isPlaying;

  function getRollButtonTitle(beatCount: BeatCount): string {
    if (!bpmIsSet) return disabledTitle;
    if (!isPlaying) return notPlayingTitle;
    return `${beatCount}-beat loop roll`;
  }

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>LOOPS</span>
      <div className={styles.buttons}>
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

        {/* ROLL toggle button — amber accent when active */}
        <button
          type="button"
          className={[styles.rollBtn, rollMode ? styles.rollBtnActive : '']
            .filter(Boolean)
            .join(' ')}
          onClick={handleRollToggle}
          aria-label={`Loop roll mode on Deck ${deckId}`}
          aria-pressed={rollMode}
          title={rollMode ? 'Loop roll mode on' : 'Loop roll mode off'}
        >
          ROLL
        </button>
      </div>
    </div>
  );
}

export default LoopControls;
