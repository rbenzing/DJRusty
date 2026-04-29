/**
 * CenterWaveform.tsx — Serato-style dual scrolling waveform display.
 *
 * Shows both decks' frequency-colored waveforms stacked vertically with a
 * fixed center playhead.  Deck A on top (cyan accents), Deck B on bottom
 * (orange accents), mirrored vertically to match the Rane/Serato aesthetic.
 *
 * Rendering:
 *   - Each bar is colored by frequency content: bass=red, mid=green, high=cyan.
 *   - The waveform scrolls so the current playhead stays at the horizontal center.
 *   - If no colored peaks are available (YouTube track / not yet decoded), a
 *     fallback monochrome waveform is drawn from waveformPeaks.
 *   - Cue point markers and beat grid lines are drawn over the waveform.
 */
import { useRef, useEffect, useCallback } from 'react';
import { useDeck } from '../../store/deckStore';
import type { ColoredPeak } from '../../utils/extractColoredPeaks';
import styles from './CenterWaveform.module.css';

// Number of waveform bars stored per deck (must match WAVEFORM_PEAKS in useAudioEngine)
const TOTAL_BARS = 1000;
// Number of bars visible on each side of the center playhead
const VISIBLE_HALF = 180;
// Total visible bars
const VISIBLE_BARS = VISIBLE_HALF * 2 + 1;

// Color palette — frequency band colors
const BASS_R = 220, BASS_G = 60,  BASS_B = 40;   // red/orange
const MID_R  = 80,  MID_G  = 200, MID_B  = 80;   // green
const HIGH_R = 60,  HIGH_G = 160, HIGH_B = 255;  // cyan/blue

interface WaveformRowProps {
  deckId: 'A' | 'B';
  mirrored?: boolean;
}

