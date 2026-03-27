/**
 * HotCueButton.tsx — A single hot cue button for one cue index (0–7).
 *
 * Interaction contract:
 *   - Normal click (< 500ms press):
 *       - If cue is SET   → jump to that timestamp via onJump()
 *       - If cue is UNSET → no-op (long-press or shift+click to set)
 *   - Shift+click (any duration):
 *       - Sets the cue at the current deck time via onSet()
 *   - Long-press (pointer held ≥ 500ms):
 *       - Sets the cue at the current deck time via onSet()
 *   - Right-click / contextmenu on a SET cue:
 *       - Clears the cue via onClear()
 *
 * Colours per cue index (0-based):
 *   0 → red    (#ff4444)
 *   1 → orange (#ff9900)
 *   2 → green  (#44ff44)
 *   3 → blue   (#4488ff)
 *   4 → purple (#cc44ff)
 *   5 → pink   (#ff44aa)
 *   6 → gold   (#ffcc00)
 *   7 → white  (#cccccc)
 */
import { useEffect, useRef } from 'react';
import { formatTime } from '../../utils/formatTime';
import styles from './HotCueButton.module.css';

/** How long (ms) a pointer must be held to trigger "set" mode. */
const LONG_PRESS_MS = 500;

/** Per-index accent colours (0-based indices matching the 8 hot cues). */
export const HOT_CUE_COLORS: readonly string[] = [
  '#ff4444', // index 0 — red
  '#ff9900', // index 1 — orange
  '#44ff44', // index 2 — green
  '#4488ff', // index 3 — blue
  '#cc44ff', // index 4 — purple
  '#ff44aa', // index 5 — pink
  '#ffcc00', // index 6 — gold
  '#cccccc', // index 7 — white
];

interface HotCueButtonProps {
  /** 0-based cue index (0–7). */
  index: number;
  /** Deck identifier for aria labels. */
  deckId: 'A' | 'B';
  /** Stored timestamp for this cue, or undefined if not set. */
  timestamp: number | undefined;
  /** Whether the deck has a track loaded (buttons disabled when false). */
  hasTrack: boolean;
  /** Callback: set the cue at the current deck time. */
  onSet: () => void;
  /** Callback: jump to this cue's timestamp. */
  onJump: () => void;
  /** Callback: clear this cue. */
  onClear: () => void;
}

export function HotCueButton({
  index,
  deckId,
  timestamp,
  hasTrack,
  onSet,
  onJump,
  onClear,
}: HotCueButtonProps) {
  const pressTimerRef = useRef<number | null>(null);
  /** Whether the long-press timer fired before pointerup (prevents normal-click path). */
  const longPressDidFireRef = useRef(false);
  const color = HOT_CUE_COLORS[index] ?? '#888888';
  const isSet = timestamp !== undefined;

  // Cancel any pending long-press timer when the component unmounts to prevent
  // a setState call (longPressDidFireRef / onSet) on an unmounted component.
  useEffect(() => {
    return () => cancelPressTimer();
  }, []);

  // ---- Pointer event handlers ------------------------------------------------

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    // Ignore non-primary buttons (right-click is handled by contextmenu).
    if (event.button !== 0) return;

    longPressDidFireRef.current = false;

    // Shift+click → set immediately, don't start long-press timer.
    if (event.shiftKey) {
      onSet();
      return;
    }

    pressTimerRef.current = window.setTimeout(() => {
      longPressDidFireRef.current = true;
      pressTimerRef.current = null;
      onSet();
    }, LONG_PRESS_MS);
  }

  function handlePointerUp() {
    cancelPressTimer();
  }

  function handlePointerLeave() {
    cancelPressTimer();
  }

  function cancelPressTimer() {
    if (pressTimerRef.current !== null) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  // ---- Click handler (fires after pointerup if within the element) -----------

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    // Shift+click was handled in pointerdown — skip here.
    if (event.shiftKey) return;
    // Long-press already fired — skip normal-click action.
    if (longPressDidFireRef.current) return;

    if (isSet) {
      onJump();
    }
    // Unset cue + normal click = no-op (user should shift+click or long-press to set).
  }

  // ---- Context menu (right-click) to clear -----------------------------------

  function handleContextMenu(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    cancelPressTimer();
    if (isSet) {
      onClear();
    }
  }

  // ---- Derived display values ------------------------------------------------

  /** Button label: formatted timestamp when set, 1-based number when unset. */
  const label = isSet ? formatTime(timestamp) : String(index + 1);

  const ariaLabel = isSet
    ? `Hot cue ${index + 1} on Deck ${deckId}: jump to ${formatTime(timestamp)}. Right-click to clear, shift+click or hold to reset.`
    : `Hot cue ${index + 1} on Deck ${deckId}: not set. Shift+click or hold to set at current position.`;

  const title = isSet
    ? `Jump to ${formatTime(timestamp)} — right-click to clear, shift+click or hold to set new position`
    : 'Hold 500ms or shift+click to set hot cue at current position';

  return (
    <button
      type="button"
      className={[styles.hotCueBtn, isSet ? styles.hotCueBtnSet : styles.hotCueBtnUnset].join(' ')}
      style={
        isSet
          ? ({
              '--cue-color': color,
              '--cue-color-bg': `${color}22`, // 13% opacity background tint
              '--cue-color-border': `${color}88`, // 53% opacity border
            } as React.CSSProperties)
          : undefined
      }
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      disabled={!hasTrack}
      aria-label={ariaLabel}
      title={title}
      aria-pressed={isSet}
    >
      {label}
    </button>
  );
}

export default HotCueButton;
