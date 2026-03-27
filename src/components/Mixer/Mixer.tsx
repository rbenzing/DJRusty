import { VUMeter } from './VUMeter';
import { Crossfader } from './Crossfader';
import { ChannelFader } from './ChannelFader';
import { CrossfaderCurveSelector } from './CrossfaderCurveSelector';
import { MasterVolumeKnob } from './MasterVolumeKnob';
import styles from './Mixer.module.css';

/**
 * Mixer — center column mixer strip between Deck A and Deck B.
 *
 * Contains (top to bottom):
 *   - "MIXER" section label
 *   - Per-deck channel volume faders (CH A / CH B)
 *   - VU meters (visual-only, animated from volume level)
 *   - Crossfader (with crossfader curve selector)
 *   - Master volume control
 *
 * Volume application pattern:
 *   mixerStore.setCrossfaderPosition / setChannelFaderA / setChannelFaderB
 *   → recalculates composite volumes
 *   → calls deckStore.setVolume(deckId, compositeVol)
 *   → useYouTubePlayer subscription picks up the store change
 *   → calls player.setVolume() on the IFrame player
 *
 * This satisfies the <50ms response requirement because the entire chain is
 * synchronous within the React state update triggered by the input event.
 */
export function Mixer() {
  return (
    <div className={styles.mixer}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.title}>MIXER</span>
      </div>

      {/* Master volume — global output level above channel faders */}
      <section className={styles.section} aria-label="Master volume">
        <MasterVolumeKnob />
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

      {/* Crossfader */}
      <section className={styles.section} aria-label="Crossfader">
        <div className={styles.sectionLabel}>CROSSFADER</div>
        <Crossfader />
        <CrossfaderCurveSelector />
      </section>

    </div>
  );
}

export default Mixer;
