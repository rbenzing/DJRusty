# DJ Rusty — SAMPLER Mode (Phase 2c)

**Date:** 2026-07-03
**Status:** Approved for planning
**Parent spec:** `docs/superpowers/specs/2026-07-02-serato-controller-parity-design.md` §6 ("Phase 2")
**Prior phases:** Phase 2a (PadGrid shell + HOT CUE/LOOP), Phase 2b (SLICER) — both merged to main.
**Goal:** Implement the SAMPLER pad mode — the fourth and final PadGrid mode, currently shown as a disabled placeholder — 8 per-deck sample slots that load local audio files and trigger one-shot playback through a dedicated, mixer-independent gain bus.

---

## 1. Decisions made

- **Fader routing:** samples route through a **dedicated gain bus per deck**, connected straight to the audio destination — bypassing the channel fader, EQ, and crossfader entirely. The bus still scales with the global **MASTER** volume knob (mirroring how the mixer already applies master as a multiplier, via a `settingsStore.masterVolume` subscription applied directly to the bus gain).
- **Loading:** drag-drop a file onto an empty pad, or click an empty pad to open a file picker. Right-click a loaded pad clears it (matching hot cues' clear gesture).
- **Persistence:** samples persist via the existing IndexedDB session save/load feature (`sessionStore.ts`) — extended now, not deferred.
- **Retrigger:** pressing an already-playing slot's pad cuts off that slot's current instance and restarts from the beginning. Different slots always overlap freely.
- **Decode timing:** eager (on load), not lazy (on first press) — a one-shot sampler needs zero playback lag on trigger, unlike the Library's lazy-decode-on-deck-load convention.
- **Scope:** per-deck (8 slots for Deck A, 8 for Deck B), matching the existing per-deck architecture of HOT CUE/LOOP/SLICER.

## 2. Data model

### New store: `src/store/samplerStore.ts`

```ts
export interface SampleSlot {
  fileName: string;
  file: File;
  buffer: AudioBuffer | null;   // null while decoding
  decoding: boolean;
  decodeError: string | null;
}
```

State: `slots: Record<'A' | 'B', (SampleSlot | null)[]>` — length-8 arrays per deck, `null` = empty slot.

Actions:
- `loadFile(deckId, slotIndex, file): Promise<void>` — validates (audio MIME type, 500MB cap, mirroring `FileImportZone`'s existing rules), sets the slot to `{ decoding: true, buffer: null, ... }` immediately, decodes via the existing `decodeAudioFile` utility, then updates to either a populated `buffer` or a `decodeError` string (mirroring the Library's existing decode-error message convention: `"Couldn't decode — this format may be unsupported in your browser"`).
- `clearSlot(deckId, slotIndex)` — sets the slot back to `null`. Does **not** stop a currently-playing instance from that slot — a fire-and-forget one-shot is allowed to finish naturally; clearing only prevents *future* retriggers.
- `restoreSlot(deckId, slotIndex, slot: SampleSlot)` — used by session load; accepts an already-decoded slot directly (no re-decode needed since `loadSession` decodes once, up front).

Sample slots are **deck-scoped, not track-scoped**: like `padMode`, they are independent of whichever track is loaded on the deck and are **not** reset by `loadTrack`/`clearTrack`. QUANTIZE/SHIFT/SLIP have no effect on Sampler pads.

### New audio service: `src/services/samplerEngine.ts`

- Lazily creates one `GainNode` per deck ("sampler bus") on first use, connected directly to `audioContext.destination` — independent of each deck's own signal chain, the crossfader, and channel faders.
- Subscribes to `settingsStore.masterVolume` and applies it as the bus's gain scalar (`masterVolume / 100`), so turning down MASTER also quiets samples, mirroring the mixer's existing master-scaling pattern but applied directly rather than composited through channel/crossfader math.
- `playSample(deckId, slotIndex, buffer)`: if a source is already tracked as playing for `(deckId, slotIndex)`, stops it first; creates a fresh `AudioBufferSourceNode`, connects it to that deck's bus, starts it, and tracks it in a **module-level `Map`** (imperative handle — never stored in Zustand, per this project's core architecture rule). Registers `onended` to clear its own map entry once playback finishes naturally.
- `setSamplerVolume(deckId, volume)`: sets a per-deck user-controllable multiplier on top of the master scalar (see the new SAMPLE VOL control below) — the bus's final gain is `(volume / 100) * (masterVolume / 100)`.

