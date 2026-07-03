# SAMPLER Phase 2c Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the SAMPLER pad mode — 8 per-deck one-shot sample slots that load local audio files and trigger playback through a dedicated, mixer-independent gain bus — replacing the currently-disabled SAMPLER placeholder in `PadGrid`.

**Architecture:** A new `samplerStore.ts` holds 8 sample slots per deck (file + decoded buffer + decode state). A new `samplerEngine.ts` service creates one dedicated `GainNode` bus per deck (bypassing the channel fader/crossfader, still scaled by MASTER) and plays one-shot sources with cut-off-and-restart retrigger semantics, tracked in a module-level map (never in Zustand). A new `PadGridSampler.tsx` component handles loading (drag-drop/click-to-browse) and triggering. `sessionStore.ts` is extended to persist sample slots through the existing IndexedDB session save/load feature.

**Tech Stack:** React 18 + TypeScript (strict), Zustand, Web Audio API, Vitest (jsdom), `@testing-library/react`, CSS Modules.

## Global Constraints

- **Strict TS:** `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` are ON. Indexed access is `T | undefined` (guard/assert).
- **Lint:** `npm run lint` is zero-warnings (`--max-warnings 0`).
- **Fader routing:** samples MUST bypass the channel fader/crossfader/EQ entirely, routing through a dedicated per-deck bus straight to the audio destination. The bus MUST still scale with `settingsStore.masterVolume`.
- **Retrigger:** pressing an already-playing slot's pad stops that slot's current instance before starting a new one. Different slots/decks always overlap freely.
- **Decode timing:** eager (on load), not lazy (on first press).
- **Sample slots are deck-scoped, not track-scoped** — NOT reset by `loadTrack`/`clearTrack` (they live in their own store, separate from `deckStore`, so this is automatic — just don't wire any reset).
- **Imperative audio handles never live in Zustand** — the `playing` source-node map lives in `samplerEngine.ts`'s module scope, matching this project's core architecture rule (mirrors `playerRegistry.ts`).
- Tests live flat in `src/test/`. CSS Modules co-located under `src/components/`.
- After implementation: `npm run build` (`tsc -b && vite build`) and `npm run lint`, per project CLAUDE.md.

---

## File Structure

**New:**
- `src/store/samplerStore.ts` — `SampleSlot` type + per-deck 8-slot array; `loadFile`/`clearSlot`/`restoreSlot` actions.
- `src/services/samplerEngine.ts` — per-deck bus creation, `playSample`, `setSamplerVolume`, master-volume propagation.
- `src/components/Deck/PadGridSampler.tsx` + `.module.css` — 8 pads + SAMPLE VOL slider.
- `src/test/samplerStore.test.ts`, `src/test/samplerEngine.test.ts`, `src/test/PadGridSampler.test.tsx` — new tests.

**Modified:**
- `src/components/Deck/PadGrid.tsx` — flip SAMPLER's `disabled: true` → `false`; render `PadGridSampler`; update doc comment.
- `src/test/PadGrid.test.tsx` — SAMPLER's disabled-check test replaced with an enabled/renders test.
- `src/services/sessionStore.ts` — `SavedSession.samplers` field; `snapshot()`/`loadSession()` extended.
- `src/test/sessionStore.test.ts` — one new round-trip test.

---

## Task 1: `samplerStore.ts` — sample slot state

**Files:**
- Create: `src/store/samplerStore.ts`
- Test: `src/test/samplerStore.test.ts`

**Interfaces:**
- Consumes: `decodeAudioFile` from `src/services/audioDecoder.ts` (already exists, unchanged).
- Produces: `SampleSlot` type (`{ fileName: string; file: File; buffer: AudioBuffer | null; decoding: boolean; decodeError: string | null }`); `useSamplerStore` with `slots: Record<'A' | 'B', (SampleSlot | null)[]>` (8 entries each); actions `loadFile(deckId, slotIndex, file): Promise<void>`, `clearSlot(deckId, slotIndex): void`, `restoreSlot(deckId, slotIndex, slot: SampleSlot): void`.

- [ ] **Step 1: Write the failing test**

Create `src/test/samplerStore.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSamplerStore } from '../store/samplerStore';
import * as audioDecoder from '../services/audioDecoder';

describe('samplerStore', () => {
  beforeEach(() => {
    useSamplerStore.setState({ slots: { A: Array(8).fill(null), B: Array(8).fill(null) } });
    vi.restoreAllMocks();
  });

  it('starts with 8 empty slots per deck', () => {
    expect(useSamplerStore.getState().slots.A).toHaveLength(8);
    expect(useSamplerStore.getState().slots.A.every((s) => s === null)).toBe(true);
    expect(useSamplerStore.getState().slots.B).toHaveLength(8);
  });

  it('loadFile decodes and stores the buffer', async () => {
    const mockBuffer = { duration: 2 } as AudioBuffer;
    vi.spyOn(audioDecoder, 'decodeAudioFile').mockResolvedValue(mockBuffer);
    const file = new File([new Uint8Array([1, 2, 3])], 'kick.wav', { type: 'audio/wav' });

    const promise = useSamplerStore.getState().loadFile('A', 2, file);
    expect(useSamplerStore.getState().slots.A[2]?.decoding).toBe(true);

    await promise;

    const slot = useSamplerStore.getState().slots.A[2];
    expect(slot?.decoding).toBe(false);
    expect(slot?.buffer).toBe(mockBuffer);
    expect(slot?.fileName).toBe('kick.wav');
    expect(slot?.decodeError).toBeNull();
  });

  it('sets decodeError when decoding fails', async () => {
    vi.spyOn(audioDecoder, 'decodeAudioFile').mockRejectedValue(new Error('bad file'));
    const file = new File([new Uint8Array([1])], 'broken.mp3', { type: 'audio/mpeg' });

    await useSamplerStore.getState().loadFile('B', 0, file);

    const slot = useSamplerStore.getState().slots.B[0];
    expect(slot?.decoding).toBe(false);
    expect(slot?.buffer).toBeNull();
    expect(slot?.decodeError).toBe("Couldn't decode — this format may be unsupported in your browser");
  });

  it('clearSlot empties a slot', async () => {
    const mockBuffer = { duration: 2 } as AudioBuffer;
    vi.spyOn(audioDecoder, 'decodeAudioFile').mockResolvedValue(mockBuffer);
    await useSamplerStore.getState().loadFile('A', 5, new File([new Uint8Array([1])], 'snare.wav', { type: 'audio/wav' }));
    expect(useSamplerStore.getState().slots.A[5]).not.toBeNull();

    useSamplerStore.getState().clearSlot('A', 5);
    expect(useSamplerStore.getState().slots.A[5]).toBeNull();
  });

  it('restoreSlot accepts an already-decoded slot directly', () => {
    const mockBuffer = { duration: 3 } as AudioBuffer;
    const slot = { fileName: 'clap.wav', file: new File([], 'clap.wav'), buffer: mockBuffer, decoding: false, decodeError: null };
    useSamplerStore.getState().restoreSlot('B', 4, slot);
    expect(useSamplerStore.getState().slots.B[4]).toEqual(slot);
  });

  it('slots for deck A and B are independent', async () => {
    const mockBuffer = { duration: 1 } as AudioBuffer;
    vi.spyOn(audioDecoder, 'decodeAudioFile').mockResolvedValue(mockBuffer);
    await useSamplerStore.getState().loadFile('A', 0, new File([new Uint8Array([1])], 'a.wav', { type: 'audio/wav' }));
    expect(useSamplerStore.getState().slots.B[0]).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/samplerStore.test.ts`
Expected: FAIL — cannot find module `../store/samplerStore`.

- [ ] **Step 3: Write minimal implementation**

Create `src/store/samplerStore.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/samplerStore.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/samplerStore.ts src/test/samplerStore.test.ts
git commit -m "feat: samplerStore — per-deck SAMPLER pad slot state"
```

---

## Task 2: `samplerEngine.ts` — dedicated per-deck playback bus

**Files:**
- Create: `src/services/samplerEngine.ts`
- Test: `src/test/samplerEngine.test.ts`

**Interfaces:**
- Consumes: `getAudioContext` from `src/services/audioContext.ts` (unchanged); `useSettingsStore` from `src/store/settingsStore.ts` (unchanged, reads `masterVolume`).
- Produces: `playSample(deckId: 'A' | 'B', slotIndex: number, buffer: AudioBuffer): void`; `setSamplerVolume(deckId: 'A' | 'B', volume: number): void`.

**Testing note:** this module holds module-level singleton state (one bus per deck, created lazily on first use — mirrors `audioContext.ts`'s own singleton pattern). Because Vitest gives each test FILE its own isolated module registry, this state resets between test *files* but persists across `it()` blocks *within* this one file. The tests below account for this by using distinct deck/slot combinations per test rather than expecting a clean-slate reset — do not "fix" this by adding a test-only reset export to the production module.

- [ ] **Step 1: Write the failing test**

Create `src/test/samplerEngine.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { playSample, setSamplerVolume } from '../services/samplerEngine';
import { useSettingsStore } from '../store/settingsStore';

const mockContext = {
  createGain: vi.fn(),
  createBufferSource: vi.fn(),
  destination: {},
  currentTime: 0,
  state: 'running',
  sampleRate: 44100,
};

function makeMockGain() {
  return { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } };
}

function makeMockSource() {
  return { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), buffer: null as AudioBuffer | null, onended: null as (() => void) | null };
}

vi.mock('../services/audioContext', () => ({
  getAudioContext: () => mockContext,
}));

describe('samplerEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ masterVolume: 100 });
  });

  it('creates a dedicated bus per deck, connected to destination', () => {
    const mockGain = makeMockGain();
    mockContext.createGain.mockReturnValueOnce(mockGain);
    const mockSource = makeMockSource();
    mockContext.createBufferSource.mockReturnValueOnce(mockSource);
    const buffer = { duration: 1 } as AudioBuffer;

    playSample('A', 0, buffer);

    expect(mockGain.connect).toHaveBeenCalledWith(mockContext.destination);
    expect(mockSource.connect).toHaveBeenCalledWith(mockGain);
    expect(mockSource.buffer).toBe(buffer);
    expect(mockSource.start).toHaveBeenCalledWith(0);
  });

  it('retriggering the same slot stops the previous instance', () => {
    const mockSource1 = makeMockSource();
    const mockSource2 = makeMockSource();
    mockContext.createBufferSource.mockReturnValueOnce(mockSource1).mockReturnValueOnce(mockSource2);
    const buffer = { duration: 1 } as AudioBuffer;

    playSample('A', 1, buffer);
    playSample('A', 1, buffer);

    expect(mockSource1.stop).toHaveBeenCalled();
    expect(mockSource2.stop).not.toHaveBeenCalled();
  });

  it('different slots do not stop each other', () => {
    const mockSource1 = makeMockSource();
    const mockSource2 = makeMockSource();
    mockContext.createBufferSource.mockReturnValueOnce(mockSource1).mockReturnValueOnce(mockSource2);
    const buffer = { duration: 1 } as AudioBuffer;

    playSample('A', 2, buffer);
    playSample('A', 3, buffer);

    expect(mockSource1.stop).not.toHaveBeenCalled();
  });

  it('setSamplerVolume and master volume both scale the bus gain', () => {
    const mockGain = makeMockGain();
    mockContext.createGain.mockReturnValueOnce(mockGain);
    mockContext.createBufferSource.mockReturnValueOnce(makeMockSource());
    playSample('B', 4, { duration: 1 } as AudioBuffer); // creates B's bus

    setSamplerVolume('B', 50);
    expect(mockGain.gain.value).toBeCloseTo(0.5, 6); // 50% volume * 100% master

    useSettingsStore.setState({ masterVolume: 50 });
    expect(mockGain.gain.value).toBeCloseTo(0.25, 6); // 50% volume * 50% master
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/samplerEngine.test.ts`
Expected: FAIL — cannot find module `../services/samplerEngine`.

- [ ] **Step 3: Write minimal implementation**

Create `src/services/samplerEngine.ts`:

```ts
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
import { getAudioContext } from './audioContext';
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/samplerEngine.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/samplerEngine.ts src/test/samplerEngine.test.ts
git commit -m "feat: samplerEngine — dedicated per-deck sample playback bus"
```

---

## Task 3: `PadGridSampler` component

**Files:**
- Create: `src/components/Deck/PadGridSampler.tsx`
- Create: `src/components/Deck/PadGridSampler.module.css`
- Test: `src/test/PadGridSampler.test.tsx`

**Interfaces:**
- Consumes: `useSamplerStore` (Task 1); `playSample`, `setSamplerVolume` (Task 2).
- Produces: `<PadGridSampler deckId="A" | "B" />` — 8 sample pads in a 2×4 grid + a SAMPLE VOL slider.

- [ ] **Step 1: Write the failing test**

Create `src/test/PadGridSampler.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PadGridSampler } from '../components/Deck/PadGridSampler';
import { useSamplerStore } from '../store/samplerStore';
import * as samplerEngine from '../services/samplerEngine';

describe('PadGridSampler', () => {
  beforeEach(() => {
    useSamplerStore.setState({ slots: { A: Array(8).fill(null), B: Array(8).fill(null) } });
    vi.restoreAllMocks();
  });

  it('renders 8 empty slots by default', () => {
    render(<PadGridSampler deckId="A" />);
    expect(screen.getByRole('button', { name: /sample slot 1 on deck a: empty/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sample slot 8 on deck a: empty/i })).toBeInTheDocument();
  });

  it('dropping a valid audio file onto an empty slot loads it', () => {
    render(<PadGridSampler deckId="A" />);
    const pad = screen.getByRole('button', { name: /sample slot 3 on deck a: empty/i });
    const file = new File([new Uint8Array([1])], 'kick.wav', { type: 'audio/wav' });
    fireEvent.drop(pad, { dataTransfer: { files: [file] } });
    expect(useSamplerStore.getState().slots.A[2]?.decoding).toBe(true);
  });

  it('dropping an invalid file does not load it', () => {
    render(<PadGridSampler deckId="A" />);
    const pad = screen.getByRole('button', { name: /sample slot 1 on deck a: empty/i });
    const file = new File([new Uint8Array([1])], 'not-audio.txt', { type: 'text/plain' });
    fireEvent.drop(pad, { dataTransfer: { files: [file] } });
    expect(useSamplerStore.getState().slots.A[0]).toBeNull();
  });

  it('clicking a loaded pad triggers playback', () => {
    const playSpy = vi.spyOn(samplerEngine, 'playSample').mockImplementation(() => {});
    const buffer = { duration: 1 } as AudioBuffer;
    useSamplerStore.getState().restoreSlot('A', 4, {
      fileName: 'clap.wav', file: new File([], 'clap.wav'), buffer, decoding: false, decodeError: null,
    });
    render(<PadGridSampler deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /sample slot 5 on deck a: clap.wav/i }));
    expect(playSpy).toHaveBeenCalledWith('A', 4, buffer);
  });

  it('right-clicking a loaded pad clears it', () => {
    const buffer = { duration: 1 } as AudioBuffer;
    useSamplerStore.getState().restoreSlot('A', 6, {
      fileName: 'hat.wav', file: new File([], 'hat.wav'), buffer, decoding: false, decodeError: null,
    });
    render(<PadGridSampler deckId="A" />);
    fireEvent.contextMenu(screen.getByRole('button', { name: /sample slot 7 on deck a: hat.wav/i }));
    expect(useSamplerStore.getState().slots.A[6]).toBeNull();
  });

  it('moving the SAMPLE VOL slider calls setSamplerVolume', () => {
    const volSpy = vi.spyOn(samplerEngine, 'setSamplerVolume').mockImplementation(() => {});
    render(<PadGridSampler deckId="A" />);
    fireEvent.change(screen.getByRole('slider', { name: /sample volume for deck a/i }), { target: { value: '60' } });
    expect(volSpy).toHaveBeenCalledWith('A', 60);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/PadGridSampler.test.tsx`
Expected: FAIL — cannot find module `../components/Deck/PadGridSampler`.

- [ ] **Step 3: Create the component + CSS**

Create `src/components/Deck/PadGridSampler.tsx`:

```tsx
/**
 * PadGridSampler.tsx — SAMPLER pad-mode panel, rendered inside PadGrid.
 *
 * 8 one-shot sample slots in a 2x4 grid, plus a SAMPLE VOL slider for this
 * deck's dedicated gain bus (independent of the channel fader/crossfader,
 * still scaled by MASTER — see samplerEngine.ts). Empty slots accept a
 * dropped file or open a file picker on click; loaded slots trigger
 * playback on click and clear on right-click. Slots are deck-scoped, not
 * track-scoped — this reads samplerStore, entirely separate from deckStore,
 * so loadTrack/clearTrack never touch them.
 *
 * File-type/size validation happens here (mirroring FileImportZone's own
 * validate-then-delegate pattern) — samplerStore.loadFile always attempts
 * to decode whatever it's given.
 */
import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useSamplerStore } from '../../store/samplerStore';
import { playSample, setSamplerVolume } from '../../services/samplerEngine';
import styles from './PadGridSampler.module.css';

const SLOT_COUNT = 8;
const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB, matches FileImportZone

interface PadGridSamplerProps {
  deckId: 'A' | 'B';
}

function isAudioType(type: string): boolean {
  return type.startsWith('audio/');
}

export function PadGridSampler({ deckId }: PadGridSamplerProps) {
  const slots = useSamplerStore((s) => s.slots[deckId]);
  const [volume, setVolume] = useState(100);
  const [dragoverIndex, setDragoverIndex] = useState<number | null>(null);
  const [rejectedIndex, setRejectedIndex] = useState<number | null>(null);
  const pendingSlotIndex = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function acceptFile(slotIndex: number, file: File): void {
    if (!isAudioType(file.type) || file.size > MAX_FILE_SIZE_BYTES) {
      setRejectedIndex(slotIndex);
      window.setTimeout(() => setRejectedIndex((cur) => (cur === slotIndex ? null : cur)), 2000);
      return;
    }
    setRejectedIndex(null);
    void useSamplerStore.getState().loadFile(deckId, slotIndex, file);
  }

  function handlePadClick(slotIndex: number): void {
    const slot = slots[slotIndex];
    if (slot?.buffer) {
      playSample(deckId, slotIndex, slot.buffer);
      return;
    }
    if (!slot) {
      pendingSlotIndex.current = slotIndex;
      inputRef.current?.click();
    }
  }

  function handlePadContextMenu(e: React.MouseEvent, slotIndex: number): void {
    e.preventDefault();
    if (slots[slotIndex]) {
      useSamplerStore.getState().clearSlot(deckId, slotIndex);
    }
  }

  function handleDrop(e: DragEvent<HTMLButtonElement>, slotIndex: number): void {
    e.preventDefault();
    setDragoverIndex(null);
    const file = e.dataTransfer.files[0];
    if (file) acceptFile(slotIndex, file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    const slotIndex = pendingSlotIndex.current;
    if (file && slotIndex !== null) acceptFile(slotIndex, file);
    e.target.value = '';
    pendingSlotIndex.current = null;
  }

  function handleVolumeChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const v = Number(e.target.value);
    setVolume(v);
    setSamplerVolume(deckId, v);
  }

  return (
    <div className={styles.wrapper}>
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.wav,.flac,.ogg,.m4a,.aac,audio/*"
        className={styles.hiddenInput}
        onChange={handleInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className={styles.volumeRow}>
        <span className={styles.volumeLabel}>SAMPLE VOL</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={volume}
          onChange={handleVolumeChange}
          aria-label={`Sample volume for Deck ${deckId}`}
        />
      </div>
      <div className={styles.pads}>
        {Array.from({ length: SLOT_COUNT }, (_, index) => {
          const slot = slots[index];
          const isEmpty = !slot;
          const isDecoding = slot?.decoding ?? false;
          const hasError = !!slot?.decodeError;
          const isLoaded = !!slot?.buffer;
          const isDragover = dragoverIndex === index;
          const isRejected = rejectedIndex === index;

          const label = isEmpty
            ? `Sample slot ${index + 1} on Deck ${deckId}: empty. Click or drop a file to load.`
            : isDecoding
              ? `Sample slot ${index + 1} on Deck ${deckId}: decoding ${slot.fileName}.`
              : hasError
                ? `Sample slot ${index + 1} on Deck ${deckId}: failed to decode ${slot.fileName}.`
                : `Sample slot ${index + 1} on Deck ${deckId}: ${slot.fileName}. Click to play, right-click to clear.`;

          return (
            <button
              key={index}
              type="button"
              className={[
                styles.pad,
                isLoaded ? styles.padLoaded : '',
                (hasError || isRejected) ? styles.padError : '',
                isDragover ? styles.padDragover : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handlePadClick(index)}
              onContextMenu={(e) => handlePadContextMenu(e, index)}
              onDragOver={(e) => { e.preventDefault(); setDragoverIndex(index); }}
              onDragLeave={() => setDragoverIndex((cur) => (cur === index ? null : cur))}
              onDrop={(e) => handleDrop(e, index)}
              aria-label={label}
              title={label}
            >
              {isDecoding ? '…' : hasError ? '⚠' : isEmpty ? `${index + 1}` : slot.fileName}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default PadGridSampler;
```

Create `src/components/Deck/PadGridSampler.module.css`:

```css
.wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.hiddenInput {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
}

.volumeRow {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.volumeLabel {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  font-weight: 700;
  flex-shrink: 0;
}

.pads {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-2);
}

.pad {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 28px;
  padding: 0 var(--space-2);
  background: #1a1a1a;
  border: 1px dashed #333333;
  border-radius: var(--radius-md);
  color: #888888;
  font-size: var(--text-xs);
  font-weight: 700;
  font-family: var(--font-primary);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast),
    color var(--transition-fast);
}

.pad:hover {
  background: #242424;
  border-color: #555555;
  color: #aaaaaa;
}

.pad:focus-visible {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: var(--shadow-focus);
}

.padLoaded {
  background: #1a3a1a;
  border: 1px solid #4a9a4a;
  color: #7fd97f;
}

.padLoaded:hover {
  background: #1f421f;
  border-color: #5aaa5a;
  color: #8fe98f;
}

.padError {
  background: #2a1a1a;
  border: 1px solid #5a2a2a;
  color: #cc6666;
}

.padDragover {
  border-color: var(--color-accent-primary);
  background: var(--color-accent-primary-dim);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/PadGridSampler.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Deck/PadGridSampler.tsx src/components/Deck/PadGridSampler.module.css src/test/PadGridSampler.test.tsx
git commit -m "feat: PadGridSampler component (8 sample pads + SAMPLE VOL slider)"
```

---

## Task 4: Wire `PadGridSampler` into `PadGrid`

**Files:**
- Modify: `src/components/Deck/PadGrid.tsx`
- Modify: `src/test/PadGrid.test.tsx`

**Interfaces:**
- Consumes: `PadGridSampler` (Task 3).
- Produces: `PadGrid`'s SAMPLER mode button is enabled and renders `PadGridSampler` when selected. All four modes are now functional.

- [ ] **Step 1: Update the test first (this will fail)**

In `src/test/PadGrid.test.tsx`, find and replace this test:

```tsx
  it('SAMPLER mode button is disabled', () => {
    render(<PadGrid deckId="A" />);
    expect(screen.getByRole('button', { name: /sampler pad mode for deck a/i })).toBeDisabled();
  });
```

with:

```tsx
  it('switching to SAMPLER mode renders the sample pads', () => {
    render(<PadGrid deckId="A" />);
    const samplerBtn = screen.getByRole('button', { name: /sampler pad mode for deck a/i });
    expect(samplerBtn).not.toBeDisabled();
    fireEvent.click(samplerBtn);
    expect(screen.getByRole('button', { name: /sample slot 1 on deck a/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hot cue 1 on deck a/i })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/PadGrid.test.tsx`
Expected: FAIL — SAMPLER button is still `disabled`.

- [ ] **Step 3: Wire in `PadGridSampler`**

In `src/components/Deck/PadGrid.tsx`, update the top doc comment. Replace these exact lines:

```
 * SLICER / SAMPLER pad section. Only HOT CUE, LOOP, and (as of Phase 2b)
 * SLICER are functional. SAMPLER renders as a disabled placeholder button
 * (Phase 2c lands later, flipping it on with no relayout).
```

with:

```
 * SLICER / SAMPLER pad section. All four modes — HOT CUE, LOOP, SLICER,
 * and (as of Phase 2c) SAMPLER — are functional.
```

Add the import:

```tsx
import { PadGridSampler } from './PadGridSampler';
```

Update the `MODES` array — change the `sampler` entry's `disabled` from `true` to `false`:

```tsx
const MODES: { mode: DeckState['padMode']; label: string; disabled: boolean }[] = [
  { mode: 'hotcue', label: 'HOT CUE', disabled: false },
  { mode: 'loop', label: 'LOOP', disabled: false },
  { mode: 'slicer', label: 'SLICER', disabled: false },
  { mode: 'sampler', label: 'SAMPLER', disabled: false },
];
```

Add the render branch, right after the `PadGridSlicer` line:

```tsx
        {padMode === 'slicer' && <PadGridSlicer deckId={deckId} />}
        {padMode === 'sampler' && <PadGridSampler deckId={deckId} />}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/PadGrid.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Deck/PadGrid.tsx src/test/PadGrid.test.tsx
git commit -m "feat: wire PadGridSampler into PadGrid — SAMPLER mode is now functional"
```

---

## Task 5: Extend session persistence for sample slots

**Files:**
- Modify: `src/services/sessionStore.ts`
- Modify: `src/test/sessionStore.test.ts`

**Interfaces:**
- Consumes: `useSamplerStore`, `SampleSlot` (Task 1); the existing `fileToBlob` helper and `decodeAudioFile` (unchanged).
- Produces: `SavedSession.samplers: { A: ({ fileName: string; blob: Blob } | null)[]; B: (...) }`; `snapshot()` and `loadSession()` extended to round-trip sample slots. Sessions saved before this task (missing the `samplers` key) load with all slots empty — no migration needed.

- [ ] **Step 1: Write the failing test**

In `src/test/sessionStore.test.ts`, add the import:

```ts
import { useSamplerStore } from '../store/samplerStore';
```

Add to the existing `beforeEach` (append this line inside the existing function body, after the `usePlaylistStore.getState().clearPlaylist('B');` line):

```ts
  useSamplerStore.setState({ slots: { A: Array(8).fill(null), B: Array(8).fill(null) } });
```

Add a new test at the end of the file:

```ts
it('save → load round-trips a sampler slot (fileName always restored; buffer/decodeError depend on decode outcome)', async () => {
  const buffer = { duration: 1 } as AudioBuffer;
  const file = new File([new Uint8Array([1, 2, 3])], 'kick.wav', { type: 'audio/wav' });
  useSamplerStore.getState().restoreSlot('A', 0, { fileName: 'kick.wav', file, buffer, decoding: false, decodeError: null });

  await saveSession('WithSamples');

  useSamplerStore.setState({ slots: { A: Array(8).fill(null), B: Array(8).fill(null) } });
  await loadSession('WithSamples');

  const restored = useSamplerStore.getState().slots.A[0];
  expect(restored?.fileName).toBe('kick.wav');
  expect(restored?.decoding).toBe(false);
  // jsdom has no AudioContext implementation and this test doesn't mock
  // audioDecoder/audioContext, so loadSession's real decodeAudioFile call
  // deterministically throws (ReferenceError: AudioContext is not defined),
  // landing in the catch branch — buffer stays null, decodeError is set.
  // This still proves the round-trip (blob saved, file reconstructed,
  // fileName preserved, decode genuinely attempted) without needing a mock.
  expect(restored?.buffer).toBeNull();
  expect(restored?.decodeError).toBe("Couldn't decode — this format may be unsupported in your browser");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/sessionStore.test.ts`
Expected: FAIL — `session.samplers` is `undefined` / restored slot is `null`.

- [ ] **Step 3: Extend `sessionStore.ts`**

In `src/services/sessionStore.ts`, add the import:

```ts
import { useSamplerStore, type SampleSlot } from '../store/samplerStore';
```

Add to the `SavedSession` interface, after the `loops` field:

```ts
  samplers: {
    A: ({ fileName: string; blob: Blob } | null)[];
    B: ({ fileName: string; blob: Blob } | null)[];
  };
```

In `snapshot()`, after the existing `loops` loop (right before the `return` statement), add:

```ts
  const samplerSlots = useSamplerStore.getState().slots;
  const samplers: SavedSession['samplers'] = { A: [], B: [] };
  for (const deckId of ['A', 'B'] as const) {
    samplers[deckId] = await Promise.all(
      samplerSlots[deckId].map(async (slot) => {
        if (!slot) return null;
        return { fileName: slot.fileName, blob: await fileToBlob(slot.file) };
      }),
    );
  }
```

Add `samplers,` to the returned object (alongside `cues, grids, loops,`):

```ts
  return {
    name, savedAt: Date.now(),
    tracks,
    deckA: { queue: pl.playlists.A.map((e) => e.id), currentIndex: pl.currentIndex.A },
    deckB: { queue: pl.playlists.B.map((e) => e.id), currentIndex: pl.currentIndex.B },
    cues, grids, loops, samplers,
  };
```

In `loadSession()`, after the existing `pendingLoops` population loop and before the `const pl = usePlaylistStore.getState();` line, add:

```ts
  if (session.samplers) {
    for (const deckId of ['A', 'B'] as const) {
      const deckSlots = session.samplers[deckId] ?? [];
      for (let i = 0; i < deckSlots.length; i++) {
        const saved = deckSlots[i];
        if (!saved) continue;
        const restoredFile = new File([saved.blob], saved.fileName, { type: saved.blob.type });
        try {
          const buffer = await decodeAudioFile(restoredFile);
          useSamplerStore.getState().restoreSlot(deckId, i, {
            fileName: saved.fileName, file: restoredFile, buffer, decoding: false, decodeError: null,
          });
        } catch {
          useSamplerStore.getState().restoreSlot(deckId, i, {
            fileName: saved.fileName, file: restoredFile, buffer: null, decoding: false,
            decodeError: "Couldn't decode — this format may be unsupported in your browser",
          });
        }
      }
    }
  }
```

Add the import for `decodeAudioFile` (it isn't already imported in this file):

```ts
import { decodeAudioFile } from './audioDecoder';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/sessionStore.test.ts`
Expected: PASS (all tests including the new one).

- [ ] **Step 5: Commit**

```bash
git add src/services/sessionStore.ts src/test/sessionStore.test.ts
git commit -m "feat: extend session save/load to persist SAMPLER slots"
```

---

## Task 6: Full-suite verification (build + lint + all tests + manual smoke test)

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test`
Expected: PASS — all suites green.

- [ ] **Step 2: Type-check + build**

Run: `npm run build`
Expected: `tsc -b` reports no errors; `vite build` completes.

- [ ] **Step 3: Lint (zero warnings)**

Run: `npm run lint`
Expected: exits 0 with no warnings.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`, open the app, and verify for Deck A:
- Switching to SAMPLER mode shows 8 empty numbered pads and a SAMPLE VOL slider.
- Dropping (or picking via click) a local audio file onto an empty pad loads it — the pad briefly shows a decoding indicator, then the filename.
- Clicking a loaded pad plays it audibly; clicking it again while still playing cuts it off and restarts from the beginning.
- Clicking two different loaded pads in quick succession lets both play simultaneously (they don't cut each other off).
- Moving the SAMPLE VOL slider changes the volume of triggered samples without affecting the deck's own track playback volume, EQ, or crossfader response.
- Moving the global MASTER volume (Settings) also scales sample playback volume.
- Right-clicking a loaded pad clears it back to empty.
- Save a session (via the Sessions tab), reload the page, load that session back — the sample pad's file should be restored and playable again.
- HOT CUE, LOOP, and SLICER modes still work exactly as before (regression check).

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: SAMPLER Phase 2c build/lint/test verification fixes"
```

---

## Self-Review (author checklist — completed)

**Spec coverage** (each Phase 2c spec item → task):
- Fader routing (dedicated bus, bypasses channel/crossfader, scaled by MASTER) (§2) → Task 2.
- `sliceWindowBeats`-style... N/A for this phase; deck-scoped/not-track-scoped slots (§2) → Task 1 (separate store, never touched by `deckStore`'s `loadTrack`/`clearTrack`).
- Loading (drag-drop + click-to-browse, invalid-file rejection UI) (§3) → Task 3.
- Retrigger (cut-off-and-restart, per-slot) (§2) → Task 2, explicitly tested.
- Eager decode (§1, §2) → Task 1.
- Session persistence extension (§2) → Task 5.
- Wiring into `PadGrid`, doc comment (§3) → Task 4.
- Testing (§4) → per-task unit/component tests plus Task 6's full-suite gate + manual smoke test.

**Placeholder scan:** none — every step has concrete code/commands, including deterministic assertions for Task 5's session round-trip test (verified jsdom has no `AudioContext` polyfill in this project's `vite.config.ts`/`setup.ts`, so the decode-failure branch is the confirmed, not merely likely, outcome).

**Type consistency:** `SampleSlot`, `useSamplerStore`, `loadFile`/`clearSlot`/`restoreSlot`, `playSample`/`setSamplerVolume`, `PadGridSampler`, `SavedSession.samplers` are used identically across tasks and match their defining tasks.

**Deliberate design notes:**
- File-type/size validation lives in the UI component (Task 3), not the store (Task 1) — mirrors `FileImportZone`'s existing validate-then-delegate division of responsibility exactly.
- The "rejected file" transient UI state uses a plain `window.setTimeout` with no unmount-guard ref — a narrow, low-impact, purely cosmetic risk (a dev-mode React warning if the panel unmounts within the 2-second window), accepted rather than adding an `isMountedRef` for a cosmetic flash, consistent with keeping scope tight.
- `samplerEngine.ts`'s module-level state (bus/playing map) is intentionally never reset by a test-only escape hatch — tests are designed around Vitest's per-file module isolation instead, matching how `playerRegistry.ts` is tested (per-key `unregister`, not a full reset).
