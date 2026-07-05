import { VUMeter } from './VUMeter';
import { Crossfader } from './Crossfader';
import { ChannelFader } from './ChannelFader';
import { CrossfaderCurveSelector } from './CrossfaderCurveSelector';
import { MasterVolumeKnob } from './MasterVolumeKnob';
import { HeadphoneMixKnob } from './HeadphoneMixKnob';
import { GainKnob } from './GainKnob';
import { BeatmatchGuide } from './BeatmatchGuide';
import { EQPanel } from './EQPanel';
import styles from './Mixer.module.css';

/**
 * Mixer — center column mixer strip between Deck A and Deck B.
 *
 * Layout: EQPanel (Deck A) | vertical mixer stack | EQPanel (Deck B).
 * The vertical stack itself contains (top to bottom):
 *   - "MIXER" section label
 *   - Master volume control
 *   - Headphone CUE/MIX blend (Phase 4)
 *   - Per-deck channel input trim (GAIN)
 *   - Per-deck channel volume faders (CH A / CH B)
 *   - VU meters (visual-only, animated from volume level)
 *   - Beatmatch guide (tempo + phase alignment between decks)
 *   - Crossfader (with crossfader curve selector)
 *
 * Volume application pattern:
 *   mixerStore.setCrossfaderPosition / setChannelFaderA / setChannelFaderB
 *   → recalculates composite volumes
 *   → calls deckStore.setVolume(deckId, compositeVol)
 *   → audio engine subscription picks up the store change and calls player.setVolume()
 *
 * This satisfies the <50ms response requirement because the entire chain is
 * synchronous within the React state update triggered by the input event.
 */
export function Mixer() {
  return (
    <div className={styles.mixer}>
      <div className={styles.eqColumn}>
        <EQPanel deckId="A" />
      </div>

      <div className={styles.mixerCenter}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>MIXER</span>
        </div>

        {/* Master volume — global output level above channel faders */}
        <section className={styles.section} aria-label="Master volume">
          <MasterVolumeKnob />
        </section>

        {/* Headphone CUE/MIX blend — Phase 4 */}
        <section className={styles.section} aria-label="Headphone mix">
          <HeadphoneMixKnob />
        </section>

        {/* Channel input trim (GAIN) — top of the controller's mixer column */}
        <section className={styles.section} aria-label="Channel gain">
          <div className={styles.sectionLabel}>GAIN</div>
          <div className={styles.channelRow}>
            <GainKnob deckId="A" />
            <GainKnob deckId="B" />
          </div>
        </section>

        {/* Channel faders — per-deck volume controls in the mixer strip */}
        <section className={styles.section} aria-label="Channel faders">
          <div className={styles.sectionLabel}>CH FADERS</div>
          <div className={styles.channelRow}>
            <ChannelFader deckId="A" />
            <ChannelFader deckId="B" />
          </div>
        </section>

        {/* VU Meters */}
        <section className={styles.section} aria-label="Level meters">
          <div className={styles.sectionLabel}>LEVELS</div>
          <div className={styles.vuRow}>
            <div className={styles.vuChannel}>
              <span className={styles.vuLabel} style={{ color: 'var(--color-deck-a-text)' }}>A</span>
              <VUMeter deckId="A" />
            </div>
            <div className={styles.vuChannel}>
              <span className={styles.vuLabel} style={{ color: 'var(--color-deck-b-text)' }}>B</span>
              <VUMeter deckId="B" />
            </div>
          </div>
        </section>

        {/* Beatmatch guide — tempo + phase alignment between decks */}
        <section className={styles.section}>
          <BeatmatchGuide />
        </section>

        {/* Crossfader */}
        <section className={styles.section} aria-label="Crossfader">
          <div className={styles.sectionLabel}>CROSSFADER</div>
          <Crossfader />
          <CrossfaderCurveSelector />
        </section>
      </div>

      <div className={styles.eqColumn}>
        <EQPanel deckId="B" />
      </div>
    </div>
  );
}

export default Mixer;
