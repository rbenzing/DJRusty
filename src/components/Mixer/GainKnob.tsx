/**
 * GainKnob.tsx — Per-deck channel input trim (GAIN), rendered in the mixer strip.
 * Drag up/down to change; double-click resets to 0 dB; Arrow keys step ±1 dB.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useDeck, useDeckActions } from '../../store/deckStore';
import styles from './GainKnob.module.css';

const DB_MIN = -24;
const DB_MAX = 12;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

interface GainKnobProps {
  deckId: 'A' | 'B';
}

export function GainKnob({ deckId }: GainKnobProps) {
  const value = useDeck(deckId).gainDb;
  const { setGain } = useDeckActions();
  const dragStartY = useRef<number | null>(null);
  const dragStartValue = useRef(value);
  const removeDrag = useRef<(() => void) | null>(null);

  useEffect(() => () => { removeDrag.current?.(); }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartValue.current = value;

    function onMove(ev: MouseEvent) {
      if (dragStartY.current === null) return;
      const deltaDb = (dragStartY.current - ev.clientY) * 0.2;
      setGain(deckId, parseFloat(clamp(dragStartValue.current + deltaDb, DB_MIN, DB_MAX).toFixed(1)));
    }
    function onUp() {
      dragStartY.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      removeDrag.current = null;
    }
    removeDrag.current?.();
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    removeDrag.current = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [deckId, value, setGain]);

  // -24 dB → -135°, 0 dB → 0°, +12 dB → +135°
  const ratio = (value - DB_MIN) / (DB_MAX - DB_MIN);
  const angle = -135 + ratio * 270;
  const valueLabel = value === 0 ? '0 dB' : `${value > 0 ? '+' : ''}${value.toFixed(1)} dB`;

  return (
    <div className={styles.wrap} data-deck={deckId.toLowerCase()}>
      <div
        className={styles.knob}
        style={{ '--knob-angle': `${angle.toFixed(1)}deg` } as React.CSSProperties}
        role="slider"
        tabIndex={0}
        aria-label={`Deck ${deckId} gain: ${valueLabel}`}
        aria-valuemin={DB_MIN}
        aria-valuemax={DB_MAX}
        aria-valuenow={value}
        aria-valuetext={valueLabel}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => setGain(deckId, 0)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp')   { e.preventDefault(); setGain(deckId, clamp(value + 1, DB_MIN, DB_MAX)); }
          if (e.key === 'ArrowDown') { e.preventDefault(); setGain(deckId, clamp(value - 1, DB_MIN, DB_MAX)); }
        }}
      >
        <div className={styles.indicator} />
      </div>
      <span className={styles.label}>{deckId}</span>
    </div>
  );
}

export default GainKnob;