### Session persistence: `src/services/sessionStore.ts` extension

Extend `SavedSession`:
```ts
samplers: {
  A: ({ fileName: string; blob: Blob } | null)[];
  B: ({ fileName: string; blob: Blob } | null)[];
};
```
`snapshot()` reads live `samplerStore` slots and converts each loaded slot's `File` to a `Blob` via the existing `fileToBlob` helper (same one already used for library tracks). `loadSession()` reconstructs each slot's `File` from its blob, decodes it via `decodeAudioFile`, and calls `samplerStore.restoreSlot`. A session saved before this phase (missing the `samplers` key) loads with all slots empty — no migration needed since IndexedDB records are read as plain objects and a missing key is simply `undefined`.

## 3. Components & files

**New:**
- `src/store/samplerStore.ts` — as above.
- `src/services/samplerEngine.ts` — as above.
- `src/components/Deck/PadGridSampler.tsx` (+ `.module.css`) — 8 pads in a 2×4 grid (matching HOT CUE/LOOP/SLICER's shape) plus a compact **SAMPLE VOL** slider for that deck's bus. Empty pads show a drag-drop/click-to-browse affordance; loaded pads show a truncated filename; a decoding pad shows a brief spinner state; a failed decode shows an error indicator (reusing the Library's error-state visual convention where practical). Dropping or picking an invalid file (wrong MIME type, or over the 500MB cap) leaves the pad empty and shows a transient error state on that pad — mirroring `FileImportZone`'s existing `isError` zone-state pattern — rather than silently ignoring the drop.

**Modified:**
- `src/components/Deck/PadGrid.tsx` — flip SAMPLER's `disabled: true` → `false`; render `PadGridSampler` when `padMode === 'sampler'`.
- `src/services/sessionStore.ts` — `SavedSession` type, `snapshot()`, `loadSession()` extended as above.

**Layout note:** like SLICER, SAMPLER has one extra row (the SAMPLE VOL slider) above/alongside the 8 pads, so the pad area is similarly taller than HOT CUE/LOOP's single row. Accepted, intentional, consistent with the precedent SLICER already set.

## 4. Testing

- `samplerStore.test.ts` — `loadFile` decodes and stores the buffer (async; `decoding` true then false), rejects invalid file types/oversized files, sets `decodeError` on decode failure, `clearSlot` empties the slot, `restoreSlot` accepts a pre-decoded buffer directly.
- `samplerEngine.test.ts` — `playSample` connects a fresh source to the correct deck's bus; retriggering the same `(deckId, slotIndex)` stops the prior instance; different slots/decks never interfere with each other; `setSamplerVolume` and a simulated `masterVolume` change both correctly scale the bus's gain.
- `PadGridSampler.test.tsx` — renders correct visual state for empty/loaded/decoding/error pads; drag-drop and click-to-browse both call `loadFile`; clicking a loaded pad calls `playSample`; right-click calls `clearSlot`.
- `sessionStore` tests extended — a saved session's snapshot includes sampler slots as blobs; loading a session reconstructs and re-decodes them into fresh, playable buffers.
- `PadGrid.test.tsx` — SAMPLER is no longer `disabled`; switching to it renders sampler pads; HOT CUE/LOOP/SLICER remain unaffected.
- After implementation: `npm run build` and `npm run lint` (zero-warnings), per project CLAUDE.md.

## 5. Non-goals (2c)

- No per-sample pitch/tempo adjustment, looping, or effects — pure one-shot trigger playback.
- No MIDI/keyboard triggering — click/tap only, matching the other three pad modes' current scope.
- No change to HOT CUE/LOOP/SLICER behavior, the deck audio engine's own signal chain, or the crossfader/channel-fader composite-volume math.
- No "Sampler Loop" secondary mode or velocity-sensitive triggering — out of scope, matches the tight-scope precedent from prior phases.
