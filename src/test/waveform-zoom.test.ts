import { describe, it, expect, beforeEach } from 'vitest';
import { useDeckStore } from '../store/deckStore';
import { WAVEFORM_ZOOM_LEVELS, DEFAULT_WAVEFORM_ZOOM_INDEX } from '../utils/waveformZoom';

describe('waveform zoom', () => {
  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    // Reset zoom level to default for test isolation
    const { decks } = useDeckStore.getState();
    Object.assign(decks.A, { waveformZoomIndex: DEFAULT_WAVEFORM_ZOOM_INDEX });
  });

  it('defaults to DEFAULT_WAVEFORM_ZOOM_INDEX', () => {
    expect(useDeckStore.getState().decks.A.waveformZoomIndex).toBe(DEFAULT_WAVEFORM_ZOOM_INDEX);
  });

  it('zoomWaveformIn moves to the previous (narrower) index', () => {
    useDeckStore.getState().zoomWaveformIn('A');
    expect(useDeckStore.getState().decks.A.waveformZoomIndex).toBe(DEFAULT_WAVEFORM_ZOOM_INDEX - 1);
  });

  it('zoomWaveformOut moves to the next (wider) index', () => {
    useDeckStore.getState().zoomWaveformOut('A');
    expect(useDeckStore.getState().decks.A.waveformZoomIndex).toBe(DEFAULT_WAVEFORM_ZOOM_INDEX + 1);
  });

  it('zoomWaveformIn clamps at 0 (does not go below the narrowest level)', () => {
    for (let i = 0; i < WAVEFORM_ZOOM_LEVELS.length + 2; i++) {
      useDeckStore.getState().zoomWaveformIn('A');
    }
    expect(useDeckStore.getState().decks.A.waveformZoomIndex).toBe(0);
  });

  it('zoomWaveformOut clamps at the last index (does not exceed the whole-track level)', () => {
    for (let i = 0; i < WAVEFORM_ZOOM_LEVELS.length + 2; i++) {
      useDeckStore.getState().zoomWaveformOut('A');
    }
    expect(useDeckStore.getState().decks.A.waveformZoomIndex).toBe(WAVEFORM_ZOOM_LEVELS.length - 1);
  });

  it('does not affect the other deck', () => {
    useDeckStore.getState().zoomWaveformOut('A');
    expect(useDeckStore.getState().decks.B.waveformZoomIndex).toBe(DEFAULT_WAVEFORM_ZOOM_INDEX);
  });

  it('survives loadTrack (persists like vinylMode)', () => {
    useDeckStore.getState().zoomWaveformOut('A');
    useDeckStore.getState().loadTrack('A', 't1', { title: 'T', artist: 'A', duration: 100, thumbnailUrl: null });
    expect(useDeckStore.getState().decks.A.waveformZoomIndex).toBe(DEFAULT_WAVEFORM_ZOOM_INDEX + 1);
  });

  it('survives clearTrack (persists like vinylMode)', () => {
    useDeckStore.getState().zoomWaveformOut('A');
    useDeckStore.getState().clearTrack('A');
    expect(useDeckStore.getState().decks.A.waveformZoomIndex).toBe(DEFAULT_WAVEFORM_ZOOM_INDEX + 1);
  });
});
