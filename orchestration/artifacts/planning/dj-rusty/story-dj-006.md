# STORY-DJ-006: Crossfader Curve Selector & Master Volume Knob

## Status: PLANNED
## Complexity: Medium
## Dependencies: None (all prerequisite infrastructure exists)

---

## Objective

Add a crossfader curve selector (Smooth / Linear / Sharp) to the Mixer panel and expose the existing master volume (from `settingsStore`) as a rotary knob in the Mixer panel. The curve selector changes how the crossfader maps position to per-deck volumes. The master volume knob provides direct access to the already-implemented `settingsStore.masterVolume` scalar without opening the Settings Modal.

---

## Pre-Implementation Analysis

### Existing Infrastructure

| Component | Location | Status |
|---|---|---|
| `crossfaderToVolumes()` | `src/utils/volumeMap.ts` | Exists -- implements Smooth (cosine) curve only |
| `compositeVolume()` | `src/utils/volumeMap.ts` | Exists -- unchanged |
| `MixerState` interface | `src/types/mixer.ts` | Exists -- needs `crossfaderCurve` field |
| `mixerStore` | `src/store/mixerStore.ts` | Exists -- calls `crossfaderToVolumes()` without curve param |
| `settingsStore.masterVolume` | `src/store/settingsStore.ts` | **Already implemented (STORY-013)** with localStorage persistence |
| `settingsStore.setMasterVolume()` | `src/store/settingsStore.ts` | **Already implemented** |
| Master volume wiring in `applyVolumesToDecks` | `src/store/mixerStore.ts:46-47` | **Already implemented** -- reads `settingsStore.masterVolume` |
| `RotaryKnob` component | `src/components/common/RotaryKnob.tsx` | Exists -- stub with visual rotation, no drag/scroll interaction |
| `Crossfader` component | `src/components/Mixer/Crossfader.tsx` | Exists -- horizontal slider |
| `Mixer` component | `src/components/Mixer/Mixer.tsx` | Exists -- layout container |
| Volume map tests | `src/test/volume-map.test.ts` | Exists -- covers smooth curve only |

### Key Discovery

**Master volume state and computation already exist.** STORY-013 implemented `settingsStore.masterVolume` and `mixerStore.applyVolumesToDecks` already multiplies by `masterVolume / 100` (line 47-49 of `mixerStore.ts`). This story only needs to add a **UI knob** in the Mixer panel that reads/writes `settingsStore.masterVolume`. No new store state or computation logic is needed for master volume.

---

## Task Breakdown

### Task 1: Add `CrossfaderCurve` type and multi-curve `crossfaderToVolumes`

**Sizing:** Small
**Complexity:** Low
**Dependencies:** None
**Files to modify:** `src/utils/volumeMap.ts`, `src/types/mixer.ts`

#### Description

Define the `CrossfaderCurve` union type and extend `crossfaderToVolumes` to accept an optional `curve` parameter (defaulting to `'smooth'`), preserving backward compatibility with all existing callers.

#### Implementation Steps

1. **In `src/types/mixer.ts`:**
   - Add the exported type: `export type CrossfaderCurve = 'smooth' | 'linear' | 'sharp';`
   - Add `crossfaderCurve: CrossfaderCurve;` field to `MixerState` interface

2. **In `src/utils/volumeMap.ts`:**
   - Import `CrossfaderCurve` from `../types/mixer`
   - Change the signature of `crossfaderToVolumes` to:
     ```ts
     export function crossfaderToVolumes(
       position: number,
       curve: CrossfaderCurve = 'smooth',
     ): { a: number; b: number }
     ```
   - Extract the existing cosine body into the `'smooth'` case of a switch statement
   - Add `'linear'` case:
     ```ts
     case 'linear': {
       const a = Math.round((1 - pos) * 100);
       const b = Math.round(pos * 100);
       return { a: clamp(a, 0, 100), b: clamp(b, 0, 100) };
     }
     ```
   - Add `'sharp'` case:
     ```ts
     case 'sharp': {
       const a = pos < 0.5 ? 100 : Math.max(0, Math.round(100 * (1 - (pos - 0.5) * 2)));
       const b = pos > 0.5 ? 100 : Math.max(0, Math.round(100 * (pos * 2)));
       return { a: clamp(a, 0, 100), b: clamp(b, 0, 100) };
     }
     ```
   - The default parameter `= 'smooth'` ensures all existing call sites (which pass no curve argument) continue to work identically

