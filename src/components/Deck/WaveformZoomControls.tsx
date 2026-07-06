/**
 * WaveformZoomControls.tsx — Zoom in/out buttons for one deck's waveform.
 *
 * Steps deckStore's waveformZoomIndex through WAVEFORM_ZOOM_LEVELS (narrowest/
 * most-detailed first, widest/whole-track last). Disabled at each end.
 */
import { useDeck, useDeckStore } from '../../store/deckStore';
import { WAVEFORM_ZOOM_LEVELS } from '../../utils/waveformZoom';
import styles from './WaveformZoomControls.module.css';

interface WaveformZoomControlsProps {
  deckId: 'A' | 'B';
}

export function WaveformZoomControls({ deckId }: WaveformZoomControlsProps) {
  const { waveformZoomIndex } = useDeck(deckId);
  const atNarrowest = waveformZoomIndex <= 0;
  const atWidest = waveformZoomIndex >= WAVEFORM_ZOOM_LEVELS.length - 1;

  return (
    <div className={styles.zoomControls}>
      <button
        type="button"
        className={styles.zoomBtn}
        onClick={() => useDeckStore.getState().zoomWaveformOut(deckId)}
        disabled={atWidest}
        aria-label={`Zoom out Deck ${deckId} waveform`}
        title="Zoom out"
      >
        &#x2212;
      </button>
      <button
        type="button"
        className={styles.zoomBtn}
        onClick={() => useDeckStore.getState().zoomWaveformIn(deckId)}
        disabled={atNarrowest}
        aria-label={`Zoom in Deck ${deckId} waveform`}
        title="Zoom in"
      >
        &#x2b;
      </button>
    </div>
  );
}

export default WaveformZoomControls;
