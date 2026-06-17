/**
 * PitchSlider.tsx — Continuous pitch rate slider (0.5–2.0×).
 *
 * Reads pitchRate from deckStore via narrow selector.
 * Dispatches setPitchRate + setSynced(false) on every user change,
 * and on the 1× reset button.
 *
 * STORY-009: Added rate display label, Reset to 1× button.
 * PHASE-4 Task 4.3: Continuous slider for MP3 backend.
 */
import { DEFAULT_PITCH_RATE } from '../../constants/pitchRates';
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import styles from './PitchSlider.module.css';

interface PitchSliderProps {
  deckId: 'A' | 'B';
}

// ── Continuous constants ───────────────────────────────────────────────────────
const MP3_MIN = 0.5;
const MP3_MAX = 2.0;
const MP3_STEP = 0.001;

export function PitchSlider({ deckId }: PitchSliderProps) {
  const pitchRate = useDeckStore((s) => s.decks[deckId].pitchRate);
  const { setPitchRate, setSynced } = useDeckActions();

  // Display as ×multiplier to match the existing visual style.
  const rateLabel = `×${pitchRate.toFixed(3)}`;
  // Clamp the stored value into [0.5, 2.0] so the thumb always has a valid
  // position even if an out-of-range value is programmatically set.
  const clampedRate = Math.max(MP3_MIN, Math.min(MP3_MAX, pitchRate));

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const rate = parseFloat(event.target.value);
    if (!isNaN(rate)) {
      setPitchRate(deckId, rate);
      setSynced(deckId, false);
    }
  }

  function handleReset() {
    setPitchRate(deckId, DEFAULT_PITCH_RATE);
    setSynced(deckId, false);
  }

  return (
    <div className={styles.wrapper}>
      <span className={styles.label}>PITCH</span>
      <div className={styles.sliderRow}>
        <input
          type="range"
          className={styles.slider}
          min={MP3_MIN}
          max={MP3_MAX}
          step={MP3_STEP}
          value={clampedRate}
          onChange={handleChange}
          aria-label={`Pitch for Deck ${deckId}`}
          aria-valuemin={MP3_MIN}
          aria-valuemax={MP3_MAX}
          aria-valuenow={clampedRate}
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
        <span>0.5×</span>
        <span>1×</span>
        <span>2×</span>
      </div>
    </div>
  );
}

export default PitchSlider;
