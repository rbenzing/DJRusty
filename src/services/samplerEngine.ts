/**
 * samplerEngine.ts — One-shot sample playback for SAMPLER pads (Phase 2c).
 *
 * One dedicated GainNode bus per deck, connected straight to the audio
 * destination — independent of each deck's own signal chain, the crossfader,
 * and channel faders. Still scaled by the global MASTER volume knob.
 *
 * Playing the same (deckId, slotIndex) again stops the previous instance
 * first (cut-off-and-restart); different slots/decks always overlap freely.
 * Playing source nodes are tracked in a module-level map — imperative audio
 * handles never live in Zustand, per this project's core architecture rule
 * (mirrors playerRegistry.ts).
 */
import { getAudioContext, ensureAudioContextResumed } from './audioContext';
import { useSettingsStore } from '../store/settingsStore';

type DeckId = 'A' | 'B';

const buses: Partial<Record<DeckId, GainNode>> = {};
const samplerVolumes: Record<DeckId, number> = { A: 100, B: 100 };
const playing = new Map<string, AudioBufferSourceNode>();

function slotKey(deckId: DeckId, slotIndex: number): string {
  return `${deckId}:${slotIndex}`;
}

function applyBusGain(deckId: DeckId): void {
  const bus = buses[deckId];
  if (!bus) return;
  const masterVolume = useSettingsStore.getState().masterVolume;
  bus.gain.value = (samplerVolumes[deckId] / 100) * (masterVolume / 100);
}

function getOrCreateBus(deckId: DeckId): GainNode {
  let bus = buses[deckId];
  if (!bus) {
    const context = getAudioContext();
    bus = context.createGain();
    bus.connect(context.destination);
    buses[deckId] = bus;
    applyBusGain(deckId);
  }
  return bus;
}

// Recompute every deck's bus gain whenever masterVolume changes.
useSettingsStore.subscribe((state, prevState) => {
  if (state.masterVolume === prevState.masterVolume) return;
  applyBusGain('A');
  applyBusGain('B');
});

/** Play a one-shot sample. Stops any currently-playing instance from the same slot first. */
export function playSample(deckId: DeckId, slotIndex: number, buffer: AudioBuffer): void {
  void ensureAudioContextResumed();

  const key = slotKey(deckId, slotIndex);
  const existing = playing.get(key);
  if (existing) {
    try { existing.stop(); } catch { /* already stopped */ }
    playing.delete(key);
  }

  const bus = getOrCreateBus(deckId);
  const context = getAudioContext();
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(bus);
  source.onended = () => {
    if (playing.get(key) === source) playing.delete(key);
  };
  source.start(0);
  playing.set(key, source);
}

/** Set the per-deck sampler bus volume (0-100), independent of the composite deck/crossfader chain. */
export function setSamplerVolume(deckId: DeckId, volume: number): void {
  samplerVolumes[deckId] = Math.max(0, Math.min(100, volume));
  applyBusGain(deckId);
}

/** Get the current per-deck sampler bus volume (0-100). */
export function getSamplerVolume(deckId: DeckId): number {
  return samplerVolumes[deckId];
}
