/**
 * PitchSlider.tsx — Stepped pitch slider snapping to PITCH_RATES values.
 *
 * The slider uses indices 0–7 as its internal value range, mapping to the
 * 8 discrete PITCH_RATES entries. This ensures clean integer stepping rather
 * than floating-point rounding issues with a 0.25-step slider.
 *
 * Reads pitchRate and pitchRateLocked from deckStore; dispatches setPitchRate
 * on change and shows "Rate locked by video" when the loaded video does not
 * support variable playback rates.
 *
 * STORY-009: Added rate display label, Reset to 1× button, and locked state.
 */
import { PITCH_RATES, DEFAULT_PITCH_RATE } from '../../constants/pitchRates';
import type { PitchRate } from '../../constants/pitchRates';
import { useDeck, useDeckStore } from '../../store/deckStore';
import styles from './PitchSlider.module.css';

interface PitchSliderProps {
  deckId: 'A' | 'B';
}

const MIN_INDEX = 0;
const MAX_INDEX = PITCH_RATES.length - 1; // 7
const DEFAULT_INDEX = PITCH_RATES.indexOf(DEFAULT_PITCH_RATE); // 3 (1×)

export function PitchSlider({ deckId }: PitchSliderProps) {
  const { pitchRate, pitchRateLocked } = useDeck(deckId);
  const { setPitchRate, setSynced } = useDeckStore();

  // Find the index of the current pitch rate in PITCH_RATES array
  const currentIndex = PITCH_RATES.indexOf(pitchRate as PitchRate);
  const safeIndex = currentIndex >= 0 ? currentIndex : DEFAULT_INDEX;

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (pitchRateLocked) return;
    const index = parseInt(event.target.value, 10);
    const rate = PITCH_RATES[index];
    if (rate !== undefined) {
      setPitchRate(deckId, rate);
      setSynced(deckId, false);
    }
  }

  function handleReset() {
    if (pitchRateLocked) return;
    setPitchRate(deckId, DEFAULT_PITCH_RATE);
    setSynced(deckId, false);
  }

  const rateLabel = `\u00d7${pitchRate.toFixed(2)}`;

  if (pitchRateLocked) {
    return (
      <div className={styles.wrapper}>
        <span className={styles.label}>PITCH</span>
        <div className={styles.lockedMessage}>Rate locked by video</div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>PITCH</span>
      <div className={styles.sliderRow}>
        <input
          type="range"
          className={styles.slider}
          min={MIN_INDEX}
          max={MAX_INDEX}
          step={1}
          value={safeIndex}
          onChange={handleChange}
          aria-label={`Deck ${deckId} pitch rate`}
          aria-valuemin={MIN_INDEX}
          aria-valuemax={MAX_INDEX}
          aria-valuenow={safeIndex}
          aria-valuetext={rateLabel}
        />
        <span className={styles.rateDisplay} aria-live="polite">{rateLabel}</span>
        <button
          type="button"
          className={styles.resetButton}
          onClick={handleReset}
          aria-label={`Reset Deck ${deckId} pitch to 1×`}
          title="Reset to 1×"
        >
          1×
        </button>
      </div>
      <div className={styles.endLabels}>
        <span>0.25×</span>
        <span>1×</span>
        <span>2×</span>
      </div>
    </div>
  );
}

export default PitchSlider;
