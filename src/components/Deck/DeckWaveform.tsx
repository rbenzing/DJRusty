/**
 * DeckWaveform.tsx — Frequency-colored waveform canvas for a single deck.
 *
 * Extracted from the former shared CenterWaveform component (which stacked
 * both decks' waveforms above the deck row) — this renders exactly one
 * deck's waveform, sized to whatever width its container (DeckDisplay's
 * header) provides via a ResizeObserver, since that width is no longer the
 * full app width.
 *
 * Rendering: each bar is colored by frequency content (bass=red, mid=green,
 * high=cyan blend); falls back to a flat monochrome bar from waveformPeaks
 * if colored peaks aren't available yet (still decoding). Draws hot cue
 * markers and a center-following playhead line.
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import { useDeck } from '../../store/deckStore';
import { usePlayhead } from '../../hooks/usePlayhead';
import type { ColoredPeak } from '../../utils/extractColoredPeaks';
import { WAVEFORM_ZOOM_LEVELS, DEFAULT_WAVEFORM_ZOOM_INDEX } from '../../utils/waveformZoom';
import styles from './DeckWaveform.module.css';

const TOTAL_BARS = 1000; // must match WAVEFORM_PEAKS in useAudioEngine.ts
const CANVAS_HEIGHT = 48;
const FALLBACK_WIDTH = 300; // used until ResizeObserver reports a real width

const BASS_R = 220, BASS_G = 60,  BASS_B = 40;
const MID_R  = 80,  MID_G  = 200, MID_B  = 80;
const HIGH_R = 60,  HIGH_G = 160, HIGH_B = 255;

interface DeckWaveformProps {
  deckId: 'A' | 'B';
}

export function DeckWaveform({ deckId }: DeckWaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(FALLBACK_WIDTH);
  const { waveformColoredPeaks, waveformPeaks, duration, hotCues, waveformZoomIndex } = useDeck(deckId);
  const playhead = usePlayhead(deckId);
  const visibleHalf = WAVEFORM_ZOOM_LEVELS[waveformZoomIndex] ?? WAVEFORM_ZOOM_LEVELS[DEFAULT_WAVEFORM_ZOOM_INDEX];
  const visibleBars = visibleHalf * 2 + 1;

  const deckColor = deckId === 'A' ? '#4af5ff' : '#ff8c42';
  const playedColor = deckId === 'A' ? 'rgba(74,245,255,0.3)' : 'rgba(255,140,66,0.3)';

  // Resize the canvas's drawing buffer to match its rendered width, so bars
  // stay crisp instead of stretching/blurring at whatever column width this
  // deck's header ends up being (previously always the full app width).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setCanvasWidth(Math.round(width));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const drawFrame = useCallback((currentTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, width, height);

    const hasColored = waveformColoredPeaks && waveformColoredPeaks.length > 0;
    const hasMono = waveformPeaks && waveformPeaks.length > 0;
    if (!hasColored && !hasMono) {
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(0, height / 2 - 1, width, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(width / 2 - 1, 0, 2, height);
      return;
    }

    const playheadBar = duration > 0
      ? Math.round((currentTime / duration) * (TOTAL_BARS - 1))
      : 0;

    const barWidth = width / visibleBars;
    const centerX = width / 2;

    for (let i = 0; i < visibleBars; i++) {
      const barIndex = playheadBar - visibleHalf + i;
      const x = i * barWidth;

      if (barIndex < 0 || barIndex >= TOTAL_BARS) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(x, height / 2 - 1, barWidth, 2);
        continue;
      }

      let barHeight: number;
      let r: number, g: number, b: number;

      if (hasColored) {
        const peak = (waveformColoredPeaks as ColoredPeak[])[barIndex]!;
        barHeight = Math.max(2, peak.amp * height * 0.9);
        r = Math.round(BASS_R * peak.bass + MID_R * peak.mid * 0.5 + HIGH_R * peak.high * 0.2);
        g = Math.round(BASS_G * peak.bass * 0.2 + MID_G * peak.mid + HIGH_G * peak.high * 0.5);
        b = Math.round(BASS_B * peak.bass * 0.1 + MID_B * peak.mid * 0.3 + HIGH_B * peak.high);
        const isFuture = barIndex > playheadBar;
        const factor = isFuture ? 1.0 : 0.55;
        r = Math.min(255, Math.round(r * factor));
        g = Math.min(255, Math.round(g * factor));
        b = Math.min(255, Math.round(b * factor));
      } else {
        const amp = (waveformPeaks as Float32Array)[barIndex] ?? 0;
        barHeight = Math.max(2, amp * height * 0.9);
        const isFuture = barIndex > playheadBar;
        ctx.fillStyle = isFuture ? deckColor : playedColor;
        const y = (height - barHeight) / 2;
        ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
        continue;
      }

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      const y = (height - barHeight) / 2;
      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    }

    // Hot cue markers
    Object.values(hotCues).forEach((cueSec) => {
      if (typeof cueSec !== 'number') return;
      const cueBar = Math.round((cueSec / duration) * (TOTAL_BARS - 1));
      const offsetBars = cueBar - playheadBar;
      if (offsetBars < -visibleHalf || offsetBars > visibleHalf) return;
      const cueX = centerX + offsetBars * barWidth;
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(cueX - 1, 0, 2, height);
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
  }, [waveformColoredPeaks, waveformPeaks, duration, hotCues, deckColor, playedColor, visibleHalf, visibleBars]);

  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      drawFrame(playhead.current);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [drawFrame, playhead]);

  return (
    <div ref={containerRef} className={styles.wrapper}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={canvasWidth}
        height={CANVAS_HEIGHT}
        aria-label={`Deck ${deckId} waveform`}
      />
    </div>
  );
}

export default DeckWaveform;
