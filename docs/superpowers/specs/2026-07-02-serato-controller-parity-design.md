# DJ Rusty — Serato / Hercules DJC Inpulse 300 MK2 Controller Parity

**Date:** 2026-07-02
**Status:** Phase 1 approved for planning
**Goal:** Bring DJ Rusty's UI and Web Audio engine toward 1-for-1 functional parity with the
Hercules DJC Inpulse 300 MK2 (Serato) controller, by *adding the missing controls in place*
into the existing layout and the sparse center mixer — not a full visual re-skin.

**Guiding principle:** *mimic the Serato DJ as closely as we can* — match Serato's control
grouping, labels, and behavior wherever the browser allows; defer only the genuinely
browser-limited pieces (scratch audio, dual-output cue) to their own dedicated phases so each
is done properly rather than faked.

---

## 1. Gap analysis

Controls the reference controller has that DJ Rusty was missing, and the disposition of each:

| # | Controller control | Status in DJ Rusty | Disposition |
|---|---|---|---|
| 1 | GAIN / TRIM knob per channel | Missing | **Phase 1** |
| 2 | FX BEAT / TIME knob | Missing (echo time hard-coded) | **Phase 1** |
| 3 | QUANTIZE (Q) toggle | Missing | **Phase 1** |
| 4 | SHIFT modifier button | Missing | **Phase 1** |
| 5 | Manual loop IN / OUT / RELOOP | Missing (only auto beat-loops) | **Phase 1** |
| 6 | Beatmatch guide (tempo + phase) | Partial (VU only) | **Phase 1** |
| 7 | Unified 8-pad grid + mode switch (HOT CUE / LOOP / SLICER / SAMPLER) | Separate always-on panels; no Slicer/Sampler | Phase 2 |
| 8 | SLICER pad mode | Missing | Phase 2 |
| 9 | SAMPLER pad mode | Missing | Phase 2 |
| 10 | Interactive jog wheel + scratch | Platter display-only | Phase 3 |
| 11 | Headphone CUE / PFL + headphone mix + device picker | Missing | Phase 4 |
| 12 | LOAD A / LOAD B buttons | **Already covered** by per-row A/B buttons in LibraryBrowser | Dropped (redundant) |

Already at parity (no work): 3-band EQ, FILTER sweep, FX on + wet/dry (DEPTH), MASTER,
channel faders, crossfader (+ curve), VU meters, PLAY/CUE/SYNC, TEMPO/pitch fader, 8 hot cues,
beat-loops 1/2/4/8 (+ ROLL), SLIP, beat jump, tap tempo / beat grid, browser/library.

## 2. Brainstorming decisions

- **Ambition:** add missing controls *in place*, using the existing empty space (chiefly the
  center mixer column), not a full controller-style re-skin.
- **Performance pads (Phase 2):** unified mode-switched 8-pad grid (HOT CUE / LOOP / SLICER /
  SAMPLER) + SHIFT, replacing the separate Hot Cue and Loop panels. Builds Slicer + Sampler.
- **Jog wheel (Phase 3):** full scratch audio (real buffer scrubbing), not just nudge.
- **Headphone cue (Phase 4):** experimental true dual-output.
- **Web Audio guidance:** use the modern API surface — `AudioWorklet` (scratch),
  `MediaStreamAudioDestinationNode` + `HTMLMediaElement.setSinkId()` (cue), `AudioParam`
  smoothing for knobs. Exact API shapes to be verified against MDN/spec when designing the
  audio-core phases (3 & 4).
- **GAIN placement:** center mixer, above CH FADERS (approved adjustment).
- **Modifier scope:** per-deck SHIFT & QUANTIZE.
- **Quantize default:** ON (Serato-like).

## 3. Phase decomposition (build in this order)

