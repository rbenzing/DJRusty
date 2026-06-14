# Hardware-Accurate Transport, Loops, Sync & Beat Grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CUE/play, loops, beat-jump/FF, and SYNC behave like Pioneer-CDJ hardware on the MP3 (Web Audio) backend — driven by a real beat grid and the audio clock — while the YouTube backend keeps identical semantics at best-effort precision.

**Architecture:** A pure **beat-grid** model and a pure **CDJ transport state machine** form the foundation. The MP3 Web Audio engine gains **native loop-point** scheduling (sample-accurate) and **clock-driven position**. Store actions delegate to the pure utils. Components fire hardware-accurate events (press/release CUE, grid-snapped jumps). Five phases, each independently testable and shippable.

**Tech Stack:** TypeScript 5 (strict: `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`), React 18, Zustand 4, Web Audio API, YouTube IFrame API, Vitest + Testing Library.

**Reference spec:** `docs/superpowers/specs/2026-06-13-hardware-accurate-transport-design.md`

---

## Background the implementer needs

- **PowerShell-only run rules:** use `npm run …`, no `npx`, no `&&` chaining. Single frontend test file: `npm run test -- <path>`. Always finish a task with `npm run lint` (zero-warnings) and `npm run build` (strict `tsc -b`).
- **Pure utils live in `src/utils/` and must stay free of React/DOM/store imports** (project mandate). They are unit-tested in isolation. Follow the style of the existing `src/utils/beatJump.ts` and `src/utils/beatSync.ts`.
- **Dual backends, one interface.** Imperative commands route through `getActivePlayer(deckId, sourceType)` in `src/services/playerRegistry.ts` (returns a `DeckPlayer`). MP3 = `AudioEngineImpl` (`src/services/audioEngine.ts`); YouTube = `YouTubePlayerAdapter`. **Do not change this routing.**
- **Engine position formula** (`audioEngine.ts:221`): `getCurrentTime()` returns `seekOffset` when paused, else `seekOffset + (context.currentTime - startedAt) * playbackRate`. Fields: `seekOffset`, `startedAt`, `playbackRate`, `sourceNode: AudioBufferSourceNode | null`, `isPlayingFlag`, `generation`.
- **Position today is 250 ms-polled** (`useAudioEngine.ts:28`) and the poll re-applies seeks via a `skipSeekRef` guard; YouTube polls in `useYouTubePlayer.ts`. The MP3 seek-subscription double-seek lives around `useAudioEngine.ts:162`.
- **Re-render discipline (from prior hardening):** control components use narrow Zustand selectors; the high-frequency playhead must **not** be written to Zustand every frame. Read the engine clock directly in an rAF loop for the smooth playhead; only write a coarse `currentTime` to the store. A `Profiler` test must prove control components don't re-render on the high-frequency tick.
- **DeckState** lives in `src/types/deck.ts`; the store + initial state + `clearTrack` + `createInitialDeckState` are in `src/store/deckStore.ts`. Adding a field means updating the type, the initial state, and (if persistent) `clearTrack`.
- **BPM detection** runs only for MP3 (`bpmDetector.worker.ts`, launched from `useAudioEngine.ts`); it posts `bpm`. There is no downbeat detection today.

---

## Shared interfaces (define once; all tasks use these exact names)

```ts
// src/utils/beatGrid.ts
export interface BeatGrid { bpm: number; anchor: number; } // anchor = seconds of a known beat-1 (downbeat); 4/4
export function secondsPerBeat(bpm: number): number;
export function beatIndexAt(grid: BeatGrid, t: number): number;       // fractional beats from anchor (may be negative)
export function nearestBeat(grid: BeatGrid, t: number): number;       // snap t to nearest beat time
export function beatAtOrBefore(grid: BeatGrid, t: number): number;    // greatest beat time <= t
export function nearestBar(grid: BeatGrid, t: number): number;        // snap to nearest downbeat (every 4 beats)
export function quantize(grid: BeatGrid, t: number, division: number): number; // snap to nearest 1/division beat
export function phase(grid: BeatGrid, t: number, span?: 'beat' | 'bar'): number; // [0,1)

// src/utils/transport.ts
export type TransportState = 'CUED' | 'PLAYING' | 'PAUSED' | 'PREVIEW';
export type TransportEvent = { type: 'PLAY' } | { type: 'CUE_PRESS' } | { type: 'CUE_RELEASE' };
export interface TransportContext { position: number; cuePoint: number | null; }
export type TransportIntent =
  | { kind: 'play' } | { kind: 'pause' }
  | { kind: 'seek'; to: number } | { kind: 'setCue'; at: number };
export interface TransportResult { nextState: TransportState; intents: TransportIntent[]; cuePoint: number | null; }
export function transition(state: TransportState, event: TransportEvent, ctx: TransportContext): TransportResult;

// src/utils/loopMath.ts
export function snapLoopIn(grid: BeatGrid, playhead: number): number;     // beatAtOrBefore
export function loopOutFor(inSec: number, beats: number, bpm: number): number; // inSec + beats*60/bpm

// src/utils/beatSync.ts (additions)
export function exactSyncRate(thisBpm: number | null, otherBpm: number | null, otherPitch: number): number | null;
export function phaseDelta(thisGrid: BeatGrid, otherGrid: BeatGrid, thisPos: number, otherPos: number): number; // seconds to add to thisPos

// src/services/audioEngine.ts (additions to AudioEngine interface + impl)
setLoop(startSec: number, endSec: number): void;
clearLoop(): void;
isLooping(): boolean;
// getCurrentTime() becomes loop-aware (returns position within the active loop window)

// src/types/deck.ts (DeckState additions)
anchor: number | null;          // downbeat offset (seconds); null until proposed/tapped
gridConfirmed: boolean;         // false while provisional (auto), true after Tap-Downbeat/confirm
cuePoint: number | null;        // the memory cue, distinct from hotCues
transportState: TransportState; // 'CUED' | 'PLAYING' | 'PAUSED' | 'PREVIEW'
```

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `src/utils/beatGrid.ts` (+ test) | Pure grid math | Create |
| `src/utils/transport.ts` (+ test) | Pure CDJ state machine | Create |
| `src/utils/loopMath.ts` (+ test) | Grid-snapped loop in/out | Create |
| `src/utils/beatSync.ts` (+ test) | Add `exactSyncRate`, `phaseDelta` | Modify |
| `src/types/deck.ts` | Add `anchor`, `gridConfirmed`, `cuePoint`, `transportState` | Modify |
| `src/services/audioEngine.ts` (+ test) | Native loop points, loop-aware position | Modify |
| `src/store/deckStore.ts` | Grid + transport + loop/cue/jump/sync actions delegate to utils | Modify |
| `src/hooks/useAudioEngine.ts` | rAF clock position; native-loop wiring; remove double-seek | Modify |
| `src/hooks/useYouTubePlayer.ts` | Keep poll wrap; grid-consistent semantics | Modify |
| `src/hooks/usePlayhead.ts` (+ test) | rAF playhead reader (engine clock → ref, not Zustand) | Create |
| `src/components/Deck/GridControl.tsx` (+ test) | Tap-Downbeat / Nudge / fine-BPM | Create |
| `src/components/Deck/DeckControls.tsx` | CDJ cue/play (press/release CUE) | Modify |
| `src/components/Deck/LoopControls.tsx` | Grid-snapped loops via store | Modify |
| `src/components/Deck/BeatJump.tsx` | Grid-snapped jump; buttons==keyboard | Modify |
| `src/components/Deck/SyncButton.tsx` | Exact tempo + phase align | Modify |
| `src/components/Deck/PitchSlider.tsx` | Continuous pitch on MP3 | Modify |
| `src/hooks/useKeyboardShortcuts.ts` | Route jump/cue through new store actions | Modify |

