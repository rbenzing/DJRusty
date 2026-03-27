# Code Review Report — STORY-DJ-006: Crossfader Curve & Master Volume Knob

**Project**: DJRusty
**Reviewer**: Code Reviewer Agent
**Date**: 2026-03-25
**Story**: STORY-DJ-006
**Items Reviewed**:
- `src/utils/volumeMap.ts`
- `src/types/mixer.ts`
- `src/store/mixerStore.ts`
- `src/components/Mixer/CrossfaderCurveSelector.tsx`
- `src/components/Mixer/CrossfaderCurveSelector.module.css`
- `src/components/Mixer/MasterVolumeKnob.tsx`
- `src/components/Mixer/MasterVolumeKnob.module.css`
- `src/components/Mixer/Mixer.tsx`
- `src/test/volume-map.test.ts`

---

## Overall Assessment

**Status**: CHANGES REQUESTED
**Verdict**: REJECTED

**Acceptance Criteria Completion**: 89% (16 of 18 criteria fully met)
**Spec Compliance**: 94% (1 layout deviation, 3 required tests missing)

### Decision Summary

The core logic implementation is correct and well-structured. The crossfader curves produce the right values, `setCrossfaderCurve` recalculates volumes immediately, and `MasterVolumeKnob` is correctly wired to `settingsStore`. However, there are two blocking deficiencies:

1. The `MasterVolumeKnob` is placed at the **bottom** of the Mixer panel (after the crossfader section) rather than at the top (after the header, before channel faders) as explicitly required by the spec and acceptance criteria.
2. Three required acceptance-criteria tests are absent: the sharp-curve position-0.25 test, the backward-compatibility test, and the master-volume scaling tests.

These are straightforward fixes with no architectural impact.

---

## Strict Validation Checklist

### Specification Compliance

| Item | Status | Notes |
|---|---|---|
| `CrossfaderCurve` type exported from `src/types/mixer.ts` | [x] | Union: `'smooth' \| 'linear' \| 'sharp'` |
| `crossfaderCurve` field added to `MixerState` interface | [x] | Present, documented |
| `crossfaderToVolumes` backward compatible (no second arg = smooth) | [x] | Default `= 'smooth'` on parameter |
| `crossfaderToVolumes(0.5, 'linear')` returns `{ a: 50, b: 50 }` | [x] | Math verified |
| `crossfaderToVolumes(0.0, 'linear')` returns `{ a: 100, b: 0 }` | [x] | Math verified |
| `crossfaderToVolumes(1.0, 'linear')` returns `{ a: 0, b: 100 }` | [x] | Math verified |
| `crossfaderToVolumes(0.5, 'sharp')` returns `{ a: 100, b: 100 }` | [x] | Math verified |
| `crossfaderToVolumes(0.0, 'sharp')` returns `{ a: 100, b: 0 }` | [x] | Math verified |
| `crossfaderToVolumes(1.0, 'sharp')` returns `{ a: 0, b: 100 }` | [x] | Math verified |
| `mixerStore` initial state includes `crossfaderCurve: 'smooth'` | [x] | `INITIAL_STATE` correct |
| `setCrossfaderCurve` updates curve and immediately recalculates volumes | [x] | Calls `applyVolumesToDecks`, then `set(...)` atomically |
| Existing `setCrossfaderPosition/A/B` actions use current `crossfaderCurve` | [x] | All three pass `get().crossfaderCurve` |
| Master volume scaling continues to work | [x] | `applyVolumesToDecks` unchanged logic |
| `CrossfaderCurveSelector` renders 3 buttons (S/L/X) | [x] | CURVES constant, mapped correctly |
| Active curve button visually distinct | [x] | `curveButtonActive` class applied |
| Clicking button calls `setCrossfaderCurve` with correct value | [x] | `onClick={() => setCrossfaderCurve(c.value)}` |
| `role="radiogroup"` with `role="radio"` and `aria-checked` | [x] | Present and correct |
| Each button has `aria-label` with full curve name | [x] | `fullName` field used |
| `MasterVolumeKnob` renders and is wired to `settingsStore.masterVolume` | [x] | Reads `masterVolume`, writes via `setMasterVolume` |
| Knob range 0-100, default 100 | [x] | `min=0 max=100`; default from persisted store |
| Label "MASTER" displayed | [x] | Via `<label>` element |
| Numeric value displayed | [x] | `{masterVolume}` readout |
| `aria-label="Master volume"` present | [x] | On `<input>` element |
| `MasterVolumeKnob` visible **above channel faders** | [ ] | FAIL — placed at bottom after crossfader section |
| `CrossfaderCurveSelector` visible below crossfader slider | [x] | Inside crossfader section, after `<Crossfader />` |
| Layout does not break existing mixer sections | [x] | All sections present and intact |
| Test: Sharp curve position 0.25 yields `{ a: 100, b: 50 }` | [ ] | MISSING — required by Task 6 acceptance criteria |
| Test: Backward compat — `crossfaderToVolumes(pos)` equals `crossfaderToVolumes(pos, 'smooth')` | [ ] | MISSING — required by Task 6 acceptance criteria |
| Test: Master volume scaling tests | [ ] | MISSING — required by Task 6 acceptance criteria |
| All existing tests pass unchanged | [x] | 403/403 passing |

