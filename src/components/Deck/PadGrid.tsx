/**
 * PadGrid.tsx — Unified performance-pad grid for a deck (Phase 2a).
 *
 * Replaces the separate HotCues + LoopControls panels with one mode-switched
 * 8-pad grid, matching the Hercules DJC Inpulse 300 MK2's HOT CUE / LOOP /
 * SLICER / SAMPLER pad section. All four modes — HOT CUE, LOOP, SLICER,
 * and (as of Phase 2c) SAMPLER — are functional.
 *
 * Mode-switch is a pure UI visibility concern — switching away from LOOP
 * mode does not deactivate a running loop or roll; the underlying state and
 * audio engine are unaffected. Hot-cue keyboard shortcuts keep working
 * regardless of the currently displayed mode.
 */
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import type { DeckState } from '../../types/deck';
import { PadGridHotCue } from './PadGridHotCue';
import { PadGridLoop } from './PadGridLoop';
import { PadGridSlicer } from './PadGridSlicer';
import { PadGridSampler } from './PadGridSampler';
import styles from './PadGrid.module.css';

interface PadGridProps {
  deckId: 'A' | 'B';
}

const MODES: { mode: DeckState['padMode']; label: string; disabled: boolean }[] = [
  { mode: 'hotcue', label: 'HOT CUE', disabled: false },
  { mode: 'loop', label: 'LOOP', disabled: false },
  { mode: 'slicer', label: 'SLICER', disabled: false },
  { mode: 'sampler', label: 'SAMPLER', disabled: false },
];

export function PadGrid({ deckId }: PadGridProps) {
  const padMode = useDeckStore((s) => s.decks[deckId].padMode);
  const { setPadMode } = useDeckActions();

  return (
    <div className={styles.wrapper}>
      <div className={styles.modeRow}>
        {MODES.map(({ mode, label, disabled }) => (
          <button
            key={mode}
            type="button"
            className={[
              styles.modeBtn,
              padMode === mode ? styles.modeBtnActive : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => setPadMode(deckId, mode)}
            disabled={disabled}
            aria-pressed={padMode === mode}
            aria-label={`${label} pad mode for Deck ${deckId}`}
            title={disabled ? `${label} — coming soon` : `${label} pad mode`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.padArea}>
        {padMode === 'hotcue' && <PadGridHotCue deckId={deckId} />}
        {padMode === 'loop' && <PadGridLoop deckId={deckId} />}
        {padMode === 'slicer' && <PadGridSlicer deckId={deckId} />}
        {padMode === 'sampler' && <PadGridSampler deckId={deckId} />}
      </div>
    </div>
  );
}

export default PadGrid;
