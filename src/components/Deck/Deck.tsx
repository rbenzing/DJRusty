/**
 * Deck.tsx — Main deck container component.
 *
 * Renders the full Deck A or Deck B UI shell per ui-spec.md §4.
 * Reads all state from deckStore via the deckId prop.
 *
 * Layout (top to bottom):
 *   DeckDisplay   — deck label, BPM, track title, channel, time/rate
 *   VinylPlatter  — animated vinyl disc
 *   DeckControls  — Play/Pause, Cue, Set Cue
 *   TapTempo      — TAP button + BPM display
 *   PitchSlider   — stepped pitch rate slider
 *   EQPanel       — visual-only EQ knobs (Low/Mid/High)
 *   Volume fader  — deck volume slider
 *
 * States handled:
 *   - Empty: no track loaded, shows "No Track Loaded" message
 *   - Buffering: spinner overlay on platter
 *   - Error: error message banner beneath platter
 *   - Playing/Paused/Ended: platter spin controlled by playbackState
 */
import { useDeck } from '../../store/deckStore';
import { useMixerStore } from '../../store/mixerStore';
import { DeckControls } from './DeckControls';
import { DeckDisplay } from './DeckDisplay';
import { EQPanel } from './EQPanel';
import { HotCues } from './HotCues';
import { BeatJump } from './BeatJump';
import { LoopControls } from './LoopControls';
import { SlipButton } from './SlipButton';
import { PitchSlider } from './PitchSlider';
import { TapTempo } from './TapTempo';
import { VinylPlatter } from './VinylPlatter';
import styles from './Deck.module.css';

interface DeckProps {
  /** Which deck this component represents. */
  deckId: 'A' | 'B';
}

export function Deck({ deckId }: DeckProps) {
  const deck = useDeck(deckId);
  const setChannelFaderA = useMixerStore((s) => s.setChannelFaderA);
  const setChannelFaderB = useMixerStore((s) => s.setChannelFaderB);
  const channelFader = useMixerStore((s) => deckId === 'A' ? s.channelFaderA : s.channelFaderB);

  const { playbackState, trackId, thumbnailUrl, pitchRate, error } = deck;

  const isPlaying = playbackState === 'playing';
  const isBuffering = playbackState === 'buffering';
  const hasTrack = trackId !== null;

  function handleVolumeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(event.target.value, 10);
    if (deckId === 'A') setChannelFaderA(val);
    else setChannelFaderB(val);
  }

  return (
    <div
      className={styles.deck}
      data-deck={deckId.toLowerCase()}
    >
      {/* Track info / time display */}
      <DeckDisplay deckId={deckId} />

      {/* Vinyl platter — always shown; empty state shown inside platter section */}
      <div className={styles.platterSection}>
        {hasTrack ? (
          <VinylPlatter
            isPlaying={isPlaying}
            isBuffering={isBuffering}
            pitchRate={pitchRate}
            thumbnailUrl={thumbnailUrl}
          />
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

      {/* Transport controls */}
      <DeckControls deckId={deckId} />

      {/* Hot cue buttons (4 per deck, STORY-011) */}
      <HotCues deckId={deckId} />

      {/* Loop controls */}
      <LoopControls deckId={deckId} />

      {/* Slip mode toggle */}
      <SlipButton deckId={deckId} />

      {/* Beat jump controls */}
      <BeatJump deckId={deckId} />

      {/* Tap BPM */}
      <TapTempo deckId={deckId} />

      {/* Pitch slider */}
      <PitchSlider deckId={deckId} />

      {/* EQ knobs (visual only) */}
      <EQPanel deckId={deckId} />

      {/* Volume fader */}
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
    </div>
  );
}

export default Deck;
