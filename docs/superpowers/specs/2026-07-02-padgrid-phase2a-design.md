# DJ Rusty — PadGrid Shell + HOT CUE/LOOP Modes (Phase 2a)

**Date:** 2026-07-02
**Status:** Approved for planning
**Parent spec:** `docs/superpowers/specs/2026-07-02-serato-controller-parity-design.md` §6 ("Phase 2")
**Goal:** Replace the two always-visible Hot Cue and Loop panels with a single, mode-switched
8-pad grid per deck — matching the Hercules DJC Inpulse 300 MK2's unified pad section — while
reusing all existing hot-cue and loop logic unchanged.

---

## 1. Scope decomposition

The parent spec's Phase 2 summary ("PadGrid with mode state (hotcue|loop|slicer|sampler) +
SHIFT; Slicer and Sampler...") bundles four independent subsystems. This is decomposed into
three ordered sub-phases, each independently shippable:

| Sub-phase | Scope | Risk |
|---|---|---|
| **2a — PadGrid shell + HOT CUE/LOOP modes** (this spec) | Mode-switching 8-pad UI frame; HOT CUE = existing 8 cues remapped; LOOP = redesigned 8-pad layout | Low — pure UI restructuring of working code |
| 2b — SLICER mode | 8 slices over an N-beat region, auto-highlighting playhead | Medium — new interaction paradigm |
| 2c — SAMPLER mode | 8 one-shot sample slots, dedicated gain bus, file loading | High — new audio subsystem |

This document specifies **2a** in full. 2b and 2c get their own brainstorm → spec → plan cycles.

## 2. Decisions made

- **SLICER/SAMPLER mode buttons:** shown now (production-honest), rendered **disabled** with a
  "coming soon" tooltip — not hidden, not fake-clickable. Avoids a second layout change when 2b/2c land.
- **ROLL relocates** out of the loop pads into `DeckModifiers` (next to SHIFT and QUANTIZE) as a
  third always-visible modifier button. It is conceptually a modifier — it changes how the loop
  pads react (click-toggle vs. hold-to-roll) — not a pad itself. Frees exactly the one slot
  needed to fit the loop controls into 8 pads. Reuses the existing `rollMode`/`setRollMode`
  state and action unchanged; only the toggle's UI location moves.