---

# PHASE 1 — Beat-grid foundation + clock-driven position

## Task 1.1: Pure `beatGrid` module

**Files:**
- Create: `src/utils/beatGrid.ts`
- Test: `src/test/beatGrid.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/test/beatGrid.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  secondsPerBeat, beatIndexAt, nearestBeat, beatAtOrBefore, nearestBar, quantize, phase,
} from '../utils/beatGrid';

const grid = { bpm: 120, anchor: 0.5 }; // spb = 0.5s; beats at 0.5,1.0,1.5,...

describe('beatGrid', () => {
  it('secondsPerBeat', () => { expect(secondsPerBeat(120)).toBeCloseTo(0.5, 6); });

  it('beatIndexAt counts fractional beats from the anchor', () => {
    expect(beatIndexAt(grid, 0.5)).toBeCloseTo(0, 6);
    expect(beatIndexAt(grid, 1.5)).toBeCloseTo(2, 6);
    expect(beatIndexAt(grid, 0.25)).toBeCloseTo(-0.5, 6);
  });

  it('nearestBeat snaps to the closest beat time', () => {
    expect(nearestBeat(grid, 1.6)).toBeCloseTo(1.5, 6);
    expect(nearestBeat(grid, 1.8)).toBeCloseTo(2.0, 6);
  });

  it('beatAtOrBefore returns the greatest beat <= t', () => {
    expect(beatAtOrBefore(grid, 1.6)).toBeCloseTo(1.5, 6);
    expect(beatAtOrBefore(grid, 1.5)).toBeCloseTo(1.5, 6);
    expect(beatAtOrBefore(grid, 0.4)).toBeCloseTo(0.0, 6); // beat -1 is 0.0
  });

  it('nearestBar snaps to the nearest downbeat (4 beats = 2.0s here)', () => {
    expect(nearestBar(grid, 0.6)).toBeCloseTo(0.5, 6);   // bar starts at anchor 0.5
    expect(nearestBar(grid, 2.4)).toBeCloseTo(2.5, 6);   // next bar at 0.5 + 2.0
  });

  it('quantize snaps to 1/division beat', () => {
    expect(quantize(grid, 0.62, 2)).toBeCloseTo(0.5, 6);  // half-beat grid: 0.5,0.75,1.0
    expect(quantize(grid, 0.7, 2)).toBeCloseTo(0.75, 6);
  });

  it('phase returns [0,1) within a beat and within a bar', () => {
    expect(phase(grid, 0.75, 'beat')).toBeCloseTo(0.5, 6);
    expect(phase(grid, 1.0, 'beat')).toBeCloseTo(0, 6);
    expect(phase(grid, 1.5, 'bar')).toBeCloseTo(0.5, 6); // 2 beats into a 4-beat bar
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm run test -- src/test/beatGrid.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement** `src/utils/beatGrid.ts`:

```ts
/**
 * beatGrid.ts — Pure beat-grid math. No React/DOM/store imports.
 * A grid is { bpm, anchor }: anchor is the time (s) of a known beat-1 (downbeat); 4/4 assumed.
 */
export interface BeatGrid { bpm: number; anchor: number; }

const BEATS_PER_BAR = 4;

export function secondsPerBeat(bpm: number): number { return 60 / bpm; }

export function beatIndexAt(grid: BeatGrid, t: number): number {
  return (t - grid.anchor) / secondsPerBeat(grid.bpm);
}

export function nearestBeat(grid: BeatGrid, t: number): number {
  const spb = secondsPerBeat(grid.bpm);
  return grid.anchor + Math.round(beatIndexAt(grid, t)) * spb;
}

export function beatAtOrBefore(grid: BeatGrid, t: number): number {
  const spb = secondsPerBeat(grid.bpm);
  return grid.anchor + Math.floor(beatIndexAt(grid, t) + 1e-9) * spb;
}

export function nearestBar(grid: BeatGrid, t: number): number {
  const spBar = secondsPerBeat(grid.bpm) * BEATS_PER_BAR;
  return grid.anchor + Math.round((t - grid.anchor) / spBar) * spBar;
}

export function quantize(grid: BeatGrid, t: number, division: number): number {
  const step = secondsPerBeat(grid.bpm) / division;
  return grid.anchor + Math.round((t - grid.anchor) / step) * step;
}

export function phase(grid: BeatGrid, t: number, span: 'beat' | 'bar' = 'beat'): number {
  const unit = secondsPerBeat(grid.bpm) * (span === 'bar' ? BEATS_PER_BAR : 1);
  const raw = ((t - grid.anchor) % unit + unit) % unit;
  return raw / unit;
}
```

- [ ] **Step 4: Run to verify it passes** — `npm run test -- src/test/beatGrid.test.ts` → PASS (7 tests).

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/utils/beatGrid.ts src/test/beatGrid.test.ts
git commit -m "feat: pure beat-grid math (snap/phase/quantize)"
```

---

## Task 1.2: Grid fields on DeckState

**Files:**
- Modify: `src/types/deck.ts` (DeckState interface)
- Modify: `src/store/deckStore.ts` (`createInitialDeckState`, `clearTrack` reset)
- Test: `src/test/deck-grid-state.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/test/deck-grid-state.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useDeckStore } from '../store/deckStore';

describe('deck grid state', () => {
  beforeEach(() => { useDeckStore.getState().clearTrack('A'); });

  it('fresh deck has null anchor, unconfirmed grid, null cuePoint, CUED transport', () => {
    const d = useDeckStore.getState().decks.A;
    expect(d.anchor).toBeNull();
    expect(d.gridConfirmed).toBe(false);
    expect(d.cuePoint).toBeNull();
    expect(d.transportState).toBe('CUED');
  });

  it('setGrid sets bpm + anchor and marks confirmed', () => {
    useDeckStore.getState().setGrid('A', 128, 0.25);
    const d = useDeckStore.getState().decks.A;
    expect(d.bpm).toBe(128);
    expect(d.anchor).toBeCloseTo(0.25, 6);
    expect(d.gridConfirmed).toBe(true);
  });

  it('nudgeGrid shifts the anchor by the delta', () => {
    useDeckStore.getState().setGrid('A', 120, 1.0);
    useDeckStore.getState().nudgeGrid('A', 0.005);
    expect(useDeckStore.getState().decks.A.anchor).toBeCloseTo(1.005, 6);
  });

  it('clearTrack resets grid + cue + transport', () => {
    useDeckStore.getState().setGrid('A', 128, 0.25);
    useDeckStore.getState().setCuePoint('A', 12);
    useDeckStore.getState().clearTrack('A');
    const d = useDeckStore.getState().decks.A;
    expect(d.anchor).toBeNull();
    expect(d.gridConfirmed).toBe(false);
    expect(d.cuePoint).toBeNull();
    expect(d.transportState).toBe('CUED');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm run test -- src/test/deck-grid-state.test.ts` → FAIL (fields/actions missing).

- [ ] **Step 3: Implement**

