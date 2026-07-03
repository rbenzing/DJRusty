# DJ Rusty — SLICER Mode (Phase 2b)

**Date:** 2026-07-03
**Status:** Approved for planning
**Parent spec:** `docs/superpowers/specs/2026-07-02-serato-controller-parity-design.md` §6 ("Phase 2")
**Prior phase:** `docs/superpowers/specs/2026-07-02-padgrid-phase2a-design.md` (PadGrid shell + HOT CUE/LOOP modes, merged to main)
**Goal:** Implement the SLICER pad mode — the third of the four PadGrid modes, currently shown as a disabled placeholder — faithfully mimicking real Serato/Pioneer Slicer behavior: 8 pads divide an upcoming beat window into 8 equal slices; holding a pad loops that slice, releasing catches playback back up to where it would naturally be.

---

## 1. Decisions made

- **Behavior fidelity:** hold-to-loop + catch-up-on-release (not simple jump-and-continue). Matches real Serato Slicer and the project's stated "1-for-1 mimic" goal. The release side reuses the **existing `endRoll` store action unchanged** — it already computes "where would we be if this loop never happened" and seeks there, since it was built for ROLL mode in Phase 1. Only the press side (`startSlice`) is new.
- **Window size:** adjustable (4/8/16/32 beats), via a small selector row mirroring LOOP mode's beat-count button style. Each of the 8 pads represents `windowBeats / 8` beats.
- **SAMPLER remains disabled** — unaffected by this phase, Phase 2c later.

## 2. Data model

`deckStore` — new per-deck field:
```ts
sliceWindowBeats: 4 | 8 | 16 | 32  // default 8
```
New actions: `setSliceWindowBeats(deckId, size)`, `startSlice(deckId, sliceIndex)`.

**Reset convention:** `sliceWindowBeats` mirrors the existing `beatJumpSize` field's precedent — it is a "step size" preference, not a persistent modifier like `padMode`/`quantize`/`shift`. It **survives `loadTrack`** (carries across track changes on the same deck) but **resets to the default (8) on `clearTrack`** (eject), exactly matching `beatJumpSize`'s current reset behavior.

### `startSlice(deckId, sliceIndex)`

Computes the slice's start/end from the current beat grid, `sliceWindowBeats`, and the live playhead (via `sliceWindowStart`/`sliceStartFor` from the new `slicer.ts` util — see §3). No-ops if there's no confirmed grid (`bpm`/`anchor` unset), same precondition as `activateLoopBeat`/`startRoll`.

Arms the engine loop (`getActivePlayer(deckId)?.setLoop?.(sliceStart, sliceEnd)`) and sets the SAME fields `startRoll` already sets: `rollStartWallClock`, `rollStartPosition` (both `Date.now()`/current position at press time), `loopActive: true`, `loopStart`/`loopEnd` (the slice bounds), `loopBeatCount: null` (distinguishing it from named 1/2/4/8 beat-loops, matching the convention manual loops and RELOOP already use). If `slipMode` is on, also calls `startSlipTracking` — identical to `startRoll`'s existing slip interop.

Also clears `manualLoopIn: null`, mirroring the exact fix `activateLoopBeat` already needed (found in Phase 1's final review): if a manual loop IN point is pending when a different loop mechanic engages, it must not survive as stale state that a later OUT press could silently consume. (Note: `startRoll` itself does not currently clear `manualLoopIn` — a pre-existing gap, out of scope for this phase to fix since it's unrelated existing code, not something Phase 2b introduces or touches.)

### Release: reuse `endRoll` directly

No new release action. `PadGridSlicer.tsx`'s pad `onMouseUp`/`onTouchEnd`/`onMouseLeave` handlers call the existing `endRoll(deckId)` action exactly as `PadGridLoop.tsx`'s roll-mode pads already do. `endRoll` already: computes `rollStartPosition + elapsed * pitchRate` (clamped to duration), clears the engine loop, seeks there, and resets `rollStartWallClock`/`rollStartPosition`/`loopActive`/slip fields. Since `startSlice` populates the exact same fields `startRoll` does, `endRoll` needs zero changes.

## 3. New pure util: `src/utils/slicer.ts`

