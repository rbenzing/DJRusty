# Jog Wheel + Scratch Audio (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the currently decorative `VinylPlatter` into an interactive jog wheel with two modes — real scratch audio (VINYL on, via a custom `AudioWorkletProcessor`) and temporary pitch-bend (VINYL off) — matching real DJ controller behavior.

**Architecture:** A pure-math module (`scratchMath.ts`) shared between a React `JogWheel` component and a new `AudioWorkletProcessor` (`scratchProcessor.ts`) that holds a copy of the track's PCM data and advances a fractional read-position by a signed, jog-driven rate each sample (no native negative `playbackRate` — verified unreliable across browsers). `AudioEngineImpl` gains `beginScratch`/`updateScratchRate`/`endScratch`/`setBendMultiplier`/`primeScratch`; `deckStore` gains `vinylMode`/`scratching` state and slip-aware begin/end actions mirroring the existing `startRoll`/`endRoll`/`deactivateLoop` pattern.

**Tech Stack:** TypeScript (strict), React 18, Zustand, Web Audio API (`AudioWorkletNode`, custom `AudioParam`), Vite (`new URL(..., import.meta.url)` worklet-module loading, mirroring the existing `bpmDetector.worker` pattern), Vitest + jsdom (with a new `PointerEvent` polyfill), Pointer Events API.

## Global Constraints

- `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are both on (`tsconfig.app.json`) — indexed access is `T | undefined`; optional props cannot be explicitly assigned `undefined` (use conditional prop-spreading instead: `{...(x !== null ? { prop: x } : {})}`).
- Zero-warnings lint policy (`npm run lint` → `eslint . --max-warnings 0`).
- `src/test/**` is excluded from `tsconfig.app.json`'s `include` (`"exclude": ["src/test"]`) and is not full-type-checked by `tsc -b` — Vitest transforms it via esbuild (type-erasure only). Test-file object literals do not need to satisfy every interface field exactly, but should still be as complete/accurate as reasonably possible (existing convention).
- Every new small button (the VINYL toggle) must be a compact, fixed-width, clearly button-shaped control (~52px, matching `DeckModifiers.module.css`'s `.modBtn`) — never a full-width bar. This was an explicit, repeatedly-enforced requirement in every prior phase of this project.
- Per project CLAUDE.md: run `npm run build` (`tsc -b && vite build`) and `npm run lint` (zero warnings) after implementation.
- Single Web Audio backend rule: any new deck command a component issues must go through the `DeckPlayer` interface (`src/services/playerRegistry.ts`), looked up via `getActivePlayer(deckId)` — never store an engine/audio-node reference in Zustand.
- Negative `AudioBufferSourceNode.playbackRate` is not implemented reliably in any current browser (Firefox bug 1308438, WebKit bug 69725 both unresolved) — reverse/variable-speed scratch playback must use manual sample-index stepping inside `scratchProcessor.ts`, never rely on native negative rate.
- Scratch never touches `transportState`/`playbackState` (`src/utils/transport.ts`'s state machine is driven only by `PLAY`/`CUE_PRESS`/`CUE_RELEASE` events and has no scratch-shaped transition).

---

### Task 1: `scratchMath.ts` — pure jog-wheel math

**Files:**
- Create: `src/utils/scratchMath.ts`
- Test: `src/test/scratchMath.test.ts`

**Interfaces:**
- Produces: `SECONDS_PER_ROTATION` (number constant), `angleDeg(centerX, centerY, pointerX, pointerY): number`, `shortestAngleDelta(fromDeg, toDeg): number`, `rotationDeltaToSeconds(deltaDeg): number`, `rateFromMovement(deltaSeconds, deltaMs): number`, `interpolateSample(data: Float32Array, position: number): number` — all consumed by Task 2 (`scratchProcessor.ts`) and Task 5 (`JogWheel.tsx`).

- [ ] **Step 1: Write the failing tests**

Create `src/test/scratchMath.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  SECONDS_PER_ROTATION,
  angleDeg,
  shortestAngleDelta,
  rotationDeltaToSeconds,
  rateFromMovement,
  interpolateSample,
} from '../utils/scratchMath';

describe('scratchMath', () => {
  describe('angleDeg', () => {
    it('returns 0 for a point directly to the right of center', () => {
      expect(angleDeg(0, 0, 100, 0)).toBeCloseTo(0, 5);
    });

    it('returns 90 for a point directly below center (screen y increases downward)', () => {
      expect(angleDeg(0, 0, 0, 100)).toBeCloseTo(90, 5);
    });

    it('returns -90 for a point directly above center', () => {
      expect(angleDeg(0, 0, 0, -100)).toBeCloseTo(-90, 5);
    });

    it('returns 180 (or -180) for a point directly to the left of center', () => {
      const result = angleDeg(0, 0, -100, 0);
      expect(Math.abs(result)).toBeCloseTo(180, 5);
    });
  });

  describe('shortestAngleDelta', () => {
    it('computes a simple positive delta with no wraparound', () => {
      expect(shortestAngleDelta(10, 50)).toBeCloseTo(40, 5);
    });

    it('computes a simple negative delta with no wraparound', () => {
      expect(shortestAngleDelta(50, 10)).toBeCloseTo(-40, 5);
    });

    it('takes the short way across the +180/-180 seam (forward)', () => {
      // 170 -> -170 is a 20-degree forward step across the seam, not -340.
      expect(shortestAngleDelta(170, -170)).toBeCloseTo(20, 5);
    });

    it('takes the short way across the +180/-180 seam (backward)', () => {
      // 10 -> 350 (equivalently -10) is a 20-degree backward step, not +340.
      expect(shortestAngleDelta(10, 350)).toBeCloseTo(-20, 5);
    });

    it('returns 0 for identical angles', () => {
      expect(shortestAngleDelta(45, 45)).toBeCloseTo(0, 5);
    });
  });

  describe('rotationDeltaToSeconds', () => {
    it('converts a full rotation to SECONDS_PER_ROTATION', () => {
      expect(rotationDeltaToSeconds(360)).toBeCloseTo(SECONDS_PER_ROTATION, 5);
    });

    it('converts a half rotation to half of SECONDS_PER_ROTATION', () => {
      expect(rotationDeltaToSeconds(180)).toBeCloseTo(SECONDS_PER_ROTATION / 2, 5);
    });

    it('preserves sign for a reverse (negative) rotation', () => {
      expect(rotationDeltaToSeconds(-90)).toBeCloseTo(-SECONDS_PER_ROTATION / 4, 5);
    });
  });

  describe('rateFromMovement', () => {
    it('returns 1.0 for a movement matching real time (normal speed)', () => {
      expect(rateFromMovement(0.1, 100)).toBeCloseTo(1.0, 5);
    });

    it('returns 2.0 for a movement twice as fast as real time', () => {
      expect(rateFromMovement(0.2, 100)).toBeCloseTo(2.0, 5);
    });

    it('preserves sign for a reverse movement', () => {
      expect(rateFromMovement(-0.1, 100)).toBeCloseTo(-1.0, 5);
    });

    it('returns 0 for a non-positive elapsed time (guards div-by-zero)', () => {
      expect(rateFromMovement(0.1, 0)).toBe(0);
      expect(rateFromMovement(0.1, -5)).toBe(0);
    });
  });

  describe('interpolateSample', () => {
    it('returns the exact sample at an integer position', () => {
      const data = new Float32Array([0, 1, 2, 3]);
      expect(interpolateSample(data, 2)).toBeCloseTo(2, 5);
    });

    it('linearly interpolates at a fractional position', () => {
      const data = new Float32Array([0, 1, 2, 3]);
      expect(interpolateSample(data, 0.5)).toBeCloseTo(0.5, 5);
      expect(interpolateSample(data, 2.25)).toBeCloseTo(2.25, 5);
    });

    it('clamps a negative position to the first sample', () => {
      const data = new Float32Array([5, 1, 2, 3]);
      expect(interpolateSample(data, -10)).toBeCloseTo(5, 5);
    });

    it('clamps a position beyond the array to the last sample', () => {
      const data = new Float32Array([0, 1, 2, 3]);
      expect(interpolateSample(data, 999)).toBeCloseTo(3, 5);
    });

    it('returns 0 for an empty array', () => {
      expect(interpolateSample(new Float32Array(0), 0)).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/test/scratchMath.test.ts`
Expected: FAIL — `Cannot find module '../utils/scratchMath'`

- [ ] **Step 3: Implement scratchMath.ts**

Create `src/utils/scratchMath.ts`:

```ts
/**
 * scratchMath.ts — pure math for jog-wheel scratch/bend interaction.
 *
 * No DOM or AudioWorkletGlobalScope APIs — importable both by React
 * components (JogWheel.tsx) and by the AudioWorkletProcessor module
 * (scratchProcessor.ts), which runs in an isolated global scope that cannot
 * import anything DOM-dependent.
 */

/** Seconds of track-time per full platter rotation — matches VinylPlatter's existing CSS spin-duration constant (`1.8 / pitchRate` seconds per rotation at rate 1.0). */
export const SECONDS_PER_ROTATION = 1.8;