In `src/types/deck.ts`, add to `DeckState` (import the type): `anchor: number | null;`, `gridConfirmed: boolean;`, `cuePoint: number | null;`, and `transportState: TransportState;` (import `TransportState` from `../utils/transport`). Add to the `DeckStore` actions interface:
```ts
setGrid: (deckId: 'A' | 'B', bpm: number, anchor: number) => void;
nudgeGrid: (deckId: 'A' | 'B', deltaSeconds: number) => void;
setCuePoint: (deckId: 'A' | 'B', time: number) => void;
```

In `src/store/deckStore.ts` `createInitialDeckState`, add the four fields: `anchor: null, gridConfirmed: false, cuePoint: null, transportState: 'CUED'`. Ensure `clearTrack` (and `loadTrack`) reset them to those defaults (the existing `clearTrack` rebuilds from the initial-state shape — add the four fields wherever the loop/slip fields are reset). Add the actions:
```ts
setGrid: (deckId, bpm, anchor) => updateDeck(set, deckId, { bpm, anchor, gridConfirmed: true }),
nudgeGrid: (deckId, deltaSeconds) => {
  const deck = get().decks[deckId];
  if (deck.anchor === null) return;
  updateDeck(set, deckId, { anchor: deck.anchor + deltaSeconds });
},
setCuePoint: (deckId, time) => updateDeck(set, deckId, { cuePoint: time }),
```

- [ ] **Step 4: Run to verify it passes** — `npm run test -- src/test/deck-grid-state.test.ts` → PASS.

- [ ] **Step 5: Lint + build + full suite (catch fixture drift in other deck-state tests)**

Run: `npm run lint` ; `npm run build` ; `npm run test`.
Expected: PASS. Some tests construct full deck fixtures by hand (e.g. `slip-mode.test.ts`, `keyboardShortcuts.test.ts`, `stores.test.ts`) — add the four new fields to those literals if `exactOptionalPropertyTypes`/the suite flags them.

- [ ] **Step 6: Commit**

```bash
git add src/types/deck.ts src/store/deckStore.ts src/test/deck-grid-state.test.ts
git commit -m "feat: grid/cue/transport fields + setGrid/nudgeGrid/setCuePoint actions"
```

---

## Task 1.3: Provisional grid from the BPM worker

**Files:**
- Modify: `src/hooks/useAudioEngine.ts` (BPM worker `onmessage` handler)
- Test: covered via Task 1.2 actions + a small unit on the proposal helper

**Behavior:** when the BPM worker posts a result, set `bpm` AND propose a provisional `anchor = 0` with `gridConfirmed = false` (the DJ confirms via Tap-Downbeat). Use a tiny pure helper so it's testable.

- [ ] **Step 1: Write the failing test** — Create `src/test/grid-proposal.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { proposeGrid } from '../utils/beatGrid';

describe('proposeGrid', () => {
  it('proposes the detected bpm with anchor 0, unconfirmed', () => {
    expect(proposeGrid(128)).toEqual({ bpm: 128, anchor: 0, confirmed: false });
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm run test -- src/test/grid-proposal.test.ts` → FAIL.

- [ ] **Step 3: Implement** — append to `src/utils/beatGrid.ts`:

```ts
/** Provisional grid proposed from auto-detected BPM. anchor 0 until the DJ taps the downbeat. */
export function proposeGrid(bpm: number): { bpm: number; anchor: number; confirmed: boolean } {
  return { bpm, anchor: 0, confirmed: false };
}
```

In `useAudioEngine.ts`, where the worker message currently calls `setBpm(deckId, bpm)`, instead set bpm and the provisional anchor without marking confirmed:
```ts
const { bpm: dbpm, anchor } = proposeGrid(bpm);
useDeckStore.getState().setBpm(deckId, dbpm);
useDeckStore.setState((s) => ({ decks: { ...s.decks, [deckId]: { ...s.decks[deckId], anchor, gridConfirmed: false } } }));
```
(Import `proposeGrid`. Keep `setBpm` so the existing other-deck-sync-invalidation still fires.)

- [ ] **Step 4: Run to verify it passes** — `npm run test -- src/test/grid-proposal.test.ts` → PASS. Then `npm run test` (full) → PASS.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/utils/beatGrid.ts src/hooks/useAudioEngine.ts src/test/grid-proposal.test.ts
git commit -m "feat: propose provisional grid (bpm + anchor 0) from the BPM worker"
```

---

## Task 1.4: `usePlayhead` — rAF clock reader (no Zustand writes per frame)

**Files:**
- Create: `src/hooks/usePlayhead.ts`
- Test: `src/test/usePlayhead.test.tsx`

**Behavior:** returns a `playheadRef` updated each `requestAnimationFrame` from the active player's `getCurrentTime()`, WITHOUT writing to Zustand (so the smooth playhead doesn't re-render control components). Components that draw the playhead read the ref via rAF.

- [ ] **Step 1: Write the failing test** — Create `src/test/usePlayhead.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePlayhead } from '../hooks/usePlayhead';
import { playerRegistry } from '../services/playerRegistry';
import { useDeckStore } from '../store/deckStore';

