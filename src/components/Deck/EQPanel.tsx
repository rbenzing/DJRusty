/**
 * EQPanel.tsx — EQ knobs (High/Mid/Low) with kill switches and filter sweep.
 *
 * For MP3 tracks: fully functional — drives BiquadFilterNodes in the Web Audio chain.
 * For YouTube tracks: visual-only (cross-origin iframe prevents audio access).
 *
 * Controls:
 *   - Three rotary knobs: BASS / MID / TREBLE (−12 to +12 dB, double-click resets)
 *   - Kill button per band: instantly silences that frequency band
 *   - Filter sweep knob: left = HPF (cuts bass), center = flat, right = LPF (cuts treble)
 *
 * Drag interaction: drag up = increase value, drag down = decrease.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useDeck, useDeckStore } from '../../store/deckStore';
import styles from './EQPanel.module.css';

interface EQPanelProps {
  deckId: 'A' | 'B';
}

type EqBand = 'eqLow' | 'eqMid' | 'eqHigh';

const EQ_BANDS: { band: EqBand; label: string; kill: 'low' | 'mid' | 'high' }[] = [
  { band: 'eqLow',  label: 'BASS',   kill: 'low'  },
  { band: 'eqMid',  label: 'MID',    kill: 'mid'  },
  { band: 'eqHigh', label: 'TREBLE', kill: 'high' },
];

const DB_MIN = -12;
const DB_MAX = 12;
const DEG_MIN = -135;
const DEG_MAX = 135;

function dbToDeg(db: number): number {
  const ratio = (db - DB_MIN) / (DB_MAX - DB_MIN);
  return DEG_MIN + ratio * (DEG_MAX - DEG_MIN);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ── Rotary Knob ────────────────────────────────────────────────────────────

interface EqKnobProps {
  deckId: 'A' | 'B';
  band: EqBand;
  killBand: 'low' | 'mid' | 'high';
  label: string;
  value: number;
  killed: boolean;
  onChange: (band: EqBand, value: number) => void;
  onKillToggle: (band: 'low' | 'mid' | 'high') => void;
}

function EqKnob({ deckId, band, killBand, label, value, killed, onChange, onKillToggle }: EqKnobProps) {
  const dragStartY = useRef<number | null>(null);
  const dragStartValue = useRef<number>(value);
  const removeDragListeners = useRef<(() => void) | null>(null);

  useEffect(() => () => { removeDragListeners.current?.(); }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    dragStartY.current = event.clientY;
    dragStartValue.current = value;

    function onMouseMove(e: MouseEvent) {
      if (dragStartY.current === null) return;
      const deltaDb = (dragStartY.current - e.clientY) * 0.15;
      onChange(band, parseFloat(clamp(dragStartValue.current + deltaDb, DB_MIN, DB_MAX).toFixed(1)));
    }
    function onMouseUp() {
      dragStartY.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      removeDragListeners.current = null;
    }
    removeDragListeners.current?.();
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    removeDragListeners.current = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [band, value, onChange]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowUp')   { e.preventDefault(); onChange(band, clamp(value + 1, DB_MIN, DB_MAX)); }
    if (e.key === 'ArrowDown') { e.preventDefault(); onChange(band, clamp(value - 1, DB_MIN, DB_MAX)); }
  }

  const angle = dbToDeg(value);
  const valueLabel = value === 0 ? '0 dB' : `${value > 0 ? '+' : ''}${value.toFixed(1)} dB`;

  return (
    <div className={`${styles.knobGroup} ${killed ? styles.knobGroupKilled : ''}`}>
      {/* Rotary knob */}
      <div
        className={styles.knob}
        style={{ '--knob-angle': `${angle.toFixed(1)}deg` } as React.CSSProperties}
        role="slider"
        tabIndex={0}
        aria-label={`Deck ${deckId} ${label} EQ: ${valueLabel}`}
        aria-valuemin={DB_MIN}
        aria-valuemax={DB_MAX}
        aria-valuenow={value}
        aria-valuetext={valueLabel}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onChange(band, 0)}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.indicator} />
      </div>
      <span className={styles.knobLabel}>{label}</span>
      {/* Kill button */}
      <button
        type="button"
        className={`${styles.killBtn} ${killed ? styles.killBtnActive : ''}`}
        aria-label={`Kill ${label} band`}
        aria-pressed={killed}
        onClick={() => onKillToggle(killBand)}
        title={`Kill ${label} (instantly silence this band)`}
      >
        K
      </button>
    </div>
  );
}

