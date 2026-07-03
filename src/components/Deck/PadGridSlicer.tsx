/**
 * PadGridSlicer.tsx — SLICER pad-mode panel, rendered inside PadGrid.
 *
 * A window-size selector (4/8/16/32 beats) above 8 slice pads in a 2x4 grid.
 * Each pad shows two visual states: a dim "follow" highlight on the slice
 * the playhead is naturally passing through (recomputed from the existing
 * currentTime poll — no new polling), and a bright "held" highlight on a
 * slice actively being pressed/looped (wins when both coincide, tracked via
 * local component state since the store's loopBeatCount is null for every
 * slice and can't disambiguate which pad is held).
 *
 * Holding a pad arms a loop over that slice (startSlice); releasing catches
 * playback up to where it would have been via the pre-existing, unchanged
 * endRoll action (built for ROLL mode in Phase 1).
 *
 * Both the 8 slice pads and the window-size row require a confirmed beat
 * grid (bpm + anchor) — disabled otherwise, same precondition and message
 * as LOOP mode's beat-count pads. The size row additionally disables while
 * a pad is held (switching windows mid-loop would be undefined behavior).
 */
import { useState } from 'react';
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import { SLICE_WINDOW_SIZES, sliceIndexAt } from '../../utils/slicer';
import styles from './PadGridSlicer.module.css';

const SLICE_COUNT = 8;

interface PadGridSlicerProps {
  deckId: 'A' | 'B';
}

export function PadGridSlicer({ deckId }: PadGridSlicerProps) {
  const bpm = useDeckStore((s) => s.decks[deckId].bpm);
  const anchor = useDeckStore((s) => s.decks[deckId].anchor);
  const currentTime = useDeckStore((s) => s.decks[deckId].currentTime);
  const sliceWindowBeats = useDeckStore((s) => s.decks[deckId].sliceWindowBeats);
  const { setSliceWindowBeats, startSlice, endRoll } = useDeckActions();

  const [heldIndex, setHeldIndex] = useState<number | null>(null);

  const gridConfirmed = bpm !== null && anchor !== null;
  const disabledTitle = 'Set BPM using Tap Tempo first';
  const followIndex = gridConfirmed ? sliceIndexAt({ bpm, anchor }, currentTime, sliceWindowBeats) : null;

  function handlePress(index: number) {
    if (!gridConfirmed) return;
    setHeldIndex(index);
    startSlice(deckId, index);
  }

  function handleRelease() {
    if (heldIndex === null) return;
    setHeldIndex(null);
    endRoll(deckId);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.sizeRow}>
        {SLICE_WINDOW_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            className={[styles.sizeBtn, sliceWindowBeats === size ? styles.sizeBtnActive : '']
              .filter(Boolean)
              .join(' ')}
            onClick={() => setSliceWindowBeats(deckId, size)}
            disabled={!gridConfirmed || heldIndex !== null}
            aria-pressed={sliceWindowBeats === size}
            aria-label={`Set Slicer window to ${size} beats on Deck ${deckId}`}
            title={gridConfirmed ? `${size}-beat window` : disabledTitle}
          >
            {size}
          </button>
        ))}
      </div>
      <div className={styles.pads}>
        {Array.from({ length: SLICE_COUNT }, (_, index) => {
          const isHeld = heldIndex === index;
          const isFollowed = followIndex === index;
          return (
            <button
              key={index}
              type="button"
              className={[
                styles.pad,
                isHeld ? styles.padHeld : isFollowed ? styles.padFollow : '',
                !gridConfirmed ? styles.padDisabled : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={!gridConfirmed}
              aria-label={`Slice ${index + 1} on Deck ${deckId}`}
              aria-pressed={isHeld}
              title={gridConfirmed ? `Hold to loop slice ${index + 1}` : disabledTitle}
              onMouseDown={() => handlePress(index)}
              onMouseUp={handleRelease}
              onMouseLeave={handleRelease}
              onTouchStart={(e) => {
                e.preventDefault();
                handlePress(index);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleRelease();
              }}
              onClick={(e) => {
                // Suppress click — mousedown/mouseup handle everything.
                e.preventDefault();
              }}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PadGridSlicer;
