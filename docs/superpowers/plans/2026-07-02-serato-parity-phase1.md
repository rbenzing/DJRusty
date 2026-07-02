# Serato Controller Parity — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Serato/Hercules controller's channel-strip and modifier controls to DJ Rusty in place — GAIN/TRIM, FX BEAT/TIME, QUANTIZE, SHIFT, manual loop IN/OUT/RELOOP, and a beatmatch guide — wired to the existing Web Audio engine.

**Architecture:** New per-deck audio input trim (`trimGain` node at the head of the signal chain), extended `setEffect` to accept a beat-division multiplier, new pure utils for all math (dB→linear, FX beat divisions, grid snapping, beatmatch readout), new Zustand deck fields/actions, and small React components placed into the existing Mixer, Deck, EffectsPanel, and LoopControls. Every deck command still flows through the module-level `playerRegistry`; the engine instance is never stored in Zustand.

**Tech Stack:** React 18 + TypeScript (strict), Zustand, Web Audio API, Vite, Vitest (jsdom), `@testing-library/react`, CSS Modules.

## Global Constraints

- **Strict TS:** `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are ON. Indexed access is `T | undefined` (assert or guard). Optional props cannot be explicitly set to `undefined`.
- **Lint:** `npm run lint` is zero-warnings (`--max-warnings 0`).
- **After writing code:** always run `npm run build` (`tsc -b && vite build`) and `npm run lint` (per project + user global instructions).
- **Single Web Audio backend:** deck commands go through `getActivePlayer(deckId)` from `src/services/playerRegistry.ts`. The player is never stored in Zustand.
- **CSS Modules:** co-locate `*.module.css` next to each component under `src/components/`.
- **Tests:** live flat in `src/test/`, named `<topic>.test.ts` / `.test.tsx`.
- **Design tokens:** use the CSS custom properties in `src/index.css` (`--space-*`, `--color-*`, `--radius-*`, `--text-*`, `--btn-height-*`, etc.).
- **Commit** after each task with the message shown in its final step.

---

## File Structure

**New files:**
- `src/utils/gain.ts` — `dbToLinear(db)` pure conversion.
- `src/utils/fxBeat.ts` — `FX_BEAT_DIVISIONS`, `fxBeatMultiplier(v)`.
- `src/utils/quantize.ts` — `snapToGrid(grid, t)`.
- `src/utils/beatmatch.ts` — `beatmatchReadout(a, b)` + its input/output types.
- `src/components/Mixer/GainKnob.tsx` (+ `.module.css`) — per-deck trim knob.
- `src/components/Deck/DeckModifiers.tsx` (+ `.module.css`) — SHIFT + QUANTIZE compact button row.
- `src/components/Mixer/BeatmatchGuide.tsx` (+ `.module.css`) — tempo + phase indicator.
- Test files under `src/test/` (one per task, named below).

**Modified files:**
- `src/services/audioEngine.ts` — `trimGain` node + `setGain`; `setEffect` gains a `beatMultiplier` param.
- `src/store/deckStore.ts` — new fields (`gainDb`, `effectBeat`, `quantize`, `shift`, `manualLoopIn`, `lastManualLoop`) + actions; extend `useDeckActions`.
- `src/types/deck.ts` — declare the new `DeckState` fields.
- `src/hooks/useAudioEngine.ts` — gain subscription; effect subscription passes the beat multiplier; apply gain on load.
- `src/components/Mixer/Mixer.tsx` — GAIN section + BeatmatchGuide.
- `src/components/Deck/Deck.tsx` — render `DeckModifiers` under `DeckControls`.
- `src/components/Deck/DeckControls.tsx` — SHIFT+Restart jumps to cue point.
- `src/components/Deck/EffectsPanel.tsx` — BEAT knob.
- `src/components/Deck/HotCues.tsx` — quantize hot-cue SET.
- `src/components/Deck/LoopControls.tsx` — IN / OUT / RELOOP buttons.
- `src/test/audioEngine.test.ts` — updated constructor mocks (7 gains) + gain/fx-beat tests.

---

## Task 1: `dbToLinear` gain util

**Files:**
- Create: `src/utils/gain.ts`
- Test: `src/test/gain-util.test.ts`

**Interfaces:**
- Produces: `dbToLinear(db: number): number` — decibels → linear amplitude (`10 ** (db/20)`).

- [ ] **Step 1: Write the failing test**

Create `src/test/gain-util.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dbToLinear } from '../utils/gain';

