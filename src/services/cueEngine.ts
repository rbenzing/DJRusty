/**
 * cueEngine.ts — Headphone CUE/PFL routing service.
 *
 * Owns a single, lazily-created shared Web Audio node graph that lets a DJ
 * monitor cued deck(s) and/or the main program mix through headphones,
 * routed to a chosen output device via MediaStreamAudioDestinationNode +
 * HTMLMediaElement.setSinkId() (AudioContext.destination itself cannot be
 * redirected to a specific device — only a media element's stream can be).
 *
 * Lazy by design: nothing here touches AudioContext until a real cue-related
 * action happens (a deck's CUE toggled on, the MIX knob moved, or a device
 * picked). registerDeckCueSend/registerDeckProgramTap/unregisterDeck are pure
 * bookkeeping, so they're safe to call unconditionally from every deck's
 * mount/unmount effect — including in test environments with no real
 * AudioContext.
 */
import { getAudioContext } from './audioContext';

type DeckId = 'A' | 'B';

let initialized = false;
let cueBusGain: GainNode;
let programBusGain: GainNode;
let cueMixGain: GainNode;
let programMixGain: GainNode;
let headphoneOutGain: GainNode;
let audioEl: HTMLAudioElement;

const deckCueSends = new Map<DeckId, GainNode>();
const deckAnalysers = new Map<DeckId, AnalyserNode>();
const deckCueEnabled = new Map<DeckId, boolean>();

function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;

  const context = getAudioContext();
  cueBusGain = context.createGain();
  programBusGain = context.createGain();
  cueMixGain = context.createGain();
  programMixGain = context.createGain();
  headphoneOutGain = context.createGain();

  cueBusGain.connect(cueMixGain);
  programBusGain.connect(programMixGain);
  cueMixGain.connect(headphoneOutGain);
  programMixGain.connect(headphoneOutGain);

  const mediaStreamDestination = context.createMediaStreamDestination();
  headphoneOutGain.connect(mediaStreamDestination);

  audioEl = document.createElement('audio');
  audioEl.autoplay = true;
  audioEl.srcObject = mediaStreamDestination.stream;

  // Connect anything registered before this lazy init fired.
  for (const analyser of deckAnalysers.values()) {
    analyser.connect(programBusGain);
  }
  for (const [deckId, enabled] of deckCueEnabled) {
    if (!enabled) continue;
    const send = deckCueSends.get(deckId);
    if (send) send.connect(cueBusGain);
  }
}

/** Feature-detect setSinkId support (absent in Firefox/Safari as of this writing). */
function isOutputDeviceSelectionSupported(): boolean {
  return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
}

export const cueEngine = {
  /** Register a deck's pre-fader cue-send node. Pure bookkeeping — safe on every deck mount. */
  registerDeckCueSend(deckId: DeckId, cueSendGain: GainNode): void {
    deckCueSends.set(deckId, cueSendGain);
  },

  /** Register a deck's final analyser node as a program-bus tap. Pure bookkeeping — safe on every deck mount. */
  registerDeckProgramTap(deckId: DeckId, analyser: AnalyserNode): void {
    deckAnalysers.set(deckId, analyser);
    if (initialized) analyser.connect(programBusGain);
  },

  /** Unregister a deck on unmount — disconnects its cue send if currently live, then forgets it. */
  unregisterDeck(deckId: DeckId): void {
    const send = deckCueSends.get(deckId);
    if (initialized && send && deckCueEnabled.get(deckId)) {
      try { send.disconnect(cueBusGain); } catch { /* already disconnected */ }
    }
    deckCueSends.delete(deckId);
    deckAnalysers.delete(deckId);
    deckCueEnabled.delete(deckId);
  },

  /** Enable/disable a deck's CUE send into the shared cue bus. Triggers lazy init. */
  setDeckCueEnabled(deckId: DeckId, enabled: boolean): void {
    ensureInitialized();
    deckCueEnabled.set(deckId, enabled);
    const send = deckCueSends.get(deckId);
    if (!send) return;
    if (enabled) {
      send.connect(cueBusGain);
    } else {
      try { send.disconnect(cueBusGain); } catch { /* already disconnected */ }
    }
  },

  /** Set the headphone MIX blend: 0 = full cue, 1 = full program. Triggers lazy init. */
  setHeadphoneMix(mix: number): void {
    ensureInitialized();
    const clamped = Math.max(0, Math.min(1, mix));
    const now = getAudioContext().currentTime;
    cueMixGain.gain.setTargetAtTime(1 - clamped, now, 0.01);
    programMixGain.gain.setTargetAtTime(clamped, now, 0.01);
  },

  /** Route the cue/program blend to a specific output device (setSinkId), or the default if deviceId is null. Triggers lazy init. */
  async setHeadphoneDeviceId(deviceId: string | null): Promise<void> {
    ensureInitialized();
    if (!isOutputDeviceSelectionSupported()) return;
    await (audioEl as HTMLAudioElement & { setSinkId(id: string): Promise<void> }).setSinkId(deviceId ?? '');
  },

  isOutputDeviceSelectionSupported,
};

/** Test-only: resets all module-level state between test cases. Never called by production code. */
export function __resetCueEngineForTests(): void {
  initialized = false;
  deckCueSends.clear();
  deckAnalysers.clear();
  deckCueEnabled.clear();
}
