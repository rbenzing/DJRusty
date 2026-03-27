import { useCallback } from 'react';
import { useMixerStore } from '../../store/mixerStore';
import styles from './ChannelFader.module.css';

interface ChannelFaderProps {
  deckId: 'A' | 'B';
}

/**
 * ChannelFader — per-deck vertical channel volume fader in the mixer strip.
 *
 * Controls `channelFaderA` / `channelFaderB` in mixerStore (0–100).
 * When changed the store recalculates and pushes composite volumes to deckStore
 * so the IFrame player updates within the same event loop tick.
 */
export function ChannelFader({ deckId }: ChannelFaderProps) {
  const channelFaderA = useMixerStore((s) => s.channelFaderA);
  const channelFaderB = useMixerStore((s) => s.channelFaderB);
  const setChannelFaderA = useMixerStore((s) => s.setChannelFaderA);
  const setChannelFaderB = useMixerStore((s) => s.setChannelFaderB);

  const value = deckId === 'A' ? channelFaderA : channelFaderB;
  const setter = deckId === 'A' ? setChannelFaderA : setChannelFaderB;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(parseInt(e.target.value, 10));
    },
    [setter],
  );

  const deckClass = deckId === 'A' ? styles.faderA : styles.faderB;

  return (
    <div className={`${styles.faderContainer} ${deckClass}`}>
      <span className={styles.label}>CH {deckId}</span>
      <input
        type="range"
        className={styles.fader}
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={handleChange}
        aria-label={`Channel ${deckId} fader`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value}%`}
      />
      <span className={styles.value}>{value}</span>
    </div>
  );
}

export default ChannelFader;