describe('dbToLinear', () => {
  it('maps 0 dB to unity gain', () => {
    expect(dbToLinear(0)).toBe(1);
  });

  it('maps +20 dB to 10x', () => {
    expect(dbToLinear(20)).toBeCloseTo(10, 6);
  });

  it('maps +6 dB to ~1.995x', () => {
    expect(dbToLinear(6)).toBeCloseTo(1.995, 3);
  });

  it('maps -6 dB to ~0.501x', () => {
    expect(dbToLinear(-6)).toBeCloseTo(0.501, 3);
  });

  it('maps -Infinity dB to silence', () => {
    expect(dbToLinear(-Infinity)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/gain-util.test.ts`
Expected: FAIL — cannot find module `../utils/gain`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/gain.ts`:

```ts
/**
 * gain.ts — Pure decibel↔linear conversion for the channel input trim (GAIN).
 * No React/DOM/store imports so it can be unit-tested in isolation.
 */

/** Convert a gain value in decibels to a linear amplitude multiplier. */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/gain-util.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/gain.ts src/test/gain-util.test.ts
git commit -m "feat: dbToLinear util for channel input trim (GAIN)"
```

---

## Task 2: Audio engine `trimGain` node + `setGain`

**Files:**
- Modify: `src/services/audioEngine.ts`
- Modify: `src/test/audioEngine.test.ts`

**Interfaces:**
- Consumes: `dbToLinear` from Task 1.
- Produces: `AudioEngine.setGain(db: number): void` — sets a pre-fader input trim via a new `trimGain` `GainNode` at the head of the chain (`source → trimGain → gainNode(volume) → EQ…`), smoothed with `AudioParam.setTargetAtTime`.

- [ ] **Step 1: Update the engine test's constructor mocks (make them fail first)**

In `src/test/audioEngine.test.ts`, add `setTargetAtTime` to the gain mock and a `mockTrimGain`. Replace the `makeMockGain` function:

```ts
function makeMockGain() {
  return { connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1.0, setTargetAtTime: vi.fn() } };
}
```

Add a declaration alongside the other named mocks (near `let mockGainNode: ...`):

```ts
let mockTrimGain: ReturnType<typeof makeMockGain>;
```

In `setupConstructorMocks`, create `mockTrimGain` and make it the FIRST `createGain` return value (the engine will create `trimGain` first). Replace the assignment block + the `createGain` mock chain:

```ts
  mockTrimGain     = makeMockGain();
  mockGainNode     = makeMockGain();
  mockLowKillGain  = makeMockGain();
  mockMidKillGain  = makeMockGain();
  mockHighKillGain = makeMockGain();
  mockDryGain      = makeMockGain();
  mockWetGain      = makeMockGain();
  mockLowFilter    = makeMockFilter('lowshelf',  320);
  mockMidFilter    = makeMockFilter('peaking',  1000);
  mockHighFilter   = makeMockFilter('highshelf', 3200);
  mockSweepFilter  = makeMockFilter('allpass',  20000);

  // createGain order: trimGain, gainNode, lowKill, midKill, highKill, dryGain, wetGain
  mockContext.createGain
    .mockReturnValueOnce(mockTrimGain)
    .mockReturnValueOnce(mockGainNode)
    .mockReturnValueOnce(mockLowKillGain)
    .mockReturnValueOnce(mockMidKillGain)
    .mockReturnValueOnce(mockHighKillGain)
    .mockReturnValueOnce(mockDryGain)
    .mockReturnValueOnce(mockWetGain);
```

Update the initialization test's count + connections. Replace the `createGain` count assertion and add the trim wiring:

```ts
      expect(mockContext.createGain).toHaveBeenCalledTimes(7);        // trim + gain + 3 kills + dry + wet
      expect(mockContext.createBiquadFilter).toHaveBeenCalledTimes(4); // low + mid + high + sweep
      expect(mockContext.createAnalyser).toHaveBeenCalled();

      // Key connections
      expect(mockTrimGain.connect).toHaveBeenCalledWith(mockGainNode);
      expect(mockGainNode.connect).toHaveBeenCalledWith(mockLowFilter);
```

Update the "starts playback correctly" test — the source now connects to `trimGain`:

```ts
      expect(mockSourceNode.connect).toHaveBeenCalledWith(mockTrimGain);
```

Add a new describe block after the existing `volume control` block:

```ts
  describe('gain / trim', () => {
    it('sets 0 dB as unity via setTargetAtTime', () => {
      engine.setGain(0);
      expect(mockTrimGain.gain.setTargetAtTime).toHaveBeenCalledWith(1, 0, 0.01);
    });

    it('applies +6 dB as ~1.995 linear', () => {
      engine.setGain(6);
      const calls = mockTrimGain.gain.setTargetAtTime.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall?.[0]).toBeCloseTo(1.995, 3);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/audioEngine.test.ts`
Expected: FAIL — `createGain` called 6 times not 7 / `setGain is not a function` / source connected to `mockGainNode` not `mockTrimGain`.

- [ ] **Step 3: Implement `trimGain` + `setGain` in the engine**

In `src/services/audioEngine.ts`:

Add the import at the top (below the existing imports):

```ts
import { dbToLinear } from '../utils/gain';
```

Add to the `AudioEngine` interface (after `setVolume`):

```ts
  /** Set the pre-fader input trim (GAIN) in dB. Smoothed to avoid zipper noise. */
  setGain(gainDb: number): void;
```

Add the field declaration (with the other signal-chain nodes, before `gainNode`):

```ts
  private trimGain: GainNode;
```

In the constructor, create `trimGain` as the FIRST `createGain()` call (before `this.gainNode`):

```ts
    // trimGain must be created first so the test mock ordering (trim, gain, kills…) holds.
    this.trimGain = this.context.createGain();
    this.gainNode = this.context.createGain();
```

Set its default and wire it in the constructor's connection block — the source will feed `trimGain`, which feeds `gainNode`. Add `this.trimGain.gain.value = 1;` near the other defaults, and add the connection just before `this.gainNode.connect(this.lowFilter);`:

```ts
    this.trimGain.gain.value = 1;
```

```ts
    // Signal chain head: source → trimGain → gainNode(volume) → EQ…
    this.trimGain.connect(this.gainNode);
    this.gainNode.connect(this.lowFilter);
```

In `play()`, connect the source to `trimGain` instead of `gainNode`:

```ts
    this.sourceNode.connect(this.trimGain);
```

Add the method (next to `setVolume`):

```ts
  setGain(gainDb: number): void {
    this.trimGain.gain.setTargetAtTime(dbToLinear(gainDb), this.context.currentTime, 0.01);
  }
```

In `destroy()`, add `this.trimGain` to the disconnect list (front of the array):

```ts
    [
      this.trimGain, this.gainNode, this.lowFilter, this.lowKillGain,
      this.midFilter, this.midKillGain, this.highFilter, this.highKillGain,
      this.sweepFilter, this.dryGain, this.wetGain, this.analyser,
    ].forEach((n) => { try { n.disconnect(); } catch { /* ok */ } });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/audioEngine.test.ts`
Expected: PASS (all existing + 2 new gain tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/audioEngine.ts src/test/audioEngine.test.ts
git commit -m "feat: audio engine input trim (trimGain node + setGain)"
```

---

## Task 3: deckStore `gainDb` state + action + engine subscription

**Files:**
- Modify: `src/types/deck.ts`
- Modify: `src/store/deckStore.ts`
- Modify: `src/hooks/useAudioEngine.ts`
- Test: `src/test/deck-gain.test.ts`

**Interfaces:**
- Consumes: `AudioEngine.setGain` (Task 2).
- Produces: `DeckState.gainDb: number` (default `0`); `deckStore.setGain(deckId, db)` clamped to `[-24, 12]`; exposed on `useDeckActions()` as `setGain`.

- [ ] **Step 1: Write the failing test**

Create `src/test/deck-gain.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useDeckStore } from '../store/deckStore';

describe('deck gain (input trim)', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('defaults gainDb to 0', () => {
    expect(useDeckStore.getState().decks.A.gainDb).toBe(0);
  });

  it('setGain updates gainDb', () => {
    useDeckStore.getState().setGain('A', 6);
    expect(useDeckStore.getState().decks.A.gainDb).toBe(6);
  });

  it('clamps gainDb to [-24, 12]', () => {
    useDeckStore.getState().setGain('A', 99);
    expect(useDeckStore.getState().decks.A.gainDb).toBe(12);
    useDeckStore.getState().setGain('A', -99);
    expect(useDeckStore.getState().decks.A.gainDb).toBe(-24);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/deck-gain.test.ts`
Expected: FAIL — `gainDb` is `undefined` / `setGain is not a function`.

- [ ] **Step 3: Implement state + action + subscription**

In `src/types/deck.ts`, add to the `DeckState` interface (after the `eqHigh` block near line 130):

```ts
  /** Channel input trim (GAIN) in dB. Range -24..+12, unity at 0. */
  gainDb: number;
```

In `src/store/deckStore.ts`, `createInitialDeckState` — add after `eqHigh: 0,`:

```ts
    gainDb: 0,
```

Add the action type to `DeckStoreActions` (after `setEq`):

```ts
  /** Set the channel input trim (GAIN) in dB, clamped to [-24, 12]. */
  setGain: (deckId: 'A' | 'B', gainDb: number) => void;
```

Add the action implementation (after the `setEq` implementation):

```ts
  setGain: (deckId, gainDb) => {
    updateDeck(set, deckId, { gainDb: Math.max(-24, Math.min(12, gainDb)) });
  },
```

Add `setGain` to the `useDeckActions` shallow bag (append to the `setEq` line group):

```ts
      setGain: s.setGain,
```

In `src/hooks/useAudioEngine.ts`, add a new subscription effect immediately after the `// ── 5. Volume ──` effect (before `// ── 6. EQ ──`):

```ts
  // ── 5b. Gain (input trim) ─────────────────────────────────────────────────
  useEffect(() => {
    let prev = useDeckStore.getState().decks[deckId].gainDb;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { gainDb } = state.decks[deckId];
      if (gainDb === prev) return;
      prev = gainDb;
      if (!engineRef.current) return;
      engineRef.current.setGain(gainDb);
    });

    return unsubscribe;
  }, [deckId]);
```

Apply the current trim right after `engine.setVolume(...)` in BOTH `loadAudioFile` and `loadAudioUrl` (so a preset gain is honored on load):

```ts
    engine.setGain(useDeckStore.getState().decks[deckId].gainDb);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/deck-gain.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/types/deck.ts src/store/deckStore.ts src/hooks/useAudioEngine.ts src/test/deck-gain.test.ts
git commit -m "feat: deck gainDb state + setGain action wired to engine trim"
```

---

## Task 4: `GainKnob` component + Mixer placement

**Files:**
- Create: `src/components/Mixer/GainKnob.tsx`
- Create: `src/components/Mixer/GainKnob.module.css`
- Modify: `src/components/Mixer/Mixer.tsx`
- Test: `src/test/GainKnob.test.tsx`

**Interfaces:**
- Consumes: `useDeck`, `useDeckActions().setGain`.
- Produces: `<GainKnob deckId="A" | "B" />` — a rotary trim knob reading/writing `gainDb` (−24…+12 dB).

- [ ] **Step 1: Write the failing test**

Create `src/test/GainKnob.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GainKnob } from '../components/Mixer/GainKnob';
import { useDeckStore } from '../store/deckStore';

describe('GainKnob', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('renders the current gain as a slider role', () => {
    useDeckStore.getState().setGain('A', 3);
    render(<GainKnob deckId="A" />);
    expect(screen.getByRole('slider', { name: /gain/i })).toHaveAttribute('aria-valuenow', '3');
  });

  it('ArrowUp increases gain by 1 dB', () => {
    render(<GainKnob deckId="A" />);
    const knob = screen.getByRole('slider', { name: /gain/i });
    fireEvent.keyDown(knob, { key: 'ArrowUp' });
    expect(useDeckStore.getState().decks.A.gainDb).toBe(1);
  });

  it('double-click resets gain to 0', () => {
    useDeckStore.getState().setGain('A', 8);
    render(<GainKnob deckId="A" />);
    fireEvent.doubleClick(screen.getByRole('slider', { name: /gain/i }));
    expect(useDeckStore.getState().decks.A.gainDb).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/GainKnob.test.tsx`
Expected: FAIL — cannot find module `GainKnob`.

- [ ] **Step 3: Implement the component + styles + Mixer placement**

Create `src/components/Mixer/GainKnob.tsx`:

```tsx
/**
 * GainKnob.tsx — Per-deck channel input trim (GAIN), rendered in the mixer strip.
 * Drag up/down to change; double-click resets to 0 dB; Arrow keys step ±1 dB.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useDeck, useDeckActions } from '../../store/deckStore';
import styles from './GainKnob.module.css';

const DB_MIN = -24;
const DB_MAX = 12;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

interface GainKnobProps {
  deckId: 'A' | 'B';
}

export function GainKnob({ deckId }: GainKnobProps) {
  const value = useDeck(deckId).gainDb;
  const { setGain } = useDeckActions();
  const dragStartY = useRef<number | null>(null);
  const dragStartValue = useRef(value);
  const removeDrag = useRef<(() => void) | null>(null);

  useEffect(() => () => { removeDrag.current?.(); }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartValue.current = value;

    function onMove(ev: MouseEvent) {
      if (dragStartY.current === null) return;
      const deltaDb = (dragStartY.current - ev.clientY) * 0.2;
      setGain(deckId, parseFloat(clamp(dragStartValue.current + deltaDb, DB_MIN, DB_MAX).toFixed(1)));
    }
    function onUp() {
      dragStartY.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      removeDrag.current = null;
    }
    removeDrag.current?.();
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    removeDrag.current = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [deckId, value, setGain]);

  // -24 dB → -135°, 0 dB → 0°, +12 dB → +135°
  const ratio = (value - DB_MIN) / (DB_MAX - DB_MIN);
  const angle = -135 + ratio * 270;
  const valueLabel = value === 0 ? '0 dB' : `${value > 0 ? '+' : ''}${value.toFixed(1)} dB`;

  return (
    <div className={styles.wrap} data-deck={deckId.toLowerCase()}>
      <div
        className={styles.knob}
        style={{ '--knob-angle': `${angle.toFixed(1)}deg` } as React.CSSProperties}
        role="slider"
        tabIndex={0}
        aria-label={`Deck ${deckId} gain: ${valueLabel}`}
        aria-valuemin={DB_MIN}
        aria-valuemax={DB_MAX}
        aria-valuenow={value}
        aria-valuetext={valueLabel}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => setGain(deckId, 0)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp')   { e.preventDefault(); setGain(deckId, clamp(value + 1, DB_MIN, DB_MAX)); }
          if (e.key === 'ArrowDown') { e.preventDefault(); setGain(deckId, clamp(value - 1, DB_MIN, DB_MAX)); }
        }}
      >
        <div className={styles.indicator} />
      </div>
      <span className={styles.label}>{deckId}</span>
    </div>
  );
}

export default GainKnob;
```

Create `src/components/Mixer/GainKnob.module.css`:

```css
.wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.knob {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-full);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-strong);
  box-shadow: var(--shadow-knob);
  position: relative;
  cursor: ns-resize;
  outline: none;
}

.knob:focus-visible {
  box-shadow: var(--shadow-focus);
}

.indicator {
  position: absolute;
  top: 3px;
  left: 50%;
  width: 2px;
  height: 12px;
  background: var(--color-accent-primary);
  transform-origin: 50% 14px;
  transform: translateX(-50%) rotate(var(--knob-angle, 0deg));
  border-radius: 1px;
}

.label {
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: var(--tracking-wide);
  color: var(--color-text-muted);
}

.wrap[data-deck='a'] .label { color: var(--color-deck-a-text); }
.wrap[data-deck='b'] .label { color: var(--color-deck-b-text); }
```

In `src/components/Mixer/Mixer.tsx`, import the knob:

```tsx
import { GainKnob } from './GainKnob';
```

Add a GAIN section immediately above the Channel-faders section (after the Master section):

```tsx
      {/* Channel input trim (GAIN) — top of the controller's mixer column */}
      <section className={styles.section} aria-label="Channel gain">
        <div className={styles.sectionLabel}>GAIN</div>
        <div className={styles.channelRow}>
          <GainKnob deckId="A" />
          <GainKnob deckId="B" />
        </div>
      </section>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/GainKnob.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Mixer/GainKnob.tsx src/components/Mixer/GainKnob.module.css src/components/Mixer/Mixer.tsx src/test/GainKnob.test.tsx
git commit -m "feat: GAIN trim knobs in the mixer strip"
```

---

## Task 5: `fxBeatMultiplier` util

**Files:**
- Create: `src/utils/fxBeat.ts`
- Test: `src/test/fx-beat-util.test.ts`

**Interfaces:**
- Produces: `FX_BEAT_DIVISIONS: readonly number[]`; `fxBeatMultiplier(v: number): number` — maps a `[0,1]` knob value to the nearest musical beat division.

- [ ] **Step 1: Write the failing test**

Create `src/test/fx-beat-util.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fxBeatMultiplier, FX_BEAT_DIVISIONS } from '../utils/fxBeat';

describe('fxBeatMultiplier', () => {
  it('exposes 7 divisions from 1/16 to 4 beats', () => {
    expect(FX_BEAT_DIVISIONS).toEqual([1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4]);
  });

  it('maps 0 to the smallest division (1/16)', () => {
    expect(fxBeatMultiplier(0)).toBe(1 / 16);
  });

  it('maps 1 to the largest division (4)', () => {
    expect(fxBeatMultiplier(1)).toBe(4);
  });

  it('maps the default 0.5 to a half-beat', () => {
    expect(fxBeatMultiplier(0.5)).toBe(1 / 2);
  });

  it('clamps out-of-range values', () => {
    expect(fxBeatMultiplier(-5)).toBe(1 / 16);
    expect(fxBeatMultiplier(5)).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/fx-beat-util.test.ts`
Expected: FAIL — cannot find module `../utils/fxBeat`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/fxBeat.ts`:

```ts
/**
 * fxBeat.ts — Maps the FX BEAT/TIME knob (0..1) to a musical beat division.
 * Pure; no React/DOM/store imports.
 */

/** Ordered FX time divisions, in beats. Index 3 (1/2) is the default. */
export const FX_BEAT_DIVISIONS = [1 / 16, 1 / 8, 1 / 4, 1 / 2, 1, 2, 4] as const;

/** Map a normalized knob value in [0,1] to the nearest beat division. */
export function fxBeatMultiplier(v: number): number {
  const clamped = Math.max(0, Math.min(1, v));
  const idx = Math.round(clamped * (FX_BEAT_DIVISIONS.length - 1));
  const division = FX_BEAT_DIVISIONS[idx];
  // noUncheckedIndexedAccess: idx is guaranteed in range, but assert for the type.
  return division ?? 1 / 2;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/fx-beat-util.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/fxBeat.ts src/test/fx-beat-util.test.ts
git commit -m "feat: fxBeatMultiplier util (FX BEAT/TIME divisions)"
```

---

## Task 6: Engine `setEffect` accepts a beat multiplier

**Files:**
- Modify: `src/services/audioEngine.ts`
- Modify: `src/test/audioEngine.test.ts`

**Interfaces:**
- Produces: `setEffect(type, wetDry, bpm = 120, beatMultiplier = 0.5)` — echo delay time becomes `(60/bpm) * beatMultiplier`; reverb impulse duration scales with `beatMultiplier`.

- [ ] **Step 1: Write the failing test**

In `src/test/audioEngine.test.ts`, add inside the existing `describe('effects', …)` block:

```ts
    it('echo delay time follows bpm and beat multiplier', () => {
      const mockDelay = { connect: vi.fn(), disconnect: vi.fn(), delayTime: { value: 0 } };
      const mockFeedbackGain = makeMockGain();
      mockContext.createDelay.mockReturnValueOnce(mockDelay);
      mockContext.createGain.mockReturnValueOnce(mockFeedbackGain);

      // 120 bpm → 0.5 s/beat; quarter-beat (0.25) → 0.125 s delay
      engine.setEffect('echo', 0.5, 120, 0.25);

      expect(mockDelay.delayTime.value).toBeCloseTo(0.125, 6);
    });

    it('defaults to a half-beat delay when beatMultiplier omitted', () => {
      const mockDelay = { connect: vi.fn(), disconnect: vi.fn(), delayTime: { value: 0 } };
      const mockFeedbackGain = makeMockGain();
      mockContext.createDelay.mockReturnValueOnce(mockDelay);
      mockContext.createGain.mockReturnValueOnce(mockFeedbackGain);

      engine.setEffect('echo', 0.5, 120);

      expect(mockDelay.delayTime.value).toBeCloseTo(0.25, 6); // 0.5 s/beat * 0.5
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/test/audioEngine.test.ts -t "beat multiplier"`
Expected: FAIL — delay time is `0.25` for the quarter-beat case (multiplier ignored).

- [ ] **Step 3: Implement the multiplier**

In `src/services/audioEngine.ts`, update the `setEffect` signature in the `AudioEngine` interface:

```ts
  /**
   * Enable/disable and configure an effect.
   * type 'none' bypasses all effects. beatMultiplier scales the effect time
   * (echo delay = (60/bpm) * beatMultiplier; reverb size scales with it).
   */
  setEffect(type: 'none' | 'echo' | 'reverb', wetDry: number, bpm?: number, beatMultiplier?: number): void;
```

Update the implementation signature and the echo/reverb bodies:

```ts
  setEffect(type: 'none' | 'echo' | 'reverb', wetDry: number, bpm = 120, beatMultiplier = 0.5): void {
```

Echo delay line (replace the `delay.delayTime.value = beatSeconds * 0.5;` region):

```ts
    if (type === 'echo') {
      const delay = this.context.createDelay(4.0);
      const beatSeconds = 60 / bpm;
      delay.delayTime.value = beatSeconds * beatMultiplier; // FX BEAT/TIME division
```

Reverb impulse (replace the `convolver.buffer = this.createReverbImpulse(2.5, 0.7);` line):

```ts
      const convolver = this.context.createConvolver();
      convolver.buffer = this.createReverbImpulse(1 + beatMultiplier, 0.7); // 1..5 s room size
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/test/audioEngine.test.ts`
Expected: PASS (all effect tests including the 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/services/audioEngine.ts src/test/audioEngine.test.ts
git commit -m "feat: setEffect beatMultiplier drives echo delay time + reverb size"
```

---

## Task 7: deckStore `effectBeat` state + action + effect subscription

**Files:**
- Modify: `src/types/deck.ts`
- Modify: `src/store/deckStore.ts`
- Modify: `src/hooks/useAudioEngine.ts`
- Test: `src/test/deck-fxbeat.test.ts`

**Interfaces:**
- Consumes: `fxBeatMultiplier` (Task 5), `setEffect` (Task 6).
- Produces: `DeckState.effectBeat: number` (default `0.5`); `deckStore.setEffectBeat(deckId, v)` clamped `[0,1]`; on `useDeckActions` as `setEffectBeat`. The effect subscription re-runs on `effectBeat` change and passes `fxBeatMultiplier(effectBeat)`.

- [ ] **Step 1: Write the failing test**

Create `src/test/deck-fxbeat.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useDeckStore } from '../store/deckStore';

describe('deck FX beat', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('defaults effectBeat to 0.5', () => {
    expect(useDeckStore.getState().decks.A.effectBeat).toBe(0.5);
  });

  it('setEffectBeat updates and clamps to [0,1]', () => {
    useDeckStore.getState().setEffectBeat('A', 0.9);
    expect(useDeckStore.getState().decks.A.effectBeat).toBe(0.9);
    useDeckStore.getState().setEffectBeat('A', 5);
    expect(useDeckStore.getState().decks.A.effectBeat).toBe(1);
    useDeckStore.getState().setEffectBeat('A', -5);
    expect(useDeckStore.getState().decks.A.effectBeat).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/deck-fxbeat.test.ts`
Expected: FAIL — `effectBeat` is `undefined` / `setEffectBeat is not a function`.

- [ ] **Step 3: Implement state + action + subscription**

In `src/types/deck.ts`, add to `DeckState` after `effectWetDry`:

```ts
  /** FX BEAT/TIME knob position (0..1). Maps to a musical division; default 0.5 = half-beat. */
  effectBeat: number;
```

In `src/store/deckStore.ts` `createInitialDeckState`, add after `effectWetDry: 0.5,`:

```ts
    effectBeat: 0.5,
```

Add the action type (after `setEffectWetDry`):

```ts
  /** Set the FX BEAT/TIME knob position (0..1). */
  setEffectBeat: (deckId: 'A' | 'B', v: number) => void;
```

Add the action implementation (after `setEffectWetDry`):

```ts
  setEffectBeat: (deckId, v) => {
    updateDeck(set, deckId, { effectBeat: Math.max(0, Math.min(1, v)) });
  },
```

Add to `useDeckActions` (in the effects group):

```ts
      setEffectBeat: s.setEffectBeat,
```

In `src/hooks/useAudioEngine.ts`, add the import:

```ts
import { fxBeatMultiplier } from '../utils/fxBeat';
```

Replace the `// ── 6d. Effects ──` effect body so it also tracks `effectBeat`:

```ts
  // ── 6d. Effects ───────────────────────────────────────────────────────────
  useEffect(() => {
    let prevType = useDeckStore.getState().decks[deckId].effectType;
    let prevEnabled = useDeckStore.getState().decks[deckId].effectEnabled;
    let prevWetDry = useDeckStore.getState().decks[deckId].effectWetDry;
    let prevBeat = useDeckStore.getState().decks[deckId].effectBeat;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { effectType, effectEnabled, effectWetDry, effectBeat, bpm } = state.decks[deckId];
      if (effectType === prevType && effectEnabled === prevEnabled && effectWetDry === prevWetDry && effectBeat === prevBeat) return;
      prevType = effectType; prevEnabled = effectEnabled; prevWetDry = effectWetDry; prevBeat = effectBeat;
      if (!engineRef.current) return;
      const active = effectEnabled ? effectType : 'none';
      engineRef.current.setEffect(active, effectWetDry, bpm ?? 120, fxBeatMultiplier(effectBeat));
    });

    return unsubscribe;
  }, [deckId]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/deck-fxbeat.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/types/deck.ts src/store/deckStore.ts src/hooks/useAudioEngine.ts src/test/deck-fxbeat.test.ts
git commit -m "feat: deck effectBeat state + FX BEAT wired into effect subscription"
```

---

## Task 8: BEAT knob in `EffectsPanel`

**Files:**
- Modify: `src/components/Deck/EffectsPanel.tsx`
- Test: `src/test/EffectsPanelBeat.test.tsx`

**Interfaces:**
- Consumes: `deckStore.effectBeat`, `setEffectBeat`, `fxBeatMultiplier`.
- Produces: a second knob (`BEAT`) beside the existing D/W knob in the FX panel.

- [ ] **Step 1: Write the failing test**

Create `src/test/EffectsPanelBeat.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EffectsPanel } from '../components/Deck/EffectsPanel';
import { useDeckStore } from '../store/deckStore';

describe('EffectsPanel BEAT knob', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('renders a BEAT knob showing the current division', () => {
    render(<EffectsPanel deckId="A" />);
    expect(screen.getByRole('slider', { name: /fx beat/i })).toBeInTheDocument();
  });

  it('ArrowUp raises effectBeat', () => {
    render(<EffectsPanel deckId="A" />);
    const knob = screen.getByRole('slider', { name: /fx beat/i });
    fireEvent.keyDown(knob, { key: 'ArrowUp' });
    expect(useDeckStore.getState().decks.A.effectBeat).toBeGreaterThan(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/EffectsPanelBeat.test.tsx`
Expected: FAIL — no slider named "fx beat".

- [ ] **Step 3: Implement the BEAT knob**

In `src/components/Deck/EffectsPanel.tsx`, add the import:

```tsx
import { fxBeatMultiplier } from '../../utils/fxBeat';
```

Add a `BeatKnob` component (mirrors `WetDryKnob`) above `EffectsPanel`:

```tsx
function BeatKnob({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const dragStartY = useRef<number | null>(null);
  const dragStartValue = useRef(value);
  const removeDrag = useRef<(() => void) | null>(null);

  useEffect(() => () => { removeDrag.current?.(); }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartY.current = e.clientY;
    dragStartValue.current = value;

    function onMove(ev: MouseEvent) {
      if (dragStartY.current === null) return;
      const delta = (dragStartY.current - ev.clientY) * 0.008;
      onChange(Math.max(0, Math.min(1, dragStartValue.current + delta)));
    }
    function onUp() {
      dragStartY.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      removeDrag.current = null;
    }
    removeDrag.current?.();
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    removeDrag.current = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [value, onChange]);

  const angle = (value - 0.5) * 270;
  const mult = fxBeatMultiplier(value);
  const label = mult < 1 ? `1/${Math.round(1 / mult)}` : `${mult}`;

  return (
    <div className={styles.knobWrap}>
      <div
        className={styles.knob}
        style={{ '--knob-angle': `${angle.toFixed(1)}deg` } as React.CSSProperties}
        role="slider"
        tabIndex={0}
        aria-label={`FX beat: ${label} beat`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        aria-valuetext={`${label} beat`}
        onMouseDown={handleMouseDown}
        onDoubleClick={() => onChange(0.5)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp')   { e.preventDefault(); onChange(Math.min(1, value + 0.1)); }
          if (e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0, value - 0.1)); }
        }}
      >
        <div className={styles.indicator} />
      </div>
      <span className={styles.knobLabel}>BEAT</span>
    </div>
  );
}
```

In the `EffectsPanel` function, read the state + action:

```tsx
  const effectBeat = useDeckStore((s) => s.decks[deckId].effectBeat);
  const { setEffectType, setEffectEnabled, setEffectWetDry, setEffectBeat } = useDeckActions();
```

```tsx
  const handleBeat = useCallback((v: number) => {
    setEffectBeat(deckId, v);
  }, [deckId, setEffectBeat]);
```

Render `<BeatKnob>` right after the existing `<WetDryKnob>` in the `controls` div:

```tsx
        <WetDryKnob value={effectWetDry} onChange={handleWetDry} />
        <BeatKnob value={effectBeat} onChange={handleBeat} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/EffectsPanelBeat.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Deck/EffectsPanel.tsx src/test/EffectsPanelBeat.test.tsx
git commit -m "feat: FX BEAT/TIME knob in EffectsPanel"
```

---

## Task 9: `snapToGrid` util

**Files:**
- Create: `src/utils/quantize.ts`
- Test: `src/test/quantize-util.test.ts`

**Interfaces:**
- Produces: `snapToGrid(grid: BeatGrid, t: number): number` — snaps a time to the nearest beat.

- [ ] **Step 1: Write the failing test**

Create `src/test/quantize-util.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { snapToGrid } from '../utils/quantize';

describe('snapToGrid', () => {
  const grid = { bpm: 120, anchor: 0 }; // 0.5 s per beat

  it('snaps forward to the nearest beat', () => {
    expect(snapToGrid(grid, 0.26)).toBeCloseTo(0.5, 6);
  });

  it('snaps backward to the nearest beat', () => {
    expect(snapToGrid(grid, 0.24)).toBeCloseTo(0, 6);
  });

  it('respects the anchor offset', () => {
    expect(snapToGrid({ bpm: 120, anchor: 0.1 }, 0.34)).toBeCloseTo(0.1, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/quantize-util.test.ts`
Expected: FAIL — cannot find module `../utils/quantize`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/quantize.ts`:

```ts
/**
 * quantize.ts — Snap a time to the beat grid (QUANTIZE). Pure; wraps beatGrid math.
 */
import { type BeatGrid, nearestBeat } from './beatGrid';

/** Snap a time (seconds) to the nearest beat on the grid. */
export function snapToGrid(grid: BeatGrid, t: number): number {
  return nearestBeat(grid, t);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/quantize-util.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/quantize.ts src/test/quantize-util.test.ts
git commit -m "feat: snapToGrid util (QUANTIZE)"
```

---

## Task 10: deckStore `quantize` + `shift` state + actions

**Files:**
- Modify: `src/types/deck.ts`
- Modify: `src/store/deckStore.ts`
- Test: `src/test/deck-modifiers.test.ts`

**Interfaces:**
- Produces: `DeckState.quantize: boolean` (default `true`), `DeckState.shift: boolean` (default `false`); `setQuantize(deckId, on)`, `setShift(deckId, on)`; both on `useDeckActions`.

- [ ] **Step 1: Write the failing test**

Create `src/test/deck-modifiers.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useDeckStore } from '../store/deckStore';

describe('deck modifiers (quantize + shift)', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('quantize defaults to true', () => {
    expect(useDeckStore.getState().decks.A.quantize).toBe(true);
  });

  it('shift defaults to false', () => {
    expect(useDeckStore.getState().decks.A.shift).toBe(false);
  });

  it('setQuantize toggles the flag', () => {
    useDeckStore.getState().setQuantize('A', false);
    expect(useDeckStore.getState().decks.A.quantize).toBe(false);
  });

  it('setShift toggles the flag', () => {
    useDeckStore.getState().setShift('A', true);
    expect(useDeckStore.getState().decks.A.shift).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/deck-modifiers.test.ts`
Expected: FAIL — `quantize`/`shift` undefined; setters missing.

- [ ] **Step 3: Implement state + actions**

In `src/types/deck.ts`, add to `DeckState` (after `gainDb`):

```ts
  /** QUANTIZE: when true, snap hot-cue set and manual loop IN to the beat grid. */
  quantize: boolean;

  /** SHIFT modifier: alters certain button actions while active. */
  shift: boolean;
```

In `src/store/deckStore.ts` `createInitialDeckState`, add after `gainDb: 0,`:

```ts
    quantize: true,
    shift: false,
```

Add the action types (after `setGain`):

```ts
  /** Toggle QUANTIZE for the specified deck. */
  setQuantize: (deckId: 'A' | 'B', on: boolean) => void;

  /** Toggle the SHIFT modifier for the specified deck. */
  setShift: (deckId: 'A' | 'B', on: boolean) => void;
```

Add the implementations (after `setGain`):

```ts
  setQuantize: (deckId, on) => {
    updateDeck(set, deckId, { quantize: on });
  },

  setShift: (deckId, on) => {
    updateDeck(set, deckId, { shift: on });
  },
```

Add both to `useDeckActions`:

```ts
      setQuantize: s.setQuantize, setShift: s.setShift,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/deck-modifiers.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/types/deck.ts src/store/deckStore.ts src/test/deck-modifiers.test.ts
git commit -m "feat: per-deck quantize + shift state"
```

---

## Task 11: `DeckModifiers` component + SHIFT+Restart→cue wiring

**Files:**
- Create: `src/components/Deck/DeckModifiers.tsx`
- Create: `src/components/Deck/DeckModifiers.module.css`
- Modify: `src/components/Deck/Deck.tsx`
- Modify: `src/components/Deck/DeckControls.tsx`
- Test: `src/test/DeckModifiers.test.tsx`

**Interfaces:**
- Consumes: `useDeck`, `useDeckActions().setShift/.setQuantize`.
- Produces: `<DeckModifiers deckId />` — a short row with compact `SHIFT` and `Q` toggle buttons. DeckControls' Restart jumps to `cuePoint` when the deck's `shift` is active.

- [ ] **Step 1: Write the failing test**

Create `src/test/DeckModifiers.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DeckModifiers } from '../components/Deck/DeckModifiers';
import { useDeckStore } from '../store/deckStore';

describe('DeckModifiers', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('SHIFT button toggles shift state and reflects aria-pressed', () => {
    render(<DeckModifiers deckId="A" />);
    const shift = screen.getByRole('button', { name: /shift/i });
    expect(shift).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(shift);
    expect(useDeckStore.getState().decks.A.shift).toBe(true);
    expect(shift).toHaveAttribute('aria-pressed', 'true');
  });

  it('Q button toggles quantize (default on)', () => {
    render(<DeckModifiers deckId="A" />);
    const q = screen.getByRole('button', { name: /quantize/i });
    expect(q).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(q);
    expect(useDeckStore.getState().decks.A.quantize).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/DeckModifiers.test.tsx`
Expected: FAIL — cannot find module `DeckModifiers`.

- [ ] **Step 3: Implement component, styles, wiring**

Create `src/components/Deck/DeckModifiers.tsx`:

```tsx
/**
 * DeckModifiers.tsx — Compact SHIFT + QUANTIZE toggle row for a deck.
 * Rendered under the transport. Buttons are small and clearly button-shaped
 * (fixed width, bordered, lit when active) — never a full-width bar.
 */
import { useDeck, useDeckActions } from '../../store/deckStore';
import styles from './DeckModifiers.module.css';

interface DeckModifiersProps {
  deckId: 'A' | 'B';
}

export function DeckModifiers({ deckId }: DeckModifiersProps) {
  const shift = useDeck(deckId).shift;
  const quantize = useDeck(deckId).quantize;
  const { setShift, setQuantize } = useDeckActions();

  return (
    <div className={styles.row}>
      <button
        type="button"
        className={`${styles.modBtn} ${shift ? styles.modBtnActive : ''}`}
        aria-label={`Shift modifier for Deck ${deckId}`}
        aria-pressed={shift}
        title="SHIFT — hold-alternative for secondary functions"
        onClick={() => setShift(deckId, !shift)}
      >
        SHIFT
      </button>
      <button
        type="button"
        className={`${styles.modBtn} ${quantize ? styles.modBtnActive : ''}`}
        aria-label={`Quantize for Deck ${deckId}`}
        aria-pressed={quantize}
        title="QUANTIZE — snap cues & loops to the beat grid"
        onClick={() => setQuantize(deckId, !quantize)}
      >
        Q
      </button>
    </div>
  );
}

export default DeckModifiers;
```

Create `src/components/Deck/DeckModifiers.module.css`:

```css
.row {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  justify-content: flex-start;
}

.modBtn {
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

.modBtn:hover {
  color: var(--color-text-primary);
}

.modBtn:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}

.modBtnActive {
  color: var(--color-text-inverse);
  background: var(--color-accent-primary);
  border-color: var(--color-accent-primary-bright);
  box-shadow: var(--shadow-button-active);
}
```

In `src/components/Deck/Deck.tsx`, add the import:

```tsx
import { DeckModifiers } from './DeckModifiers';
```

Render it immediately after `<DeckControls deckId={deckId} />`:

```tsx
      {/* Transport controls */}
      <DeckControls deckId={deckId} />

      {/* SHIFT + QUANTIZE modifier row */}
      <DeckModifiers deckId={deckId} />
```

In `src/components/Deck/DeckControls.tsx`, make Restart honor SHIFT (jump to cue). Replace `handleRestart`:

```tsx
  function handleRestart() {
    if (!playerReady || !hasTrack) return;
    const player = getActivePlayer(deckId);
    if (!player) return;
    const deck = useDeckStore.getState().decks[deckId];
    const target = deck.shift && deck.cuePoint !== null ? deck.cuePoint : 0;
    player.seekTo(target, true);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/DeckModifiers.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Deck/DeckModifiers.tsx src/components/Deck/DeckModifiers.module.css src/components/Deck/Deck.tsx src/components/Deck/DeckControls.tsx src/test/DeckModifiers.test.tsx
git commit -m "feat: SHIFT + QUANTIZE modifier row (compact buttons) + shift restart-to-cue"
```

---

## Task 12: Apply QUANTIZE to hot-cue SET

**Files:**
- Modify: `src/components/Deck/HotCues.tsx`
- Test: `src/test/hotcues-quantize.test.tsx`

**Interfaces:**
- Consumes: `snapToGrid` (Task 9), deck `quantize`/`bpm`/`anchor`.
- Produces: when `quantize` is on and a grid exists, a hot cue is SET at the nearest beat rather than the raw playhead. (Jump-quantize is deferred to Phase 2, which adds beat-scheduled triggering.)

- [ ] **Step 1: Write the failing test**

Create `src/test/hotcues-quantize.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HotCues } from '../components/Deck/HotCues';
import { useDeckStore } from '../store/deckStore';

describe('hot cue quantize', () => {
  beforeEach(() => {
    localStorage.clear();
    useDeckStore.getState().clearTrack('A');
  });

  it('snaps the SET position to the nearest beat when quantize is on', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'trk', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setGrid('A', 120, 0);      // 0.5 s/beat
    s.setQuantize('A', true);
    s.setCurrentTime('A', 1.26); // nearest beat = 1.5
    render(<HotCues deckId="A" />);
    // Shift+click sets a hot cue at index 0 (button label "1")
    fireEvent.click(screen.getByRole('button', { name: /hot cue 1/i }), { shiftKey: true });
    expect(useDeckStore.getState().decks.A.hotCues[0]).toBeCloseTo(1.5, 6);
  });

  it('uses the raw position when quantize is off', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'trk', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setGrid('A', 120, 0);
    s.setQuantize('A', false);
    s.setCurrentTime('A', 1.26);
    render(<HotCues deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /hot cue 1/i }), { shiftKey: true });
    expect(useDeckStore.getState().decks.A.hotCues[0]).toBeCloseTo(1.26, 6);
  });
});
```

> Note: `HotCueButton` sets a cue on Shift+click. Confirm the accessible name matches `/hot cue 1/i`; if the empty-cue label differs, use the button's actual label (index "1").

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/hotcues-quantize.test.tsx`
Expected: FAIL — cue stored at `1.26` even with quantize on.

- [ ] **Step 3: Implement quantized SET**

In `src/components/Deck/HotCues.tsx`, add the import:

```tsx
import { snapToGrid } from '../../utils/quantize';
```

Replace `handleSet`:

```tsx
  function handleSet(index: number) {
    if (!trackId) return;
    const deck = useDeckStore.getState().decks[deckId];
    let t = deck.currentTime;
    if (deck.quantize && deck.bpm && deck.anchor !== null) {
      t = snapToGrid({ bpm: deck.bpm, anchor: deck.anchor }, t);
    }
    persistSetHotCue(trackId, index, t);
    setHotCue(deckId, index, t);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/hotcues-quantize.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Deck/HotCues.tsx src/test/hotcues-quantize.test.tsx
git commit -m "feat: quantize hot-cue SET to the beat grid"
```

---

## Task 13: Manual loop store actions (IN / OUT / RELOOP)

**Files:**
- Modify: `src/types/deck.ts`
- Modify: `src/store/deckStore.ts`
- Test: `src/test/manual-loop.test.ts`

**Interfaces:**
- Consumes: `snapToGrid`, `getActivePlayer(deckId).setLoop/.clearLoop/.getCurrentTime`.
- Produces: `DeckState.manualLoopIn: number | null`, `DeckState.lastManualLoop: { start: number; end: number } | null`; actions `setLoopIn(deckId)`, `setLoopOut(deckId)`, `reloop(deckId)`; all on `useDeckActions`.

- [ ] **Step 1: Write the failing test**

Create `src/test/manual-loop.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';

function mockEngine() {
  return { seekTo: vi.fn(), getCurrentTime: () => NaN, getDuration: () => 180, setLoop: vi.fn(), clearLoop: vi.fn(), isLooping: () => false };
}

describe('manual loop IN/OUT/RELOOP', () => {
  beforeEach(() => { useDeckStore.getState().clearTrack('A'); playerRegistry.unregister('A'); });

  it('IN then OUT arms a manual loop (no grid, quantize skipped)', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setCurrentTime('A', 1.0);
    s.setLoopIn('A');
    expect(useDeckStore.getState().decks.A.manualLoopIn).toBeCloseTo(1.0, 6);
    s.setCurrentTime('A', 2.0);
    s.setLoopOut('A');
    const d = useDeckStore.getState().decks.A;
    expect(d.loopActive).toBe(true);
    expect(d.loopStart).toBeCloseTo(1.0, 6);
    expect(d.loopEnd).toBeCloseTo(2.0, 6);
    expect(d.loopBeatCount).toBeNull();
    expect(d.lastManualLoop).toEqual({ start: 1.0, end: 2.0 });
  });

  it('OUT with no IN is a no-op', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setCurrentTime('A', 2.0);
    s.setLoopOut('A');
    expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
  });

  it('OUT before IN position is ignored', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setCurrentTime('A', 2.0); s.setLoopIn('A');
    s.setCurrentTime('A', 1.0); s.setLoopOut('A');
    expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
  });

  it('RELOOP re-arms the last manual loop after EXIT, and toggles off', () => {
    const eng = mockEngine();
    playerRegistry.register('A', eng as never);
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setCurrentTime('A', 1.0); s.setLoopIn('A');
    s.setCurrentTime('A', 2.0); s.setLoopOut('A');
    s.deactivateLoop('A');
    expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
    s.reloop('A');
    let d = useDeckStore.getState().decks.A;
    expect(d.loopActive).toBe(true);
    expect(eng.setLoop).toHaveBeenCalledWith(1.0, 2.0);
    s.reloop('A'); // toggle off
    expect(useDeckStore.getState().decks.A.loopActive).toBe(false);
  });
});
```

> Note: `mockEngine().getCurrentTime` returns `NaN` so the store falls back to `deck.currentTime` (see the `Number.isFinite` guard in the implementation).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/manual-loop.test.ts`
Expected: FAIL — `setLoopIn` / `setLoopOut` / `reloop` not functions.

- [ ] **Step 3: Implement state + actions**

In `src/types/deck.ts`, add to `DeckState` (after the `loopBeatCount` field):

```ts
  /** Pending manual loop in-point (seconds), or null. Set by the IN button. */
  manualLoopIn: number | null;

  /** The most recent manual loop, remembered so RELOOP works after EXIT. */
  lastManualLoop: { start: number; end: number } | null;
```

In `src/store/deckStore.ts` `createInitialDeckState`, add after `loopBeatCount: null,`:

```ts
    manualLoopIn: null,
    lastManualLoop: null,
```

In `clearTrack`, add the same two resets (after `loopBeatCount: null,`):

```ts
      manualLoopIn: null,
      lastManualLoop: null,
```

Add a small helper above the store (near the other imports/helpers) to read the live position with a grid-snap:

```ts
/** Live playhead for a deck, snapped to the grid when quantize is on. */
function quantizedNow(deck: DeckState): number {
  const raw = getActivePlayer(deck.deckId)?.getCurrentTime();
  const pos = raw !== undefined && Number.isFinite(raw) ? raw : deck.currentTime;
  if (deck.quantize && deck.bpm && deck.anchor !== null) {
    return snapToGrid({ bpm: deck.bpm, anchor: deck.anchor }, pos);
  }
  return pos;
}
```

Add the import for `snapToGrid` at the top of `deckStore.ts`:

```ts
import { snapToGrid } from '../utils/quantize';
```

Add the action types (after the `deactivateLoop` type):

```ts
  /** Set the manual loop in-point at the (quantized) playhead. */
  setLoopIn: (deckId: 'A' | 'B') => void;

  /** Set the manual loop out-point and arm the loop. No-op without a valid in-point. */
  setLoopOut: (deckId: 'A' | 'B') => void;

  /** Re-arm the last manual loop (toggles it on/off). No-op if none was set. */
  reloop: (deckId: 'A' | 'B') => void;
```

Add the implementations (after `deactivateLoop`):

```ts
  setLoopIn: (deckId) => {
    const deck = get().decks[deckId];
    updateDeck(set, deckId, { manualLoopIn: quantizedNow(deck) });
  },

  setLoopOut: (deckId) => {
    const deck = get().decks[deckId];
    if (deck.manualLoopIn === null) return;
    const end = quantizedNow(deck);
    if (end <= deck.manualLoopIn) return;
    getActivePlayer(deckId)?.setLoop?.(deck.manualLoopIn, end);
    updateDeck(set, deckId, {
      loopActive: true,
      loopStart: deck.manualLoopIn,
      loopEnd: end,
      loopBeatCount: null,
      lastManualLoop: { start: deck.manualLoopIn, end },
    });
  },

  reloop: (deckId) => {
    const deck = get().decks[deckId];
    const lm = deck.lastManualLoop;
    if (!lm) return;
    if (deck.loopActive) {
      get().deactivateLoop(deckId);
      return;
    }
    getActivePlayer(deckId)?.setLoop?.(lm.start, lm.end);
    getActivePlayer(deckId)?.seekTo(lm.start, true);
    updateDeck(set, deckId, {
      loopActive: true,
      loopStart: lm.start,
      loopEnd: lm.end,
      loopBeatCount: null,
    });
  },
```

Add all three to `useDeckActions` (in the loop group):

```ts
      setLoopIn: s.setLoopIn, setLoopOut: s.setLoopOut, reloop: s.reloop,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/manual-loop.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/types/deck.ts src/store/deckStore.ts src/test/manual-loop.test.ts
git commit -m "feat: manual loop IN/OUT/RELOOP store actions"
```

---

## Task 14: IN / OUT / RELOOP buttons in `LoopControls`

**Files:**
- Modify: `src/components/Deck/LoopControls.tsx`
- Test: `src/test/loopcontrols-manual.test.tsx`

**Interfaces:**
- Consumes: `setLoopIn`, `setLoopOut`, `reloop`, `manualLoopIn`, `lastManualLoop`.
- Produces: `IN`, `OUT`, `RELOOP` buttons in the loop panel.

- [ ] **Step 1: Write the failing test**

Create `src/test/loopcontrols-manual.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoopControls } from '../components/Deck/LoopControls';
import { useDeckStore } from '../store/deckStore';

describe('LoopControls manual loop buttons', () => {
  beforeEach(() => useDeckStore.getState().clearTrack('A'));

  it('IN then OUT activates a manual loop', () => {
    const s = useDeckStore.getState();
    s.loadTrack('A', 'x', { title: '', artist: '', duration: 180, thumbnailUrl: null });
    s.setCurrentTime('A', 1.0);
    render(<LoopControls deckId="A" />);
    fireEvent.click(screen.getByRole('button', { name: /set loop in/i }));
    useDeckStore.getState().setCurrentTime('A', 2.0);
    fireEvent.click(screen.getByRole('button', { name: /set loop out/i }));
    const d = useDeckStore.getState().decks.A;
    expect(d.loopActive).toBe(true);
    expect(d.loopStart).toBeCloseTo(1.0, 6);
    expect(d.loopEnd).toBeCloseTo(2.0, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/loopcontrols-manual.test.tsx`
Expected: FAIL — no "set loop in" button.

- [ ] **Step 3: Implement the buttons**

In `src/components/Deck/LoopControls.tsx`, extend the actions destructure:

```tsx
  const { activateLoopBeat, deactivateLoop, setRollMode, startRoll, endRoll, setLoopIn, setLoopOut, reloop } = useDeckActions();
```

Read the manual-loop state near the other selectors:

```tsx
  const manualLoopIn = useDeckStore((s) => s.decks[deckId].manualLoopIn);
  const lastManualLoop = useDeckStore((s) => s.decks[deckId].lastManualLoop);
```

Add IN / OUT buttons at the very start of the `.buttons` container (before the beat-count map):

```tsx
        {/* Manual loop in/out */}
        <button
          type="button"
          className={[styles.loopBtn, manualLoopIn !== null ? styles.loopBtnActive : ''].filter(Boolean).join(' ')}
          onClick={() => setLoopIn(deckId)}
          aria-label={`Set loop in on Deck ${deckId}`}
          title="Set loop in-point"
        >
          IN
        </button>
        <button
          type="button"
          className={styles.loopBtn}
          onClick={() => setLoopOut(deckId)}
          aria-label={`Set loop out on Deck ${deckId}`}
          title="Set loop out-point and start looping"
        >
          OUT
        </button>
```

Add a RELOOP button right before the existing EXIT button:

```tsx
        {/* RELOOP — re-arm the last manual loop */}
        <button
          type="button"
          className={[styles.loopBtn, !lastManualLoop ? styles.loopBtnDisabled : ''].filter(Boolean).join(' ')}
          onClick={() => reloop(deckId)}
          disabled={!lastManualLoop}
          aria-label={`Reloop on Deck ${deckId}`}
          title="Re-arm the last manual loop"
        >
          RELOOP
        </button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/loopcontrols-manual.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/Deck/LoopControls.tsx src/test/loopcontrols-manual.test.tsx
git commit -m "feat: manual loop IN/OUT/RELOOP buttons in LoopControls"
```

---

## Task 15: `beatmatchReadout` util

**Files:**
- Create: `src/utils/beatmatch.ts`
- Test: `src/test/beatmatch-util.test.ts`

**Interfaces:**
- Produces: `DeckBeatState`, `BeatmatchReadout` types; `beatmatchReadout(a, b): BeatmatchReadout` where `hasGrids` is false unless both decks have `bpm` and `anchor`; `tempoDeltaBpm = bEff - aEff`; `phaseOffset ∈ [-0.5, 0.5)` beats.

- [ ] **Step 1: Write the failing test**

Create `src/test/beatmatch-util.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { beatmatchReadout, type DeckBeatState } from '../utils/beatmatch';

const base: DeckBeatState = { bpm: 120, pitchRate: 1, anchor: 0, currentTime: 0 };

describe('beatmatchReadout', () => {
  it('reports hasGrids=false when a deck lacks a grid', () => {
    const r = beatmatchReadout({ ...base, bpm: null }, base);
    expect(r.hasGrids).toBe(false);
  });

  it('matched decks have zero tempo delta and zero phase offset', () => {
    const r = beatmatchReadout(base, base);
    expect(r.hasGrids).toBe(true);
    expect(r.tempoDeltaBpm).toBeCloseTo(0, 6);
    expect(r.phaseOffset).toBeCloseTo(0, 6);
  });

  it('tempo delta uses effective bpm (bpm * pitchRate)', () => {
    const r = beatmatchReadout(base, { ...base, pitchRate: 1.05 });
    expect(r.tempoDeltaBpm).toBeCloseTo(6, 6); // 126 - 120
  });

  it('phase offset reflects downbeat drift', () => {
    // B is 0.125 s ahead at 120 bpm (0.5 s/beat) → quarter-beat = 0.25
    const r = beatmatchReadout(base, { ...base, currentTime: 0.125 });
    expect(r.phaseOffset).toBeCloseTo(0.25, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/beatmatch-util.test.ts`
Expected: FAIL — cannot find module `../utils/beatmatch`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/beatmatch.ts`:

```ts
/**
 * beatmatch.ts — Pure tempo/phase readout for the beatmatch guide.
 * No React/DOM/store imports.
 */
import { type BeatGrid, phase } from './beatGrid';

export interface DeckBeatState {
  bpm: number | null;
  pitchRate: number;
  anchor: number | null;
  currentTime: number;
}

export interface BeatmatchReadout {
  /** True only when both decks have a bpm and an anchor. */
  hasGrids: boolean;
  /** Effective-tempo difference (B minus A), in BPM. */
  tempoDeltaBpm: number;
  /** Downbeat phase offset in beats, wrapped to [-0.5, 0.5). */
  phaseOffset: number;
}

/** Compute tempo + phase alignment between two decks. */
export function beatmatchReadout(a: DeckBeatState, b: DeckBeatState): BeatmatchReadout {
  if (!a.bpm || !b.bpm || a.anchor === null || b.anchor === null) {
    return { hasGrids: false, tempoDeltaBpm: 0, phaseOffset: 0 };
  }
  const aEff = a.bpm * a.pitchRate;
  const bEff = b.bpm * b.pitchRate;
  const aGrid: BeatGrid = { bpm: aEff, anchor: a.anchor };
  const bGrid: BeatGrid = { bpm: bEff, anchor: b.anchor };
  const raw = phase(bGrid, b.currentTime) - phase(aGrid, a.currentTime);
  const phaseOffset = ((raw + 0.5) % 1 + 1) % 1 - 0.5; // wrap to [-0.5, 0.5)
  return { hasGrids: true, tempoDeltaBpm: bEff - aEff, phaseOffset };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/beatmatch-util.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/beatmatch.ts src/test/beatmatch-util.test.ts
git commit -m "feat: beatmatchReadout util (tempo + phase alignment)"
```

---

## Task 16: `BeatmatchGuide` component + Mixer placement

**Files:**
- Create: `src/components/Mixer/BeatmatchGuide.tsx`
- Create: `src/components/Mixer/BeatmatchGuide.module.css`
- Modify: `src/components/Mixer/Mixer.tsx`
- Test: `src/test/BeatmatchGuide.test.tsx`

**Interfaces:**
- Consumes: `beatmatchReadout` (Task 15); reads both decks' `bpm/pitchRate/anchor/currentTime`.
- Produces: `<BeatmatchGuide />` — a read-only tempo bar + phase marker in the center mixer.

- [ ] **Step 1: Write the failing test**

Create `src/test/BeatmatchGuide.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BeatmatchGuide } from '../components/Mixer/BeatmatchGuide';
import { useDeckStore } from '../store/deckStore';

describe('BeatmatchGuide', () => {
  beforeEach(() => {
    useDeckStore.getState().clearTrack('A');
    useDeckStore.getState().clearTrack('B');
  });

  it('shows a no-grid state when decks lack grids', () => {
    render(<BeatmatchGuide />);
    expect(screen.getByLabelText(/beatmatch/i).getAttribute('data-has-grids')).toBe('false');
  });

  it('shows an active state when both decks have grids', () => {
    const s = useDeckStore.getState();
    s.setGrid('A', 120, 0);
    s.setGrid('B', 126, 0);
    render(<BeatmatchGuide />);
    expect(screen.getByLabelText(/beatmatch/i).getAttribute('data-has-grids')).toBe('true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/BeatmatchGuide.test.tsx`
Expected: FAIL — cannot find module `BeatmatchGuide`.

- [ ] **Step 3: Implement the component + styles + placement**

Create `src/components/Mixer/BeatmatchGuide.tsx`:

```tsx
/**
 * BeatmatchGuide.tsx — Read-only tempo + phase alignment indicator between decks.
 * Mirrors the controller's beatmatch LED ladder. Purely visual; no audio.
 */
import { useShallow } from 'zustand/react/shallow';
import { useDeckStore } from '../../store/deckStore';
import { beatmatchReadout, type DeckBeatState } from '../../utils/beatmatch';
import styles from './BeatmatchGuide.module.css';

function pick(d: {
  bpm: number | null; pitchRate: number; anchor: number | null; currentTime: number;
}): DeckBeatState {
  return { bpm: d.bpm, pitchRate: d.pitchRate, anchor: d.anchor, currentTime: d.currentTime };
}

export function BeatmatchGuide() {
  const readout = useDeckStore(
    useShallow((s) => beatmatchReadout(pick(s.decks.A), pick(s.decks.B))),
  );

  // Tempo marker: clamp ±8 BPM to the bar half-width.
  const tempoPct = Math.max(-1, Math.min(1, readout.tempoDeltaBpm / 8)) * 50 + 50;
  // Phase marker: phaseOffset is [-0.5, 0.5) → map to 0..100%.
  const phasePct = (readout.phaseOffset + 0.5) * 100;

  return (
    <div
      className={styles.guide}
      aria-label="Beatmatch guide"
      data-has-grids={readout.hasGrids ? 'true' : 'false'}
    >
      <div className={styles.label}>BEATMATCH</div>
      {readout.hasGrids ? (
        <>
          <div className={styles.track} aria-hidden="true">
            <span className={styles.center} />
            <span className={styles.marker} style={{ left: `${tempoPct}%` }} />
          </div>
          <div className={styles.track} aria-hidden="true">
            <span className={styles.center} />
            <span className={styles.markerPhase} style={{ left: `${phasePct}%` }} />
          </div>
        </>
      ) : (
        <div className={styles.idle}>no grid</div>
      )}
    </div>
  );
}

export default BeatmatchGuide;
```

Create `src/components/Mixer/BeatmatchGuide.module.css`:

```css
.guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  width: 100%;
}

.label {
  font-size: var(--text-xs);
  color: var(--color-text-disabled);
  letter-spacing: var(--tracking-widest);
  text-transform: uppercase;
}

.track {
  position: relative;
  width: 100%;
  height: 8px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-sm);
}

.center {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--color-border-strong);
  transform: translateX(-50%);
}

.marker,
.markerPhase {
  position: absolute;
  top: -1px;
  width: 4px;
  height: 8px;
  border-radius: 1px;
  transform: translateX(-50%);
  transition: left var(--transition-fast);
}

.marker { background: var(--color-state-success); }
.markerPhase { background: var(--color-accent-primary); }

.idle {
  font-size: var(--text-xs);
  color: var(--color-text-disabled);
  font-family: var(--font-mono);
}
```

In `src/components/Mixer/Mixer.tsx`, import and place the guide between the Levels section and the Crossfader section:

```tsx
import { BeatmatchGuide } from './BeatmatchGuide';
```

```tsx
      {/* Beatmatch guide — tempo + phase alignment between decks */}
      <section className={styles.section} aria-label="Beatmatch">
        <BeatmatchGuide />
      </section>

      {/* Crossfader */}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/BeatmatchGuide.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Mixer/BeatmatchGuide.tsx src/components/Mixer/BeatmatchGuide.module.css src/components/Mixer/Mixer.tsx src/test/BeatmatchGuide.test.tsx
git commit -m "feat: beatmatch guide (tempo + phase) in the mixer strip"
```

---

## Task 17: Full-suite verification (build + lint + all tests)

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npm run test`
Expected: PASS — all suites green, including the pre-existing ones (the `audioEngine.test.ts` mock changes and `setEffect` default keep old tests passing).

- [ ] **Step 2: Type-check + build**

Run: `npm run build`
Expected: `tsc -b` reports no errors; `vite build` completes. (Watch for `exactOptionalPropertyTypes` / `noUncheckedIndexedAccess` errors introduced by the new fields — fix any inline.)

- [ ] **Step 3: Lint (zero warnings)**

Run: `npm run lint`
Expected: exits 0 with no warnings. Common fixes: remove unused imports, ensure every new `useEffect`/callback dep list is correct.

- [ ] **Step 4: Manual smoke test (optional but recommended)**

Run: `npm run dev`, import an audio file, and verify: GAIN knobs affect loudness; FX BEAT changes echo timing; toggling Q/SHIFT lights the buttons; SHIFT+Restart jumps to the cue; IN/OUT/RELOOP loops; the beatmatch guide moves when both decks have grids and play.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "chore: Phase 1 build/lint/test verification fixes"
```

---

## Self-Review (author checklist — completed)

**Spec coverage** (each Phase 1 spec item → task):
- GAIN/TRIM (spec §4.1) → Tasks 1–4.
- FX BEAT/TIME (§4.2) → Tasks 5–8.
- QUANTIZE (§4.3) → Tasks 9, 10, 12 (applied to hot-cue SET + manual loop IN; jump-quantize deferred to Phase 2 — noted in Task 12).
- SHIFT (§4.4) → Tasks 10, 11 (compact-button visual requirement satisfied by `DeckModifiers.module.css` fixed-width buttons; Phase-1 behavior = SHIFT+Restart→cue; physical-key binding + remaining behaviors deferred to Phase 2 to avoid clashing with the hot-cue Shift+click already in use — deliberate scope note).
- Manual loop IN/OUT/RELOOP (§4.5) → Tasks 13, 14.
- Beatmatch guide (§4.6) → Tasks 15, 16.
- Data-model summary (§4.7) → fields/actions added across Tasks 3, 7, 10, 13.
- Testing & tooling (§4.8) → per-task unit tests + Task 17 build/lint/test gate.

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `setGain`, `setEffectBeat`, `setQuantize`, `setShift`, `setLoopIn`, `setLoopOut`, `reloop`, `gainDb`, `effectBeat`, `quantize`, `shift`, `manualLoopIn`, `lastManualLoop`, `dbToLinear`, `fxBeatMultiplier`, `snapToGrid`, `beatmatchReadout`, `DeckBeatState`, `BeatmatchReadout` are used identically across tasks and match their defining tasks.

**Deliberate deviations from spec (documented):** (1) quantize applied to hot-cue SET + manual loop IN only, not hot-cue JUMP (needs beat-scheduled triggering → Phase 2); (2) SHIFT Phase-1 behavior limited to Restart→cue with the physical Shift key deferred, to avoid conflicting with the existing hot-cue Shift+click.
