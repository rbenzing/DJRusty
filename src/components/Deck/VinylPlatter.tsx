/**
 * VinylPlatter.tsx — Rotating vinyl platter with CSS animation.
 *
 * Animation is driven entirely by CSS custom properties:
 *   --platter-state: 'running' | 'paused'
 *   --platter-duration: e.g. '1.800s'
 *
 * This approach preserves the current rotation angle when paused —
 * animation-play-state: paused does not reset to 0deg.
 */
import styles from './VinylPlatter.module.css';

interface VinylPlatterProps {
  /** Whether the deck is currently playing. Controls spin animation. */
  isPlaying: boolean;
  /** Whether the deck is buffering. Shows a loading spinner overlay. */
  isBuffering: boolean;
  /** Current playback rate (pitch rate). Controls animation speed. */
  pitchRate: number;
  /** Track thumbnail URL, used as the vinyl center label image. */
  thumbnailUrl?: string | null;
}

export function VinylPlatter({ isPlaying, isBuffering, pitchRate, thumbnailUrl }: VinylPlatterProps) {
  const platterStyle = {
    '--platter-state': isPlaying ? 'running' : 'paused',
    '--platter-duration': `${(1.8 / pitchRate).toFixed(3)}s`,
  } as React.CSSProperties;

  return (
    <div className={styles.wrapper}>
      {/* Tonearm indicator at 12 o'clock */}
      <span className={styles.tonearmNotch} aria-hidden="true">▲</span>

      <div
        className={styles.platter}
        style={platterStyle}
        aria-hidden="true"
      >
        {/* Center label — thumbnail or fallback "DR" logo */}
        <div className={styles.label}>
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              className={styles.labelImage}
              aria-hidden="true"
            />
          ) : (
            <span className={styles.labelFallback} aria-hidden="true">DR</span>
          )}
        </div>

        {/* Buffering overlay — shown during buffering state */}
        {isBuffering && (
          <div className={styles.bufferingOverlay} aria-hidden="true">
            <div className={styles.spinner} />
          </div>
        )}
      </div>
    </div>
  );
}

export default VinylPlatter;
