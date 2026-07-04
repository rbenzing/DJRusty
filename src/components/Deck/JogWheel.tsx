/**
 * JogWheel.tsx — Interactive jog wheel wrapping VinylPlatter.
 *
 * A single Pointer Events drag surface (mouse + touch, single pointer) drives
 * two mutually exclusive behaviors gated by VINYL mode:
 *   - VINYL on:  real scratch — beginScratch/updateScratchRate/endScratch,
 *                mirroring how every other deck command goes through the
 *                registered player (see playerRegistry.ts).
 *   - VINYL off: temporary pitch bend — setBendMultiplier via the same
 *                player, released back to 1.0 on pointer up.
 * Visual rotation during a drag is driven directly by the drag angle
 * (VinylPlatter's rotationOverrideDeg), locking the platter's spin to the
 * exact position being scratched/bent.
 *
 * Re-entrancy: only one drag session per wheel is meaningful (the design's
 * non-goals rule out multi-touch scratching). handlePointerDown bails out
 * immediately if a drag is already in progress (dragRef.current !== null),
 * so a second finger touching the same platter before the first pointerup
 * fires cannot restart SLIP shadow tracking or re-issue beginScratch/
 * setBendMultiplier mid-gesture.
 */
import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useDeck, useDeckStore } from '../../store/deckStore';
import { getActivePlayer } from '../../services/playerRegistry';
import { angleDeg, shortestAngleDelta, rotationDeltaToSeconds, rateFromMovement } from '../../utils/scratchMath';
import { VinylPlatter } from './VinylPlatter';
import styles from './JogWheel.module.css';

const BEND_RANGE = 0.08; // +/-8% temporary pitch nudge
const BEND_DEGREES_FOR_MAX = 180; // full bend range reached at a half-rotation drag

interface JogWheelProps {
  deckId: 'A' | 'B';
}

interface DragState {
  pointerId: number;
  centerX: number;
  centerY: number;
  lastAngle: number;
  lastTimestamp: number;
  cumulativeDeg: number; // total rotation since pointer-down, for bend-mode mapping
  rotationDeg: number; // visual override angle
}

export function JogWheel({ deckId }: JogWheelProps) {
  const deck = useDeck(deckId);
  const { playbackState, pitchRate, thumbnailUrl, vinylMode, trackId } = deck;
  const isPlaying = playbackState === 'playing';
  const isBuffering = playbackState === 'buffering';

  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [rotationOverride, setRotationOverride] = useState<number | null>(null);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>): void {
    // A drag is already in progress (e.g. a second finger touching the same
    // wheel before the first pointerup/pointercancel fires). Two concurrent
    // drag sessions on one wheel are meaningless — ignore this pointerdown
    // entirely rather than restarting the gesture (which would re-issue
    // beginScratch/setBendMultiplier and, in VINYL+SLIP mode, restart the
    // SLIP shadow tracking mid-gesture).
    if (dragRef.current !== null) return;
    if (!trackId) return;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = angleDeg(centerX, centerY, e.clientX, e.clientY);
    dragRef.current = {
      pointerId: e.pointerId,
      centerX,
      centerY,
      lastAngle: angle,
      lastTimestamp: performance.now(),
      cumulativeDeg: 0,
      rotationDeg: 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (vinylMode) {
      useDeckStore.getState().beginScratch(deckId);
    }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const angle = angleDeg(drag.centerX, drag.centerY, e.clientX, e.clientY);
    const deltaDeg = shortestAngleDelta(drag.lastAngle, angle);
    const now = performance.now();
    const deltaMs = now - drag.lastTimestamp;
    drag.lastAngle = angle;
    drag.lastTimestamp = now;
    drag.cumulativeDeg += deltaDeg;
    drag.rotationDeg += deltaDeg;
    setRotationOverride(drag.rotationDeg);

    if (vinylMode) {
      const deltaSeconds = rotationDeltaToSeconds(deltaDeg);
      const rate = rateFromMovement(deltaSeconds, deltaMs);
      getActivePlayer(deckId)?.updateScratchRate?.(rate);
    } else {
      const bendFraction = Math.max(-1, Math.min(1, drag.cumulativeDeg / BEND_DEGREES_FOR_MAX));
      const multiplier = 1 + bendFraction * BEND_RANGE;
      getActivePlayer(deckId)?.setBendMultiplier?.(multiplier);
    }
  }

  function endDrag(e: ReactPointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setRotationOverride(null);
    if (vinylMode) {
      useDeckStore.getState().endScratch(deckId);
    } else {
      getActivePlayer(deckId)?.setBendMultiplier?.(1.0);
    }
  }

  function handleVinylToggle(): void {
    useDeckStore.getState().setVinylMode(deckId, !vinylMode);
  }

  return (
    <div className={styles.wrapper}>
      <div
        ref={wrapperRef}
        className={styles.dragSurface}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="button"
        tabIndex={-1}
        aria-label={`Jog wheel for Deck ${deckId} — drag to ${vinylMode ? 'scratch' : 'bend pitch'}`}
      >
        <VinylPlatter
          isPlaying={isPlaying}
          isBuffering={isBuffering}
          pitchRate={pitchRate}
          thumbnailUrl={thumbnailUrl}
          {...(rotationOverride !== null ? { rotationOverrideDeg: rotationOverride } : {})}
        />
      </div>
      <button
        type="button"
        className={`${styles.vinylBtn} ${vinylMode ? styles.vinylBtnActive : ''}`}
        onClick={handleVinylToggle}
        aria-pressed={vinylMode}
        aria-label={`Vinyl scratch mode for Deck ${deckId}`}
        title={vinylMode ? 'VINYL mode: drag scratches the track' : 'VINYL mode off: drag only bends pitch'}
      >
        VINYL
      </button>
    </div>
  );
}

export default JogWheel;