| Phase | Scope | Risk | Web Audio work |
|---|---|---|---|
| **1 — Channel strip & FX** | GAIN/TRIM, FX BEAT/TIME, QUANTIZE, SHIFT, manual loop IN/OUT/RELOOP, beatmatch guide | Low, additive | New input GainNode + AudioParam smoothing |
| 2 — Unified pad grid | 8-pad grid + mode buttons + SHIFT; Slicer + Sampler | Medium | Sampler bus + one-shot buffer sources |
| 3 — Jog wheel + scratch | Interactive platter → real scratch + nudge/pitch-bend | High (audio core) | AudioWorklet signed-rate playback processor |
| 4 — Headphone CUE / PFL | Per-deck cue, headphone mix knob, output-device picker | Medium (browser-fragile) | MediaStreamAudioDestinationNode → `<audio>.setSinkId()` |

Each phase gets its own spec → plan → build cycle. **This document specifies Phase 1 in
detail; Phases 2–4 are summarized only.**

---

## 4. Phase 1 — detailed spec

All new controls reuse existing rotary-knob / button interaction patterns and the persistent
signal-chain node pattern in `AudioEngineImpl`. Placement:

```
  DECK COLUMN (A / B)                 CENTER MIXER (24%)
 ┌─────────────────────────┐        ┌──────────────────┐
 │ DeckDisplay             │        │ MASTER           │
 │ Vinyl platter           │        │ GAIN   A    B    │ ← NEW (two trim knobs)
 │ Waveform                │        │ CH FADERS  A  B  │
 │ Transport ⏮ CUE ▶ SYNC  │        │ LEVELS (VU) A B  │
 │ ┌ modifiers ─────────┐  │ ← NEW  │ BEATMATCH ◄ ● ►  │ ← NEW
 │ │  SHIFT   Q          │  │        │ CROSSFADER       │
 │ └─────────────────────┘  │        │ (curve selector) │
 │ HOT CUES (8)            │        └──────────────────┘
 │ LOOPS: IN OUT 1 2 4 8   │ ← NEW IN/OUT/RELOOP
 │        RELOOP EXIT ROLL │
 │ SLIP  BEATJUMP  TAP     │        FX PANEL (in deck):
 │ GRID   PITCH/TEMPO      │          [OFF][ECHO][VERB]
 │ EQ: BASS MID TREBLE FIL │          DEPTH(D/W)  BEAT ← NEW
 │ VOLUME                  │
 └─────────────────────────┘
```

### 4.1 GAIN / TRIM knob (center mixer)

- **UI:** a new `GainKnob` (or reused rotary) rendered twice in `Mixer.tsx`, in a new
  `GAIN` section above `CH FADERS`, one per deck (A blue / B red accent). dB readout.
- **Range:** −24 … +12 dB; unity at **0 dB**; double-click resets to 0; ArrowUp/Down ±1 dB.
- **State:** `deckStore.decks[id].gainDb: number` (default `0`). Action `setGain(deckId, db)`.
- **Audio:** add a persistent `trimGain: GainNode` at the **head** of the chain:
  `source → trimGain → gainNode(volume) → lowFilter → …`. New engine method
  `setGain(db)` converts dB→linear (`10 ** (db/20)`) and applies via
  `trimGain.gain.setTargetAtTime(linear, ctx.currentTime, 0.01)` for click-free change.
  `useAudioEngine` subscribes to `gainDb` and calls `engine.setGain`.
- **Edge:** trim is independent of the mixer volume/crossfader chain — the composite-volume
  path in `mixerStore` is untouched. Signal = `trim × volume`.

### 4.2 FX BEAT / TIME knob (EffectsPanel)

- **UI:** second knob beside the existing D/W knob; label `BEAT`. So FX panel reads:
  type buttons + `DEPTH` (existing D/W) + `BEAT` (new).
- **State:** `deckStore.decks[id].effectBeat: number` in `[0,1]` (default `0.5`, matching the
  current hard-coded half-beat). Action `setEffectBeat(deckId, v)`.