- **LOOP mode's 8 pads (click-toggle, per explicit user preference):** `IN, OUT, 1B, 2B, 4B,
  8B, RELOOP, EXIT`. Unchanged actions/logic from today's `LoopControls.tsx` (including SHIFT
  halve/double and QUANTIZE-snapped IN).
- **HOT CUE mode's 8 pads:** the existing `HotCueButton` component and interaction contract
  (click / shift-click / long-press / right-click, 8-color palette), unchanged.
- **Grid shape:** 2 rows × 4 columns, matching the reference controller image and the CSS
  `HotCues.module.css` already uses (`grid-template-columns: repeat(4, 1fr)`).

## 3. Data model

`deckStore` — new per-deck field:
```ts
padMode: 'hotcue' | 'loop' | 'slicer' | 'sampler'  // default 'hotcue'
```
New action: `setPadMode(deckId, mode)`.

**`padMode` is a deck-level UI preference, not track-specific** — like `quantize`/`shift`/
`gainDb` from Phase 1, it is **not** reset by `loadTrack` or `clearTrack`; it only defaults at
deck creation (`createInitialDeckState`).

`'slicer'`/`'sampler'` are valid union members (for forward type-compatibility with 2b/2c) but
unreachable via UI in 2a since their mode buttons are disabled — `setPadMode` is never called
with those values yet.

## 4. Components & files

**New:**
- `src/components/Deck/PadGrid.tsx` (+ `.module.css`) — shell: renders the 4-button mode-select
  row (HOT CUE / LOOP enabled; SLICER / SAMPLER disabled + tooltip) and delegates the pad area
  below it to the active mode's panel. Renders nothing in the pad area for `'slicer'`/`'sampler'`
  (unreachable in 2a).
- `src/components/Deck/PadGridHotCue.tsx` — the 8 `HotCueButton`s in a 2×4 grid, extracted
  from today's `HotCues.tsx`. Same interaction contract, same colors, same store actions
  (`setHotCue`/`clearHotCue`, quantize-snapped SET from Phase 1). Drops the old wrapper's
  redundant "HOT CUES" text label — the mode button itself now conveys that.
- `src/components/Deck/PadGridLoop.tsx` (+ `.module.css`) — 8 pads in a 2×4 grid: `IN, OUT, 1B,
  2B, 4B, 8B, RELOOP, EXIT`, extracted from today's `LoopControls.tsx` minus the ROLL button.
  Unchanged actions (`setLoopIn`/`setLoopOut`/`reloop`/`deactivateLoop`/`activateLoopBeat`),
  unchanged SHIFT-halve/double (`shiftedLoopBeatCount`) and QUANTIZE-snap behavior.

**Modified:**
- `src/store/deckStore.ts` — add `padMode` field + `setPadMode` action; export on `useDeckActions`.
- `src/components/Deck/DeckModifiers.tsx` — add a third button, **ROLL**, wired to the existing
  `rollMode`/`setRollMode` (moved from `LoopControls.tsx`, no behavior change).
- `src/components/Deck/Deck.tsx` — replace `<HotCues deckId={deckId} />` and
  `<LoopControls deckId={deckId} />` with a single `<PadGrid deckId={deckId} />`, in the same
  position in the render order.

**Removed:** `src/components/Deck/HotCues.tsx`, `HotCues.module.css`,
`src/components/Deck/LoopControls.tsx`, `LoopControls.module.css` — logic fully absorbed into
`PadGridHotCue.tsx`/`PadGridLoop.tsx`. `HotCueButton.tsx` is kept as-is and reused unchanged.

## 5. Behavior edge cases

- **Mode-switch independence:** `padMode` is a pure UI visibility concern. Switching away from
  LOOP mode does **not** deactivate a running loop or an in-progress roll — the loop/rollMode
  state and audio engine are entirely unaffected; only which pads are *shown* changes. An active
  loop keeps looping audibly even while HOT CUE pads are displayed.
- **Keyboard shortcuts unaffected:** the existing hot-cue keyboard shortcuts (keys 1–8) continue
  to work regardless of the currently displayed pad mode — they operate on store state, not on
  visible UI.
- **ROLL/SHIFT/QUANTIZE are always visible**, independent of `padMode` — they live in
  `DeckModifiers`, outside the mode-switched pad area, exactly like the reference controller's
  layout (modifier row separate from the pad-mode row).

## 6. Testing

- Unit: `padMode` defaults to `'hotcue'`; `setPadMode` updates it; unaffected by
  `loadTrack`/`clearTrack` (mirrors the Phase 1 pattern for `quantize`/`shift`).
- Component: `PadGrid` mode-select — clicking LOOP renders loop pads, clicking HOT CUE renders
  hot-cue pads, SLICER/SAMPLER buttons render `disabled` and are non-interactive.
- Existing hot-cue and loop-pad interaction tests are retargeted to render through
  `PadGridHotCue`/`PadGridLoop` (same assertions, same store actions, new render path) rather
  than through the removed `HotCues`/`LoopControls` components.
- `DeckModifiers` test extended to cover the relocated ROLL button (toggles `rollMode`, matching
  its pre-move behavior).
- After implementation: `npm run build` and `npm run lint` (zero-warnings), per project CLAUDE.md.

## 7. Non-goals (2a)

- No SLICER or SAMPLER functionality (2b/2c).
- No change to hot-cue or loop audio/engine behavior — this is a UI restructuring only.
- No change to `quantize`/`shift` semantics from Phase 1.
