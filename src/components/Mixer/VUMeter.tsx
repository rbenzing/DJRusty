import { useMemo } from 'react';
import { useDeck } from '../../store/deckStore';
import styles from './VUMeter.module.css';

interface VUMeterProps {
  deckId: 'A' | 'B';
}

const SEGMENT_COUNT = 12;

/**
 * Returns how many segments (0–12) should be lit based on a volume level 0–100.
 *
 * Segments 1–8 are green, 9–10 yellow, 11–12 red.
 * When the deck is not playing, all segments remain dark.
 *
 * The mapping uses the stored deck volume so that when the crossfader moves
 * the meter reflects the actual output volume going to the player.
 */
function segmentsLit(volume: number, isPlaying: boolean): number {
  if (!isPlaying) return 0;
  // Map 0–100 volume to 0–12 segments with a slight curve:
  // below 5% → 0 segments; linear from 5–100% → 1–12 segments
  if (volume < 5) return 0;
  return Math.min(SEGMENT_COUNT, Math.ceil((volume / 100) * SEGMENT_COUNT));
}

function segmentClass(index: number): string {
  // index is 0-based from top (highest = index 0)
  // Segments counted from bottom so invert: lit segment number = SEGMENT_COUNT - index
  const segNumber = SEGMENT_COUNT - index; // 12 at top, 1 at bottom
  if (segNumber >= 11) return styles.segmentPeak ?? '';   // 11–12
  if (segNumber >= 9) return styles.segmentMid ?? '';     // 9–10
  return styles.segmentLow ?? '';                          // 1–8
}

/**
 * VUMeter — decorative 12-segment level display for a single deck channel.
 *
 * Visual-only: derives display level from the deck's current volume value in
 * the store rather than audio analysis (which is impossible via IFrame API due
 * to CORS constraints).
 *
 * All segments animate with a CSS transition when values change.
 * The component is aria-hidden as it is purely decorative.
 */
export function VUMeter({ deckId }: VUMeterProps) {
  const deck = useDeck(deckId);
  const isPlaying = deck.playbackState === 'playing';

  // Use the deck's volume (updated by mixerStore when crossfader/channel faders change)
  const litCount = useMemo(
    () => segmentsLit(deck.volume, isPlaying),
    [deck.volume, isPlaying],
  );

  const deckClass = deckId === 'A' ? styles.meterA : styles.meterB;

  return (
    <div
      className={`${styles.vuMeter} ${deckClass}`}
      aria-hidden="true"
      title={`Deck ${deckId} level`}
    >
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => {
        // i=0 is the top segment (peak), i=11 is the bottom (low)
        const segNumber = SEGMENT_COUNT - i; // 12 at top, 1 at bottom
        const isLit = segNumber <= litCount;
        const colorClass = isLit ? segmentClass(i) : styles.segmentInactive;

        return (
          <div
            key={i}
            className={`${styles.segment} ${colorClass}`}
          />
        );
      })}
    </div>
  );
}

export default VUMeter;