- **Mapping:** `v` → a musical division from an ordered set
  `[1/16, 1/8, 1/4, 1/2, 1, 2, 4]` beats (nearest-step), exposed as `beatMultiplier`.
- **Audio:** extend `setEffect(type, wetDry, bpm, beatMultiplier = 0.5)`:
  - echo: `delay.delayTime = (60/bpm) * beatMultiplier`, smoothed via `setTargetAtTime`.
  - reverb: `beatMultiplier` scales impulse duration/decay (longer = bigger room).
  - The `useAudioEngine` effect subscription passes `effectBeat`'s resolved multiplier.
- **Test:** `fxBeatMultiplier(v)` pure fn — unit-tested for step boundaries.

### 4.3 QUANTIZE (Q) toggle (per deck)

- **UI:** `Q` toggle button in a new `DeckModifiers` row rendered under `DeckControls`.
  Lit when active.
- **State:** `deckStore.decks[id].quantize: boolean` (**default `true`**). Action
  `setQuantize(deckId, on)`.
- **Behavior:** when ON, snap to nearest beat using the confirmed grid for:
  manual-loop IN (§4.5), hot-cue **set** and **jump**. No-op when `bpm`/`anchor` unset.
- **Util:** `snapToGrid(grid: {bpm, anchor}, t: number): number` in `src/utils/quantize.ts`,
  unit-tested. Existing beat-loops already snap and are unaffected.

### 4.4 SHIFT button (per deck)

- **UI (visual requirement):** `SHIFT` and `Q` sit together in a short `DeckModifiers` row as
  **compact, square/pill buttons that clearly read as buttons** (fixed small width ~44–56px,
  raised border, centered label, lit/pressed state) — explicitly **not** a long full-width bar.
  The row is left-aligned and only as wide as its two buttons, not stretched across the deck.
- **Interaction:** SHIFT is a **click-to-toggle sticky** button (primary, mouse-friendly). The
  physical `Shift` key is an *optional* momentary override for Phase 1: while held it forces
  `shift=true`; on keyup it reverts to the sticky toggle's value (tracked as a separate
  transient so the key never silently clears a sticky toggle). Lit when effectively active.
- **State:** `deckStore.decks[id].shift: boolean` (default `false`). Action
  `setShift(deckId, on)`.
- **Phase-1 wired behaviors** (the bulk of SHIFT lands in Phase 2 with the pad grid):
  1. `SHIFT` + beat-loop length button → **halve/double** the active loop length.
  2. `SHIFT` + Restart → jump to `cuePoint` instead of 0.
  3. `SHIFT` + beat-jump → jump by the next-larger grid size.
- **Note:** behaviors are additive; unshifted actions are unchanged.

### 4.5 Manual loop IN / OUT / RELOOP (LoopControls)

- **UI:** three buttons added to `LoopControls`: `IN`, `OUT`, `RELOOP`. Final row:
  `IN  OUT  1B 2B 4B 8B  RELOOP  EXIT  ROLL`.
- **Behavior:**
  - **IN** → `loopStart = quantize ? snapToGrid(grid, currentTime) : currentTime`; store as a
    pending manual in-point; does not loop yet. Lights IN.
  - **OUT** → `loopEnd = quantize ? snap(currentTime) : currentTime` (must be > loopStart);
    `engine.setLoop(loopStart, loopEnd)`; `loopActive = true`, `loopBeatCount = null`.
  - **RELOOP** → if a manual loop was previously set, re-arm it (`engine.setLoop`, seek to
    `loopStart`) and toggle it on/off.
  - **EXIT** (existing) → `deactivateLoop`.
- **State:** reuse `loopStart / loopEnd / loopActive / loopBeatCount`; add transient
  `manualLoopIn: number | null` (pending in-point) and `lastManualLoop: { start: number;
  end: number } | null` (remembers the most recent manual loop so RELOOP works after EXIT
  clears the active loop). Actions `setLoopIn`, `setLoopOut`, `reloop`. Engine
  `setLoop/clearLoop` already exist.
