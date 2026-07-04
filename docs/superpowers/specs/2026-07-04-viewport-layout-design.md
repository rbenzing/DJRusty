# DJ Rusty — Viewport-Fit Layout Overhaul

**Date:** 2026-07-04
**Status:** Approved for planning
**Prior phases:** Phase 1 (channel-strip & FX), Phase 2a/2b/2c (PadGrid), Phase 3 (jog wheel + scratch audio) — all merged to main. This is a standalone UI reorganization pass, not part of the original numbered phase roadmap.
**Goal:** Reorganize the deck and mixer layouts so the app fits better within a real desktop viewport, reducing vertical stacking and consolidating controls that are currently spread across many separate rows.

---

## 1. Decisions made

- **Per-deck waveform, not shared.** The currently-shared `CenterWaveform` (rendered once above the deck row, showing both decks' frequency-colored waveforms stacked) is removed from `App.tsx`. Its frequency-colored, left/right-info-flanked row logic is split into two per-deck instances and moved into each deck's own `DeckDisplay` header. The old per-deck `WaveformDisplay` (monochrome, uncolored) is deleted — there is exactly one waveform per deck after this change, not three.
- **EQ columns nest inside `Mixer.tsx`, not a new top-level App.tsx column.** `EQPanel` is removed from each `Deck`'s render tree and instead rendered twice inside `Mixer.tsx`: once to the left of the mixer's existing vertical stack (gain/faders/levels/beatmatch guide/crossfader), once to the right. `EQPanel`'s internal layout changes from a horizontal row of 4 controls (bass/mid/treble knobs + filter sweep, each already a self-contained knob+label+kill-button group) to a vertical column of the same 4 groups — they move and reorient together, not split apart.
- **Minimum viewport floor: 1366×768.** Design and test against this size. Below it, the existing `overflow-y: auto` fallback on `.app-deck-col` continues to apply — no new mobile/tablet reflow is added. This is a firm floor, not a new responsive breakpoint to design around.
- **Tap BPM / FX / Grid Control become one row, unequal widths.** `TapTempo`, `EffectsPanel`, and `GridControl` (currently three separate stacked rows) merge into one `display: flex; flex-direction: row` container with a single shared divider. FX gets `flex: 1` (it has 5 controls — 3 type buttons, wet/dry knob, beat knob — and needs the most room); Tap BPM and Grid Control get narrower, min-content widths. Grid Control's status text ("grid unconfirmed" etc.) gets `white-space: nowrap` (plus a slightly smaller font if needed) so it never wraps mid-word in its narrower column.
- **Volume + Pitch become one 2-column row.** The deck volume fader and `PitchSlider` (currently two separate stacked rows) merge into one row, each at `flex: 1` (equal halves — neither has an inherent size asymmetry). Each column keeps its existing internal 3-line structure (label → slider → end-labels) unchanged; only the outer wrapper changes.
- **Top-level `App.tsx` column proportions are unchanged** (`.app-deck-col` 38%, `.app-mixer-col` 24%, unchanged split). The two new EQ columns must fit inside the Mixer's existing 24% share via compact, small fixed widths (~40-60px each, roughly knob-width + padding) — verified at exactly 1366px during implementation, not solved by growing the Mixer's page share.

## 2. Component & file changes

**Deleted:**
- `src/components/Deck/WaveformDisplay.tsx` (+ `.module.css`) — replaced by the relocated per-deck colored waveform logic.
- `src/components/CenterWaveform/CenterWaveform.tsx` (+ `.module.css`) — its rendering logic is extracted/reused, not the file itself; removed from `App.tsx`'s render tree.

**Modified:**
- `src/App.tsx` — remove the `<CenterWaveform />` render (currently line 88). Top-level 3-column grid (`app-deck-row`) structure otherwise unchanged.
- `src/components/Deck/DeckDisplay.tsx` (+ `.module.css`) — restructured from 4 stacked rows (header / title / channel / time) into a layout with a full-width, frequency-colored waveform row flanked by that deck's info compacted to one side (label + track title) and the other (BPM + time/rate) — reusing `CenterWaveform`'s existing `data-deck='a'`/`data-deck='b' { flex-direction: row-reverse }` flanking pattern. Includes a `ResizeObserver`-driven canvas resolution fix (previously missing) since the waveform's container width changes from full-app-width to a deck-column-width slot.
- `src/components/Deck/Deck.tsx` — remove the `WaveformDisplay` render step (previously step 4) and the standalone `EQPanel` render step (previously step 14). Replace the three separate `TapTempo`/`EffectsPanel`/`GridControl` render steps (previously 11/15/12) and the two separate `PitchSlider`/volume-fader render steps (previously 13/16) with two new consolidated-row wrapper renders.
- `src/components/Mixer/Mixer.tsx` (+ `.module.css`) — restructure from a single vertical column into a 3-column row: `<EQPanel deckId="A" />` | existing vertical stack | `<EQPanel deckId="B" />`.
- `src/components/Deck/EQPanel.tsx` (+ `.module.css`) — `.knobsRow` changes from `flex-direction: row` to `column`; component itself keeps its existing `deckId` prop and internal structure otherwise unchanged.
- `src/index.css` — add `--min-viewport-width: 1366px` to the `:root` token block, with a comment noting it's a design-time reference (not an enforced CSS constraint).

**New:**
- A small wrapper component (or straightforward inline JSX + a new CSS module) inside `Deck.tsx`'s render tree for each of the two consolidated rows (Tap/FX/Grid; Volume/Pitch) — exact componentization (new files vs. inline markup in `Deck.tsx`) is an implementation-plan-level decision, not a design-level one, given how small each wrapper is.

## 3. Testing

- Component/unit tests updated for every relocated piece: `EQPanel`'s tests move their rendering-context assumptions from being a `Deck` child to being a `Mixer` child; `DeckDisplay` tests updated for the new waveform-row layout (replacing `WaveformDisplay`'s deleted test file); any `Deck.tsx`-level snapshot/render-order tests updated to reflect the removed/consolidated render steps.
- Visual verification via Playwright at exactly 1366×768 (this project's established end-of-phase smoke-test convention) — confirm no unwanted horizontal scrollbar, no control overlap/clipping in the Mixer's EQ columns or the deck's consolidated rows, and check whether vertical scroll is needed within a deck column (a "best effort to eliminate" goal, not a hard pass/fail gate, since `overflow-y: auto` remains an acceptable fallback).
- No new automated breakpoint/viewport tests — jsdom doesn't meaningfully exercise CSS layout; the Playwright pass is the primary verification for this phase, consistent with prior layout-sensitive work in this project.
- After implementation: `npm run build` and `npm run lint` (zero-warnings), per project CLAUDE.md.

## 4. Non-goals

- No mobile/tablet responsive layout below the 1366×768 floor.
- No changes to the top-level `App.tsx` 3-column percentage split (38/24/38).
- No new DJ features — this is purely a layout/reorganization pass over existing controls; no control gains new behavior.
- No changes to `CrossfaderCurveSelector`, `BeatmatchGuide`, `MasterVolumeKnob`, or any other Mixer content beyond adding the two new EQ columns around the existing stack.
- The dead, unused `src/components/Layout/AppLayout.tsx` and `Header.tsx` stub components are left alone (not wired in, not deleted) — out of scope for this phase.
