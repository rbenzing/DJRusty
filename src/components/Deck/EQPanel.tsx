/**
 * EQPanel.tsx — Visual-only EQ knobs (Low/Mid/High).
 *
 * These knobs are purely visual — they do not affect audio.
 * YouTube embeds play inside a cross-origin iframe, which prevents the
 * browser from accessing the audio stream via the Web Audio API.
 * Values are stored in deckStore (eqLow, eqMid, eqHigh) and are ready
 * for a future direct-audio playback mode.
 *
 * Interaction: vertical mouse drag (delta Y controls rotation).
 * Range: -12 to +12 dB (mapped to -135° to +135° rotation).
 * Center (0 dB) = 0° (12 o'clock position).
 * Double-click resets to 0.
 *
 * Each knob has title="Visual only — cross-origin iframe audio cannot be processed".
 */
import { useCallback, useEffect, useRef } from 'react';
import { useDeck, useDeckStore } from '../../store/deckStore';
import styles from './EQPanel.module.css';

interface EQPanelProps {
  deckId: 'A' | 'B';
}

type EqBand = 'eqLow' | 'eqMid' | 'eqHigh';

const EQ_BANDS: { band: EqBand; label: string }[] = [
  { band: 'eqLow', label: 'BASS' },
  { band: 'eqMid', label: 'MID' },
  { band: 'eqHigh', label: 'TREBLE' },
];

const DB_MIN = -12;
const DB_MAX = 12;
const DEG_MIN = -135;
const DEG_MAX = 135;

/** Map a dB value to a CSS rotation angle in degrees. */
function dbToDeg(db: number): number {
  const ratio = (db - DB_MIN) / (DB_MAX - DB_MIN);
  return DEG_MIN + ratio * (DEG_MAX - DEG_MIN);
}

/** Clamp a value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface EqKnobProps {
  deckId: 'A' | 'B';
  band: EqBand;
  label: string;
  value: number;
  onChange: (band: EqBand, value: number) => void;
}

function EqKnob({ deckId, band, label, value, onChange }: EqKnobProps) {
  const dragStartY = useRef<number | null>(null);
  const dragStartValue = useRef<number>(value);
  /** Cleanup fn to remove drag listeners if the component unmounts mid-drag. */
  const removeDragListeners = useRef<(() => void) | null>(null);

  // Remove any lingering document listeners on unmount (e.g. component hidden
  // while user is mid-drag).
  useEffect(() => {
    return () => {
      removeDragListeners.current?.();
    };
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    dragStartY.current = event.clientY;
    dragStartValue.current = value;

    function onMouseMove(moveEvent: MouseEvent) {
      if (dragStartY.current === null) return;
      // Each 1px upward = +0.1 dB increase (drag up = increase)
      const deltaY = dragStartY.current - moveEvent.clientY;
      const deltaDb = deltaY * 0.15;
      const newValue = clamp(dragStartValue.current + deltaDb, DB_MIN, DB_MAX);
      onChange(band, parseFloat(newValue.toFixed(1)));
    }

    function onMouseUp() {
      dragStartY.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      removeDragListeners.current = null;
    }

    // If a previous drag somehow didn't complete (rapid re-press), clean up
    // before attaching new listeners to prevent accumulation.
    removeDragListeners.current?.();

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    removeDragListeners.current = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [band, value, onChange]);

  function handleDoubleClick() {
    onChange(band, 0);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onChange(band, clamp(value + 1, DB_MIN, DB_MAX));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      onChange(band, clamp(value - 1, DB_MIN, DB_MAX));
    }
  }

  const angle = dbToDeg(value);
  const knobStyle = { '--knob-angle': `${angle.toFixed(1)}deg` } as React.CSSProperties;
  const valueLabel = value === 0 ? '0 dB' : `${value > 0 ? '+' : ''}${value.toFixed(1)} dB`;

  return (
    <div className={styles.knobGroup}>
      <div
        className={styles.knob}
        style={knobStyle}
        role="slider"
        tabIndex={0}
        aria-label={`Deck ${deckId} ${label} EQ: ${valueLabel} (visual only)`}
        aria-valuemin={DB_MIN}
        aria-valuemax={DB_MAX}
        aria-valuenow={value}
        aria-valuetext={valueLabel}
        title="Visual only — cross-origin iframe audio cannot be processed"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.indicator} />
      </div>
      <span className={styles.knobLabel}>{label}</span>
    </div>
  );
}

export function EQPanel({ deckId }: EQPanelProps) {
  const deck = useDeck(deckId);
  const { setEq } = useDeckStore();

  const handleChange = useCallback((band: EqBand, value: number) => {
    setEq(deckId, band, value);
  }, [deckId, setEq]);

  const eqValues: Record<EqBand, number> = {
    eqLow: deck.eqLow,
    eqMid: deck.eqMid,
    eqHigh: deck.eqHigh,
  };

  return (
    <div className={styles.panel}>
      <div className={styles.headerRow}>
        <span className={styles.panelLabel}>EQ</span>
        <span
          className={styles.v1Badge}
          title="YouTube embeds play inside a cross-origin iframe, which prevents the browser from accessing the audio stream. EQ knobs are visual only — values are stored and ready for a future direct-audio playback mode."
        >
          Visual Only
        </span>
      </div>
      <div className={styles.knobsRow}>
        {EQ_BANDS.map(({ band, label }) => (
          <EqKnob
            key={band}
            deckId={deckId}
            band={band}
            label={label}
            value={eqValues[band]}
            onChange={handleChange}
          />
        ))}
      </div>
    </div>
  );
}

export default EQPanel;