/**
 * Angle (degrees, -180..180) from a center point to a pointer position.
 * Standard atan2 convention: 0deg points along +X; since screen Y increases
 * downward, positive angles sweep clockwise (toward +Y / "down").
 */
export function angleDeg(centerX: number, centerY: number, pointerX: number, pointerY: number): number {
  return Math.atan2(pointerY - centerY, pointerX - centerX) * (180 / Math.PI);
}

/**
 * Shortest signed delta (degrees) from one angle to another, correctly
 * handling the +180/-180 wraparound (e.g. 170 -> -170 is +20, not -340).
 */
export function shortestAngleDelta(fromDeg: number, toDeg: number): number {
  let delta = (toDeg - fromDeg) % 360;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return delta;
}

/** Converts a rotation delta (degrees) to a track-time delta (seconds) via SECONDS_PER_ROTATION. */
export function rotationDeltaToSeconds(deltaDeg: number): number {
  return (deltaDeg / 360) * SECONDS_PER_ROTATION;
}

/**
 * Instantaneous scratch rate (seconds of track-time per second of real time)
 * from a track-time delta and the wall-clock time (ms) it took. Returns 0
 * for a non-positive elapsed time (guards div-by-zero on duplicate/out-of-order events).
 */
export function rateFromMovement(deltaSeconds: number, deltaMs: number): number {
  if (deltaMs <= 0) return 0;
  return deltaSeconds / (deltaMs / 1000);
}

/**
 * Linearly-interpolated sample at a fractional index, clamped to the array's
 * bounds. Used by the scratch worklet to read between two integer sample
 * positions as its read-position advances by a fractional rate each sample.
 */
