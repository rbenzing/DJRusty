/**
 * HeadphoneMixKnob — slider control blending headphone CUE vs. program mix.
 *
 * Reads headphoneMix from settingsStore and calls setHeadphoneMix on change.
 * 0 = full CUE (cued deck(s) only), 1 = full program (main mix only).
 */
import { useSettingsStore } from '../../store/settingsStore';
import styles from './HeadphoneMixKnob.module.css';

export function HeadphoneMixKnob() {
  const headphoneMix = useSettingsStore((s) => s.headphoneMix);
  const setHeadphoneMix = useSettingsStore((s) => s.setHeadphoneMix);

  const valueText =
    headphoneMix <= 0.05 ? 'Full CUE'
    : headphoneMix >= 0.95 ? 'Full program'
    : `${Math.round(headphoneMix * 100)}% program`;

  return (
    <div className={styles.container}>
      <label className={styles.label} htmlFor="headphone-mix-knob">
        CUE / MIX
      </label>
      <input
        id="headphone-mix-knob"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={headphoneMix}
        onChange={(e) => setHeadphoneMix(Number(e.target.value))}
        className={styles.slider}
        aria-label="Headphone CUE/MIX blend"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={headphoneMix}
        aria-valuetext={valueText}
      />
    </div>
  );
}

export default HeadphoneMixKnob;
