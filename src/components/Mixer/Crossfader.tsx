import { useCallback } from 'react';
import { useMixerStore } from '../../store/mixerStore';
import styles from './Crossfader.module.css';

/**
 * Crossfader — horizontal slider mapping [0, 1] across the mixer store.
 *
 * Position 0.0 = full Deck A, 0.5 = equal-power centre, 1.0 = full Deck B.
 * On change the store applies the constant-power curve and pushes composite
 * volumes to the deck store so the IFrame players update within one event loop tick.
 */
export function Crossfader() {
  const position = useMixerStore((s) => s.crossfaderPosition);
  const setCrossfaderPosition = useMixerStore((s) => s.setCrossfaderPosition);

  // Convert internal [0, 1] range to slider's [0, 100] integer range for
  // `<input type="range">` which only supports integer step by default.
  const sliderValue = Math.round(position * 100);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseInt(e.target.value, 10);
      setCrossfaderPosition(raw / 100);
    },
    [setCrossfaderPosition],
  );

  // Human-readable description for aria-valuetext
  let valueText: string;
  if (sliderValue === 0) {
    valueText = 'Full Deck A';
  } else if (sliderValue === 100) {
    valueText = 'Full Deck B';
  } else if (sliderValue === 50) {
    valueText = 'Centre — equal power';
  } else if (sliderValue < 50) {
    valueText = `${100 - sliderValue}% Deck A`;
  } else {
    valueText = `${sliderValue}% Deck B`;
  }

  return (
    <div className={styles.crossfaderContainer}>
      <div className={styles.labels}>
        <span className={styles.labelA}>A</span>
        <span className={styles.labelB}>B</span>
      </div>

      <div className={styles.trackWrapper}>
        {/* Decorative centre notch */}
        <div className={styles.centreNotch} aria-hidden="true" />

        <input
          type="range"
          className={styles.slider}
          min={0}
          max={100}
          step={1}
          value={sliderValue}
          onChange={handleChange}
          aria-label="Crossfader: Deck A to Deck B"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={sliderValue}
          aria-valuetext={valueText}
        />
      </div>

      <div className={styles.sublabels}>
        <span className={styles.sublabelA}>FULL A</span>
        <span className={styles.sublabelCenter}>CENTER</span>
        <span className={styles.sublabelB}>FULL B</span>
      </div>
    </div>
  );
}

export default Crossfader;