export function interpolateSample(data: Float32Array, position: number): number {
  const length = data.length;
  if (length === 0) return 0;
  const clamped = Math.max(0, Math.min(position, length - 1));
  const index = Math.floor(clamped);
  const frac = clamped - index;
  const a = data[index] ?? 0;
  const b = data[Math.min(index + 1, length - 1)] ?? a;
  return a + (b - a) * frac;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/test/scratchMath.test.ts`
Expected: PASS (23 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/scratchMath.ts src/test/scratchMath.test.ts
git commit -m "feat: add scratchMath — pure jog-wheel angle/rate/interpolation math"
```

---

### Task 2: `scratchProcessor.ts` — the AudioWorkletProcessor

**Files:**
- Create: `src/services/scratchProcessor.ts`

**Interfaces:**
- Consumes: `interpolateSample` from `src/utils/scratchMath.ts` (Task 1).
- Produces: a processor registered under the name `'scratch-processor'`, loaded via `audioContext.audioWorklet.addModule(new URL('./scratchProcessor.ts', import.meta.url))` (consumed by Task 3's `AudioEngineImpl`). Message protocol (consumed by Task 3):
  - Inbound: `{ type: 'load', channels: Float32Array[] }`, `{ type: 'setPosition', position: number }` (seconds), `{ type: 'setLoopBounds', start: number | null, end: number | null }` (seconds).
  - Outbound (throttled, ~every 64 render quanta): `{ type: 'position', position: number }` (seconds).
  - Custom `AudioParam` named `readRate` (a-rate, signed, default 0, range -8..8) — automated by Task 3 via `node.parameters.get('readRate')`.

This file cannot be unit-tested directly in jsdom (no `AudioWorkletGlobalScope`) — its DSP logic delegates to the already-tested `interpolateSample`. Correctness of the wiring is verified in Task 3 (mocked `AudioWorkletNode`) and Task 7's Playwright smoke test (real browser).

- [ ] **Step 1: Implement scratchProcessor.ts**

Create `src/services/scratchProcessor.ts`:

```ts
/**
 * scratchProcessor.ts — AudioWorkletProcessor for real scratch audio.
 *
 * Loaded once via audioContext.audioWorklet.addModule(...) (see
 * audioEngine.ts's ensureScratchWorkletLoaded). Each deck creates its own
 * AudioWorkletNode instance from this registered processor. Holds a copy of
 * the track's channel data (sent once via postMessage when the track loads)
 * and advances a fractional read position by the signed `readRate` AudioParam
 * each sample — this is what makes both reverse playback and arbitrary
 * scratch speeds possible without relying on unsupported negative native
 * playbackRate (see docs/superpowers/specs/2026-07-04-jogwheel-scratch-phase3-design.md).
 */
import { interpolateSample } from '../utils/scratchMath';

// ~64 render quanta (128 samples each) ≈ 186ms at 44.1kHz — throttles how
// often the live read-position is reported back to the main thread.
const POSITION_REPORT_INTERVAL = 64;

interface LoadMessage { type: 'load'; channels: Float32Array[]; }
interface SetPositionMessage { type: 'setPosition'; position: number; }
interface SetLoopBoundsMessage { type: 'setLoopBounds'; start: number | null; end: number | null; }
type InboundMessage = LoadMessage | SetPositionMessage | SetLoopBoundsMessage;

class ScratchProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'readRate', defaultValue: 0, minValue: -8, maxValue: 8, automationRate: 'a-rate' as const },
    ];
  }

  private channels: Float32Array[] = [];
  private positionSamples = 0;
  private loopStartSamples: number | null = null;
  private loopEndSamples: number | null = null;
  private reportCounter = 0;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<InboundMessage>) => {
      const msg = event.data;
      if (msg.type === 'load') {
        this.channels = msg.channels;
        this.positionSamples = 0;
      } else if (msg.type === 'setPosition') {
        this.positionSamples = msg.position * sampleRate;
      } else if (msg.type === 'setLoopBounds') {
        this.loopStartSamples = msg.start === null ? null : msg.start * sampleRate;
        this.loopEndSamples = msg.end === null ? null : msg.end * sampleRate;
      }
    };
  }

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const output = outputs[0];
    if (!output || output.length === 0 || this.channels.length === 0) return true;

    const readRate = parameters.readRate;
    const frameCount = output[0]?.length ?? 0;

    for (let i = 0; i < frameCount; i++) {
      const rate = readRate && readRate.length > 1 ? (readRate[i] ?? 0) : (readRate?.[0] ?? 0);

      for (let ch = 0; ch < output.length; ch++) {
        const data = this.channels[ch % this.channels.length];
        const outChannel = output[ch];
        if (data && outChannel) outChannel[i] = interpolateSample(data, this.positionSamples);
      }

      this.positionSamples += rate;
      const maxSample = (this.channels[0]?.length ?? 1) - 1;
      if (this.loopStartSamples !== null && this.loopEndSamples !== null) {
        this.positionSamples = Math.max(this.loopStartSamples, Math.min(this.positionSamples, this.loopEndSamples));
      } else {
        this.positionSamples = Math.max(0, Math.min(this.positionSamples, maxSample));
      }
    }

    this.reportCounter++;
    if (this.reportCounter >= POSITION_REPORT_INTERVAL) {
      this.reportCounter = 0;
      this.port.postMessage({ type: 'position', position: this.positionSamples / sampleRate });
    }

    return true;
  }
}

registerProcessor('scratch-processor', ScratchProcessor);
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc -b --noEmit 2>&1 | head -n 40` (or `npm run build`, which runs `tsc -b` first)
Expected: no errors referencing `scratchProcessor.ts`. `AudioWorkletProcessor`, `registerProcessor`, and the ambient `sampleRate` global are declared in TypeScript's `lib.dom.d.ts`, already included via `tsconfig.app.json`'s `"lib": ["ES2020", "DOM", "DOM.Iterable"]` — no tsconfig changes are needed.

- [ ] **Step 3: Commit**

```bash
git add src/services/scratchProcessor.ts
git commit -m "feat: add scratchProcessor AudioWorkletProcessor for real buffer scrubbing"
```

---

### Task 3: `AudioEngineImpl` + `DeckPlayer` — scratch & bend engine methods

**Files:**
- Modify: `src/services/audioEngine.ts`
- Modify: `src/services/playerRegistry.ts`
- Test: `src/test/audioEngine.test.ts`

**Interfaces:**
- Consumes: the `'scratch-processor'` registered by Task 2, loaded via `new URL('./scratchProcessor.ts', import.meta.url)`.
- Produces (added to `AudioEngine`, required; added to `DeckPlayer`, optional — mirrors the existing `setLoop`/`clearLoop`/`isLooping` required-vs-optional split):
  - `primeScratch(buffer: AudioBuffer): void` — **not** added to `DeckPlayer` (only ever called via the concretely-typed `AudioEngineImpl` ref in `useAudioEngine.ts`, Task 6).
  - `beginScratch(): void`
  - `updateScratchRate(rate: number): void`
  - `endScratch(resumeAt?: number): void`
  - `setBendMultiplier(multiplier: number): void`
- Consumed by: Task 4's `deckStore.ts` actions (via `getActivePlayer(deckId)?.beginScratch?.()` etc.) and Task 5's `JogWheel.tsx` (via `getActivePlayer(deckId)?.updateScratchRate?.()` / `setBendMultiplier?.()` directly, and Task 6's `useAudioEngine.ts` (via the concrete engine ref, for `primeScratch`).

- [ ] **Step 1: Write the failing tests**

Add to `src/test/audioEngine.test.ts`. First, update the existing import at the top of the file to also bring in the test-only cache-reset helper added in Step 4 below:

```ts
import { AudioEngineImpl, __resetScratchWorkletCacheForTests } from '../services/audioEngine';
```

Next, extend `mockContext` (near the top of the file, after `sampleRate: 44100,`) to add an `audioWorklet` field:

```ts
const mockContext = {
  createGain: vi.fn(),
  createBiquadFilter: vi.fn(),
  createAnalyser: vi.fn(),
  createBufferSource: vi.fn(),
  createDelay: vi.fn(),
  createConvolver: vi.fn(),
  currentTime: 0,
  state: 'running',
  destination: {},
  sampleRate: 44100,
  audioWorklet: { addModule: vi.fn().mockResolvedValue(undefined) },
};
```

Then add a mock `AudioWorkletNode` global and helper, after the existing `mockSourceNode` declaration:

```ts
interface MockAudioParam { value: number; setValueAtTime: ReturnType<typeof vi.fn>; linearRampToValueAtTime: ReturnType<typeof vi.fn>; }

class MockAudioWorkletNode {
  port = {
    postMessage: vi.fn(),
    onmessage: null as ((e: MessageEvent) => void) | null,
  };
  connect = vi.fn();
  disconnect = vi.fn();
  private params = new Map<string, MockAudioParam>([
    ['readRate', { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }],
  ]);
  parameters = { get: (name: string) => this.params.get(name) };
  constructor(_context: unknown, _name: string, _options?: unknown) {}
}

/** The most recently constructed MockAudioWorkletNode, for assertions. */
let lastScratchNode: MockAudioWorkletNode | undefined;

vi.stubGlobal('AudioWorkletNode', class extends MockAudioWorkletNode {
  constructor(context: unknown, name: string, options?: unknown) {
    super(context, name, options);
    lastScratchNode = this;
  }
});
```

Now add a new `describe('scratch & bend', ...)` block at the end of the file, right before the final closing of the `describe('AudioEngine', ...)` block (i.e., as a sibling of the existing `describe('effects', ...)` block):

```ts
  describe('scratch & bend', () => {
    const mockBuffer = {
      duration: 120,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(1000),
    } as unknown as AudioBuffer;

    beforeEach(() => {
      lastScratchNode = undefined;
      // The real ensureScratchWorkletLoaded caches its promise at module scope
      // (correct in production — addModule must only run once per shared
      // AudioContext) but that means it must be explicitly reset between
      // otherwise-isolated test cases, since vi.clearAllMocks() only clears
      // mock call history, not this module's own singleton state.
      __resetScratchWorkletCacheForTests();
      engine.loadBuffer(mockBuffer);
    });

    it('primeScratch loads the worklet module and creates a scratch node', async () => {
      engine.primeScratch(mockBuffer);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockContext.audioWorklet.addModule).toHaveBeenCalledTimes(1);
      expect(lastScratchNode).toBeDefined();
    });

    it('primeScratch copies channel data via postMessage without a transfer list (no detach)', async () => {
      engine.primeScratch(mockBuffer);
      await Promise.resolve();
      await Promise.resolve();

      const loadCall = lastScratchNode?.port.postMessage.mock.calls.find(
        (call) => (call[0] as { type: string }).type === 'load',
      );
      expect(loadCall).toBeDefined();
      expect(loadCall?.length).toBe(1); // no second (transfer list) argument
    });

    it('beginScratch is a no-op if the worklet has not been primed yet', () => {
      engine.beginScratch();
      expect(lastScratchNode).toBeUndefined();
    });

    it('beginScratch connects the scratch node and stops the current source', async () => {
      await engine.play();
      engine.primeScratch(mockBuffer);
      await Promise.resolve();
      await Promise.resolve();

      engine.beginScratch();

      expect(mockSourceNode.stop).toHaveBeenCalled();
      expect(lastScratchNode?.connect).toHaveBeenCalledWith(mockTrimGain);
    });

    it('updateScratchRate automates the readRate param via a short ramp', async () => {
      engine.primeScratch(mockBuffer);
      await Promise.resolve();
      await Promise.resolve();
      engine.beginScratch();

      engine.updateScratchRate(2.5);

      const param = lastScratchNode?.parameters.get('readRate');
      expect(param?.linearRampToValueAtTime).toHaveBeenCalledWith(2.5, expect.any(Number));
    });

    it('updateScratchRate is a no-op when not currently scratching', () => {
      engine.updateScratchRate(2.5);
      // No scratch node exists at all — must not throw, and there is nothing to assert on.
      expect(lastScratchNode).toBeUndefined();
    });

    it('beginScratch seeds the worklet with the live elapsed position, not a stale offset', async () => {
      await engine.play();
      mockContext.currentTime = 5; // 5 real seconds have elapsed since play() started

      engine.primeScratch(mockBuffer);
      await Promise.resolve();
      await Promise.resolve();
      engine.beginScratch();

      const setPositionCall = lastScratchNode?.port.postMessage.mock.calls.find(
        (call) => (call[0] as { type: string }).type === 'setPosition',
      );
      expect(setPositionCall?.[0]).toEqual({ type: 'setPosition', position: 5 });
    });

    it('endScratch disconnects the worklet and resumes playing at the reported position if it was playing before', async () => {
      await engine.play();
      engine.primeScratch(mockBuffer);
      await Promise.resolve();
      await Promise.resolve();
      engine.beginScratch();

      // Simulate the worklet reporting a live position back.
      lastScratchNode?.port.onmessage?.({ data: { type: 'position', position: 42 } } as MessageEvent);

      engine.endScratch();

      expect(lastScratchNode?.disconnect).toHaveBeenCalled();
      expect(mockSourceNode.start).toHaveBeenCalledWith(0, 42);
      expect(engine.isPlaying()).toBe(true);
    });

    it('endScratch stays paused at the reported position if it was paused before', async () => {
      // Never called play() — engine starts paused.
      engine.primeScratch(mockBuffer);
      await Promise.resolve();
      await Promise.resolve();
      engine.beginScratch();

      lastScratchNode?.port.onmessage?.({ data: { type: 'position', position: 17 } } as MessageEvent);

      engine.endScratch();

      expect(engine.isPlaying()).toBe(false);
      expect(engine.getCurrentTime()).toBeCloseTo(17, 5);
    });

    it('endScratch resumes at an explicit resumeAt position when given (SLIP-aware resume)', async () => {
      await engine.play();
      engine.primeScratch(mockBuffer);
      await Promise.resolve();
      await Promise.resolve();
      engine.beginScratch();

      engine.endScratch(99);

      expect(mockSourceNode.start).toHaveBeenCalledWith(0, 99);
    });

    it('getCurrentTime returns the worklet-reported position while scratching', async () => {
      engine.primeScratch(mockBuffer);
      await Promise.resolve();
      await Promise.resolve();
      engine.beginScratch();

      lastScratchNode?.port.onmessage?.({ data: { type: 'position', position: 55 } } as MessageEvent);

      expect(engine.getCurrentTime()).toBeCloseTo(55, 5);
    });

    it('setBendMultiplier scales playbackRate on top of the stored pitch rate', async () => {
      await engine.play();

      engine.setBendMultiplier(1.05);
      expect(mockSourceNode.playbackRate.value).toBeCloseTo(1.05, 5);

      engine.setPlaybackRate(2.0);
      expect(mockSourceNode.playbackRate.value).toBeCloseTo(2.1, 5); // 2.0 * 1.05

      engine.setBendMultiplier(1.0);
      engine.setPlaybackRate(1.0);
      expect(mockSourceNode.playbackRate.value).toBeCloseTo(1.0, 5);
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/test/audioEngine.test.ts`
Expected: FAIL — `engine.primeScratch is not a function` (and similar for the other new methods)

- [ ] **Step 3: Add the new methods to the `AudioEngine` interface**

In `src/services/audioEngine.ts`, insert after the existing `isLooping(): boolean;` line (currently line 72) and before `/** Register a callback for when playback naturally ends. */`:

```ts
  /** Prime the scratch worklet with a copy of this buffer's channel data. Fire-and-forget; safe to call again (e.g. on every loadBuffer) to re-prime for a new track. */
  primeScratch(buffer: AudioBuffer): void;

  /** Begin a scratch gesture: swap the normal source for the scratch worklet. No-op if the worklet hasn't finished priming yet or no buffer is loaded. */
  beginScratch(): void;

  /** Update the signed read-rate (seconds of track-time per second of real time) driving an in-progress scratch. No-op if not currently scratching. */
  updateScratchRate(rate: number): void;

  /** End a scratch gesture. Resumes at resumeAt if given (e.g. a SLIP shadow position), else at the worklet's last-reported position. Resumes playing if the deck was playing when the scratch began; otherwise stays paused. No-op if not currently scratching. */
  endScratch(resumeAt?: number): void;

  /** Temporarily scale playback rate by a multiplier on top of the deck's stored rate (VINYL-off pitch bend). Pass 1.0 to release. Does not touch the stored rate. */
  setBendMultiplier(multiplier: number): void;
```

- [ ] **Step 4: Add new private fields and the worklet-loading singleton**

In `src/services/audioEngine.ts`, add after the existing `private loopEnd: number | null = null;` (currently line 117):

```ts
  // Scratch/bend state
  private scratchNode: AudioWorkletNode | null = null;
  private scratchWorkletReady = false;
  private scratching = false;
  private wasPlayingBeforeScratch = false;
  private lastScratchPosition = 0;
  private bendMultiplier = 1.0;
```

Add a module-level worklet-loading singleton just before the `export class AudioEngineImpl` line — the module registers its processor once per (shared) `AudioContext`, so a second `addModule` call for the same context must reuse the same promise rather than re-registering:

```ts
// Loads the scratch-processor module exactly once per (shared) AudioContext —
// registerProcessor() throws if called twice in the same worklet global scope,
// and both deck engines share one AudioContext singleton.
let scratchWorkletModulePromise: Promise<void> | null = null;
function ensureScratchWorkletLoaded(context: AudioContext): Promise<void> {
  if (!scratchWorkletModulePromise) {
    scratchWorkletModulePromise = context.audioWorklet
      .addModule(new URL('./scratchProcessor.ts', import.meta.url))
      .catch((err: unknown) => {
        scratchWorkletModulePromise = null; // allow a retry on the next primeScratch call
        throw err;
      });
  }
  return scratchWorkletModulePromise;
}

/**
 * Test-only: resets the module-level worklet-loading cache between test
 * cases (each test constructs a fresh mocked AudioContext and expects
 * addModule to be re-invoked). Never called by production code.
 */
export function __resetScratchWorkletCacheForTests(): void {
  scratchWorkletModulePromise = null;
}
```

- [ ] **Step 5: Add an `effectiveRate()` helper and wire bendMultiplier into the existing rate call sites**

In `src/services/audioEngine.ts`, add a small private helper method (anywhere inside the class, e.g. just above `getCurrentTime()`):

```ts
  /** The actual audible rate: the stored playbackRate composed with any active bend multiplier. */
  private effectiveRate(): number {
    return this.playbackRate * this.bendMultiplier;
  }
```

Update three existing call sites to use it instead of the bare `this.playbackRate`:

In `play()` (currently line 199), change:
```ts
    this.sourceNode.playbackRate.value = this.playbackRate;
```
to:
```ts
    this.sourceNode.playbackRate.value = this.effectiveRate();
```

In `getCurrentTime()` (currently lines 261-264), change:
```ts
  getCurrentTime(): number {
    const base = this.isPlayingFlag
      ? this.seekOffset + (this.context.currentTime - this.startedAt) * this.playbackRate
      : this.seekOffset;
```
to:
```ts
  getCurrentTime(): number {
    if (this.scratching) return this.lastScratchPosition;

    const base = this.isPlayingFlag
      ? this.seekOffset + (this.context.currentTime - this.startedAt) * this.effectiveRate()
      : this.seekOffset;
```

In `setLoop()` (currently line 286), change:
```ts
      const rawPos = this.seekOffset + (this.context.currentTime - this.startedAt) * this.playbackRate;
```
to:
```ts
      const rawPos = this.seekOffset + (this.context.currentTime - this.startedAt) * this.effectiveRate();
```

In `setPlaybackRate()` (currently lines 307-312), change:
```ts
  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    if (this.sourceNode) {
      this.sourceNode.playbackRate.value = rate;
    }
  }
```
to:
```ts
  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    if (this.sourceNode) {
      this.sourceNode.playbackRate.value = this.effectiveRate();
    }
  }
```

- [ ] **Step 6: Implement `primeScratch`, `beginScratch`, `updateScratchRate`, `endScratch`, `setBendMultiplier`**

Add these methods to `AudioEngineImpl` in `src/services/audioEngine.ts`, e.g. just before the existing `getAnalyser(): AnalyserNode {` method:

```ts
  primeScratch(buffer: AudioBuffer): void {
    void ensureScratchWorkletLoaded(this.context)
      .then(() => {
        if (!this.scratchNode) {
          this.scratchNode = new AudioWorkletNode(this.context, 'scratch-processor', {
            numberOfInputs: 0,
            numberOfOutputs: 1,
            outputChannelCount: [buffer.numberOfChannels],
          });
          this.scratchNode.port.onmessage = (e: MessageEvent<{ type: string; position: number }>) => {
            if (e.data.type === 'position') this.lastScratchPosition = e.data.position;
          };
        }
        const channels: Float32Array[] = [];
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
          channels.push(buffer.getChannelData(ch));
        }
        // No transfer list — this must be a copy, not a transfer, or the
        // original AudioBuffer's channel data would be detached and unusable
        // for normal playback.
        this.scratchNode.port.postMessage({ type: 'load', channels });
        this.scratchWorkletReady = true;
      })
      .catch(() => {
        this.scratchWorkletReady = false;
      });
  }

  beginScratch(): void {
    if (!this.scratchWorkletReady || !this.scratchNode || !this.buffer) return;
    this.wasPlayingBeforeScratch = this.isPlayingFlag;
    // Read the live position BEFORE flipping isPlayingFlag — getCurrentTime()'s
    // analytic formula only integrates elapsed time while isPlayingFlag is
    // still true; reading it after would silently return the stale seekOffset.
    const startPosition = this.getCurrentTime();
    ++this.generation; // invalidate any pending onended from the source we're stopping
    this.isPlayingFlag = false;
    this.stopSource();
    this.lastScratchPosition = startPosition;

    this.scratchNode.port.postMessage({ type: 'setPosition', position: startPosition });
    this.scratchNode.port.postMessage({ type: 'setLoopBounds', start: this.loopStart, end: this.loopEnd });

    const readRateParam = this.scratchNode.parameters.get('readRate');
    readRateParam?.setValueAtTime(0, this.context.currentTime);

    this.scratchNode.connect(this.trimGain);
    this.scratching = true;
  }

  updateScratchRate(rate: number): void {
    if (!this.scratching || !this.scratchNode) return;
    const readRateParam = this.scratchNode.parameters.get('readRate');
    if (!readRateParam) return;
    readRateParam.linearRampToValueAtTime(rate, this.context.currentTime + 0.015);
  }

  endScratch(resumeAt?: number): void {
    if (!this.scratching || !this.scratchNode) return;
    this.scratching = false;

    const readRateParam = this.scratchNode.parameters.get('readRate');
    readRateParam?.setValueAtTime(0, this.context.currentTime);
    this.scratchNode.disconnect();

    const target = resumeAt !== undefined ? resumeAt : this.lastScratchPosition;
    const clamped = Math.max(0, Math.min(target, this.getDuration()));
    this.seekOffset = clamped;

    if (this.wasPlayingBeforeScratch) {
      void this.play(clamped).catch((err) => {
        console.error('[audioEngine] endScratch resume play() failed:', err);
      });
    }
  }

  setBendMultiplier(multiplier: number): void {
    this.bendMultiplier = multiplier;
    if (this.sourceNode) {
      this.sourceNode.playbackRate.value = this.effectiveRate();
    }
  }
```

- [ ] **Step 7: Disconnect the scratch node in `destroy()`**

In `src/services/audioEngine.ts`'s `destroy()` method (currently lines 449-461), add a scratch-node teardown right after `this.stopSource();`:

```ts
  destroy(): void {
    this.isPlayingFlag = false;
    this.stopSource();
    if (this.scratchNode) {
      try { this.scratchNode.disconnect(); } catch { /* already disconnected */ }
    }
    for (const node of this.effectNodes) {
      try { node.disconnect(); } catch { /* ok */ }
    }
    ...
```

- [ ] **Step 8: Add the optional methods to `DeckPlayer`**

In `src/services/playerRegistry.ts`, update the `DeckPlayer` interface:

```ts
export interface DeckPlayer {
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setLoop?(startSec: number, endSec: number): void;
  clearLoop?(): void;
  isLooping?(): boolean;
  beginScratch?(): void;
  updateScratchRate?(rate: number): void;
  endScratch?(resumeAt?: number): void;
  setBendMultiplier?(multiplier: number): void;
}
```

**Note on error handling (implements the design spec's "graceful degradation" requirement):** if `ensureScratchWorkletLoaded` rejects, `scratchWorkletReady` stays `false` and `beginScratch()` silently no-ops on every VINYL-mode drag until the next `primeScratch()` call (the next track load) gets a chance to retry — dragging the platter simply produces no scratch audio rather than throwing. This is a deliberate simplification of the design spec's "VINYL mode is force-disabled for that deck" wording: rather than threading a new "scratch available" flag from the engine back up through `deckStore` into the UI (so the VINYL button itself could show as forced-off), the failure is contained entirely to the audio layer. Given the failure trigger is an `addModule` rejection for a same-origin, bundled module (not a real flaky network fetch), this is expected to be effectively unreachable in practice — the plumbing cost of a fully-wired disabled state isn't justified for it.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run src/test/audioEngine.test.ts`
Expected: PASS (all tests, including the new `scratch & bend` describe block)

- [ ] **Step 10: Run the full test suite and build to check for regressions**

Run: `npm run test`
Expected: all test files pass (the existing `it('sets playback rate while playing', ...)` test at line ~329 still passes unchanged, since `bendMultiplier` defaults to `1.0` and `effectiveRate()` reduces to the old `playbackRate` value in every existing test).

Run: `npm run build`
Expected: no type errors.

- [ ] **Step 11: Commit**

```bash
git add src/services/audioEngine.ts src/services/playerRegistry.ts src/test/audioEngine.test.ts
git commit -m "feat: AudioEngineImpl scratch (AudioWorklet) & bend (rate multiplier) support"
```

---

### Task 4: `deckStore.ts` — `vinylMode` / `scratching` state and actions

**Files:**
- Modify: `src/types/deck.ts`
- Modify: `src/store/deckStore.ts`
- Test: `src/test/deck-vinylmode.test.ts` (new file, mirrors the existing `src/test/slip-mode.test.ts` style)

**Interfaces:**
- Consumes: `getActivePlayer(deckId)?.beginScratch?.()` / `endScratch?.(resumeAt?)` from Task 3.
- Produces: `DeckState.vinylMode: boolean`, `DeckState.scratching: boolean`; `setVinylMode(deckId, enabled)`, `beginScratch(deckId)`, `endScratch(deckId)` actions — consumed by Task 5's `JogWheel.tsx`.

- [ ] **Step 1: Add the new fields to `DeckState`**

In `src/types/deck.ts`, add after the existing `padMode` field (currently lines 150-155):

```ts
  /**
   * Active performance-pad mode. 'hotcue', 'loop', 'slicer', and (Phase 2c)
   * 'sampler' are all functional.
   */
  padMode: 'hotcue' | 'loop' | 'slicer' | 'sampler';

  /**
   * VINYL scratch mode for the jog wheel. true (default, matches real
   * hardware): dragging the platter stops the track and scratches it.
   * false: dragging only applies a temporary pitch bend, never stopping
   * the track. Persists across track loads (like padMode) — this is a
   * per-deck hardware-style setting, not track state.
   */
  vinylMode: boolean;

  /**
   * True while a jog-wheel scratch gesture is in progress. Reset to false
   * on loadTrack/clearTrack (unlike vinylMode, which persists).
   */
  scratching: boolean;
```

- [ ] **Step 2: Write the failing tests**

Create `src/test/deck-vinylmode.test.ts`:

```ts
/**
 * Unit tests for Phase 3: VINYL mode and scratch begin/end store actions.
 * Mirrors the existing style of src/test/slip-mode.test.ts.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';
import type { DeckPlayer } from '../services/playerRegistry';
import type { DeckState } from '../types/deck';

function makeDeckState(deckId: 'A' | 'B'): DeckState {
  return {
    deckId,
    trackId: null,
    title: '',
    artist: '',
    waveformPeaks: null,
    waveformColoredPeaks: null,
    filterSweep: 0,
    eqKillLow: false,
    eqKillMid: false,
    eqKillHigh: false,
    effectType: 'none',
    effectEnabled: false,
    effectWetDry: 0.5,
    effectBeat: 0.5,
    decoding: false,
    bpmDetecting: false,
    duration: 0,
    currentTime: 0,
    thumbnailUrl: null,
    playbackState: 'unstarted',
    pitchRate: 1,
    bpm: null,
    volume: 80,
    loopActive: false,
    loopStart: null,
    loopEnd: null,
    loopBeatCount: null,
    manualLoopIn: null,
    lastManualLoop: null,
    beatJumpSize: 4,
    playerReady: false,
    hotCues: {},
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    gainDb: 0,
    quantize: true,
    shift: false,
    padMode: 'hotcue',
    sliceWindowBeats: 8,
    vinylMode: true,
    scratching: false,
    error: null,
    synced: false,
    slipMode: false,
    slipPosition: null,
    slipStartTime: null,
    slipStartPosition: null,
    rollMode: false,
    rollStartWallClock: null,
    rollStartPosition: null,
    autoPlayOnLoad: false,
    anchor: null,
    gridConfirmed: false,
    cuePoint: null,
    transportState: 'CUED',
  };
}

/** Register a mock backend with spy-able beginScratch/endScratch. */
function registerMockBackend(deckId: 'A' | 'B') {
  const beginScratch = vi.fn();
  const endScratch = vi.fn();
  const player: DeckPlayer = {
    seekTo: vi.fn(),
    getCurrentTime: () => 0,
    getDuration: () => 300,
    beginScratch,
    endScratch,
  };
  playerRegistry.register(deckId, player);
  return { beginScratch, endScratch };
}

beforeEach(() => {
  useDeckStore.setState({
    decks: { A: makeDeckState('A'), B: makeDeckState('B') },
  });
  playerRegistry.unregister('A');
  playerRegistry.unregister('B');
  vi.restoreAllMocks();
});

describe('VINYL mode', () => {
  it('setVinylMode(false) disables vinyl mode', () => {
    act(() => { useDeckStore.getState().setVinylMode('A', false); });
    expect(useDeckStore.getState().decks['A'].vinylMode).toBe(false);
  });

  it('setVinylMode(true) enables vinyl mode', () => {
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], vinylMode: false } },
    });
    act(() => { useDeckStore.getState().setVinylMode('A', true); });
    expect(useDeckStore.getState().decks['A'].vinylMode).toBe(true);
  });

  it('setVinylMode(false) force-ends an in-progress scratch', () => {
    const { endScratch } = registerMockBackend('A');
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], vinylMode: true, scratching: true } },
    });

    act(() => { useDeckStore.getState().setVinylMode('A', false); });

    expect(endScratch).toHaveBeenCalled();
    expect(useDeckStore.getState().decks['A'].scratching).toBe(false);
  });
});

describe('beginScratch', () => {
  it('is a no-op when vinylMode is false', () => {
    const { beginScratch } = registerMockBackend('A');
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], trackId: 't1', vinylMode: false } },
    });

    act(() => { useDeckStore.getState().beginScratch('A'); });

    expect(beginScratch).not.toHaveBeenCalled();
    expect(useDeckStore.getState().decks['A'].scratching).toBe(false);
  });

  it('is a no-op when no track is loaded', () => {
    const { beginScratch } = registerMockBackend('A');
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], trackId: null, vinylMode: true } },
    });

    act(() => { useDeckStore.getState().beginScratch('A'); });

    expect(beginScratch).not.toHaveBeenCalled();
  });

  it('calls player.beginScratch and sets scratching true', () => {
    const { beginScratch } = registerMockBackend('A');
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], trackId: 't1', vinylMode: true } },
    });

    act(() => { useDeckStore.getState().beginScratch('A'); });

    expect(beginScratch).toHaveBeenCalledTimes(1);
    expect(useDeckStore.getState().decks['A'].scratching).toBe(true);
  });

  it('starts slip tracking when slipMode is on', () => {
    registerMockBackend('A');
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], trackId: 't1', vinylMode: true, slipMode: true, currentTime: 15 } },
    });

    act(() => { useDeckStore.getState().beginScratch('A'); });

    expect(useDeckStore.getState().decks['A'].slipStartPosition).toBe(15);
    expect(useDeckStore.getState().decks['A'].slipStartTime).not.toBeNull();
  });
});

describe('endScratch', () => {
  it('is a no-op when not currently scratching', () => {
    const { endScratch } = registerMockBackend('A');
    act(() => { useDeckStore.getState().endScratch('A'); });
    expect(endScratch).not.toHaveBeenCalled();
  });

  it('calls player.endScratch with undefined resumeAt when slipMode is off', () => {
    const { endScratch } = registerMockBackend('A');
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], scratching: true, slipMode: false } },
    });

    act(() => { useDeckStore.getState().endScratch('A'); });

    expect(endScratch).toHaveBeenCalledWith(undefined);
  });

  it('calls player.endScratch with the slip shadow position when slipMode is on and set', () => {
    const { endScratch } = registerMockBackend('A');
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], scratching: true, slipMode: true, slipPosition: 77 } },
    });

    act(() => { useDeckStore.getState().endScratch('A'); });

    expect(endScratch).toHaveBeenCalledWith(77);
  });

  it('clears scratching and slip tracking fields', () => {
    registerMockBackend('A');
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: { ...useDeckStore.getState().decks['A'], scratching: true, slipMode: true, slipPosition: 77, slipStartTime: 1000, slipStartPosition: 50 },
      },
    });

    act(() => { useDeckStore.getState().endScratch('A'); });

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.scratching).toBe(false);
    expect(deck.slipPosition).toBeNull();
    expect(deck.slipStartTime).toBeNull();
    expect(deck.slipStartPosition).toBeNull();
  });
});

describe('State reset', () => {
  it('loadTrack resets scratching but preserves vinylMode', () => {
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], vinylMode: false, scratching: true } },
    });

    act(() => {
      useDeckStore.getState().loadTrack('A', 'track-1', { title: 'T', artist: 'X', duration: 100, thumbnailUrl: null });
    });

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.scratching).toBe(false);
    expect(deck.vinylMode).toBe(false); // preserved, not reset
  });

  it('clearTrack resets scratching but preserves vinylMode', () => {
    useDeckStore.setState({
      decks: { ...useDeckStore.getState().decks, A: { ...useDeckStore.getState().decks['A'], vinylMode: false, scratching: true } },
    });

    act(() => { useDeckStore.getState().clearTrack('A'); });

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.scratching).toBe(false);
    expect(deck.vinylMode).toBe(false); // preserved, not reset
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/test/deck-vinylmode.test.ts`
Expected: FAIL — `useDeckStore.getState().setVinylMode is not a function` (and `vinylMode`/`scratching` missing from the state literal typed as `DeckState`, though this only surfaces as a runtime `undefined` in test assertions since `src/test/**` isn't type-checked)

- [ ] **Step 4: Add the fields to `createInitialDeckState` and the reset blocks**

In `src/store/deckStore.ts`, add to `createInitialDeckState` (currently around line 50-51, right after `sliceWindowBeats: DEFAULT_SLICE_WINDOW_BEATS,`):

```ts
    sliceWindowBeats: DEFAULT_SLICE_WINDOW_BEATS,
    vinylMode: true,
    scratching: false,
```

In `loadTrack`'s `updateDeck` call (currently the block starting at line 313), add `scratching: false,` — e.g. right after `autoPlayOnLoad: autoPlay,`:

```ts
      autoPlayOnLoad: autoPlay,
      scratching: false,
```

In `clearTrack`'s `updateDeck` call (currently the block starting at line 584), add `scratching: false,` — e.g. right after `autoPlayOnLoad: false,`:

```ts
      autoPlayOnLoad: false,
      scratching: false,
```

Do **not** add `vinylMode` to either reset block — it must persist across track loads, exactly like `padMode`.

- [ ] **Step 5: Add the action signatures to `DeckStoreActions`**

In `src/store/deckStore.ts`, add to the `DeckStoreActions` interface, e.g. right after the existing `setSliceWindowBeats` signature:

```ts
  /** Enable or disable VINYL scratch mode for the specified deck's jog wheel. Persists across track loads (like padMode); forces any in-progress scratch to end when disabled. */
  setVinylMode: (deckId: 'A' | 'B', enabled: boolean) => void;

  /** Begin a jog-wheel scratch gesture. No-op if VINYL mode is off or no track is loaded. Starts SLIP shadow tracking if slipMode is on. */
  beginScratch: (deckId: 'A' | 'B') => void;

  /** End a jog-wheel scratch gesture. Resumes from the SLIP shadow position if slipMode is on, else from the scratch's own exit position. No-op if not currently scratching. */
  endScratch: (deckId: 'A' | 'B') => void;
```

- [ ] **Step 6: Implement the three actions**

In `src/store/deckStore.ts`, add these implementations inside the `create<DeckStore>((set, get) => ({ ... }))` object, e.g. right after the existing `setSliceWindowBeats` implementation:

```ts
  setVinylMode: (deckId, enabled) => {
    if (!enabled && get().decks[deckId].scratching) {
      get().endScratch(deckId);
    }
    updateDeck(set, deckId, { vinylMode: enabled });
  },

  beginScratch: (deckId) => {
    const deck = get().decks[deckId];
    if (deck.trackId === null || !deck.vinylMode) return;
    getActivePlayer(deckId)?.beginScratch?.();
    updateDeck(set, deckId, { scratching: true });
    if (deck.slipMode) {
      get().startSlipTracking(deckId);
    }
  },

  endScratch: (deckId) => {
    const deck = get().decks[deckId];
    if (!deck.scratching) return;
    const resumeAt = deck.slipMode && deck.slipPosition !== null ? deck.slipPosition : undefined;
    getActivePlayer(deckId)?.endScratch?.(resumeAt);
    updateDeck(set, deckId, {
      scratching: false,
      slipPosition: null,
      slipStartTime: null,
      slipStartPosition: null,
    });
  },
```

- [ ] **Step 7: Add the new actions to `useDeckActions()`**

In `src/store/deckStore.ts`'s `useDeckActions()` function, add to the shallow-selected bag, e.g. right after `setGrid: s.setGrid, nudgeGrid: s.nudgeGrid,`:

```ts
      setGrid: s.setGrid, nudgeGrid: s.nudgeGrid,
      setVinylMode: s.setVinylMode, beginScratch: s.beginScratch, endScratch: s.endScratch,
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/test/deck-vinylmode.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 9: Run the full test suite**

Run: `npm run test`
Expected: all test files pass, including every other file that constructs a `DeckState` literal — check `npx vitest run` output for any file failing due to a missing `vinylMode`/`scratching` field. Since `src/test/**` is excluded from type-checking, a missing field in another test file's local `DeckState`-typed object will not fail to compile, and will only matter if that test's assertions actually read `vinylMode`/`scratching` (they don't, for any pre-existing test) — so no other test file needs updating.

- [ ] **Step 10: Commit**

```bash
git add src/types/deck.ts src/store/deckStore.ts src/test/deck-vinylmode.test.ts
git commit -m "feat: deckStore vinylMode/scratching state + slip-aware begin/endScratch actions"
```

---

### Task 5: `JogWheel.tsx` — interactive component

**Files:**
- Modify: `src/components/Deck/VinylPlatter.tsx`
- Modify: `src/test/setup.ts`
- Create: `src/components/Deck/JogWheel.tsx`
- Create: `src/components/Deck/JogWheel.module.css`
- Test: `src/test/JogWheel.test.tsx`

**Interfaces:**
- Consumes: `angleDeg`, `shortestAngleDelta`, `rotationDeltaToSeconds`, `rateFromMovement` from `src/utils/scratchMath.ts` (Task 1); `getActivePlayer(deckId)?.updateScratchRate?.()` / `setBendMultiplier?.()` (Task 3); `useDeckStore.getState().beginScratch/endScratch/setVinylMode` (Task 4).
- Produces: `<JogWheel deckId="A" />` — consumed by Task 6's `Deck.tsx`. `VinylPlatterProps` gains an optional `rotationOverrideDeg?: number`.

- [ ] **Step 1: Add a `PointerEvent` polyfill to the test setup**

jsdom does not implement the Pointer Events API (confirmed empirically: `typeof PointerEvent === 'undefined'` and `Element.prototype.setPointerCapture === undefined` under the project's installed jsdom 24.1.3). `JogWheel`'s drag tests need both. Add this to `src/test/setup.ts`, after the existing `DataTransfer` polyfill block (before the `window.YT` mock):

```ts
/**
 * PointerEvent polyfill for jsdom.
 *
 * jsdom does not implement the Pointer Events API (no PointerEvent
 * constructor, no setPointerCapture/releasePointerCapture on Element) —
 * needed for JogWheel's drag-to-scratch tests. This minimal polyfill is
 * sufficient for fireEvent.pointerDown/pointerMove/pointerUp tests; it does
 * not implement real pointer-capture semantics (the capture calls are just no-ops).
 */
if (typeof PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, params: MouseEventInit & { pointerId?: number } = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 0;
    }
  }
  (globalThis as unknown as Record<string, unknown>).PointerEvent = PointerEventPolyfill;
}

if (typeof Element !== 'undefined' && !Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = function (): void { /* no-op in jsdom */ };
  Element.prototype.releasePointerCapture = function (): void { /* no-op in jsdom */ };
  Element.prototype.hasPointerCapture = function (): boolean { return false; };
}
```

- [ ] **Step 2: Add `rotationOverrideDeg` to `VinylPlatter`**

In `src/components/Deck/VinylPlatter.tsx`, update the props interface and component:

```tsx
interface VinylPlatterProps {
  /** Whether the deck is currently playing. Controls spin animation. */
  isPlaying: boolean;
  /** Whether the deck is buffering. Shows a loading spinner overlay. */
  isBuffering: boolean;
  /** Current playback rate (pitch rate). Controls animation speed. */
  pitchRate: number;
  /** Track thumbnail URL, used as the vinyl center label image. */
  thumbnailUrl?: string | null;
  /**
   * When provided (during an active jog-wheel drag), overrides the CSS
   * keyframe spin with this exact rotation angle in degrees — locking visual
   * rotation to the live scratch/bend position. Omit to use the normal
   * playing/paused CSS animation.
   */
  rotationOverrideDeg?: number;
}

export function VinylPlatter({ isPlaying, isBuffering, pitchRate, thumbnailUrl, rotationOverrideDeg }: VinylPlatterProps) {
  const platterStyle = {
    '--platter-state': isPlaying ? 'running' : 'paused',
    '--platter-duration': `${(1.8 / pitchRate).toFixed(3)}s`,
    ...(rotationOverrideDeg !== undefined
      ? { animation: 'none', transform: `rotate(${rotationOverrideDeg}deg)` }
      : {}),
  } as React.CSSProperties;
```

(The rest of the component is unchanged.)

- [ ] **Step 3: Write the failing tests**

Create `src/test/JogWheel.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import { JogWheel } from '../components/Deck/JogWheel';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';
import type { DeckPlayer } from '../services/playerRegistry';

function registerMockPlayer(deckId: 'A' | 'B') {
  const updateScratchRate = vi.fn();
  const setBendMultiplier = vi.fn();
  const player: DeckPlayer = {
    seekTo: vi.fn(),
    getCurrentTime: () => 0,
    getDuration: () => 300,
    beginScratch: vi.fn(),
    endScratch: vi.fn(),
    updateScratchRate,
    setBendMultiplier,
  };
  playerRegistry.register(deckId, player);
  return { updateScratchRate, setBendMultiplier };
}

function loadTrackOnDeckA(): void {
  act(() => {
    useDeckStore.getState().loadTrack('A', 'track-1', { title: 'T', artist: 'X', duration: 100, thumbnailUrl: null });
  });
}

beforeEach(() => {
  playerRegistry.unregister('A');
  playerRegistry.unregister('B');
  vi.restoreAllMocks();
});

describe('JogWheel', () => {
  it('renders a VINYL toggle button reflecting vinylMode', () => {
    loadTrackOnDeckA();
    render(<JogWheel deckId="A" />);

    const btn = screen.getByRole('button', { name: /vinyl scratch mode for deck a/i });
    expect(btn).toHaveAttribute('aria-pressed', 'true'); // vinylMode defaults to true
  });

  it('clicking the VINYL button toggles vinylMode in the store', () => {
    loadTrackOnDeckA();
    render(<JogWheel deckId="A" />);

    fireEvent.click(screen.getByRole('button', { name: /vinyl scratch mode for deck a/i }));

    expect(useDeckStore.getState().decks['A'].vinylMode).toBe(false);
  });

  it('dragging in VINYL mode calls beginScratch on pointer down and updateScratchRate on move', () => {
    const { updateScratchRate } = registerMockPlayer('A');
    loadTrackOnDeckA();
    render(<JogWheel deckId="A" />);

    // JogWheel derives its rate from performance.now() deltas between pointer
    // events. Two real calls issued back-to-back in a synchronous test can
    // return the *same* millisecond, which would make rateFromMovement's
    // div-by-zero guard zero out the rate and flake this assertion. Mock it
    // to a deterministic, always-forward-advancing sequence instead.
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(100);

    const surface = screen.getByLabelText(/jog wheel for deck a/i);
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 0, clientY: 100, pointerId: 1 }); // 90deg clockwise step

    expect(useDeckStore.getState().decks['A'].scratching).toBe(true);
    expect(updateScratchRate).toHaveBeenCalled();
    // Clockwise motion is a positive angle delta -> a positive (forward) rate.
    expect(updateScratchRate.mock.calls[0]?.[0]).toBeGreaterThan(0);
  });

  it('releasing after a VINYL-mode drag calls endScratch', () => {
    registerMockPlayer('A');
    loadTrackOnDeckA();
    render(<JogWheel deckId="A" />);

    const surface = screen.getByLabelText(/jog wheel for deck a/i);
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 0, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: 0, clientY: 100, pointerId: 1 });

    expect(useDeckStore.getState().decks['A'].scratching).toBe(false);
  });

  it('dragging in bend mode (VINYL off) calls setBendMultiplier, never beginScratch/updateScratchRate', () => {
    const { updateScratchRate, setBendMultiplier } = registerMockPlayer('A');
    loadTrackOnDeckA();
    act(() => { useDeckStore.getState().setVinylMode('A', false); });
    render(<JogWheel deckId="A" />);

    const surface = screen.getByLabelText(/jog wheel for deck a/i);
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 0, clientY: 100, pointerId: 1 });

    expect(setBendMultiplier).toHaveBeenCalled();
    expect(updateScratchRate).not.toHaveBeenCalled();
    expect(useDeckStore.getState().decks['A'].scratching).toBe(false);
  });

  it('releasing after a bend-mode drag resets the multiplier to 1.0', () => {
    const { setBendMultiplier } = registerMockPlayer('A');
    loadTrackOnDeckA();
    act(() => { useDeckStore.getState().setVinylMode('A', false); });
    render(<JogWheel deckId="A" />);

    const surface = screen.getByLabelText(/jog wheel for deck a/i);
    fireEvent.pointerDown(surface, { clientX: 100, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(surface, { clientX: 0, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(surface, { clientX: 0, clientY: 100, pointerId: 1 });

    expect(setBendMultiplier).toHaveBeenLastCalledWith(1.0);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/test/JogWheel.test.tsx`
Expected: FAIL — `Cannot find module '../components/Deck/JogWheel'`

- [ ] **Step 5: Implement `JogWheel.module.css`**

Create `src/components/Deck/JogWheel.module.css`:

```css
/**
 * JogWheel.module.css — interactive jog wheel wrapper + VINYL toggle.
 */

.wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.dragSurface {
  cursor: grab;
  /* Prevent the browser's default touch scroll/pinch gestures from
     interfering with a single-pointer scratch/bend drag. */
  touch-action: none;
  user-select: none;
}

.dragSurface:active {
  cursor: grabbing;
}

.vinylBtn {
  width: 52px;
  height: var(--btn-height-sm);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.vinylBtn:hover {
  color: var(--color-text-primary);
}

.vinylBtn:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.vinylBtnActive {
  color: var(--color-text-inverse);
  background: var(--color-accent-primary);
  border-color: var(--color-accent-primary-bright);
  box-shadow: var(--shadow-button-active);
}
```

- [ ] **Step 6: Implement `JogWheel.tsx`**

Create `src/components/Deck/JogWheel.tsx`:

```tsx
/**
 * JogWheel.tsx — Interactive jog wheel wrapping VinylPlatter.
 *
 * A single Pointer Events drag surface (mouse + touch, single pointer) drives
 * two mutually exclusive behaviors gated by VINYL mode:
 *   - VINYL on:  real scratch — beginScratch/updateScratchRate/endScratch,
 *                mirroring how every other deck command goes through the
 *                registered player (see playerRegistry.ts).
 *   - VINYL off: temporary pitch bend — setBendMultiplier via the same
 *                player, released back to 1.0 on pointer up.
 * Visual rotation during a drag is driven directly by the drag angle
 * (VinylPlatter's rotationOverrideDeg), locking the platter's spin to the
 * exact position being scratched/bent.
 */
import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useDeck, useDeckStore } from '../../store/deckStore';
import { getActivePlayer } from '../../services/playerRegistry';
import { angleDeg, shortestAngleDelta, rotationDeltaToSeconds, rateFromMovement } from '../../utils/scratchMath';
import { VinylPlatter } from './VinylPlatter';
import styles from './JogWheel.module.css';

const BEND_RANGE = 0.08; // +/-8% temporary pitch nudge
const BEND_DEGREES_FOR_MAX = 180; // full bend range reached at a half-rotation drag

interface JogWheelProps {
  deckId: 'A' | 'B';
}

interface DragState {
  pointerId: number;
  centerX: number;
  centerY: number;
  lastAngle: number;
  lastTimestamp: number;
  cumulativeDeg: number; // total rotation since pointer-down, for bend-mode mapping
  rotationDeg: number; // visual override angle
}

export function JogWheel({ deckId }: JogWheelProps) {
  const deck = useDeck(deckId);
  const { playbackState, pitchRate, thumbnailUrl, vinylMode, trackId } = deck;
  const isPlaying = playbackState === 'playing';
  const isBuffering = playbackState === 'buffering';

  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [rotationOverride, setRotationOverride] = useState<number | null>(null);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>): void {
    if (!trackId) return;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const angle = angleDeg(centerX, centerY, e.clientX, e.clientY);
    dragRef.current = {
      pointerId: e.pointerId,
      centerX,
      centerY,
      lastAngle: angle,
      lastTimestamp: performance.now(),
      cumulativeDeg: 0,
      rotationDeg: 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (vinylMode) {
      useDeckStore.getState().beginScratch(deckId);
    }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const angle = angleDeg(drag.centerX, drag.centerY, e.clientX, e.clientY);
    const deltaDeg = shortestAngleDelta(drag.lastAngle, angle);
    const now = performance.now();
    const deltaMs = now - drag.lastTimestamp;
    drag.lastAngle = angle;
    drag.lastTimestamp = now;
    drag.cumulativeDeg += deltaDeg;
    drag.rotationDeg += deltaDeg;
    setRotationOverride(drag.rotationDeg);

    if (vinylMode) {
      const deltaSeconds = rotationDeltaToSeconds(deltaDeg);
      const rate = rateFromMovement(deltaSeconds, deltaMs);
      getActivePlayer(deckId)?.updateScratchRate?.(rate);
    } else {
      const bendFraction = Math.max(-1, Math.min(1, drag.cumulativeDeg / BEND_DEGREES_FOR_MAX));
      const multiplier = 1 + bendFraction * BEND_RANGE;
      getActivePlayer(deckId)?.setBendMultiplier?.(multiplier);
    }
  }

  function endDrag(e: ReactPointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setRotationOverride(null);
    if (vinylMode) {
      useDeckStore.getState().endScratch(deckId);
    } else {
      getActivePlayer(deckId)?.setBendMultiplier?.(1.0);
    }
  }

  function handleVinylToggle(): void {
    useDeckStore.getState().setVinylMode(deckId, !vinylMode);
  }

  return (
    <div className={styles.wrapper}>
      <div
        ref={wrapperRef}
        className={styles.dragSurface}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="button"
        tabIndex={-1}
        aria-label={`Jog wheel for Deck ${deckId} — drag to ${vinylMode ? 'scratch' : 'bend pitch'}`}
      >
        <VinylPlatter
          isPlaying={isPlaying}
          isBuffering={isBuffering}
          pitchRate={pitchRate}
          thumbnailUrl={thumbnailUrl}
          {...(rotationOverride !== null ? { rotationOverrideDeg: rotationOverride } : {})}
        />
      </div>
      <button
        type="button"
        className={`${styles.vinylBtn} ${vinylMode ? styles.vinylBtnActive : ''}`}
        onClick={handleVinylToggle}
        aria-pressed={vinylMode}
        aria-label={`Vinyl scratch mode for Deck ${deckId}`}
        title={vinylMode ? 'VINYL mode: drag scratches the track' : 'VINYL mode off: drag only bends pitch'}
      >
        VINYL
      </button>
    </div>
  );
}

export default JogWheel;
```

Note the conditional prop-spread for `rotationOverrideDeg` — with `exactOptionalPropertyTypes` on, `rotationOverrideDeg={rotationOverride ?? undefined}` would be a type error (an optional prop typed `number | undefined`'s absence must be achieved by omitting the prop, not passing `undefined` explicitly).

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/test/JogWheel.test.tsx`
Expected: PASS (7 tests)

- [ ] **Step 8: Commit**

```bash
git add src/components/Deck/VinylPlatter.tsx src/components/Deck/JogWheel.tsx src/components/Deck/JogWheel.module.css src/test/setup.ts src/test/JogWheel.test.tsx
git commit -m "feat: JogWheel component — VINYL toggle + scratch/bend pointer drag"
```

---

### Task 6: Wire `JogWheel` into `Deck.tsx` and `useAudioEngine.ts`

**Files:**
- Modify: `src/components/Deck/Deck.tsx`
- Modify: `src/hooks/useAudioEngine.ts`
- Test: `src/test/useAudioEngine.test.ts` (extend)

**Interfaces:**
- Consumes: `JogWheel` (Task 5), `engine.primeScratch(buffer)` (Task 3).

- [ ] **Step 1: Replace `VinylPlatter` with `JogWheel` in `Deck.tsx`**

In `src/components/Deck/Deck.tsx`, change the import:

```tsx
- import { VinylPlatter } from './VinylPlatter';
+ import { JogWheel } from './JogWheel';
```

Change the destructuring — `playbackState`, `pitchRate`, and `thumbnailUrl` are no longer read here (JogWheel reads them itself via `useDeck(deckId)`); only `trackId` and `error` remain needed. Replace:

```tsx
  const { playbackState, trackId, thumbnailUrl, pitchRate, error } = deck;

  const isPlaying = playbackState === 'playing';
  const isBuffering = playbackState === 'buffering';
  const hasTrack = trackId !== null;
```
with:
```tsx
  const { trackId, error } = deck;

  const hasTrack = trackId !== null;
```

(i.e., delete the `playbackState`/`thumbnailUrl`/`pitchRate` destructuring and the `isPlaying`/`isBuffering` lines entirely — they become unused, and `noUnusedLocals` in `tsconfig.app.json` will fail the build if they're left in.)

Change the platter render block:

```tsx
      <div className={styles.platterSection}>
        {hasTrack ? (
-          <VinylPlatter
-            isPlaying={isPlaying}
-            isBuffering={isBuffering}
-            pitchRate={pitchRate}
-            thumbnailUrl={thumbnailUrl}
-          />
+          <JogWheel deckId={deckId} />
        ) : (
```

- [ ] **Step 2: Verify the build catches nothing extra unused**

Run: `npx tsc -b`
Expected: no errors. (If any other now-unused variable surfaces in `Deck.tsx`, remove it — but `trackId`/`error`/`channelFader`/`setChannelFaderA`/`setChannelFaderB` etc. all remain in use elsewhere in the file.)

- [ ] **Step 3: Prime the scratch worklet after every buffer load**

In `src/hooks/useAudioEngine.ts`, in `loadAudioFile` (currently line 296), add `primeScratch` right after `loadBuffer`:

```ts
    const engine = engineRef.current;
    engine.loadBuffer(buffer);
    engine.primeScratch(buffer);
    // Sync engine volume to current mixer-computed deck volume immediately
```

In `loadAudioUrl` (currently line 360), the same change:

```ts
    const engine = engineRef.current;
    engine.loadBuffer(buffer);
    engine.primeScratch(buffer);
    engine.setVolume(useDeckStore.getState().decks[deckId].volume);
```

- [ ] **Step 4: Add a regression test confirming primeScratch is called on load**

In `src/test/useAudioEngine.test.ts`, the `MockAudioEngine` interface (currently lines 31-50) and `makeMockEngine()` (currently lines 52-75) define the mocked `AudioEngineImpl`. Add a `primeScratch` field to both:

In the `MockAudioEngine` interface, add after `loadBuffer: ReturnType<typeof vi.fn>;` (line 32):

```ts
  loadBuffer: ReturnType<typeof vi.fn>;
  primeScratch: ReturnType<typeof vi.fn>;
```

In `makeMockEngine()`, add after `loadBuffer: vi.fn(),` (line 54):

```ts
    loadBuffer: vi.fn(),
    primeScratch: vi.fn(),
```

Then add one new test immediately after the existing `'calls engine.loadBuffer with the decoded AudioBuffer'` test (currently lines 329-338, inside `describe('useAudioEngine — track loading: mp3', ...)`):

```ts
  it('calls engine.primeScratch with the decoded AudioBuffer', async () => {
    renderHook(() => useAudioEngine('A'));

    await act(async () => {
      loadMp3Track('A', fakeFile);
      await Promise.resolve();
    });

    expect(mockEngineInstances[0]!.primeScratch).toHaveBeenCalledWith(fakeAudioBuffer);
  });
```

This mirrors the neighboring `loadBuffer` test exactly (same `renderHook`/`act`/`loadMp3Track` setup), asserting the new call instead.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/test/useAudioEngine.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full suite**

Run: `npm run test`
Expected: all test files pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/Deck/Deck.tsx src/hooks/useAudioEngine.ts src/test/useAudioEngine.test.ts
git commit -m "feat: wire JogWheel into Deck.tsx; prime scratch worklet on every buffer load"
```

---

### Task 7: Full verification (build, lint, tests, Playwright smoke test)

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: all test files pass, 0 failures.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `tsc -b && vite build` completes with no type errors and no warnings.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: `eslint . --max-warnings 0` — zero warnings, zero errors.

- [ ] **Step 4: Playwright smoke test — real browser, real AudioWorklet**

This is a manual/ad-hoc verification pass (not a committed test file), matching how every prior phase of this project was verified end-to-end before merge — jsdom cannot execute real `AudioWorkletProcessor` code, so this is the only way to prove the worklet actually runs.

1. Start the dev server: `npm run dev`.
2. Using Playwright (headless Chromium), navigate to the app, and via `page.evaluate` generate a small in-memory WAV `File` (mirroring the technique used for Phase 2c's Sampler smoke test) and load it onto Deck A through the real file-picker/library-import flow.
3. Confirm the deck shows a track loaded and the platter (now `JogWheel`) renders with a visible VINYL button.
4. Click the VINYL button and confirm `aria-pressed` toggles.
5. With VINYL on, dispatch a drag gesture on the jog wheel surface via `page.mouse.move` + `page.mouse.down` + a sequence of `page.mouse.move` calls describing a small clockwise arc + `page.mouse.up` (or, if more reliable, `page.dispatchEvent('pointerdown'/'pointermove'/'pointerup', ...)` directly on the drag-surface element handle).
6. Confirm no console errors were logged during the gesture (`page.on('console', ...)` collecting `error`-level messages) — this is the strongest signal that `audioWorklet.addModule` resolved and the `AudioWorkletNode` was constructed without throwing in a real browser.
7. Press Play on Deck A after the scratch gesture ends and confirm playback resumes normally (no silent/broken audio graph) — check `playbackState` becomes `'playing'` via the app's own UI state (e.g. the play button's pressed state) rather than trying to assert on actual audio output.
8. Toggle VINYL off, repeat a drag gesture, and confirm the deck's displayed position does **not** jump/stop (bend-only behavior).

If any step fails, treat it as a genuine implementation defect to fix before considering Phase 3 complete — not a test-environment limitation, since this is the one verification stage that runs the real (non-mocked) Web Audio and AudioWorklet APIs in an actual browser.

- [ ] **Step 5: Final report**

Summarize: test count, build status, lint status, and the Playwright smoke-test outcome (pass/fail per numbered check above). This is the final task in the plan — once it passes, Phase 3 is ready for the whole-branch review and merge (via `superpowers:finishing-a-development-branch`, matching every prior phase).