- **Edge:** OUT with no IN, or `loopEnd <= loopStart` → ignored (engine already guards).
  Manual loop and beat-loop share state; setting a beat loop clears the manual in-point.

### 4.6 Beatmatch guide (center mixer, read-only)

- **UI:** `BeatmatchGuide` component in `Mixer.tsx`, between `LEVELS` and `CROSSFADER`.
  Two indicators:
  1. **Tempo bar** — closeness of the two effective BPMs (`bpm × pitchRate`). Centered = matched.
  2. **Phase arrows** — downbeat phase offset from grid anchors + current positions; a marker
     drifts left/right and centers when downbeats align.
- **Data:** pure computation from both decks' `bpm/pitchRate/anchor/currentTime` using existing
  `beatSync` helpers (`phaseDelta` / effective-tempo). Updates on the existing playhead poll.
  No audio, no new state. Shows a neutral "no grid" state when either deck lacks bpm+anchor.
- **Util:** `beatmatchReadout(deckA, deckB): { tempoDelta, phaseOffset }` — unit-tested.

### 4.7 Data-model summary

`deckStore` new per-deck fields (+ init + `clearTrack` resets where transient):
`gainDb: 0`, `effectBeat: 0.5`, `quantize: true`, `shift: false`, `manualLoopIn: null`,
`lastManualLoop: null`. New actions: `setGain`, `setEffectBeat`, `setQuantize`, `setShift`,
`setLoopIn`, `setLoopOut`, `reloop`.

`AudioEngine` interface additions: `setGain(db)`, extended `setEffect(..., beatMultiplier)`.
New node: `trimGain`. `useAudioEngine` gains subscriptions for `gainDb` and `effectBeat`.

New utils (each unit-tested): `quantize.ts` (`snapToGrid`), `fxBeat.ts`
(`fxBeatMultiplier`), `beatmatch.ts` (`beatmatchReadout`); dB→linear helper.

New components: `Mixer/GainKnob`, `Deck/DeckModifiers`, `Mixer/BeatmatchGuide`; edits to
`EffectsPanel`, `LoopControls`, `Mixer`, `deckStore`, `audioEngine`, `useAudioEngine`,
`useKeyboardShortcuts`.

### 4.8 Testing & tooling

- Vitest (jsdom) unit tests for all new pure logic: `snapToGrid`, `fxBeatMultiplier`,
  dB→linear, manual-loop in/out ordering & guards, `beatmatchReadout`.
- Respect strict TS (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- After implementation: `npm run build` (tsc + vite) and `npm run lint` (zero warnings),
  per project CLAUDE.md.

## 5. Non-goals (Phase 1)

- No jog/scratch, no pad-mode grid, no Slicer/Sampler, no headphone cue (later phases).
- No change to the composite-volume/crossfader math, session persistence schema, or the
  YouTube-less single Web Audio backend.
- No full layout re-skin.

## 6. Later phases (summary only — separate specs later)

- **Phase 2:** `PadGrid` component with mode state (`hotcue|loop|slicer|sampler`) + SHIFT;
  Slicer (8 slices over an N-beat region) and Sampler (8 local-file slots, dedicated sampler
  gain bus). Replaces separate Hot Cue + Loop panels.
- **Phase 3:** `AudioWorklet` `scratch-processor` holding transferred channel data with a
  signed, jog-driven read-rate; interactive platter capturing pointer angular velocity;
  nudge/pitch-bend + inertia. Verify AudioWorklet API against MDN/spec first.
- **Phase 4:** per-deck cue-send `GainNode` → shared `MediaStreamAudioDestinationNode` →
  hidden `<audio>` with `setSinkId(headphoneDeviceId)`; device picker via
  `enumerateDevices` / `selectAudioOutput`; headphone MIX knob. Verify output-routing APIs
  against MDN/spec first.
