/**
 * WaveformDisplay.tsx — Canvas waveform + playhead for a single deck.
 *
 * Reads waveformPeaks, currentTime, and duration from deckStore.
 * Draws amplitude bars and a playhead line using a 2D canvas context.
 */
import { useRef, useEffect } from 'react';
import { useDeck } from '../../store/deckStore';
import styles from './WaveformDisplay.module.css';

interface WaveformDisplayProps {
  deckId: 'A' | 'B';
}

const BAR_GAP = 1;
const WAVEFORM_COLOR = '#4a9eff';
const PLAYED_COLOR = '#1a4a7f';
const PLAYHEAD_COLOR = '#ffffff';

export function WaveformDisplay({ deckId }: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { waveformPeaks, currentTime, duration } = useDeck(deckId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    if (!waveformPeaks || waveformPeaks.length === 0) return;

    const numBars = waveformPeaks.length;
    const barWidth = Math.max(1, (width - numBars * BAR_GAP) / numBars);
    const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
    const playheadX = Math.round(progress * width);

    for (let i = 0; i < numBars; i++) {
      const x = i * (barWidth + BAR_GAP);
      const barHeight = Math.max(1, (waveformPeaks[i] ?? 0) * height);
      const y = (height - barHeight) / 2;
      ctx.fillStyle = x < playheadX ? PLAYED_COLOR : WAVEFORM_COLOR;
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    // Playhead
    ctx.fillStyle = PLAYHEAD_COLOR;
    ctx.fillRect(playheadX - 1, 0, 2, height);
  }, [waveformPeaks, currentTime, duration]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.waveform}
      width={800}
      height={80}
      aria-label={`Deck ${deckId} waveform`}
    />
  );
}

export default WaveformDisplay;