#### Acceptance Criteria

- [ ] `CrossfaderCurve` type exported from `src/types/mixer.ts`
- [ ] `crossfaderCurve` field added to `MixerState` interface
- [ ] `crossfaderToVolumes(pos)` with no second argument returns identical results to the current implementation (backward compatible)
- [ ] `crossfaderToVolumes(pos, 'smooth')` matches current cosine curve
- [ ] `crossfaderToVolumes(0.5, 'linear')` returns `{ a: 50, b: 50 }`
- [ ] `crossfaderToVolumes(0.0, 'linear')` returns `{ a: 100, b: 0 }`
- [ ] `crossfaderToVolumes(1.0, 'linear')` returns `{ a: 0, b: 100 }`
- [ ] `crossfaderToVolumes(0.5, 'sharp')` returns `{ a: 100, b: 100 }`
- [ ] `crossfaderToVolumes(1.0, 'sharp')` returns `{ a: 0, b: 100 }`
- [ ] `crossfaderToVolumes(0.0, 'sharp')` returns `{ a: 100, b: 0 }`
- [ ] All return values are integers in range [0, 100]

---

### Task 2: Wire crossfader curve into `mixerStore`

**Sizing:** Small
**Complexity:** Low
**Dependencies:** Task 1
**Files to modify:** `src/store/mixerStore.ts`

#### Description

Add `crossfaderCurve` state to the mixer store and pass it to `crossfaderToVolumes` in the `applyVolumesToDecks` helper. Add a `setCrossfaderCurve` action.

#### Implementation Steps

1. **In `src/store/mixerStore.ts`:**
   - Import `CrossfaderCurve` from `../types/mixer`
   - Add to `MixerStoreActions` interface:
     ```ts
     setCrossfaderCurve: (curve: CrossfaderCurve) => void;
     ```
   - Add to `INITIAL_STATE`:
     ```ts
     crossfaderCurve: 'smooth' as CrossfaderCurve,
     ```
   - Modify `applyVolumesToDecks` to accept a `curve: CrossfaderCurve` parameter:
     ```ts
     function applyVolumesToDecks(
       crossfaderPosition: number,
       channelFaderA: number,
       channelFaderB: number,
       curve: CrossfaderCurve,
     ): { deckAVolume: number; deckBVolume: number }
     ```
   - Pass `curve` to `crossfaderToVolumes(crossfaderPosition, curve)` on line 45
   - Update all three callers inside the store (`setCrossfaderPosition`, `setChannelFaderA`, `setChannelFaderB`) to pass `get().crossfaderCurve` as the fourth argument to `applyVolumesToDecks`
   - Add `setCrossfaderCurve` action:
     ```ts
     setCrossfaderCurve: (curve) => {
       const { crossfaderPosition, channelFaderA, channelFaderB } = get();
       const { deckAVolume, deckBVolume } = applyVolumesToDecks(
         crossfaderPosition, channelFaderA, channelFaderB, curve,
       );
       set({ crossfaderCurve: curve, deckAVolume, deckBVolume });
     },
     ```
     This recalculates volumes immediately when the curve changes, so switching curves mid-mix takes effect instantly.

#### Acceptance Criteria

- [ ] `mixerStore` initial state includes `crossfaderCurve: 'smooth'`
- [ ] `setCrossfaderCurve('linear')` updates `crossfaderCurve` in state and recalculates deck volumes
- [ ] `setCrossfaderCurve('sharp')` updates `crossfaderCurve` in state and recalculates deck volumes
- [ ] Existing `setCrossfaderPosition`, `setChannelFaderA`, `setChannelFaderB` actions use the current `crossfaderCurve` from state
- [ ] Master volume scaling (already in `applyVolumesToDecks`) continues to work correctly

---

### Task 3: Create `CrossfaderCurveSelector` component

**Sizing:** Small
**Complexity:** Low
**Dependencies:** Task 2
**Files to create:** `src/components/Mixer/CrossfaderCurveSelector.tsx`, `src/components/Mixer/CrossfaderCurveSelector.module.css`

#### Description

A 3-button segmented control that displays the current curve and lets the DJ switch between Smooth, Linear, and Sharp modes.