```ts
sliceWindowStart(grid: BeatGrid, playhead: number, windowBeats: number): number
```
The start (seconds) of the `windowBeats`-beat window containing `playhead`, aligned to the grid anchor (i.e., the nearest window-boundary at or before `playhead`).

```ts
sliceIndexAt(grid: BeatGrid, playhead: number, windowBeats: number): number
```
Which of the 8 slices (0–7) currently contains `playhead`, within its window. Clamped to `[0, 7]` defensively.

```ts
sliceStartFor(grid: BeatGrid, playhead: number, windowBeats: number, index: number): { start: number; end: number }
```
The `[start, end)` bounds (seconds) of slice `index` within the window containing `playhead`.

All three are pure (no React/store/DOM), unit-tested directly with example grids/playheads/window sizes, following the same pattern as `beatJump.ts`/`loopMath.ts`/`quantize.ts`.

## 4. Components & files

**New:**
- `src/utils/slicer.ts` — the three pure functions above.
- `src/components/Deck/PadGridSlicer.tsx` (+ `.module.css`) — window-size selector row (4/8/16/32) above 8 slice pads in a 2×4 grid. Each pad shows two visual states:
  - **Follow highlight** (dim): the slice the playhead is naturally passing through right now, recomputed from the existing 100ms `currentTime` poll — no new polling infrastructure.
  - **Held highlight** (bright, e.g. amber like ROLL's accent): the slice currently being pressed/looped. Takes visual priority over the follow highlight when both coincide.
  - Without a confirmed grid, all pads and the size selector render `disabled` with the title `"Set BPM using Tap Tempo first"` — the exact string already used in `PadGridLoop.tsx`, for consistency.
  - The size-selector buttons disable while any slice is actively held, so a mid-hold size change can't create an ambiguous release target.

**Modified:**
- `src/types/deck.ts` — add `sliceWindowBeats: 4 | 8 | 16 | 32`.
- `src/store/deckStore.ts` — add `sliceWindowBeats` init (`8`) + reset in `clearTrack` (not in `loadTrack`) + `setSliceWindowBeats` action + `startSlice` action.
- `src/components/Deck/PadGrid.tsx` — flip `{ mode: 'slicer', ..., disabled: true }` → `disabled: false`; render `<PadGridSlicer deckId={deckId} />` when `padMode === 'slicer'`.

**Layout note:** unlike HOT CUE/LOOP (a single row of 8 pads), SLICER has an extra row for the window-size selector, so the pad area is taller in this mode. Accepted, intentional.

## 5. Testing

- Unit: `sliceWindowStart`/`sliceIndexAt`/`sliceStartFor` — window boundaries, slice index at various playheads (including window-size changes and edge-of-window/edge-of-slice playheads), slice bounds for a given index.
- Store: `sliceWindowBeats` defaults to 8, updates via `setSliceWindowBeats`, survives `loadTrack`, resets on `clearTrack`; `startSlice` arms the correct loop bounds for a given index+window, sets the roll-shaped fields, no-ops without a confirmed grid; release via the pre-existing, unchanged `endRoll` (already covered by Phase 1 tests).
- Component: `PadGridSlicer` renders the size row + 8 pads; clicking a size button updates `sliceWindowBeats`; mousedown on a pad calls `startSlice` with the correct index; mouseup/touchend/mouseleave call `endRoll`; follow-highlight reflects `currentTime`; disabled without a grid.
- `PadGrid.test.tsx`: SLICER button is no longer `disabled`; clicking it renders `PadGridSlicer`; HOT CUE/LOOP behavior unaffected.
- After implementation: `npm run build` and `npm run lint` (zero-warnings), per project CLAUDE.md.

## 6. Non-goals (2b)

- No "Slicer Loop" secondary mode (a real-hardware variant where the loop persists after release until pressed again) — out of scope, matches the tight-scope precedent from Phase 1/2a.
- No SAMPLER functionality (Phase 2c, separate spec).
- No change to LOOP/HOT CUE mode behavior, or to the existing `startRoll`/`endRoll`/manual-loop mechanics beyond `startSlice` being a new, additive caller of the same field shapes.