### Code Quality

| Item | Status | Notes |
|---|---|---|
| Readability | [x] | Clear function names, logical structure |
| Naming conventions | [x] | Consistent camelCase/PascalCase throughout |
| Function size | [x] | All functions small and focused |
| Code duplication | [x] | None observed |
| Comments | [x] | JSDoc on public functions; inline context where needed |

### Best Practices

| Item | Status | Notes |
|---|---|---|
| Language/framework conventions | [x] | Functional React components, named exports, hooks |
| Design patterns | [x] | Store selector pattern used correctly |
| SOLID principles | [x] | Single responsibility maintained |
| Error handling | [x] | `clamp` guards all numeric outputs |
| Anti-patterns | [x] | None observed |

### Security

| Item | Status | Notes |
|---|---|---|
| Input validation | [x] | `clamp(position, 0, 1)` in `crossfaderToVolumes`; store range enforced by `min/max` on input |
| Sensitive data exposure | [x] | No sensitive data in scope |
| XSS | [x] | No `dangerouslySetInnerHTML`; values are numeric |
| Auth/authorization | [x] | Not applicable to this story |

### Testing

| Item | Status | Notes |
|---|---|---|
| Unit tests present | [x] | Volume-map tests extended |
| Coverage adequate | [x] | Boundary values covered for all three curves |
| Edge cases | [~] | Sharp 0.25 test missing (spec required) |
| Error scenarios | [x] | Out-of-range clamping tested in existing suite |
| Test naming | [x] | Descriptive, consistent |
| Assertions meaningful | [x] | Exact integer values asserted |
| Backward compat test | [ ] | MISSING |
| Master volume scaling test | [ ] | MISSING |

### Performance

| Item | Status | Notes |
|---|---|---|
| Algorithm efficiency | [x] | O(1) arithmetic in all curve calculations |
| Unnecessary computations | [x] | None — `applyVolumesToDecks` called only on state changes |
| Resource management | [x] | No subscriptions or timers introduced |

---

## Detailed Findings

### FINDING 1 — CRITICAL: MasterVolumeKnob placement violates spec

**File**: `src/components/Mixer/Mixer.tsx` (line 68)
**Severity**: Critical (spec acceptance criterion violated)
**Category**: Specification Compliance / Layout

**Problem**: The spec (Task 5, description and acceptance criteria) explicitly requires `MasterVolumeKnob` to appear "after the header, before channel faders" — position #2 in the defined layout. The implementation places it at the bottom of the panel, after the crossfader section (position #4 effectively).

**Spec requirement**:
```
Final Mixer Layout (top to bottom):
1. MIXER header
2. Master Volume knob  ← required position
3. CH FADERS section
4. LEVELS (VU meters) section
5. CROSSFADER section
6. Crossfader Curve Selector (inside crossfader section)
```