/** Renders one deck's waveform row onto a canvas. */
function WaveformRow({ deckId, mirrored = false }: WaveformRowProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { waveformColoredPeaks, waveformPeaks, currentTime, duration, hotCues } = useDeck(deckId);

  const deckColor = deckId === 'A' ? '#4af5ff' : '#ff8c42';
  const playedColor = deckId === 'A' ? 'rgba(74,245,255,0.3)' : 'rgba(255,140,66,0.3)';

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Dark background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, width, height);

    const hasColored = waveformColoredPeaks && waveformColoredPeaks.length > 0;
    const hasMono = waveformPeaks && waveformPeaks.length > 0;
    if (!hasColored && !hasMono) {
      // No data — draw flat line
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(0, height / 2 - 1, width, 2);
      // Draw center playhead
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(width / 2 - 1, 0, 2, height);
      return;
    }

    // Current playhead bar index
    const playheadBar = duration > 0
      ? Math.round((currentTime / duration) * (TOTAL_BARS - 1))
      : 0;

    const barWidth = width / VISIBLE_BARS;
    const centerX = width / 2;

    // Draw each visible bar
    for (let i = 0; i < VISIBLE_BARS; i++) {
      const barIndex = playheadBar - VISIBLE_HALF + i;
      const x = i * barWidth;

      if (barIndex < 0 || barIndex >= TOTAL_BARS) {
        // Out of range — draw a tiny tick to show silence
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(x, height / 2 - 1, barWidth, 2);
        continue;
      }

      let barHeight: number;
      let r: number, g: number, b: number;

      if (hasColored) {
        const peak = (waveformColoredPeaks as ColoredPeak[])[barIndex]!;
        barHeight = Math.max(2, peak.amp * height * 0.9);
        // Blend RGB from frequency ratios
        r = Math.round(BASS_R * peak.bass + MID_R * peak.mid * 0.5 + HIGH_R * peak.high * 0.2);
        g = Math.round(BASS_G * peak.bass * 0.2 + MID_G * peak.mid + HIGH_G * peak.high * 0.5);
        b = Math.round(BASS_B * peak.bass * 0.1 + MID_B * peak.mid * 0.3 + HIGH_B * peak.high);
        // Boost brightness for bars past the playhead (already played = slightly dimmer)
        const isFuture = barIndex > playheadBar;
        const factor = isFuture ? 1.0 : 0.55;
        r = Math.min(255, Math.round(r * factor));
        g = Math.min(255, Math.round(g * factor));
        b = Math.min(255, Math.round(b * factor));
      } else {
        // Monochrome fallback
        const amp = (waveformPeaks as Float32Array)[barIndex] ?? 0;
        barHeight = Math.max(2, amp * height * 0.9);
        const isFuture = barIndex > playheadBar;
        const hex = isFuture ? deckColor : playedColor;
        ctx.fillStyle = hex;
        const y = mirrored ? 0 : (height - barHeight) / 2;
        const h = mirrored ? barHeight / 2 : barHeight;
        ctx.fillRect(x, y, Math.max(1, barWidth - 1), h);
        continue;
      }

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      if (mirrored) {
        // Draw from top down (mirrored = bottom deck reflected)
        ctx.fillRect(x, 0, Math.max(1, barWidth - 1), barHeight / 2);
      } else {
        const y = (height - barHeight) / 2;
        ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
      }
    }

    // Hot cue markers
    Object.values(hotCues).forEach((cueSec) => {
      if (typeof cueSec !== 'number') return;
      const cueBar = Math.round((cueSec / duration) * (TOTAL_BARS - 1));
      const offsetBars = cueBar - playheadBar;
      if (offsetBars < -VISIBLE_HALF || offsetBars > VISIBLE_HALF) return;
      const cueX = centerX + offsetBars * barWidth;
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(cueX - 1, 0, 2, height);
      // Triangle marker at top
      ctx.beginPath();
      ctx.moveTo(cueX - 5, 0);
      ctx.lineTo(cueX + 5, 0);
      ctx.lineTo(cueX, 8);
      ctx.closePath();
      ctx.fill();
    });

    // Center playhead line
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(centerX - 1, 0, 2, height);

    // Subtle center glow
    const grd = ctx.createLinearGradient(centerX - 20, 0, centerX + 20, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(centerX - 20, 0, 40, height);
  }, [waveformColoredPeaks, waveformPeaks, currentTime, duration, hotCues, mirrored, deckColor, playedColor]);

  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={`${styles.row} ${mirrored ? styles.rowMirrored : ''}`}
      width={900}
      height={60}
      aria-label={`Deck ${deckId} waveform`}
    />
  );
}

/** Center dual waveform display — both decks stacked, Serato style. */
export function CenterWaveform() {
  const deckA = useDeck('A');
  const deckB = useDeck('B');

  return (
    <div className={styles.container} aria-label="Dual waveform display">
      {/* Deck A label + time */}
      <div className={styles.labels}>
        <div className={styles.deckLabel} data-deck="a">
          <span className={styles.deckLetterA}>A</span>
          <span className={styles.trackInfo}>
            {deckA.title ? deckA.title : 'No track'}
          </span>
          <span className={styles.timeDisplay}>
            {formatTime(deckA.currentTime)} / {formatTime(deckA.duration)}
          </span>
        </div>
        <div className={styles.deckLabel} data-deck="b">
          <span className={styles.deckLetterB}>B</span>
          <span className={styles.trackInfo}>
            {deckB.title ? deckB.title : 'No track'}
          </span>
          <span className={styles.timeDisplay}>
            {formatTime(deckB.currentTime)} / {formatTime(deckB.duration)}
          </span>
        </div>
      </div>

      {/* Waveform canvases */}
      <div className={styles.waveforms}>
        {/* Deck A — normal orientation */}
        <WaveformRow deckId="A" mirrored={false} />
        {/* Center divider */}
        <div className={styles.divider} />
        {/* Deck B — mirrored (bars grow downward from center line) */}
        <WaveformRow deckId="B" mirrored={true} />
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default CenterWaveform;
