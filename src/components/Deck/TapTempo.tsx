/**
 * TapTempo.tsx — TAP button that calculates BPM from tap intervals.
 *
 * Uses TapTempoCalculator to compute average BPM from up to 8 taps.
 * Resets automatically if >3 seconds elapse between taps.
 * Updates deckStore.bpm after each tap that yields a result.
 *
 * A brief visual flash on the button provides tactile feedback on each tap.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDeckStore } from '../../store/deckStore';
import { TapTempoCalculator } from '../../utils/tapTempo';
import { BpmDisplay } from './BpmDisplay';
import styles from './TapTempo.module.css';

interface TapTempoProps {
  deckId: 'A' | 'B';
}

export function TapTempo({ deckId }: TapTempoProps) {
  // Calculator instance persists for the lifetime of the component
  const calculatorRef = useRef(new TapTempoCalculator());
  const [localBpm, setLocalBpm] = useState<number | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { setBpm } = useDeckStore();

  // Cancel any pending flash timer on unmount to prevent state updates on
  // an unmounted component and to avoid timer leaks.
  useEffect(() => {
    return () => {
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  const handleTap = useCallback(() => {
    const bpm = calculatorRef.current.tap();

    // Flash the button on every tap for visual feedback
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }
    setIsFlashing(true);
    flashTimerRef.current = setTimeout(() => setIsFlashing(false), 120);

    if (bpm !== null) {
      setLocalBpm(bpm);
      setBpm(deckId, bpm);
    }
  }, [deckId, setBpm]);

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>TAP BPM</span>
      <div className={styles.rightGroup}>
        <BpmDisplay bpm={localBpm} />
        <button
          type="button"
          className={`${styles.tapBtn} ${isFlashing ? styles.tapBtnFlash : ''}`}
          onClick={handleTap}
          aria-label="Tap to calculate BPM"
          title="Tap to the beat (needs 2+ taps to calculate BPM; resets after 3s inactivity)"
        >
          TAP
        </button>
      </div>
    </div>
  );
}

export default TapTempo;
