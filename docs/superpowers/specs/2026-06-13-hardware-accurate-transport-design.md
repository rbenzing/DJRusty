# Hardware-Accurate Transport, Loops, Sync & Beat Grid — Design Spec

**Date:** 2026-06-13
**Status:** Approved (brainstorming) — pending implementation plan

## Problem

DJ Rusty's transport-family controls (CUE/play, loops, beat-jump, FF, SYNC) feel "half-baked" versus real DJ hardware. The quirks were reproduced on an **MP3** track (the full-capability Web Audio backend), so they are **not** YouTube-backend limitations — they trace to a few root causes in the core logic:

1. **No beat grid.** BPM is a bare scalar with no downbeat/phase anchor, so beat-jump is relative (drifts off-beat), beat-length loops start off-grid, and SYNC matches tempo only — never phase.
2. **Loops enforced by a 250 ms poll**, not the audio clock — wraps fire up to 250 ms late (audibly sloppy), even though Web Audio can loop sample-accurately.
3. **SYNC/pitch snap to 8 discrete steps even on MP3**, which is continuous-capable (100→120 BPM wants 1.20× but snaps to 1.25×).
4. **CUE/PLAY don't follow hardware transport semantics** — CUE just seeks and keeps playing; no return-to-cue, no hold-to-preview, no momentary play; set/jump are split awkwardly; an unset hot-cue click is a silent no-op.
5. **Position is poll-synced, not clock-driven** — laggy playhead and a redundant double-seek on MP3.

### Evidence (current behavior, file:line)
- Beat-jump relative, no snap: `src/utils/beatJump.ts:28`, `src/components/Deck/BeatJump.tsx:37`.
- Beat-loop start = raw `currentTime`: `src/store/deckStore.ts:345`.
- SYNC = tempo only, snapped to discrete `PITCH_RATES`: `src/utils/beatSync.ts:23,52`.
- Loop wrap is 250 ms-polled: `src/hooks/useAudioEngine.ts:36`, `src/hooks/useYouTubePlayer.ts:79`.
- CUE just seeks, keeps playing: `src/components/Deck/DeckControls.tsx:67`.
- Position polled every 250 ms; MP3 double-seek: `src/hooks/useAudioEngine.ts:162`.

## Goals

Make CUE/play, loops, beat-jump/FF, and SYNC behave like Pioneer-CDJ hardware on the MP3 (Web Audio) backend, with the YouTube backend keeping identical *semantics* at best-effort precision.

- **Beat grid** (BPM + downbeat anchor) as the shared source of truth.
- **Sample-accurate loops** on Web Audio (no audible lag).
- **Pioneer-CDJ transport**: PLAY toggles; CUE returns-to-cue/pauses; hold-CUE previews; CUE-while-paused sets the cue.
- **SYNC** = exact continuous tempo match + one-shot downbeat phase align (MP3).
- **Beat-jump** grid-snapped; on-screen jump buttons unified with the keyboard (fixed ±15s removed).
- **Continuous pitch** on MP3.
- **Clock-driven position** (smooth playhead, no double-seek), without reintroducing the playback re-render storm fixed in the prior hardening work.

### Non-goals (this spec)
- Continuous phase-lock (PLL) SYNC — one-shot phase align only; continuous lock is a future enhancement.
- Auto downbeat-detection accuracy beyond a provisional guess — the user confirms/edits the grid manually.
- Re-architecting EQ/FX (they work well) or the YouTube backend's fundamental precision limits.

## Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Transport model | **Pioneer CDJ (full)** — PLAY toggles; CUE returns+pauses; hold-CUE preview; CUE-while-paused sets cue; momentary play from cue |
| Grid ambition | **Full beat grid + downbeat anchor** — loops/jumps snap to grid; SYNC aligns phase |
| Downbeat source | **Auto-proposes, user confirms** — BPM worker proposes bpm + provisional anchor; manual **Tap-Downbeat + Nudge** control anchors/fine-tunes |
| FF buttons | **Beat-jump (match keyboard)** — drop fixed ±15s |
| SYNC depth (MP3) | **Tempo + one-shot phase align** — exact continuous rate + align to nearest downbeat once |
| Architecture | **Approach A** — beat-grid + clock-driven Web Audio scheduler + pure CDJ state machine |
| Delivery | **One phased plan** (5 phases), reviewed phase-by-phase, TDD throughout |

