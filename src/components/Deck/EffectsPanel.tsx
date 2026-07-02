/**
 * EffectsPanel.tsx — Echo / Reverb effects for MP3 decks.
 *
 * Controls:
 *   - Effect selector: NONE / ECHO / REVERB
 *   - ON/OFF toggle
 *   - Wet/Dry knob (0 = dry, 1 = fully wet)
 *
 * Effects are only active for MP3 tracks (Web Audio chain).
 * YouTube tracks show the panel but effects are bypassed.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import { fxBeatMultiplier } from '../../utils/fxBeat';
import styles from './EffectsPanel.module.css';

interface EffectsPanelProps {
  deckId: 'A' | 'B';
}

const EFFECTS = [
  { type: 'none',   label: 'OFF'   },
  { type: 'echo',   label: 'ECHO'  },
  { type: 'reverb', label: 'VERB'  },
] as const;

function WetDryKnob({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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
      const delta = (dragStartY.current - ev.clientY) * 0.008;
      onChange(Math.max(0, Math.min(1, dragStartValue.current + delta)));
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
  }, [value, onChange]);

  // 0 → -135°, 0.5 → 0°, 1 → +135°
  const angle = (value - 0.5) * 270;
  const pct = Math.round(value * 100);

  return (
    <div className={styles.knobWrap}>
      <div
        className={styles.knob}
        style={{ '--knob-angle': `${angle.toFixed(1)}deg` } as React.CSSProperties}
        role="slider"
        tabIndex={0}
        aria-label={`Wet/dry mix: ${pct}%`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onChange(0.5)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp')   { e.preventDefault(); onChange(Math.min(1, value + 0.05)); }
          if (e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0, value - 0.05)); }
        }}
      >
        <div className={styles.indicator} />
      </div>
      <span className={styles.knobLabel}>D/W</span>
    </div>
  );
}

function BeatKnob({ value, onChange }: { value: number; onChange: (v: number) => void }) {
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
      const delta = (dragStartY.current - ev.clientY) * 0.008;
      onChange(Math.max(0, Math.min(1, dragStartValue.current + delta)));
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
  }, [value, onChange]);

  const angle = (value - 0.5) * 270;
  const mult = fxBeatMultiplier(value);
  const label = mult < 1 ? `1/${Math.round(1 / mult)}` : `${mult}`;
  const unit = mult === 1 ? 'beat' : 'beats';

  return (
    <div className={styles.knobWrap}>
      <div
        className={styles.knob}
        style={{ '--knob-angle': `${angle.toFixed(1)}deg` } as React.CSSProperties}
        role="slider"
        tabIndex={0}
        aria-label={`FX beat: ${label} ${unit}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={`${label} ${unit}`}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onChange(0.5)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp')   { e.preventDefault(); onChange(Math.min(1, value + 0.1)); }
          if (e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0, value - 0.1)); }
        }}
      >
        <div className={styles.indicator} />
      </div>
      <span className={styles.knobLabel}>BEAT</span>
    </div>
  );
}

export function EffectsPanel({ deckId }: EffectsPanelProps) {
  const { setEffectType, setEffectEnabled, setEffectWetDry, setEffectBeat } = useDeckActions();
  const effectType = useDeckStore((s) => s.decks[deckId].effectType);
  const effectEnabled = useDeckStore((s) => s.decks[deckId].effectEnabled);
  const effectWetDry = useDeckStore((s) => s.decks[deckId].effectWetDry);
  const effectBeat = useDeckStore((s) => s.decks[deckId].effectBeat);

  const handleTypeSelect = useCallback((type: 'none' | 'echo' | 'reverb') => {
    setEffectType(deckId, type);
    setEffectEnabled(deckId, type !== 'none');
  }, [deckId, setEffectType, setEffectEnabled]);

  const handleWetDry = useCallback((v: number) => {
    setEffectWetDry(deckId, v);
  }, [deckId, setEffectWetDry]);

  const handleBeat = useCallback((v: number) => {
    setEffectBeat(deckId, v);
  }, [deckId, setEffectBeat]);

  return (
    <div className={styles.panel}>
      <div className={styles.headerRow}>
        <span className={styles.panelLabel}>FX</span>
      </div>
      <div className={styles.controls}>
        {/* Effect type buttons */}
        <div className={styles.typeButtons}>
          {EFFECTS.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              className={`${styles.typeBtn} ${effectType === type || (type === 'none' && !effectEnabled) ? styles.typeBtnActive : ''}`}
              onClick={() => handleTypeSelect(type)}
              aria-pressed={effectType === type}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Wet/Dry knob */}
        <WetDryKnob value={effectWetDry} onChange={handleWetDry} />
        <BeatKnob value={effectBeat} onChange={handleBeat} />
      </div>
    </div>
  );
}

export default EffectsPanel;