#### Implementation Steps

1. **Create `src/components/Mixer/CrossfaderCurveSelector.tsx`:**
   - Import `useMixerStore` to read `crossfaderCurve` and `setCrossfaderCurve`
   - Import `CrossfaderCurve` from `../../types/mixer`
   - Define the three options as a constant array:
     ```ts
     const CURVES: { value: CrossfaderCurve; label: string }[] = [
       { value: 'smooth', label: 'S' },
       { value: 'linear', label: 'L' },
       { value: 'sharp', label: 'X' },
     ];
     ```
     Labels are single-character abbreviations to fit the narrow mixer column. Tooltips provide full names.
   - Render a `<div role="radiogroup" aria-label="Crossfader curve">` containing three `<button>` elements
   - Each button:
     - `role="radio"`
     - `aria-checked={curve === currentCurve}`
     - `aria-label` with full name (e.g., "Smooth curve", "Linear curve", "Sharp cut curve")
     - `title` with full name for mouse hover
     - `onClick` calls `setCrossfaderCurve(curve.value)`
     - Active button gets a visually distinct style (e.g., `--color-accent` background)
   - Export as named export `CrossfaderCurveSelector`

2. **Create `src/components/Mixer/CrossfaderCurveSelector.module.css`:**
   - `.curveSelector` -- flexbox row, centered, gap `var(--space-1)`
   - `.curveButton` -- small square button matching mixer aesthetic:
     - Size: `var(--btn-height-sm)` x `var(--btn-height-sm)` (or ~24px x 24px)
     - Background: `var(--color-bg-elevated)`
     - Border: `1px solid var(--color-border-muted)`
     - Border-radius: `var(--radius-sm)`
     - Font: `var(--text-xs)`, `var(--font-primary)`, weight 700
     - Color: `var(--color-text-muted)`
     - Cursor: pointer
   - `.curveButtonActive` -- active state override:
     - Background: `var(--color-accent, #6366f1)` or project accent variable
     - Color: white
     - Border-color: transparent

#### Acceptance Criteria

- [ ] Three buttons rendered labeled S / L / X
- [ ] Active curve button is visually distinct (different background color)
- [ ] Clicking a button calls `setCrossfaderCurve` with the correct curve value
- [ ] Uses `role="radiogroup"` with `role="radio"` and `aria-checked` for accessibility
- [ ] Each button has `aria-label` with full curve name
- [ ] Component matches mixer panel visual style (dark theme, compact)

---

### Task 4: Create `MasterVolumeKnob` component

**Sizing:** Small
**Complexity:** Low
**Dependencies:** None (uses existing `settingsStore`)
**Files to create:** `src/components/Mixer/MasterVolumeKnob.tsx`, `src/components/Mixer/MasterVolumeKnob.module.css`

#### Description

A rotary knob in the Mixer panel that reads/writes `settingsStore.masterVolume`. This is purely a UI affordance -- the state and volume computation already exist from STORY-013.

#### Implementation Steps

1. **Create `src/components/Mixer/MasterVolumeKnob.tsx`:**
   - Import `useSettingsStore` to read `masterVolume` and `setMasterVolume`
   - Import `RotaryKnob` from `../common/RotaryKnob`
   - Render:
     ```tsx
     export function MasterVolumeKnob() {
       const masterVolume = useSettingsStore((s) => s.masterVolume);
       const setMasterVolume = useSettingsStore((s) => s.setMasterVolume);

       return (
         <div className={styles.masterVolumeContainer}>
           <RotaryKnob
             value={masterVolume}
             min={0}
             max={100}
             label="Master volume"
             size={36}
             onChange={setMasterVolume}
           />
           <span className={styles.masterVolumeLabel}>MASTER</span>
           <span className={styles.masterVolumeValue}>{masterVolume}</span>
         </div>
       );
     }
     ```
   - Export as named export `MasterVolumeKnob`

2. **Create `src/components/Mixer/MasterVolumeKnob.module.css`:**
   - `.masterVolumeContainer` -- flex column, centered, gap `var(--space-1)`
   - `.masterVolumeLabel` -- `var(--text-xs)`, `var(--color-text-disabled)`, uppercase, letter-spacing `var(--tracking-widest)`
   - `.masterVolumeValue` -- `var(--text-xs)`, `var(--color-text-muted)`, monospace or tabular-nums for stable width