## Architecture

A pure **beat-grid model** and a pure **CDJ transport state machine** form the foundation. The MP3 Web Audio engine gains **native loop-point** scheduling (sample-accurate) and **clock-driven position**. Store actions for cue/loop/jump/sync delegate to the pure utils. Components fire hardware-accurate events (press/release CUE, grid-snapped jumps). YouTube reuses the same semantics with best-effort (poll-based) enforcement.

### Unit boundaries

| Unit | Responsibility | Depends on | Tested |
|---|---|---|---|
| `src/utils/beatGrid.ts` | Pure grid math (snap, phase, beat/bar index, quantize) | nothing | unit |
| `src/utils/transport.ts` | Pure CDJ state machine: `(state, event, ctx) → {nextState, intents}` | nothing | unit |
| `src/utils/beatSync.ts` (extend) | Exact tempo ratio + phase-delta math | beatGrid | unit |
| `src/utils/loopMath.ts` | Grid-snapped in/out point computation | beatGrid | unit |
| `src/services/audioEngine.ts` (extend) | Native loop points, loop-aware position, play-from/preview | Web Audio | unit (mock) |
| `src/store/deckStore.ts` (modify) | Grid + transport + loop/cue/jump/sync state; delegates to utils | utils, registry | unit + integration |
| `src/hooks/useAudioEngine.ts`, `useYouTubePlayer.ts` (modify) | Clock-driven position (rAF); wire transport/loop intents | engine, store | integration |
| Components (modify/add) | Fire CDJ events; render grid/transport state | store, utils | integration |

## Detailed design

### 1. Beat grid

```ts
// src/utils/beatGrid.ts  (pure, no React/DOM)
export interface BeatGrid {
  bpm: number;        // > 0
  anchor: number;     // seconds: time of a known beat-1 (downbeat). 4/4 assumed.
}
export function secondsPerBeat(bpm: number): number;            // 60 / bpm
export function beatIndexAt(grid: BeatGrid, t: number): number; // fractional beats from anchor
export function nearestBeat(grid: BeatGrid, t: number): number; // snap t to nearest beat time
export function nearestBar(grid: BeatGrid, t: number): number;  // snap t to nearest downbeat (4 beats)
export function quantize(grid: BeatGrid, t: number, division: number): number; // snap to nearest 1/division beat
export function phase(grid: BeatGrid, t: number, span?: 'beat' | 'bar'): number; // [0,1) position within beat/bar
```

**Grid state.** Deck gains `anchor: number | null` and `gridConfirmed: boolean` (existing `bpm` retained). On MP3 decode, the BPM worker proposes `bpm` and a provisional `anchor` (first strong onset; `0` fallback). `gridConfirmed` starts `false` (provisional). The grid is usable while provisional; confirming/editing sets it `true`.

**Grid affordance (new `GridControl` component).** Hardware-style: **Tap Downbeat** stamps `anchor = currentTime` (raw playhead, no snapping — the tap *is* the anchor) and sets `gridConfirmed = true`; **Nudge ◀ ▶** shifts `anchor` by a fixed delta (±5 ms) to fine-tune; a fine BPM adjust (±0.1) refines tempo. Auto proposes; the DJ anchors. Disabled until a track is loaded.

### 2. Clock-driven position

