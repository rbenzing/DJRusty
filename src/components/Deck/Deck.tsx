/**
 * Deck.tsx — Main deck container component.
 *
 * Reads all state from deckStore via the deckId prop.
 *
 * Layout (top to bottom):
 *   DeckDisplay        — deck label, BPM, per-deck waveform, track title, channel, time/rate
 *   JogWheel           — animated vinyl platter + scratch/bend drag surface
 *   DeckControls       — Play/Pause, Cue, Set Cue
 *   DeckModifiers      — SHIFT / QUANTIZE / ROLL
 *   PadGrid            — HOT CUE / LOOP / SLICER / SAMPLER
 *   SlipButton, BeatJump
 *   Tap BPM / FX / Grid Control — consolidated row
 *   Volume fader / Pitch slider — consolidated row
 *
 * EQ controls now live in Mixer.tsx, flanking the mixer's channel strip —
 * not rendered here.
 *
 * States handled:
 *   - Empty: no track loaded, shows "No Track Loaded" message
 *   - Buffering: spinner overlay on platter
 *   - Error: error message banner beneath platter
 *   - Playing/Paused/Ended: platter spin controlled by JogWheel (reads playbackState internally)
 */
import { useState } from 'react';
import type { DragEvent } from 'react';
import { useDeck } from '../../store/deckStore';
import { useMixerStore } from '../../store/mixerStore';
import { useAudioEngine } from '../../hooks/useAudioEngine';
import { usePlaylistStore } from '../../store/playlistStore';
import { useLibraryStore, libraryTrackToEntry } from '../../store/libraryStore';
import { DeckControls } from './DeckControls';
import { DeckModifiers } from './DeckModifiers';
import { DeckDisplay } from './DeckDisplay';
import { EffectsPanel } from './EffectsPanel';
import { PadGrid } from './PadGrid';
import { BeatJump } from './BeatJump';
import { SlipButton } from './SlipButton';
import { PitchSlider } from './PitchSlider';
import { TapTempo } from './TapTempo';
import { GridControl } from './GridControl';
import { JogWheel } from './JogWheel';
import { FileImportZone } from '../FileImport/FileImportZone';
import { DND_KEY } from '../../types/dnd';
import styles from './Deck.module.css';

interface DeckProps {
  /** Which deck this component represents. */
  deckId: 'A' | 'B';
}

export function Deck({ deckId }: DeckProps) {
  useAudioEngine(deckId);
  const deck = useDeck(deckId);
  const setChannelFaderA = useMixerStore((s) => s.setChannelFaderA);
  const setChannelFaderB = useMixerStore((s) => s.setChannelFaderB);
  const channelFader = useMixerStore((s) => deckId === 'A' ? s.channelFaderA : s.channelFaderB);
  const { trackId, error } = deck;

  const hasTrack = trackId !== null;

  const [deckDragover, setDeckDragover] = useState(false);

  function handleDeckDragOver(e: DragEvent<HTMLDivElement>) {
    const hasFiles = e.dataTransfer.types.includes('Files');
    const hasDndPayload = e.dataTransfer.types.includes(DND_KEY);
    if (hasFiles || hasDndPayload) {
      e.preventDefault();
      setDeckDragover(true);
    }
  }

  function handleDeckDragLeave(e: DragEvent<HTMLDivElement>) {
    // Only clear if leaving the deck entirely (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDeckDragover(false);
    }
  }

  function handleDeckDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDeckDragover(false);

    // Branch 1: OS file drop — import to library + append to this deck's queue
    if (e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('audio/'));
      if (files.length > 0) {
        const created = useLibraryStore.getState().addFiles(files);
        created.forEach((t) => usePlaylistStore.getState().addTrack(deckId, libraryTrackToEntry(t)));
      }
      return;
    }

    // Branch 2: DnD payload from the library browser
    const raw = e.dataTransfer.getData(DND_KEY);
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as { source: string; trackId: string };
      if (payload.source !== 'library') return;
      const track = useLibraryStore.getState().tracks.find((t) => t.id === payload.trackId);
      if (!track) return;
      usePlaylistStore.getState().addTrack(deckId, libraryTrackToEntry(track));
    } catch {
      // malformed payload — ignore
    }
  }

  function handleVolumeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(event.target.value, 10);
    if (deckId === 'A') setChannelFaderA(val);
    else setChannelFaderB(val);
  }

  return (
    <div
      className={`${styles.deck}${deckDragover ? ` ${styles.deckDragover}` : ''}`}
      data-deck={deckId.toLowerCase()}
      onDragOver={handleDeckDragOver}
      onDragLeave={handleDeckDragLeave}
      onDrop={handleDeckDrop}
    >
      {/* Track info / time display */}
      <DeckDisplay deckId={deckId} />

      {/* Vinyl platter — always shown; empty state shown inside platter section */}
      <div className={styles.platterSection}>
        {hasTrack ? (
          <JogWheel deckId={deckId} />
        ) : (
          <div className={styles.emptyState} aria-live="polite">
            <span className={styles.emptyStateTitle}>No Track Loaded</span>
            <span className={styles.emptyStateHint}>
              Search for a track below and click LOAD {deckId}
            </span>
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className={styles.errorBanner} role="alert">
          {error}
        </div>
      )}

      {/* File import — only shown when no track is loaded */}
      {!hasTrack && <FileImportZone deckId={deckId} />}

      {/* Transport controls */}
      <DeckControls deckId={deckId} />

      {/* SHIFT + QUANTIZE + ROLL modifier row */}
      <DeckModifiers deckId={deckId} />

      {/* Unified performance-pad grid: HOT CUE / LOOP functional, SLICER / SAMPLER coming later */}
      <PadGrid deckId={deckId} />

      {/* Slip mode toggle */}
      <SlipButton deckId={deckId} />

      {/* Beat jump controls */}
      <BeatJump deckId={deckId} />

      {/* Tap BPM / FX / Grid Control — consolidated 3-column row */}
      <div className={styles.tapFxGridRow}>
        <TapTempo deckId={deckId} />
        <EffectsPanel deckId={deckId} />
        <GridControl deckId={deckId} />
      </div>

      {/* Volume fader + Pitch slider — consolidated 2-column row */}
      <div className={styles.pitchVolumeRow}>
        <div className={styles.volumeSection}>
          <span className={styles.volumeLabel}>VOL</span>
          <input
            type="range"
            className={styles.volumeSlider}
            min={0}
            max={100}
            step={1}
            value={channelFader}
            onChange={handleVolumeChange}
            aria-label={`Deck ${deckId} volume`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={channelFader}
            aria-valuetext={`${channelFader}%`}
          />
          <div className={styles.volumeEndLabels}>
            <span>0</span>
            <span>100</span>
          </div>
        </div>
        <PitchSlider deckId={deckId} />
      </div>
    </div>
  );
}

export default Deck;