#### Important Note on RotaryKnob

The existing `RotaryKnob` component is a visual stub (no drag/scroll interaction -- `onChange` is accepted but not called). The knob will render correctly and show the current value visually via rotation, but will not respond to user input until `RotaryKnob` is fully implemented (STORY-012). This is acceptable for this story. If the developer wants immediate interactivity, they may either:
- (a) Accept the visual-only state and note it as a known limitation, OR
- (b) Add a hidden `<input type="range">` as a fallback inside `MasterVolumeKnob` for functional control until STORY-012 lands

**Recommendation:** Option (b) -- add a small range input below the knob as a temporary fallback so the master volume is actually adjustable from the Mixer panel.

#### Acceptance Criteria

- [ ] `MasterVolumeKnob` renders a `RotaryKnob` bound to `settingsStore.masterVolume`
- [ ] Knob visually reflects current master volume (rotation angle)
- [ ] Label "MASTER" displayed below the knob
- [ ] Numeric value displayed (0-100)
- [ ] If fallback range input is added: changing it calls `setMasterVolume` and updates both knob visual and deck output volumes
- [ ] `aria-label="Master volume"` present on the knob element
- [ ] Default value is 100

---

### Task 5: Integrate new components into Mixer layout

**Sizing:** Small
**Complexity:** Low
**Dependencies:** Task 3, Task 4
**Files to modify:** `src/components/Mixer/Mixer.tsx`

#### Description

Add the `CrossfaderCurveSelector` above the crossfader and the `MasterVolumeKnob` at the top of the mixer (after the header, before channel faders).

#### Implementation Steps

1. **In `src/components/Mixer/Mixer.tsx`:**
   - Import `CrossfaderCurveSelector` from `./CrossfaderCurveSelector`
   - Import `MasterVolumeKnob` from `./MasterVolumeKnob`
   - Add master volume section after the header and before channel faders:
     ```tsx
     {/* Master Volume */}
     <section className={styles.section} aria-label="Master volume">
       <MasterVolumeKnob />
     </section>
     ```
   - Add curve selector inside the existing crossfader section, below the `<Crossfader />`:
     ```tsx
     {/* Crossfader */}
     <section className={styles.section} aria-label="Crossfader">
       <div className={styles.sectionLabel}>CROSSFADER</div>
       <Crossfader />
       <CrossfaderCurveSelector />
     </section>
     ```

#### Final Mixer Layout (top to bottom)

1. MIXER header
2. **Master Volume knob** (new)
3. CH FADERS section
4. LEVELS (VU meters) section
5. BEAT SYNC button
6. CROSSFADER section
7. **Crossfader Curve Selector** (new, inside crossfader section)

#### Acceptance Criteria

- [ ] `MasterVolumeKnob` visible in Mixer panel above channel faders
- [ ] `CrossfaderCurveSelector` visible below the crossfader slider
- [ ] Layout does not break existing mixer sections
- [ ] All existing functionality (crossfader, channel faders, VU meters) unaffected
- [ ] Responsive within the mixer column width

---

### Task 6: Add unit tests for new crossfader curves

**Sizing:** Small
**Complexity:** Low
**Dependencies:** Task 1
**Files to modify:** `src/test/volume-map.test.ts`

#### Description

Extend the existing volume map test file with test suites for the Linear and Sharp curves, plus backward compatibility verification.

#### Implementation Steps