The MP3 engine already derives position from `context.currentTime - startedAt + seekOffset` scaled by `playbackRate`. Change consumption, not the formula:
- A hook drives a `requestAnimationFrame` loop that reads the engine clock and updates **a dedicated high-frequency position source the playhead/waveform read directly** (e.g. via a ref/subscription **outside Zustand**), so 60 fps updates do **not** trigger Zustand re-renders. This preserves the re-render scoping from the prior hardening work.
- The store's `currentTime` updates at a **coarse** rate (e.g. ~10 Hz) for logic that needs it (UI labels, gating). Loop/transport timing reads the engine clock, not the store poll.
- The redundant MP3 double-seek (store-poll re-seek at `useAudioEngine.ts:162`) is removed — seeks are issued once, imperatively, and the clock reflects them.

YouTube keeps a poll (no precise clock via the IFrame API) but may raise its rate modestly for a smoother playhead.

### 3. Sample-accurate loops (MP3, native loop points)

Use `AudioBufferSourceNode.loop = true` with `loopStart`/`loopEnd` — sample-accurate and click-free (sample-continuous at the wrap), no scheduler, no polling.

Engine API additions (`audioEngine.ts`):
```ts
setLoop(startSec: number, endSec: number): void; // sets loop=true, loopStart, loopEnd on the live source
clearLoop(): void;                               // loop=false; playback continues seamlessly past loopEnd
```
- **Loop-aware position:** while a loop is active, displayed position = `loopStart + ((rawElapsed - (loopStart - seekOffset)) mod loopLen)`. The engine exposes this so the playhead tracks the looped audio correctly.
- **Activate:** snap in-point to `nearestBeat(grid, playhead)` *at or before* the playhead (so the playhead is inside the window and the loop wraps immediately at `loopEnd`); out = in + N·secondsPerBeat. Call `setLoop(in, out)`.
- **Exit / seamless continue:** `clearLoop()` lets the same source continue past `loopEnd` with no reseek (seamless).
- **Roll (momentary):** hold = `setLoop`; release = `clearLoop()` **and** seek to the wall-clock "shadow" resume position (existing `rollStart*` math retained). Slip-mode exit retains the shadow seek.

YouTube loops keep the poll-based wrap (best effort) — same in/out grid-snapping, looser timing.

### 4. Pioneer-CDJ transport state machine

Pure machine — `src/utils/transport.ts`:
```ts
export type TransportState = 'CUED' | 'PLAYING' | 'PAUSED' | 'PREVIEW';
export type TransportEvent =
  | { type: 'PLAY' }
  | { type: 'CUE_PRESS' }
  | { type: 'CUE_RELEASE' };
export interface TransportContext { position: number; cuePoint: number | null; }
export interface TransportResult {
  nextState: TransportState;
  intents: TransportIntent[]; // e.g. {kind:'play'} {kind:'pause'} {kind:'seek', to} {kind:'setCue', at}
}
export function transition(state: TransportState, event: TransportEvent, ctx: TransportContext): TransportResult;
```

A dedicated **`cuePoint: number | null`** (the memory cue) is added to deck state, **distinct from the 8 hot cues**. Transition table:

| State | Event | Intents → Next |
|---|---|---|
| PLAYING | PLAY | `pause` → PAUSED |
| PLAYING | CUE_PRESS | `seek(cuePoint)`, `pause` → CUED *(cuePoint unchanged)* |
| CUED | PLAY | `play` → PLAYING |
| CUED | CUE_PRESS | `play` (from cue) → PREVIEW |
| PREVIEW | CUE_RELEASE | `seek(cuePoint)`, `pause` → CUED |
| PAUSED | PLAY | `play` → PLAYING |
| PAUSED | CUE_PRESS | `setCue(position)`, `seek(position)` → CUED |

Notes:
- If `cuePoint` is null (never set), CUE_PRESS while PLAYING/PAUSED sets it at the current position then cues (so the first CUE press defines the cue).
- The CUE button must fire **press and release** (pointerdown/up) for PREVIEW; a quick press-release at CUED yields a brief preview then return-to-cue (matches hardware).
- **Hot cues** keep their own behavior, but an **unset hot-cue click sets the hot cue at the current playhead** (DDJ-style) instead of being a silent no-op; clicking a *set* hot cue jumps to it (unchanged); right-click/clear unchanged.
- Store holds `transportState`; the engine executes intents (`play`/`pause`/`seek`/`setCue`).