**Acceptance criterion**: "MasterVolumeKnob visible in Mixer panel **above channel faders**"

**Current implementation layout**:
```
1. MIXER header
2. CH FADERS section
3. LEVELS section
4. CROSSFADER section + CrossfaderCurveSelector
5. Master volume section  ← actual position
```

**Fix**: Move the `<section aria-label="Master volume">` block from line 68 to immediately after the `{/* Header */}` block (before the `{/* Channel faders */}` section).

---

### FINDING 2 — MAJOR: Missing required test — sharp curve at position 0.25

**File**: `src/test/volume-map.test.ts`
**Severity**: Major (required acceptance criterion not met)
**Category**: Testing / Specification Compliance

**Problem**: Task 6 acceptance criteria explicitly state: "Sharp curve: position 0.25 yields `{ a: 100, b: 50 }`". This test is not present in the file.

**Math verification**: `pos=0.25 < 0.5` so `a=100`. `b = pos > 0.5 ? 100 : Math.max(0, Math.round(100 * (0.25 * 2)))` = `Math.round(50)` = 50. The formula produces the correct result; the test to confirm it is simply absent.

**Fix**: Add the following test inside the sharp curve describe block:
```ts
it('sharp: position=0.25 → { a: 100, b: 50 }', () => {
  const { a, b } = crossfaderToVolumes(0.25, 'sharp');
  expect(a).toBe(100);
  expect(b).toBe(50);
});
```

---

### FINDING 3 — MAJOR: Missing required test — backward compatibility

**File**: `src/test/volume-map.test.ts`
**Severity**: Major (required acceptance criterion not met)
**Category**: Testing / Specification Compliance

**Problem**: Task 6 acceptance criteria state: "Backward compatibility: `crossfaderToVolumes(pos)` equals `crossfaderToVolumes(pos, 'smooth')`". No such test exists. The existing tests that call `crossfaderToVolumes` without a curve argument provide implicit coverage, but the spec requires an explicit assertion that the two call forms are equivalent.

**Fix**: Add a describe block:
```ts
describe('crossfaderToVolumes — backward compatibility', () => {
  it('no curve argument defaults to smooth (same as passing smooth)', () => {
    const withoutCurve = crossfaderToVolumes(0.5);
    const withSmooth = crossfaderToVolumes(0.5, 'smooth');
    expect(withoutCurve).toEqual(withSmooth);
  });
});
```

---

### FINDING 4 — MAJOR: Missing required tests — master volume scaling

**File**: `src/test/volume-map.test.ts`
**Severity**: Major (required acceptance criterion not met)
**Category**: Testing / Specification Compliance

**Problem**: Task 6 acceptance criteria include "Master volume scaling tests pass". The three `compositeVolume` + master scale integration tests specified in the story (masterVolume=50 halves output, masterVolume=100 is unity, masterVolume=0 silences) are absent from the test file.