1. **In `src/test/volume-map.test.ts`:**
   - Add a new `describe('crossfaderToVolumes — linear curve')` block:
     ```ts
     describe('crossfaderToVolumes — linear curve', () => {
       it('position 0.0 — Deck A at 100%, Deck B at 0%', () => {
         const { a, b } = crossfaderToVolumes(0.0, 'linear');
         expect(a).toBe(100);
         expect(b).toBe(0);
       });

       it('position 0.5 — both decks at 50%', () => {
         const { a, b } = crossfaderToVolumes(0.5, 'linear');
         expect(a).toBe(50);
         expect(b).toBe(50);
       });

       it('position 1.0 — Deck A at 0%, Deck B at 100%', () => {
         const { a, b } = crossfaderToVolumes(1.0, 'linear');
         expect(a).toBe(0);
         expect(b).toBe(100);
       });

       it('position 0.25 — Deck A at 75%, Deck B at 25%', () => {
         const { a, b } = crossfaderToVolumes(0.25, 'linear');
         expect(a).toBe(75);
         expect(b).toBe(25);
       });

       it('is symmetric', () => {
         const { a: a03, b: b03 } = crossfaderToVolumes(0.3, 'linear');
         const { a: a07, b: b07 } = crossfaderToVolumes(0.7, 'linear');
         expect(a03).toBe(b07);
         expect(b03).toBe(a07);
       });
     });
     ```

   - Add a new `describe('crossfaderToVolumes — sharp curve')` block:
     ```ts
     describe('crossfaderToVolumes — sharp curve', () => {
       it('position 0.5 — both decks at 100% (center sweet spot)', () => {
         const { a, b } = crossfaderToVolumes(0.5, 'sharp');
         expect(a).toBe(100);
         expect(b).toBe(100);
       });

       it('position 0.0 — Deck A at 100%, Deck B at 0%', () => {
         const { a, b } = crossfaderToVolumes(0.0, 'sharp');
         expect(a).toBe(100);
         expect(b).toBe(0);
       });

       it('position 1.0 — Deck A at 0%, Deck B at 100%', () => {
         const { a, b } = crossfaderToVolumes(1.0, 'sharp');
         expect(a).toBe(0);
         expect(b).toBe(100);
       });

       it('position 0.25 — Deck A at 100%, Deck B at 50%', () => {
         const { a, b } = crossfaderToVolumes(0.25, 'sharp');
         expect(a).toBe(100);
         expect(b).toBe(50);
       });

       it('position 0.75 — Deck A at 50%, Deck B at 100%', () => {
         const { a, b } = crossfaderToVolumes(0.75, 'sharp');
         expect(a).toBe(50);
         expect(b).toBe(100);
       });

       it('is symmetric', () => {
         const { a: a02, b: b02 } = crossfaderToVolumes(0.2, 'sharp');
         const { a: a08, b: b08 } = crossfaderToVolumes(0.8, 'sharp');
         expect(a02).toBe(b08);
         expect(b02).toBe(a08);
       });
     });
     ```

   - Add backward compatibility test:
     ```ts
     describe('crossfaderToVolumes — backward compatibility', () => {
       it('no curve argument defaults to smooth (same as before)', () => {
         const withoutCurve = crossfaderToVolumes(0.5);
         const withSmooth = crossfaderToVolumes(0.5, 'smooth');
         expect(withoutCurve).toEqual(withSmooth);
       });

       it('all existing smooth curve tests still pass', () => {
         // Covered by the existing describe blocks above which call
         // crossfaderToVolumes without a curve argument
       });
     });
     ```

   - Add master volume integration test:
     ```ts
     describe('master volume scaling', () => {
       it('compositeVolume * masterScale gives expected final output', () => {
         // Simulates: crossfaderVol=71, channelFader=100, masterVolume=50
         const composite = compositeVolume(71, 100); // 71
         const finalVol = Math.round(composite * (50 / 100)); // 36
         expect(finalVol).toBe(36);
       });

       it('masterVolume at 100 does not reduce volume', () => {
         const composite = compositeVolume(100, 100); // 100
         const finalVol = Math.round(composite * (100 / 100)); // 100
         expect(finalVol).toBe(100);
       });

       it('masterVolume at 0 silences output', () => {
         const composite = compositeVolume(100, 100); // 100
         const finalVol = Math.round(composite * (0 / 100)); // 0
         expect(finalVol).toBe(0);
       });
     });
     ```

#### Acceptance Criteria

- [ ] All existing tests in `volume-map.test.ts` continue to pass unchanged
- [ ] Linear curve: position 0.0 yields `{ a: 100, b: 0 }`
- [ ] Linear curve: position 0.5 yields `{ a: 50, b: 50 }`
- [ ] Linear curve: position 1.0 yields `{ a: 0, b: 100 }`
- [ ] Sharp curve: position 0.5 yields `{ a: 100, b: 100 }`
- [ ] Sharp curve: position 0.0 yields `{ a: 100, b: 0 }`
- [ ] Sharp curve: position 1.0 yields `{ a: 0, b: 100 }`
- [ ] Sharp curve: position 0.25 yields `{ a: 100, b: 50 }`
- [ ] Backward compatibility: `crossfaderToVolumes(pos)` equals `crossfaderToVolumes(pos, 'smooth')`
- [ ] Master volume scaling tests pass