### 5. SYNC — exact tempo + one-shot phase align (MP3)

- **Tempo:** `thisRate = (otherBpm × otherPitch) / thisBpm`, applied **exactly** (continuous) on MP3 — no `PITCH_RATES` snapping. (YouTube still snaps to the nearest available discrete rate, best effort.)
- **Phase:** compute the downbeat phase difference between the two decks at a common audio-clock reference (using both grids + positions), then **seek this deck by the sub-beat delta** so its next downbeat aligns with the other deck's. One-shot.
- Requires `bpm != null` on **both** decks (grid may be provisional). Sets `synced = true`; any manual pitch change clears it (existing behavior).
- `beatSync.ts` extends with `exactSyncRate(thisBpm, otherBpm, otherPitch)` and `phaseDelta(thisGrid, otherGrid, thisPos, otherPos)`.

### 6. Beat-jump / FF + pitch

- **Beat-jump:** `target = nearestBeat(grid, playhead) ± N·secondsPerBeat`, clamped to `[0, duration]` → always lands on-grid. Sizes ½/1/2/4/8/16. **On-screen jump buttons and keyboard both call this** — one paradigm. Fixed ±15s skip removed.
- **Pitch slider:** **continuous** on MP3 (fine tempo, e.g. ±8%/±16% range with fine resolution), discrete on YouTube; display as tempo %.

### 7. YouTube degradation

Same behavior model (grid snapping, transport states, sync intent) with best-effort precision: poll-based loop wrap, discrete pitch, approximate phase. The UI is consistent across backends; only the precision differs.

## Error handling & edge cases
- **No grid (bpm null):** loops, beat-jump, SYNC disabled with a visible reason; transport (cue/play) still works.
- **Provisional grid:** usable; UI indicates "grid unconfirmed" until Tap-Downbeat/confirm.
- **Loop out ≤ in:** rejected (no-op).
- **Seek/loop past duration:** clamped to `[0, duration]`; loops require `duration > 0`.
- **Preview with null cuePoint:** first CUE press sets the cue (no preview that frame).
- **Backend absent / not ready:** all transport/loop/seek intents guard on `getActivePlayer(...)` (unchanged routing).

## Testing strategy
- **Pure utils (TDD first):** `beatGrid` (snap/phase/quantize boundary cases), `transport` (every transition + null-cuePoint paths), `beatSync` (exact rate, phase delta), `loopMath` (grid-snapped in/out).
- **Engine (Web Audio mock):** `setLoop`/`clearLoop` set the right `loop`/`loopStart`/`loopEnd`; loop-aware position math; play-from/preview.
- **Integration:** transport machine ↔ store ↔ engine (cue/play/preview sequences); loop activate/exit/roll; SYNC tempo+phase; beat-jump grid landing.
- **Regression:** keep the prior suite green; preserve the re-render scoping (a Profiler test that the clock-driven playhead doesn't re-render control components).

## Phasing (one plan, reviewed per phase)
1. **Foundation** — `beatGrid` + grid state + Tap-Downbeat/Nudge `GridControl` + clock-driven position (rAF, no re-render storm) + remove MP3 double-seek.
2. **Sample-accurate loop engine** — native loop points (`setLoop`/`clearLoop`, loop-aware position) + grid-snapped loop controls + roll/slip.
3. **CDJ transport machine** — `transport.ts` + dedicated `cuePoint` + press/release CUE + play-from/preview wired through the engine.
4. **SYNC** — exact continuous tempo + one-shot phase align; continuous pitch slider.
5. **Beat-jump/FF unification** — grid-snapped jumps, buttons == keyboard, ±15s removed.

Each phase is independently testable and shippable.
