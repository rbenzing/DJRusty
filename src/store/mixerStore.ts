import { create } from 'zustand';
import type { MixerState, CrossfaderCurve } from '../types/mixer';
import { crossfaderToVolumes, compositeVolume } from '../utils/volumeMap';
import { useDeckStore } from './deckStore';
import { useSettingsStore } from './settingsStore';

interface MixerStoreActions {
  /** Set the crossfader position (0.0 = full A, 1.0 = full B). */
  setCrossfaderPosition: (position: number) => void;

  /** Set the channel fader level for Deck A (0–100). */
  setChannelFaderA: (volume: number) => void;

  /** Set the channel fader level for Deck B (0–100). */
  setChannelFaderB: (volume: number) => void;

  /** Set the computed output volumes (called after crossfader/fader calculations). */
  setDeckVolumes: (deckAVolume: number, deckBVolume: number) => void;

  /** Set the crossfader curve shape and immediately recalculate deck volumes. */
  setCrossfaderCurve: (curve: CrossfaderCurve) => void;
}

type MixerStore = MixerState & MixerStoreActions;

const INITIAL_STATE: MixerState = {
  crossfaderPosition: 0.5,
  channelFaderA: 100,
  channelFaderB: 100,
  deckAVolume: 71,
  deckBVolume: 71,
  crossfaderCurve: 'smooth' as CrossfaderCurve,
};

/**
 * Applies the computed composite volumes to the deck store so that
 * the useYouTubePlayer hook subscription picks them up and calls
 * player.setVolume() on each IFrame player.
 *
 * STORY-013: masterVolume from settingsStore is applied as a multiplier
 * to the composite volume of each deck before pushing to the deck store.
 * compositeVolume * (masterVolume / 100)
 */
function applyVolumesToDecks(
  crossfaderPosition: number,
  channelFaderA: number,
  channelFaderB: number,
  curve: CrossfaderCurve,
): { deckAVolume: number; deckBVolume: number } {
  const { a: cfVolA, b: cfVolB } = crossfaderToVolumes(crossfaderPosition, curve);
  const masterVolume = useSettingsStore.getState().masterVolume;
  const masterScale = masterVolume / 100;

  const deckAVolume = Math.round(compositeVolume(cfVolA, channelFaderA) * masterScale);
  const deckBVolume = Math.round(compositeVolume(cfVolB, channelFaderB) * masterScale);

  // Push volumes to deckStore so useYouTubePlayer subscription calls setVolume()
  const { setVolume } = useDeckStore.getState();
  setVolume('A', deckAVolume);
  setVolume('B', deckBVolume);

  return { deckAVolume, deckBVolume };
}

export const useMixerStore = create<MixerStore>((set, get) => ({
  ...INITIAL_STATE,

  setCrossfaderPosition: (position) => {
    const { channelFaderA, channelFaderB, crossfaderCurve } = get();
    const { deckAVolume, deckBVolume } = applyVolumesToDecks(position, channelFaderA, channelFaderB, crossfaderCurve);
    set({ crossfaderPosition: position, deckAVolume, deckBVolume });
  },

  setChannelFaderA: (volume) => {
    const { crossfaderPosition, channelFaderB, crossfaderCurve } = get();
    const { deckAVolume, deckBVolume } = applyVolumesToDecks(crossfaderPosition, volume, channelFaderB, crossfaderCurve);
    set({ channelFaderA: volume, deckAVolume, deckBVolume });
  },

  setChannelFaderB: (volume) => {
    const { crossfaderPosition, channelFaderA, crossfaderCurve } = get();
    const { deckAVolume, deckBVolume } = applyVolumesToDecks(crossfaderPosition, channelFaderA, volume, crossfaderCurve);
    set({ channelFaderB: volume, deckAVolume, deckBVolume });
  },

  setDeckVolumes: (deckAVolume, deckBVolume) => {
    set({ deckAVolume, deckBVolume });
  },

  setCrossfaderCurve: (curve) => {
    const { crossfaderPosition, channelFaderA, channelFaderB } = get();
    const { deckAVolume, deckBVolume } = applyVolumesToDecks(
      crossfaderPosition, channelFaderA, channelFaderB, curve,
    );
    set({ crossfaderCurve: curve, deckAVolume, deckBVolume });
  },
}));
