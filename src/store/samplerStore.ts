/**
 * samplerStore.ts — Per-deck SAMPLER pad slots (Phase 2c).
 *
 * 8 slots per deck, each holding a locally-loaded one-shot sample. Slots are
 * deck-scoped, not track-scoped — this store is entirely separate from
 * deckStore, so loadTrack/clearTrack never touch it. Decoding is eager (on
 * load), not lazy, so triggering a pad has zero playback lag.
 *
 * File-type/size validation happens in the caller (PadGridSampler.tsx),
 * mirroring FileImportZone's existing division of responsibility — this
 * store's loadFile always attempts to decode whatever file it's given.
 */
import { create } from 'zustand';
import { decodeAudioFile } from '../services/audioDecoder';

const SLOT_COUNT = 8;

export interface SampleSlot {
  fileName: string;
  file: File;
  buffer: AudioBuffer | null;
  decoding: boolean;
  decodeError: string | null;
}

interface SamplerState {
  slots: Record<'A' | 'B', (SampleSlot | null)[]>;
}

interface SamplerActions {
  /** Decode a file into the given slot. Sets decoding:true immediately, then either buffer or decodeError. */
  loadFile: (deckId: 'A' | 'B', slotIndex: number, file: File) => Promise<void>;
  /** Clear a slot back to empty. Does not stop any currently-playing instance from that slot. */
  clearSlot: (deckId: 'A' | 'B', slotIndex: number) => void;
  /** Restore an already-decoded slot (used by session load — no re-decode needed). */
  restoreSlot: (deckId: 'A' | 'B', slotIndex: number, slot: SampleSlot) => void;
}

type SamplerStore = SamplerState & SamplerActions;

function emptySlots(): (SampleSlot | null)[] {
  return Array.from({ length: SLOT_COUNT }, () => null);
}

// Module-level generation counters, one per (deckId, slotIndex) — incremented on
// every loadFile call AND every clearSlot/restoreSlot call, so a decode that resolves
// after being superseded (by a newer loadFile, an explicit clear, or a session
// restore) is discarded rather than silently overwriting newer state
// ("last-resolved-wins" bug). Not part of Zustand state — this is bookkeeping, not
// UI-relevant data, matching how samplerEngine.ts keeps its own module-level state.
const generations = new Map<string, number>();

function slotKey(deckId: 'A' | 'B', slotIndex: number): string {
  return `${deckId}:${slotIndex}`;
}

function bumpGeneration(deckId: 'A' | 'B', slotIndex: number): number {
  const key = slotKey(deckId, slotIndex);
  const next = (generations.get(key) ?? 0) + 1;
  generations.set(key, next);
  return next;
}

function currentGeneration(deckId: 'A' | 'B', slotIndex: number): number {
  return generations.get(slotKey(deckId, slotIndex)) ?? 0;
}

export const useSamplerStore = create<SamplerStore>((set) => ({
  slots: { A: emptySlots(), B: emptySlots() },

  loadFile: async (deckId, slotIndex, file) => {
    const myGeneration = bumpGeneration(deckId, slotIndex);
    set((state) => {
      const deckSlots = [...state.slots[deckId]];
      deckSlots[slotIndex] = { fileName: file.name, file, buffer: null, decoding: true, decodeError: null };
      return { slots: { ...state.slots, [deckId]: deckSlots } };
    });
    try {
      const buffer = await decodeAudioFile(file);
      if (currentGeneration(deckId, slotIndex) !== myGeneration) return;
      set((state) => {
        const deckSlots = [...state.slots[deckId]];
        deckSlots[slotIndex] = { fileName: file.name, file, buffer, decoding: false, decodeError: null };
        return { slots: { ...state.slots, [deckId]: deckSlots } };
      });
    } catch {
      if (currentGeneration(deckId, slotIndex) !== myGeneration) return;
      set((state) => {
        const deckSlots = [...state.slots[deckId]];
        deckSlots[slotIndex] = {
          fileName: file.name, file, buffer: null, decoding: false,
          decodeError: "Couldn't decode — this format may be unsupported in your browser",
        };
        return { slots: { ...state.slots, [deckId]: deckSlots } };
      });
    }
  },

  clearSlot: (deckId, slotIndex) => {
    bumpGeneration(deckId, slotIndex);
    set((state) => {
      const deckSlots = [...state.slots[deckId]];
      deckSlots[slotIndex] = null;
      return { slots: { ...state.slots, [deckId]: deckSlots } };
    });
  },

  restoreSlot: (deckId, slotIndex, slot) => {
    bumpGeneration(deckId, slotIndex);
    set((state) => {
      const deckSlots = [...state.slots[deckId]];
      deckSlots[slotIndex] = slot;
      return { slots: { ...state.slots, [deckId]: deckSlots } };
    });
  },
}));
