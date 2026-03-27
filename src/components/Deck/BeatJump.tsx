/**
 * BeatJump.tsx — Beat jump controls for a single deck.
 *
 * Renders a row of beat-size selector buttons (1/2, 1, 2, 4, 8, 16) and
 * directional jump buttons (back / forward). Jumping seeks the player by
 * (selectedBeats / bpm) * 60 seconds, clamped to [0, duration].
 *
 * Buttons are disabled when BPM has not been set via tap-tempo or when
 * no track is loaded.
 */
import { useDeck, useDeckStore } from '../../store/deckStore';
import { playerRegistry } from '../../services/playerRegistry';
import { BEAT_JUMP_SIZES, calculateJumpSeconds, clampTime } from '../../utils/beatJump';
import styles from './BeatJump.module.css';

interface BeatJumpProps {
  deckId: 'A' | 'B';
}

/**
 * Returns the display label for a given beat jump size.
 * 0.5 is shown as "1/2"; all other sizes render as their numeric string.
 */
function getSizeLabel(size: number): string {
  return size === 0.5 ? '1/2' : String(size);
}

export function BeatJump({ deckId }: BeatJumpProps) {
  const { bpm, currentTime, duration, beatJumpSize, trackId, playerReady } = useDeck(deckId);
  const { setBeatJumpSize } = useDeckStore();

  const isDisabled = !trackId || !bpm || bpm === 0 || !playerReady;

  function handleBackJump() {
    if (isDisabled || bpm === null || bpm === 0) return;
    const jumpSec = calculateJumpSeconds(beatJumpSize, bpm);
    const newTime = clampTime(currentTime - jumpSec, duration);
    playerRegistry.get(deckId)?.seekTo(newTime, true);
  }

  function handleForwardJump() {
    if (isDisabled || bpm === null || bpm === 0) return;
    const jumpSec = calculateJumpSeconds(beatJumpSize, bpm);
    const newTime = clampTime(currentTime + jumpSec, duration);
    playerRegistry.get(deckId)?.seekTo(newTime, true);
  }

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>BEAT JUMP</span>
      <div className={styles.buttons}>
        {/* Back jump button */}
        <button
          type="button"
          className={[
            styles.jumpBtn,
            isDisabled ? styles.jumpBtnDisabled : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={handleBackJump}
          disabled={isDisabled}
          aria-label={`Jump backward on Deck ${deckId}`}
        >
          &lt;
        </button>

        {/* Size selector buttons */}
        {BEAT_JUMP_SIZES.map((size) => {
          const isSelected = beatJumpSize === size;
          return (
            <button
              key={size}
              type="button"
              className={[
                styles.sizeBtn,
                isSelected ? styles.sizeBtnActive : '',
                isDisabled ? styles.sizeBtnDisabled : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setBeatJumpSize(deckId, size)}
              disabled={isDisabled}
              aria-label={`Select ${getSizeLabel(size)}-beat jump size on Deck ${deckId}`}
              aria-pressed={isSelected}
            >
              {getSizeLabel(size)}
            </button>
          );
        })}

        {/* Forward jump button */}
        <button
          type="button"
          className={[
            styles.jumpBtn,
            isDisabled ? styles.jumpBtnDisabled : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={handleForwardJump}
          disabled={isDisabled}
          aria-label={`Jump forward on Deck ${deckId}`}
        >
          &gt;
        </button>
      </div>
    </div>
  );
}

export default BeatJump;