---

## Implementation Order

```
Task 1 ──> Task 2 ──> Task 5
  │                     ^
  └──> Task 6           │
                        │
Task 3 ────────────────┘
Task 4 ────────────────┘
```

**Recommended sequence:** Task 1, Task 6 (verify immediately), Task 2, Task 3, Task 4 (parallel), Task 5.

Tasks 3 and 4 are independent of each other and can be implemented in parallel. Task 5 depends on both 3 and 4 being complete.

---

## Files Summary

### Files to Modify

| File | Task | Changes |
|---|---|---|
| `src/types/mixer.ts` | 1 | Add `CrossfaderCurve` type, add `crossfaderCurve` to `MixerState` |
| `src/utils/volumeMap.ts` | 1 | Add `curve` parameter to `crossfaderToVolumes`, implement linear + sharp cases |
| `src/store/mixerStore.ts` | 2 | Add `crossfaderCurve` state, `setCrossfaderCurve` action, pass curve to volume calc |
| `src/components/Mixer/Mixer.tsx` | 5 | Import and render `CrossfaderCurveSelector` and `MasterVolumeKnob` |
| `src/test/volume-map.test.ts` | 6 | Add linear curve, sharp curve, backward compat, and master volume tests |

### Files to Create

| File | Task | Purpose |
|---|---|---|
| `src/components/Mixer/CrossfaderCurveSelector.tsx` | 3 | 3-button segmented control for curve selection |
| `src/components/Mixer/CrossfaderCurveSelector.module.css` | 3 | Styles for curve selector |
| `src/components/Mixer/MasterVolumeKnob.tsx` | 4 | Rotary knob wired to `settingsStore.masterVolume` |
| `src/components/Mixer/MasterVolumeKnob.module.css` | 4 | Styles for master volume knob |

---

## Edge Cases and Notes

1. **Sharp curve at exact center (0.5):** Both decks must be 100%. The formula uses strict `<` and `>` comparisons, so `pos === 0.5` falls through to the "else" branch for both. Verify: `pos < 0.5 ? 100 : ...` when pos=0.5 evaluates the else, giving `Math.max(0, round(100 * (1 - 0)))` = 100. For Deck B: `pos > 0.5 ? 100 : ...` when pos=0.5 evaluates the else, giving `Math.max(0, round(100 * 1))` = 100. Both correct.

2. **Floating-point precision:** The crossfader slider produces values in increments of 0.01 (integer slider 0-100 divided by 100). The sharp curve formula at these increments will not produce unexpected floating-point artifacts because the multiplication factors are simple (multiply by 2, subtract 0.5). `Math.round` and `Math.max(0, ...)` provide additional safety.

3. **Curve change during playback:** Switching curves must immediately recalculate and apply volumes. The `setCrossfaderCurve` action in Task 2 handles this by calling `applyVolumesToDecks` and pushing to `deckStore`.

4. **RotaryKnob is a stub:** The existing `RotaryKnob` does not handle user input (no drag/scroll/keyboard). The `MasterVolumeKnob` component should include a fallback `<input type="range">` for functional control until STORY-012 is implemented. This is documented in Task 4.

5. **Master volume already persists to localStorage:** No additional persistence work needed. The `settingsStore` handles this.

6. **No changes to `settingsStore`:** The store already has `masterVolume` and `setMasterVolume`. This story only adds a UI control in the Mixer panel.

---

## Verification Checklist

- [ ] `npm run build` (or equivalent) succeeds with no type errors
- [ ] `npm run lint` passes
- [ ] `npm run test` passes -- all existing tests unaffected
- [ ] New tests for linear and sharp curves pass
- [ ] Crossfader curve selector renders 3 buttons in the mixer panel
- [ ] Clicking each curve button changes the active curve and recalculates volumes
- [ ] Default curve is Smooth (matches previous behavior exactly)
- [ ] Master volume knob visible in mixer panel
- [ ] Master volume changes affect both deck output volumes
- [ ] Sharp curve at center: both decks at full volume
- [ ] Sharp curve at edges: one deck at 0, other at 100
- [ ] Linear curve at center: both decks at 50
- [ ] Accessibility: radiogroup + radio roles, aria-labels present
