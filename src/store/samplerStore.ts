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

export const useSamplerStore = create<SamplerStore>((set) => ({
  slots: { A: emptySlots(), B: emptySlots() },

  loadFile: async (deckId, slotIndex, file) => {
    set((state) => {
      const deckSlots = [...state.slots[deckId]];
      deckSlots[slotIndex] = { fileName: file.name, file, buffer: null, decoding: true, decodeError: null };
      return { slots: { ...state.slots, [deckId]: deckSlots } };
    });
    try {
      const buffer = await decodeAudioFile(file);
      set((state) => {
        const deckSlots = [...state.slots[deckId]];
        deckSlots[slotIndex] = { fileName: file.name, file, buffer, decoding: false, decodeError: null };
        return { slots: { ...state.slots, [deckId]: deckSlots } };
      });
    } catch {
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
    set((state) => {
      const deckSlots = [...state.slots[deckId]];
      deckSlots[slotIndex] = null;
      return { slots: { ...state.slots, [deckId]: deckSlots } };
    });
  },

  restoreSlot: (deckId, slotIndex, slot) => {
    set((state) => {
      const deckSlots = [...state.slots[deckId]];
      deckSlots[slotIndex] = slot;
      return { slots: { ...state.slots, [deckId]: deckSlots } };
    });
  },
}));
