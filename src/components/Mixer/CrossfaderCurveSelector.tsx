/**
 * CrossfaderCurveSelector — 3-button segmented control for choosing the
 * crossfader curve shape (Smooth / Linear / Sharp).
 *
 * Reads `crossfaderCurve` from mixerStore and calls `setCrossfaderCurve`
 * on click. Uses radiogroup/radio ARIA pattern for accessibility.
 *
 * STORY-006
 */
import { useMixerStore } from '../../store/mixerStore';
import type { CrossfaderCurve } from '../../types/mixer';
import styles from './CrossfaderCurveSelector.module.css';

const CURVES: { value: CrossfaderCurve; label: string; fullName: string }[] = [
  { value: 'smooth', label: 'S', fullName: 'Smooth curve' },
  { value: 'linear', label: 'L', fullName: 'Linear curve' },
  { value: 'sharp',  label: 'X', fullName: 'Sharp cut curve' },
];

export function CrossfaderCurveSelector() {
  const currentCurve = useMixerStore((s) => s.crossfaderCurve);
  const setCrossfaderCurve = useMixerStore((s) => s.setCrossfaderCurve);

  return (
    <div
      role="radiogroup"
      aria-label="Crossfader curve"
      className={styles.curveSelector}
    >
      {CURVES.map((c) => {
        const isActive = c.value === currentCurve;
        return (
          <button
            key={c.value}
            role="radio"
            aria-checked={isActive}
            aria-label={c.fullName}
            title={c.fullName}
            className={`${styles.curveButton} ${isActive ? styles.curveButtonActive : ''}`}
            onClick={() => setCrossfaderCurve(c.value)}
            type="button"
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

export default CrossfaderCurveSelector;