describe('usePlayhead', () => {
  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    playerRegistry.unregister('A', 'youtube'); playerRegistry.unregister('A', 'audio');
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number);
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('reads the active player clock into the ref without touching the store', async () => {
    let t = 0;
    playerRegistry.register('A', 'audio', { seekTo: vi.fn(), getCurrentTime: () => t, getDuration: () => 180 });
    useDeckStore.getState().loadTrack('A', 'x', { sourceType: 'mp3', title: '', artist: '', duration: 180, thumbnailUrl: null });
    const spy = vi.spyOn(useDeckStore.getState(), 'setCurrentTime');
    const { result } = renderHook(() => usePlayhead('A'));
    t = 12.34;
    await new Promise((r) => setTimeout(r, 5));
    expect(result.current.current).toBeCloseTo(12.34, 2);
    expect(spy).not.toHaveBeenCalled(); // never writes the store per frame
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm run test -- src/test/usePlayhead.test.tsx` → FAIL.

- [ ] **Step 3: Implement** `src/hooks/usePlayhead.ts`:

```ts
import { useEffect, useRef } from 'react';
import { getActivePlayer } from '../services/playerRegistry';
import { useDeckStore } from '../store/deckStore';

/** Smooth playhead from the active player's clock, updated each rAF into a ref (NOT Zustand). */
export function usePlayhead(deckId: 'A' | 'B'): { current: number } {
  const ref = useRef(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const { sourceType } = useDeckStore.getState().decks[deckId];
      const player = getActivePlayer(deckId, sourceType);
      if (player) ref.current = player.getCurrentTime();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deckId]);
  return ref;
}
```

- [ ] **Step 4: Run to verify it passes** — `npm run test -- src/test/usePlayhead.test.tsx` → PASS.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/hooks/usePlayhead.ts src/test/usePlayhead.test.tsx
git commit -m "feat: usePlayhead rAF clock reader (no per-frame store writes)"
```

---

## Task 1.5: Coarsen the store poll + remove the MP3 double-seek; wire waveform/time to `usePlayhead`

**Files:**
- Modify: `src/hooks/useAudioEngine.ts` (poll interval, drop the seek-subscription double-seek)
- Modify: `src/components/CenterWaveform/CenterWaveform.tsx` and/or the deck waveform/time display to read `usePlayhead`
- Test: `src/test/deck-playhead-rerender.test.tsx` (create)

- [ ] **Step 1: Write the failing Profiler test** — Create `src/test/deck-playhead-rerender.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { Profiler } from 'react';
import { render, act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { DeckControls } from '../components/Deck/DeckControls';

describe('control components do not re-render on the coarse currentTime tick', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));
  it('DeckControls stays put across coarse ticks', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'vid12345678', { sourceType: 'mp3', title: 't', artist: 'a', duration: 180, thumbnailUrl: null });
    let commits = 0;
    render(<Profiler id="dc" onRender={() => { commits++; }}><DeckControls deckId="A" /></Profiler>);
    const base = commits;
    act(() => { for (let i = 1; i <= 5; i++) s.setCurrentTime('A', i); });
    expect(commits).toBe(base);
  });
});
```

(This should already pass from prior selector work; it locks the invariant before the poll changes.)

- [ ] **Step 2: Run** — `npm run test -- src/test/deck-playhead-rerender.test.tsx` → PASS (lock-in).

- [ ] **Step 3: Implement** — In `useAudioEngine.ts`:
- Change the poll interval from `250` to `100` ms (coarse logic tick; the smooth playhead is rAF via `usePlayhead`). Keep the loop/slip logic in the poll for now (replaced in Phase 2).
- Remove the seek-subscription double-seek: delete the effect around `useAudioEngine.ts:162` that re-calls `engine.seekTo()` when the store `currentTime` changes, and the now-unneeded `skipSeekRef` plumbing. Seeks are issued once by the imperative callers via `getActivePlayer`.

In the waveform/time-display component(s), replace the Zustand `currentTime` subscription used for the moving playhead with `const playhead = usePlayhead(deckId);` and read `playhead.current` inside the component's own rAF draw loop. (Keep any coarse numeric time label on the store `currentTime`.)

- [ ] **Step 4: Run to verify** — `npm run test -- src/test/deck-playhead-rerender.test.tsx` → PASS; `npm run test` (full) → PASS; `npm run build`.

- [ ] **Step 5: Lint + commit**

```bash
npm run lint
git add src/hooks/useAudioEngine.ts src/components/CenterWaveform/CenterWaveform.tsx src/test/deck-playhead-rerender.test.tsx
git commit -m "perf: rAF playhead + coarse logic poll; remove MP3 double-seek"
```

---

## Task 1.6: `GridControl` component (Tap-Downbeat / Nudge / fine-BPM)

**Files:**
- Create: `src/components/Deck/GridControl.tsx` (+ `GridControl.module.css`)
- Mount in: `src/components/Deck/Deck.tsx`
- Test: `src/test/GridControl.test.tsx`

- [ ] **Step 1: Write the failing test** — Create `src/test/GridControl.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GridControl } from '../components/Deck/GridControl';
import { useDeckStore } from '../store/deckStore';

describe('GridControl', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('Tap Downbeat stamps the anchor at the current playhead and confirms the grid', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { sourceType: 'mp3', title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setBpm('A', 120);
    s.setCurrentTime('A', 4.2);
    render(<GridControl deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /tap downbeat/i }));
    const d = useDeckStore.getState().decks.A;
    expect(d.anchor).toBeCloseTo(4.2, 3);
    expect(d.gridConfirmed).toBe(true);
  });

  it('Nudge ▶ shifts the anchor by +5ms', () => {
    const s = useDeckStore.getState();
    s.setGrid('A', 120, 1.0);
    render(<GridControl deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /nudge later/i }));
    expect(useDeckStore.getState().decks.A.anchor).toBeCloseTo(1.005, 4);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm run test -- src/test/GridControl.test.tsx` → FAIL.

- [ ] **Step 3: Implement** `src/components/Deck/GridControl.tsx`:

```tsx
import { useDeckStore, useDeckActions } from '../../store/deckStore';
import styles from './GridControl.module.css';

const NUDGE_MS = 0.005;

export function GridControl({ deckId }: { deckId: 'A' | 'B' }) {
  const { setGrid, nudgeGrid } = useDeckActions();
  const bpm = useDeckStore((s) => s.decks[deckId].bpm);
  const anchor = useDeckStore((s) => s.decks[deckId].anchor);
  const confirmed = useDeckStore((s) => s.decks[deckId].gridConfirmed);
  const trackId = useDeckStore((s) => s.decks[deckId].trackId);
  const disabled = !trackId || bpm === null;

  const tapDownbeat = () => {
    const { currentTime, bpm: b } = useDeckStore.getState().decks[deckId];
    if (b === null) return;
    setGrid(deckId, b, currentTime); // stamp anchor at the playhead, confirm
  };

  return (
    <div className={styles.grid} aria-label={`Deck ${deckId} beat grid`}>
      <button disabled={disabled} aria-label={`Tap downbeat on Deck ${deckId}`} onClick={tapDownbeat}>TAP</button>
      <button disabled={disabled || anchor === null} aria-label={`Nudge grid earlier on Deck ${deckId}`} onClick={() => nudgeGrid(deckId, -NUDGE_MS)}>◀</button>
      <button disabled={disabled || anchor === null} aria-label={`Nudge grid later on Deck ${deckId}`} onClick={() => nudgeGrid(deckId, NUDGE_MS)}>▶</button>
      <span className={styles.status}>{confirmed ? 'grid set' : bpm ? 'grid unconfirmed' : 'no bpm'}</span>
    </div>
  );
}
```

Create `GridControl.module.css` (a small flex row; match the project's CSS-module style). Mount `<GridControl deckId={deckId} />` in `Deck.tsx` near the existing BPM/tap controls. Add `setGrid`/`nudgeGrid` to the `useDeckActions` bag in `deckStore.ts`.

- [ ] **Step 4: Run to verify it passes** — `npm run test -- src/test/GridControl.test.tsx` → PASS.

- [ ] **Step 5: Lint + build + commit**

```bash
npm run lint
npm run build
git add src/components/Deck/GridControl.tsx src/components/Deck/GridControl.module.css src/components/Deck/Deck.tsx src/store/deckStore.ts src/test/GridControl.test.tsx
git commit -m "feat: GridControl — tap-downbeat, nudge, grid status"
```

**Phase 1 gate:** `npm run lint` (0 warnings), `npm run build`, `npm run test` (all green). Manual smoke: load an MP3, confirm BPM detects, tap the downbeat on a kick, see "grid set"; playhead is smooth.

---

# PHASE 2 — Sample-accurate loop engine + grid-snapped loop controls

## Task 2.1: `loopMath` (grid-snapped in/out)

**Files:** Create `src/utils/loopMath.ts` + `src/test/loopMath.test.ts`.

- [ ] **Step 1: Failing test** — `src/test/loopMath.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { snapLoopIn, loopOutFor } from '../utils/loopMath';

const grid = { bpm: 120, anchor: 0.5 }; // spb 0.5

describe('loopMath', () => {
  it('snapLoopIn snaps the in-point to the beat at or before the playhead', () => {
    expect(snapLoopIn(grid, 1.7)).toBeCloseTo(1.5, 6);
    expect(snapLoopIn(grid, 1.5)).toBeCloseTo(1.5, 6);
  });
  it('loopOutFor returns in + beats*60/bpm', () => {
    expect(loopOutFor(1.5, 4, 120)).toBeCloseTo(3.5, 6); // 4 beats = 2.0s
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `src/utils/loopMath.ts`:

```ts
import { type BeatGrid, beatAtOrBefore } from './beatGrid';

/** Loop in-point: snap to the grid beat at or before the playhead (so the playhead is inside the loop). */
export function snapLoopIn(grid: BeatGrid, playhead: number): number {
  return beatAtOrBefore(grid, playhead);
}
/** Loop out-point for a beat-length loop. */
export function loopOutFor(inSec: number, beats: number, bpm: number): number {
  return inSec + (beats / bpm) * 60;
}
```

- [ ] **Step 4: Run** → PASS. **Step 5:** `npm run lint`; commit `feat: grid-snapped loop in/out math`.

---

## Task 2.2: Native loop points on the audio engine

**Files:** Modify `src/services/audioEngine.ts` (interface + impl); test `src/test/audioEngine-loop.test.ts` (create).

**Design:** add `loopStart`/`loopEnd` fields. `setLoop(s,e)` sets them and turns on `sourceNode.loop`/`loopStart`/`loopEnd`. `clearLoop()` turns `sourceNode.loop = false`. New source nodes (created in `play()`) must inherit the active loop. `getCurrentTime()` becomes loop-aware: while looping, return the position folded into `[loopStart, loopEnd)`.

- [ ] **Step 1: Failing test** — `src/test/audioEngine-loop.test.ts` (reuse the Web Audio mock pattern from `audioEngine.test.ts`):

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioEngineImpl } from '../services/audioEngine';
// (import/construct the same Web Audio mock the existing audioEngine.test.ts uses)

describe('AudioEngineImpl loop points', () => {
  it('setLoop turns on native looping with the given bounds; clearLoop turns it off', () => {
    const engine = new AudioEngineImpl();
    // load a buffer via the test helper used in audioEngine.test.ts, then:
    engine.play(0);
    engine.setLoop(2, 4);
    expect(engine.isLooping()).toBe(true);
    // assert the live source node has loop=true, loopStart=2, loopEnd=4 via the mock
    engine.clearLoop();
    expect(engine.isLooping()).toBe(false);
  });

  it('getCurrentTime folds the position into the active loop window', () => {
    const engine = new AudioEngineImpl();
    // load buffer; drive the mocked context.currentTime so raw elapsed exceeds the loop length
    engine.play(2);
    engine.setLoop(2, 4); // 2s window
    // advance mock clock by 5s of elapsed → folded position should be within [2,4)
    const t = engine.getCurrentTime();
    expect(t).toBeGreaterThanOrEqual(2);
    expect(t).toBeLessThan(4);
  });
});
```

(Match the existing test's buffer/mock helpers; adapt the clock-advance mechanism to that mock.)

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — in `audioEngine.ts`:
- Add fields: `private loopStart: number | null = null; private loopEnd: number | null = null;`
- Add to the `AudioEngine` interface and impl:
```ts
setLoop(startSec: number, endSec: number): void {
  if (endSec <= startSec) return;
  this.loopStart = startSec; this.loopEnd = endSec;
  if (this.sourceNode) {
    this.sourceNode.loopStart = startSec;
    this.sourceNode.loopEnd = endSec;
    this.sourceNode.loop = true;
  }
}
clearLoop(): void {
  this.loopStart = null; this.loopEnd = null;
  if (this.sourceNode) this.sourceNode.loop = false;
}
isLooping(): boolean { return this.loopStart !== null && this.loopEnd !== null; }
```
- In `play()` (where the new `sourceNode` is created/configured, around `audioEngine.ts:174-187`), after setting `playbackRate`, re-apply an active loop to the new node:
```ts
if (this.loopStart !== null && this.loopEnd !== null) {
  this.sourceNode.loopStart = this.loopStart;
  this.sourceNode.loopEnd = this.loopEnd;
  this.sourceNode.loop = true;
}
```
- Make `getCurrentTime()` loop-aware:
```ts
getCurrentTime(): number {
  const base = this.isPlayingFlag
    ? this.seekOffset + (this.context.currentTime - this.startedAt) * this.playbackRate
    : this.seekOffset;
  if (this.loopStart !== null && this.loopEnd !== null && base >= this.loopStart) {
    const len = this.loopEnd - this.loopStart;
    return this.loopStart + ((base - this.loopStart) % len);
  }
  return base;
}
```

- [ ] **Step 4: Run** → PASS; run full `audioEngine.test.ts` (signal-chain/effect tests must stay green). **Step 5:** `npm run lint`; commit `feat: native sample-accurate loop points on the Web Audio engine`.

---

## Task 2.3: Grid-snapped loop store actions using the engine

**Files:** Modify `src/store/deckStore.ts` (`activateLoopBeat`, `deactivateLoop`, `startRoll`, `endRoll`); test `src/test/loop-actions.test.ts` (create).

- [ ] **Step 1: Failing test** — assert `activateLoopBeat` snaps `loopStart` to the grid and calls `engine.setLoop`, and `deactivateLoop` calls `engine.clearLoop`. Register a mock backend exposing `setLoop`/`clearLoop`/`seekTo` and a confirmed grid:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';

function mockEngine() { return { seekTo: vi.fn(), getCurrentTime: () => 0, getDuration: () => 180, setLoop: vi.fn(), clearLoop: vi.fn(), isLooping: () => false }; }

describe('grid-snapped loop actions', () => {
  beforeEach(() => { useDeckStore.getState().clearTrack('A'); playerRegistry.unregister('A','audio'); });

  it('activateLoopBeat snaps loopStart to the grid and arms the engine loop', () => {
    const eng = mockEngine();
    playerRegistry.register('A', 'audio', eng as never);
    const s = useDeckStore.getState();
    s.loadTrack('A','x',{ sourceType:'mp3', title:'', artist:'', duration:180, thumbnailUrl:null });
    s.setGrid('A', 120, 0.5);      // beats at .5,1,1.5,...
    s.setCurrentTime('A', 1.7);
    s.activateLoopBeat('A', 4);
    const d = useDeckStore.getState().decks.A;
    expect(d.loopActive).toBe(true);
    expect(d.loopStart).toBeCloseTo(1.5, 6);      // snapped
    expect(d.loopEnd).toBeCloseTo(3.5, 6);        // +4 beats (2.0s)
    expect(eng.setLoop).toHaveBeenCalledWith(1.5, 3.5);
  });

  it('deactivateLoop clears the engine loop', () => {
    const eng = mockEngine();
    playerRegistry.register('A','audio', eng as never);
    const s = useDeckStore.getState();
    s.loadTrack('A','x',{ sourceType:'mp3', title:'', artist:'', duration:180, thumbnailUrl:null });
    s.setGrid('A',120,0.5); s.setCurrentTime('A',1.7); s.activateLoopBeat('A',4);
    s.deactivateLoop('A');
    expect(eng.clearLoop).toHaveBeenCalled();
    expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — rewrite `activateLoopBeat` to snap and arm:
```ts
activateLoopBeat: (deckId, beatCount) => {
  const deck = get().decks[deckId];
  if (!deck.bpm || deck.anchor === null) return;
  const grid = { bpm: deck.bpm, anchor: deck.anchor };
  const loopStart = snapLoopIn(grid, deck.currentTime);
  const rawEnd = loopOutFor(loopStart, beatCount, deck.bpm);
  const loopEnd = deck.duration > 0 ? Math.min(rawEnd, deck.duration) : rawEnd;
  const player = getActivePlayer(deckId, deck.sourceType);
  player?.setLoop?.(loopStart, loopEnd); // MP3 native loop; YouTube has no setLoop → poll wrap (Task 2.4)
  updateDeck(set, deckId, { loopActive: true, loopStart, loopEnd, loopBeatCount: beatCount });
},
```
Update `deactivateLoop` to call `getActivePlayer(deckId, deck.sourceType)?.clearLoop?.()` (in addition to the existing slip-aware seek), and `startRoll`/`endRoll` to arm/clear via `setLoop`/`clearLoop` while preserving the wall-clock shadow resume. Add `setLoop?`/`clearLoop?`/`isLooping?` as **optional** methods on the `DeckPlayer` interface in `playerRegistry.ts` (YouTube adapter omits them). Import `snapLoopIn`, `loopOutFor`.

- [ ] **Step 4: Run** → PASS; `npm run test` full → PASS (the old `slip-mode.test.ts` may need a confirmed grid + the new optional engine methods on its mock — update those fixtures). **Step 5:** `npm run lint` + `npm run build`; commit `feat: grid-snapped loops armed via native engine loop points`.

---

## Task 2.4: Retire the polled loop wrap on MP3; keep it for YouTube; update LoopControls

**Files:** Modify `src/hooks/useAudioEngine.ts` (remove the poll's `seekTo(loopStart)` wrap — the engine loops natively now), keep `useYouTubePlayer.ts` poll wrap (YouTube has no native loop), and `src/components/Deck/LoopControls.tsx` (no behavior change beyond disabled-state copy). Test: extend `loop-actions.test.ts` to assert the MP3 poll no longer issues a seek when looping (since native loop handles it).

- [ ] **Step 1:** Write a test that, with a native engine loop armed, the 100 ms logic poll does NOT call `engine.seekTo` for the wrap (only slip bookkeeping remains). **Step 2:** Run → FAIL. **Step 3:** In `useAudioEngine.ts` `startPoll`, remove the `if (deck.loopActive && ... time >= deck.loopEnd) engine.seekTo(...)` block (native loop owns the wrap); keep the `updateSlipPosition` call. **Step 4:** Run → PASS; full suite → PASS. **Step 5:** lint+build; commit `refactor: MP3 loop wrap handled by native engine loop, not the poll`.

**Phase 2 gate:** lint/build/test green. Manual smoke: set a 4-beat loop on an MP3 — it should be tight and click-free; exit continues seamlessly; loop roll resumes at the slip position.

---

# PHASE 3 — Pioneer-CDJ transport state machine

## Task 3.1: Pure `transport` state machine

**Files:** Create `src/utils/transport.ts` + `src/test/transport.test.ts`.

- [ ] **Step 1: Failing test** — `src/test/transport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { transition } from '../utils/transport';

describe('transport state machine (Pioneer CDJ)', () => {
  it('PLAYING + PLAY → PAUSED (pause at position)', () => {
    const r = transition('PLAYING', { type: 'PLAY' }, { position: 30, cuePoint: 10 });
    expect(r.nextState).toBe('PAUSED');
    expect(r.intents).toEqual([{ kind: 'pause' }]);
  });
  it('PLAYING + CUE → seek to cue + pause → CUED (cue unchanged)', () => {
    const r = transition('PLAYING', { type: 'CUE_PRESS' }, { position: 30, cuePoint: 10 });
    expect(r.nextState).toBe('CUED');
    expect(r.intents).toEqual([{ kind: 'seek', to: 10 }, { kind: 'pause' }]);
    expect(r.cuePoint).toBe(10);
  });
  it('CUED + PLAY → PLAYING', () => {
    const r = transition('CUED', { type: 'PLAY' }, { position: 10, cuePoint: 10 });
    expect(r.nextState).toBe('PLAYING');
    expect(r.intents).toEqual([{ kind: 'play' }]);
  });
  it('CUED + CUE_PRESS → PREVIEW (play from cue)', () => {
    const r = transition('CUED', { type: 'CUE_PRESS' }, { position: 10, cuePoint: 10 });
    expect(r.nextState).toBe('PREVIEW');
    expect(r.intents).toEqual([{ kind: 'play' }]);
  });
  it('PREVIEW + CUE_RELEASE → seek to cue + pause → CUED', () => {
    const r = transition('PREVIEW', { type: 'CUE_RELEASE' }, { position: 12, cuePoint: 10 });
    expect(r.nextState).toBe('CUED');
    expect(r.intents).toEqual([{ kind: 'seek', to: 10 }, { kind: 'pause' }]);
  });
  it('PAUSED + CUE_PRESS → set cue at position + seek there → CUED', () => {
    const r = transition('PAUSED', { type: 'CUE_PRESS' }, { position: 25, cuePoint: 10 });
    expect(r.nextState).toBe('CUED');
    expect(r.intents).toEqual([{ kind: 'setCue', at: 25 }, { kind: 'seek', to: 25 }]);
    expect(r.cuePoint).toBe(25);
  });
  it('null cuePoint: PLAYING + CUE sets cue at position first', () => {
    const r = transition('PLAYING', { type: 'CUE_PRESS' }, { position: 18, cuePoint: null });
    expect(r.cuePoint).toBe(18);
    expect(r.intents).toEqual([{ kind: 'setCue', at: 18 }, { kind: 'seek', to: 18 }, { kind: 'pause' }]);
    expect(r.nextState).toBe('CUED');
  });
  it('CUE_RELEASE outside PREVIEW is a no-op', () => {
    const r = transition('PLAYING', { type: 'CUE_RELEASE' }, { position: 5, cuePoint: 10 });
    expect(r.nextState).toBe('PLAYING');
    expect(r.intents).toEqual([]);
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** `src/utils/transport.ts`:

```ts
export type TransportState = 'CUED' | 'PLAYING' | 'PAUSED' | 'PREVIEW';
export type TransportEvent = { type: 'PLAY' } | { type: 'CUE_PRESS' } | { type: 'CUE_RELEASE' };
export interface TransportContext { position: number; cuePoint: number | null; }
export type TransportIntent =
  | { kind: 'play' } | { kind: 'pause' }
  | { kind: 'seek'; to: number } | { kind: 'setCue'; at: number };
export interface TransportResult { nextState: TransportState; intents: TransportIntent[]; cuePoint: number | null; }

export function transition(state: TransportState, event: TransportEvent, ctx: TransportContext): TransportResult {
  const cue = ctx.cuePoint;
  switch (event.type) {
    case 'PLAY':
      if (state === 'PLAYING') return { nextState: 'PAUSED', intents: [{ kind: 'pause' }], cuePoint: cue };
      return { nextState: 'PLAYING', intents: [{ kind: 'play' }], cuePoint: cue };
    case 'CUE_PRESS': {
      if (state === 'CUED') return { nextState: 'PREVIEW', intents: [{ kind: 'play' }], cuePoint: cue };
      if (state === 'PAUSED')
        return { nextState: 'CUED', intents: [{ kind: 'setCue', at: ctx.position }, { kind: 'seek', to: ctx.position }], cuePoint: ctx.position };
      // PLAYING (or PREVIEW): return to cue & pause; if no cue yet, set it at the current position first
      if (cue === null)
        return { nextState: 'CUED', intents: [{ kind: 'setCue', at: ctx.position }, { kind: 'seek', to: ctx.position }, { kind: 'pause' }], cuePoint: ctx.position };
      return { nextState: 'CUED', intents: [{ kind: 'seek', to: cue }, { kind: 'pause' }], cuePoint: cue };
    }
    case 'CUE_RELEASE':
      if (state === 'PREVIEW' && cue !== null)
        return { nextState: 'CUED', intents: [{ kind: 'seek', to: cue }, { kind: 'pause' }], cuePoint: cue };
      return { nextState: state, intents: [], cuePoint: cue };
  }
}
```

- [ ] **Step 4: Run** → PASS (8 tests). **Step 5:** `npm run lint`; commit `feat: pure Pioneer-CDJ transport state machine`.

---

## Task 3.2: Wire the transport machine into the store

**Files:** Modify `src/store/deckStore.ts` — add a `dispatchTransport(deckId, event)` action that runs `transition`, applies intents (`play`/`pause` → `setPlaybackState`; `seek` → `getActivePlayer(...).seekTo`; `setCue` → `setCuePoint`), and stores `transportState`/`cuePoint`. Test `src/test/transport-store.test.ts` (create).

- [ ] **Step 1: Failing test** — register a mock backend; assert `dispatchTransport('A', {type:'CUE_PRESS'})` from PAUSED sets the cue at the playhead, seeks there, and sets `transportState:'CUED'`. **Step 2:** Run → FAIL. **Step 3:** Implement:

```ts
dispatchTransport: (deckId, event) => {
  const deck = get().decks[deckId];
  const player = getActivePlayer(deckId, deck.sourceType);
  const pos = player?.getCurrentTime() ?? deck.currentTime;
  const r = transition(deck.transportState, event, { position: pos, cuePoint: deck.cuePoint });
  for (const intent of r.intents) {
    if (intent.kind === 'play') get().setPlaybackState(deckId, 'playing');
    else if (intent.kind === 'pause') get().setPlaybackState(deckId, 'paused');
    else if (intent.kind === 'seek') player?.seekTo(intent.to, true);
    else if (intent.kind === 'setCue') updateDeck(set, deckId, { cuePoint: intent.at });
  }
  updateDeck(set, deckId, { transportState: r.nextState, cuePoint: r.cuePoint });
},
```
Keep `transportState` in sync with externally-driven play/pause: in `setPlaybackState`, map `'playing'→'PLAYING'` and `'paused'→'PAUSED'` when the change didn't originate from a transport intent (guard with a flag or set `transportState` directly in `setPlaybackState`). **Step 4:** Run → PASS; full suite → PASS. **Step 5:** lint+build; commit `feat: dispatchTransport applies CDJ intents to the engine + store`.

---

## Task 3.3: DeckControls — CDJ CUE/PLAY with press/release

**Files:** Modify `src/components/Deck/DeckControls.tsx`; test `src/test/deckcontrols-cdj.test.tsx` (create).

- [ ] **Step 1: Failing test** — render DeckControls on an MP3 deck with a registered mock backend; assert: PLAY toggles via `dispatchTransport({type:'PLAY'})`; CUE pointerdown fires `CUE_PRESS`, pointerup fires `CUE_RELEASE`; while playing, CUE returns to cue and pauses. **Step 2:** Run → FAIL. **Step 3:** Implement — replace the current `handlePlayPause`/`handleJumpToCue`/`handleSetCue` with:
- PLAY button `onClick` → `dispatchTransport(deckId, { type: 'PLAY' })`.
- CUE button `onPointerDown` → `dispatchTransport(deckId, { type: 'CUE_PRESS' })`; `onPointerUp`/`onPointerLeave` → `dispatchTransport(deckId, { type: 'CUE_RELEASE' })`.
- Remove the separate "set cue" button (CUE-while-paused now sets it); keep RESTART (seek 0) but it no longer changes transport state. Read `transportState` via a narrow selector for button labels/LED. Get `dispatchTransport` from `useDeckActions`. **Step 4:** Run → PASS; full suite → PASS. **Step 5:** lint+build; commit `feat: CDJ cue/play transport in DeckControls (press/release CUE)`.

## Task 3.4: Hot cues — unset click sets at playhead; route through store

**Files:** Modify `src/components/Deck/HotCues.tsx` / `HotCueButton.tsx`; extend `src/test/hotcues-seek-routing.test.tsx`.

- [ ] **Step 1:** Test that clicking an *unset* hot cue sets it at the current playhead (was a no-op). **Step 2:** Run → FAIL. **Step 3:** In `HotCueButton.handleClick`, when `!isSet`, call `onSet()` (set at playhead) instead of no-op; set hot cues stay jump-on-click. **Step 4:** Run → PASS. **Step 5:** lint; commit `feat: unset hot-cue click sets the cue at the playhead`.

**Phase 3 gate:** lint/build/test green. Manual smoke: CUE while playing jumps back & pauses; hold CUE previews then returns; PLAY from cue plays; CUE while paused sets the cue.

---

# PHASE 4 — SYNC (exact tempo + one-shot phase align) + continuous pitch

## Task 4.1: `beatSync` exact-rate + phase-delta

**Files:** Modify `src/utils/beatSync.ts`; extend `src/test/beatSync.test.ts` (or create `beatSync-exact.test.ts`).

- [ ] **Step 1: Failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { exactSyncRate, phaseDelta } from '../utils/beatSync';

describe('exact sync + phase', () => {
  it('exactSyncRate = otherEffectiveBpm / thisBpm (continuous)', () => {
    expect(exactSyncRate(100, 120, 1)).toBeCloseTo(1.2, 6);
    expect(exactSyncRate(100, 120, 1.05)).toBeCloseTo(1.26, 6); // other pitched up 5%
    expect(exactSyncRate(null, 120, 1)).toBeNull();
  });
  it('phaseDelta returns the sub-beat seconds to add so downbeats align', () => {
    const a = { bpm: 120, anchor: 0.0 };
    const b = { bpm: 120, anchor: 0.25 }; // b is 0.25s (half a beat) ahead
    // align this(a) at pos 1.0 to other(b) at pos 1.0: nudge by the phase difference within a beat
    const d = phaseDelta(a, b, 1.0, 1.0);
    expect(Math.abs(d)).toBeLessThanOrEqual(0.25 + 1e-6); // within half a beat
  });
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (append to `beatSync.ts`, importing `phase`/`secondsPerBeat` from `beatGrid`):

```ts
import { type BeatGrid, phase, secondsPerBeat } from './beatGrid';

/** Exact continuous rate to match this deck's tempo to the other deck's effective tempo. */
export function exactSyncRate(thisBpm: number | null, otherBpm: number | null, otherPitch: number): number | null {
  if (!thisBpm || !otherBpm) return null;
  return (otherBpm * otherPitch) / thisBpm;
}

/** Seconds to add to thisPos so this deck's beat phase matches the other deck's (nearest, within ±half-beat). */
export function phaseDelta(thisGrid: BeatGrid, otherGrid: BeatGrid, thisPos: number, otherPos: number): number {
  const spb = secondsPerBeat(thisGrid.bpm);
  const diff = (phase(otherGrid, otherPos, 'beat') - phase(thisGrid, thisPos, 'beat')) * spb;
  // wrap into [-spb/2, spb/2]
  return ((diff + spb / 2 + spb) % spb) - spb / 2;
}
```

- [ ] **Step 4:** Run → PASS. **Step 5:** lint; commit `feat: exact sync rate + downbeat phase-delta math`.

## Task 4.2: SYNC action (tempo + one-shot phase align) + SyncButton

**Files:** Modify `src/store/deckStore.ts` (`syncToDeck` action), `src/components/Deck/SyncButton.tsx`; test `src/test/sync-action.test.ts` (create).

- [ ] **Step 1: Failing test** — both decks MP3 with confirmed grids + registered mock engines; `syncToDeck('A','B')` sets A's `pitchRate` to the exact ratio (not snapped) and seeks A by the phase delta, sets `synced:true`. **Step 2:** Run → FAIL. **Step 3:** Implement `syncToDeck(deckId, otherId)`:
```ts
syncToDeck: (deckId, otherId) => {
  const me = get().decks[deckId], other = get().decks[otherId];
  if (!me.bpm || !other.bpm || me.anchor === null || other.anchor === null) return;
  const rate = exactSyncRate(me.bpm, other.bpm, other.pitchRate);
  if (rate === null) return;
  get().setPitchRate(deckId, rate);          // continuous on MP3; YouTube snaps in its hook
  const player = getActivePlayer(deckId, me.sourceType);
  const myPos = player?.getCurrentTime() ?? me.currentTime;
  const otherPlayer = getActivePlayer(otherId, other.sourceType);
  const otherPos = otherPlayer?.getCurrentTime() ?? other.currentTime;
  const delta = phaseDelta({ bpm: me.bpm, anchor: me.anchor }, { bpm: other.bpm, anchor: other.anchor }, myPos, otherPos);
  player?.seekTo(myPos + delta, true);
  updateDeck(set, deckId, { synced: true });
},
```
**Important:** `setPitchRate`'s type currently constrains to discrete `PitchRate`. Relax the store/`pitchRate` typing to `number` for MP3 (keep discrete snapping in the YouTube hook). Update `SyncButton` to call `syncToDeck(deckId, otherDeckId)` and require both grids (`bpm != null` on both — provisional grid allowed per spec). **Step 4:** Run → PASS; full suite → PASS. **Step 5:** lint+build; commit `feat: SYNC = exact tempo + one-shot phase align`.

## Task 4.3: Continuous pitch slider on MP3

**Files:** Modify `src/components/Deck/PitchSlider.tsx`; test extend `src/test/mp3-005-pitch.test.ts` or a new `pitch-continuous.test.tsx`.

- [ ] **Step 1:** Test that on an MP3 deck the slider emits a continuous `setPitchRate` value within a range (e.g. ±8%) — not snapped to the 8 discrete steps. **Step 2:** Run → FAIL. **Step 3:** For `sourceType === 'mp3'`, render a continuous range input mapped to `[0.92, 1.08]` (±8%, fine `step={0.001}`), displaying tempo %. Keep the discrete 8-step input for YouTube. Moving the slider still clears `synced`. **Step 4:** Run → PASS; full suite → PASS. **Step 5:** lint+build; commit `feat: continuous pitch on MP3 (±8% fine), discrete on YouTube`.

**Phase 4 gate:** lint/build/test green. Manual smoke: two MP3 decks at different BPMs → SYNC matches tempo exactly and locks the downbeat; pitch fades smoothly.

---

# PHASE 5 — Beat-jump / FF unification

## Task 5.1: Grid-snapped beat-jump action

**Files:** Modify `src/utils/beatJump.ts` (add grid-snap), `src/store/deckStore.ts` (a `beatJump(deckId, direction)` action), `src/components/Deck/BeatJump.tsx`, `src/hooks/useKeyboardShortcuts.ts`. Test `src/test/beatjump-grid.test.ts` (create).

- [ ] **Step 1: Failing test**:

```ts
import { describe, it, expect } from 'vitest';
import { gridJumpTarget } from '../utils/beatJump';

const grid = { bpm: 120, anchor: 0.5 }; // spb 0.5
describe('grid-snapped beat jump', () => {
  it('lands on the grid: nearestBeat ± N beats, clamped', () => {
    // playhead 1.7 → nearestBeat 1.5; +4 beats (2.0s) → 3.5
    expect(gridJumpTarget(grid, 1.7, 4, +1, 180)).toBeCloseTo(3.5, 6);
    // -4 beats → -0.5 → clamp 0
    expect(gridJumpTarget(grid, 1.7, 4, -1, 180)).toBeCloseTo(0, 6);
  });
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Add to `beatJump.ts`:
```ts
import { type BeatGrid, nearestBeat, secondsPerBeat } from './beatGrid';
/** Grid-snapped jump target: snap to nearest beat, move N beats, clamp to [0,duration]. */
export function gridJumpTarget(grid: BeatGrid, playhead: number, beats: number, dir: 1 | -1, duration: number): number {
  const target = nearestBeat(grid, playhead) + dir * beats * secondsPerBeat(grid.bpm);
  return clampTime(target, duration);
}
```
Add store action `beatJump(deckId, dir)` that reads grid+playhead and `getActivePlayer(...).seekTo(gridJumpTarget(...), true)`; no-op if `bpm`/`anchor` null. **Step 4:** Run → PASS. **Step 5:** lint; commit `feat: grid-snapped beat-jump target math + action`.

## Task 5.2: Unify on-screen jump buttons with the keyboard; remove ±15s

**Files:** Modify `src/components/Deck/BeatJump.tsx` (buttons call `beatJump` action), `src/components/Deck/DeckControls.tsx` (remove the ±15s skip buttons), `src/hooks/useKeyboardShortcuts.ts` (arrows/`,`/`.` call the same `beatJump` action). Test extend `src/test/keyboardShortcuts.test.ts` + a BeatJump component test.

- [ ] **Step 1:** Test that the on-screen ◀/▶ jump buttons and the keyboard both invoke `beatJump(deckId, dir)` and land on-grid; assert the ±15s buttons are gone (no `Skip ... 15` labels). **Step 2:** Run → FAIL. **Step 3:** Wire BeatJump buttons + keyboard to the `beatJump` action; delete `handleSkipBack`/`handleSkipForward` and their buttons from DeckControls. **Step 4:** Run → PASS; full suite → PASS. **Step 5:** lint+build; commit `feat: unify beat-jump (buttons==keyboard, grid-snapped); remove fixed ±15s`.

**Phase 5 gate (final):** `npm run lint` (0 warnings), `npm run build`, `npm run test` (all green), `npm run test --prefix server` (regression). Manual smoke: beat-jump lands exactly on the grid from buttons and keyboard; everything stays beat-aligned.

---

## Self-Review Notes

- **Spec coverage:** beat grid → 1.1–1.3, 1.6; clock-driven position + no double-seek → 1.4–1.5; sample-accurate loops → 2.1–2.4; CDJ transport (full table + cuePoint + preview + unset hot-cue) → 3.1–3.4; SYNC exact+phase + continuous pitch → 4.1–4.3; grid-snapped beat-jump + buttons==keyboard + ±15s removed → 5.1–5.2; YouTube degradation → optional `setLoop`/`clearLoop` (YT omits → poll wrap retained in 2.3/2.4), discrete pitch retained in PitchSlider (4.3) and the YT pitch hook.
- **Type consistency:** `BeatGrid {bpm,anchor}`, `setLoop/clearLoop/isLooping`, `transition`/`TransportIntent`, `exactSyncRate`/`phaseDelta`, `gridJumpTarget`, store actions `setGrid/nudgeGrid/setCuePoint/dispatchTransport/syncToDeck/beatJump` used consistently across tasks.
- **Re-render safety:** `usePlayhead` reads the clock into a ref (no per-frame Zustand writes); Profiler test (1.5) locks it. `setPitchRate` relaxed to `number` (MP3 continuous); discrete snapping stays in the YouTube hook.
- **Known follow-ups (out of scope):** continuous phase-lock SYNC (one-shot only here); auto downbeat detection (manual tap only); the suffix/malformed HTTP-range edge cases from the prior hardening branch remain deferred.
