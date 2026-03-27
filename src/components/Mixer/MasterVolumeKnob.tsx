/**
 * MasterVolumeKnob — compact slider control for master output volume.
 *
 * Reads masterVolume from settingsStore and calls setMasterVolume on change.
 * Range: 0–100 (default 100).
 *
 * STORY-DJ-006
 */
import { useSettingsStore } from '../../store/settingsStore';
import styles from './MasterVolumeKnob.module.css';

export function MasterVolumeKnob() {
  const masterVolume = useSettingsStore((s) => s.masterVolume);
  const setMasterVolume = useSettingsStore((s) => s.setMasterVolume);

  return (
    <div className={styles.container}>
      <label className={styles.label} htmlFor="master-volume-knob">
        MASTER
      </label>
      <input
        id="master-volume-knob"
        type="range"
        min={0}
        max={100}
        step={1}
        value={masterVolume}
        onChange={(e) => setMasterVolume(Number(e.target.value))}
        className={styles.slider}
        aria-label="Master volume"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={masterVolume}
        aria-valuetext={`${masterVolume}%`}
      />
      <span className={styles.value} aria-hidden="true">
        {masterVolume}
      </span>
    </div>
  );
}

export default MasterVolumeKnob;
