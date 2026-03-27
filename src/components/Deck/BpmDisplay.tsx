/**
 * BpmDisplay.tsx — LCD-style BPM readout.
 *
 * Shows the current BPM as a monospace number, or "---" when not set.
 * Uses an <output> element for semantic correctness (computed value display).
 */
import styles from './BpmDisplay.module.css';

interface BpmDisplayProps {
  /** BPM value from deckStore, or null if not yet set. */
  bpm: number | null;
}

export function BpmDisplay({ bpm }: BpmDisplayProps) {
  const isSet = bpm !== null;
  const displayText = isSet ? String(bpm) : '---';

  return (
    <output
      className={`${styles.bpmDisplay} ${isSet ? '' : styles.bpmDisplayUnset}`}
      aria-label={isSet ? `BPM: ${bpm}` : 'BPM not set'}
    >
      {displayText}
    </output>
  );
}

export default BpmDisplay;