// ── Filter Sweep Knob ─────────────────────────────────────────────────────

interface FilterSweepProps {
  deckId: 'A' | 'B';
  value: number;
  onChange: (v: number) => void;
}

function FilterSweepKnob({ deckId, value, onChange }: FilterSweepProps) {
  const dragStartY = useRef<number | null>(null);
  const dragStartValue = useRef<number>(value);
  const removeDragListeners = useRef<(() => void) | null>(null);

  useEffect(() => () => { removeDragListeners.current?.(); }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartValue.current = value;

    function onMouseMove(ev: MouseEvent) {
      if (dragStartY.current === null) return;
      const delta = (dragStartY.current - ev.clientY) * 0.01;
      onChange(clamp(dragStartValue.current + delta, -1, 1));
    }
    function onMouseUp() {
      dragStartY.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      removeDragListeners.current = null;
    }
    removeDragListeners.current?.();
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    removeDragListeners.current = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [value, onChange]);

  // -1 → -135°, 0 → 0°, 1 → +135°
  const angle = value * 135;
  const label = value < -0.05 ? 'HPF' : value > 0.05 ? 'LPF' : 'FLAT';

  return (
    <div className={styles.sweepGroup}>
      <div
        className={`${styles.knob} ${styles.sweepKnob}`}
        style={{ '--knob-angle': `${angle.toFixed(1)}deg` } as React.CSSProperties}
        role="slider"
        tabIndex={0}
        aria-label={`Deck ${deckId} filter sweep: ${label}`}
        aria-valuemin={-1}
        aria-valuemax={1}
        aria-valuenow={value}
        aria-valuetext={label}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onChange(0)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp')   { e.preventDefault(); onChange(clamp(value + 0.05, -1, 1)); }
          if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(value - 0.05, -1, 1)); }
        }}
        title="Filter sweep: drag up for LPF (cuts highs), drag down for HPF (cuts bass)"
      >
        <div className={styles.indicator} />
      </div>
      <span className={styles.knobLabel}>FILTER</span>
      <span className={styles.sweepLabel}>{label}</span>
    </div>
  );
}

// ── Main EQPanel ───────────────────────────────────────────────────────────

export function EQPanel({ deckId }: EQPanelProps) {
  const deck = useDeck(deckId);
  const store = useDeckStore();

  const handleChange = useCallback((band: EqBand, value: number) => {
    store.setEq(deckId, band, value);
  }, [deckId, store]);

  const handleKillToggle = useCallback((band: 'low' | 'mid' | 'high') => {
    const key = band === 'low' ? 'eqKillLow' : band === 'mid' ? 'eqKillMid' : 'eqKillHigh';
    store.setEqKill(deckId, band, !deck[key]);
  }, [deckId, store, deck]);

  const handleFilterSweep = useCallback((v: number) => {
    store.setFilterSweep(deckId, v);
  }, [deckId, store]);

  const isMp3 = deck.sourceType === 'mp3';

  return (
    <div className={styles.panel}>
      <div className={styles.headerRow}>
        <span className={styles.panelLabel}>EQ</span>
        <span
          className={styles.statusBadge}
          data-active={isMp3}
          title={isMp3
            ? 'EQ active — driving Web Audio BiquadFilter nodes'
            : 'Visual only — YouTube audio runs in a cross-origin iframe'
          }
        >
          {isMp3 ? 'LIVE' : 'Visual Only'}
        </span>
      </div>
      <div className={styles.knobsRow}>
        {EQ_BANDS.map(({ band, label, kill }) => (
          <EqKnob
            key={band}
            deckId={deckId}
            band={band}
            killBand={kill}
            label={label}
            value={deck[band]}
            killed={deck[kill === 'low' ? 'eqKillLow' : kill === 'mid' ? 'eqKillMid' : 'eqKillHigh']}
            onChange={handleChange}
            onKillToggle={handleKillToggle}
          />
        ))}
        <FilterSweepKnob
          deckId={deckId}
          value={deck.filterSweep}
          onChange={handleFilterSweep}
        />
      </div>
    </div>
  );
}

export default EQPanel;
