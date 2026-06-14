/**
 * PitchSlider.tsx — Pitch rate slider with dual-mode behaviour:
 *
 *  • MP3 decks:     continuous range 0.5–2.0 (step 0.001), reflecting exact
 *                   pitchRate values including SYNC-assigned rates (e.g. 1.2×).
 *  • YouTube decks: discrete 8-step slider over PITCH_RATES (indices 0–7),
 *                   matching the limits of the YouTube IFrame Player API.
 *
 * Reads pitchRate, sourceType, and pitchRateLocked from deckStore via narrow
 * selectors. Dispatches setPitchRate + setSynced(false) on every user change,
 * and on the 1× reset button.
 *
 * STORY-009: Added rate display label, Reset to 1× button, and locked state.
 * PHASE-4 Task 4.3: Continuous slider for MP3, discrete for YouTube.
 */
import { PITCH_RATES, DEFAULT_PITCH_RATE } from '../../constants/pitchRates';
import type { PitchRate } from '../../constants/pitchRates';
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import styles from './PitchSlider.module.css';

interface PitchSliderProps {
  deckId: 'A' | 'B';
}

// ── YouTube (discrete) constants ─────────────────────────────────────────────
const MIN_INDEX = 0;
const MAX_INDEX = PITCH_RATES.length - 1; // 7
const DEFAULT_INDEX = PITCH_RATES.indexOf(DEFAULT_PITCH_RATE); // 3 (1×)

// ── MP3 (continuous) constants ────────────────────────────────────────────────
const MP3_MIN = 0.5;
const MP3_MAX = 2.0;
const MP3_STEP = 0.001;

export function PitchSlider({ deckId }: PitchSliderProps) {
  const pitchRate = useDeckStore((s) => s.decks[deckId].pitchRate);
  const sourceType = useDeckStore((s) => s.decks[deckId].sourceType);
  const pitchRateLocked = useDeckStore((s) => s.decks[deckId].pitchRateLocked);
  const { setPitchRate, setSynced } = useDeckActions();

  // Rate locked — shown for YouTube restricted videos regardless of sourceType.
  if (pitchRateLocked) {
    return (
      <div className={styles.wrapper}>
        <span className={styles.label}>PITCH</span>
        <div className={styles.lockedMessage}>Rate locked by video</div>
      </div>
    );
  }

  // ── MP3 — continuous slider ───────────────────────────────────────────────
  if (sourceType === 'mp3') {
    // Display as ×multiplier to match the existing visual style.
    const rateLabel = `×${pitchRate.toFixed(3)}`;
    // Clamp the stored value into [0.5, 2.0] so the thumb always has a valid
    // position even if an out-of-range value is programmatically set.
    const clampedRate = Math.max(MP3_MIN, Math.min(MP3_MAX, pitchRate));

    function handleChangeMp3(event: React.ChangeEvent<HTMLInputElement>) {
      const rate = parseFloat(event.target.value);
      if (!isNaN(rate)) {
        setPitchRate(deckId, rate);
        setSynced(deckId, false);
      }
    }

    function handleResetMp3() {
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
            onChange={handleChangeMp3}
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
            onClick={handleResetMp3}
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

  // ── YouTube (or no track loaded) — discrete index-based slider ────────────
  const currentIndex = PITCH_RATES.indexOf(pitchRate as PitchRate);
  const safeIndex = currentIndex >= 0 ? currentIndex : DEFAULT_INDEX;
  const rateLabel = `×${pitchRate.toFixed(2)}`;

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
          aria-label={`Pitch for Deck ${deckId}`}
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