**Fix**: Add:
```ts
describe('master volume scaling', () => {
  it('compositeVolume * masterScale gives expected final output', () => {
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

---

### FINDING 5 — MINOR: Redundant `aria-label` on labelled input

**File**: `src/components/Mixer/MasterVolumeKnob.tsx` (lines 21-34)
**Severity**: Minor
**Category**: Accessibility

**Problem**: The `<input>` element has both a `<label htmlFor="master-volume-knob">` providing its accessible name and an explicit `aria-label="Master volume"` attribute. When both are present, `aria-label` overrides the label element for screen readers. In this case both contain the same text so there is no functional regression, but it introduces redundancy and could cause confusion if one is updated without the other.

**Recommendation**: Remove the `aria-label` from the input — the `<label htmlFor>` relationship is the correct and sufficient mechanism. Retain `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-valuetext` as those add value.

---

### FINDING 6 — MINOR: Dead CSS class `.beatSyncBtn` in Mixer.module.css

**File**: `src/components/Mixer/Mixer.module.css`
**Severity**: Minor (acknowledged by developer, no functional impact)
**Category**: Code Quality

**Problem**: The `.beatSyncBtn` CSS class is now unreferenced since the Beat Sync section was removed from `Mixer.tsx`. This is dead code.

**Recommendation**: Remove the class in this PR or in a dedicated cleanup pass. Since the developer noted it as a known item, a comment referencing the cleanup is acceptable if deferring.

---

## Positive Highlights

- **Curve math is correct and elegant**: The three-way switch in `crossfaderToVolumes` is clean and easy to audit. The sharp-curve formula handles the exact-centre case correctly without special-casing it (the `<` vs `>` strict comparisons naturally produce 100/100 at pos=0.5).
- **Immediate volume recalculation on curve change**: `setCrossfaderCurve` calls `applyVolumesToDecks` and `set()` in a single synchronous operation — exactly what the spec calls for and what a DJ expects when switching curves mid-mix.
- **Backward compatibility by default parameter**: `curve: CrossfaderCurve = 'smooth'` means every existing call site (no second argument) continues to use the cosine curve without modification. Zero risk to regression.
- **MasterVolumeKnob design decision**: Using `<input type="range">` instead of the RotaryKnob stub is the right pragmatic call. The spec recommended this as option (b) and it provides real functional control without waiting for STORY-012.
- **CrossfaderCurveSelector accessibility**: The `role="radiogroup"` / `role="radio"` / `aria-checked` pattern is correctly implemented. `title` attributes provide hover tooltips. `aria-label` on each button gives the full curve name to screen readers.
- **TypeScript is clean**: 0 type errors, all interfaces complete, no `any` types.

---

## File-by-File Review

| File | Status | Notes |
|---|---|---|
| `src/utils/volumeMap.ts` | APPROVED | Three-curve switch correct, clamp guards in place, JSDoc accurate |
| `src/types/mixer.ts` | APPROVED | `CrossfaderCurve` union type exported, `MixerState.crossfaderCurve` field present |
| `src/store/mixerStore.ts` | APPROVED | `INITIAL_STATE` correct, all three position/fader actions pass curve, `setCrossfaderCurve` recalculates immediately |
| `src/components/Mixer/CrossfaderCurveSelector.tsx` | APPROVED | Correct store wiring, ARIA pattern, button rendering |
| `src/components/Mixer/CrossfaderCurveSelector.module.css` | APPROVED | Matches spec, uses design tokens, focus ring present |
| `src/components/Mixer/MasterVolumeKnob.tsx` | APPROVED (minor note) | Correctly wired to `settingsStore`; redundant `aria-label` is minor |
| `src/components/Mixer/MasterVolumeKnob.module.css` | APPROVED | Cross-browser range input styling correct |
| `src/components/Mixer/Mixer.tsx` | REJECTED | MasterVolumeKnob in wrong position — must be above channel faders |
| `src/test/volume-map.test.ts` | REJECTED | Three required acceptance-criteria tests absent |

---

## Acceptance Criteria Verification

### Task 1: CrossfaderCurve type + multi-curve crossfaderToVolumes

| Criterion | Met |
|---|---|
| `CrossfaderCurve` type exported | [x] |
| `crossfaderCurve` field in `MixerState` | [x] |
| Backward compat — no curve arg = smooth | [x] |
| `(0.5, 'linear')` = `{ a: 50, b: 50 }` | [x] |
| `(0.0, 'linear')` = `{ a: 100, b: 0 }` | [x] |
| `(1.0, 'linear')` = `{ a: 0, b: 100 }` | [x] |
| `(0.5, 'sharp')` = `{ a: 100, b: 100 }` | [x] |
| `(1.0, 'sharp')` = `{ a: 0, b: 100 }` | [x] |
| `(0.0, 'sharp')` = `{ a: 100, b: 0 }` | [x] |
| All return values integers in [0, 100] | [x] |

### Task 2: mixerStore crossfader curve wiring

| Criterion | Met |
|---|---|
| Initial state `crossfaderCurve: 'smooth'` | [x] |
| `setCrossfaderCurve('linear')` updates curve + recalculates volumes | [x] |
| `setCrossfaderCurve('sharp')` updates curve + recalculates volumes | [x] |
| Existing `setCrossfaderPosition/A/B` use current curve | [x] |
| Master volume scaling continues to work | [x] |

### Task 3: CrossfaderCurveSelector component

| Criterion | Met |
|---|---|
| Three buttons S / L / X | [x] |
| Active button visually distinct | [x] |
| Clicking calls `setCrossfaderCurve` with correct value | [x] |
| `role="radiogroup"` with `role="radio"` and `aria-checked` | [x] |
| Each button has `aria-label` with full curve name | [x] |
| Matches mixer panel visual style | [x] |

### Task 4: MasterVolumeKnob component

| Criterion | Met |
|---|---|
| Renders control bound to `settingsStore.masterVolume` | [x] |
| Visually reflects current master volume | [x] |
| Label "MASTER" displayed | [x] |
| Numeric value 0-100 displayed | [x] |
| Changing it calls `setMasterVolume` and updates deck volumes | [x] |
| `aria-label="Master volume"` present | [x] |
| Default value is 100 | [x] |

### Task 5: Mixer layout integration

| Criterion | Met |
|---|---|
| `MasterVolumeKnob` visible **above channel faders** | [ ] — placed at bottom |
| `CrossfaderCurveSelector` visible below crossfader slider | [x] |
| Layout does not break existing sections | [x] |
| All existing functionality unaffected | [x] |

### Task 6: Volume map tests

| Criterion | Met |
|---|---|
| All existing tests still pass | [x] |
| Linear 0.0 = `{ a: 100, b: 0 }` | [x] |
| Linear 0.5 = `{ a: 50, b: 50 }` | [x] |
| Linear 1.0 = `{ a: 0, b: 100 }` | [x] |
| Sharp 0.5 = `{ a: 100, b: 100 }` | [x] |
| Sharp 0.0 = `{ a: 100, b: 0 }` | [x] |
| Sharp 1.0 = `{ a: 0, b: 100 }` | [x] |
| Sharp 0.25 = `{ a: 100, b: 50 }` | [ ] — test missing |
| Backward compat: no arg = smooth | [ ] — test missing |
| Master volume scaling tests pass | [ ] — tests missing |

---

## Recommendations

### Immediate (Required Before Approval)

1. **Fix MasterVolumeKnob position in Mixer.tsx** — move the `<section aria-label="Master volume">` block to immediately after the `{/* Header */}` block, before `{/* Channel faders */}`. This is a two-line cut-and-paste change.

2. **Add sharp curve 0.25 test** — add one `it()` asserting `crossfaderToVolumes(0.25, 'sharp')` returns `{ a: 100, b: 50 }`.

3. **Add backward compatibility test** — add one `it()` asserting `crossfaderToVolumes(0.5)` deep-equals `crossfaderToVolumes(0.5, 'smooth')`.

4. **Add master volume scaling tests** — add three `it()` assertions covering masterVolume=50 halves output, masterVolume=100 is unity, masterVolume=0 silences output.

### Future Improvements (Non-blocking)

5. Remove the dead `.beatSyncBtn` CSS class from `Mixer.module.css`.
6. Remove the redundant `aria-label` from the `<input>` in `MasterVolumeKnob.tsx` once the `<label htmlFor>` relationship is confirmed to be sufficient.

---

## Metrics

| Metric | Value |
|---|---|
| Files reviewed | 9 |
| Critical issues | 1 |
| Major issues | 3 |
| Minor issues | 2 |
| Test file tests present | 35 |
| Required tests missing | 4 |
| TypeScript errors | 0 |
| Test suite pass rate | 403/403 (100%) |
| Review time | 2026-03-25 |

---

## Verdict

**CHANGES REQUESTED — REJECTED**

The implementation is of high quality and largely correct. All curve math, store wiring, and component architecture are sound. The four required changes are all mechanical (a layout reorder and three test additions) with no logic changes needed. Once those four items are addressed the story is ready for approval and handoff to the Tester.

**Critical/Major Issue Count**: 4 (1 critical, 3 major)
**Minor Issue Count**: 2
**Estimated Rework**: 30-45 minutes
