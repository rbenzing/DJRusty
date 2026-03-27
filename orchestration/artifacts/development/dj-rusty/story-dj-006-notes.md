# STORY-DJ-006: Crossfader Curve & Master Volume — Implementation Notes

**Date**: 2026-03-25
**Status**: Complete
**Developer**: Developer Agent

---

## Implementation Summary

This story adds two features to the Mixer panel:
1. A crossfader curve selector (Smooth / Linear / Sharp) — already partially implemented.
2. A master volume knob (compact range slider) wired to `settingsStore.masterVolume`.

---

## What Was Already Done (Pre-existing)

- `src/utils/volumeMap.ts` — multi-curve `crossfaderToVolumes` function with `smooth`, `linear`, and `sharp` curves.
- `src/types/mixer.ts` — `CrossfaderCurve` type.
- `src/store/mixerStore.ts` — `setCrossfaderCurve` action.
- `src/components/Mixer/CrossfaderCurveSelector.tsx` — 3-button segmented radiogroup control.
- `src/components/Mixer/CrossfaderCurveSelector.module.css` — styling.

---

## Tasks Completed This Session

### Task 1: `src/components/Mixer/MasterVolumeKnob.tsx` (NEW)

- Reads `masterVolume` from `useSettingsStore`.
- Calls `setMasterVolume` on change (value clamped 0–100 in store).
- Uses `<input type="range" min=0 max=100 step=1>` for real interaction.
- Full ARIA attributes: `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`.
- Label: "MASTER". Numeric readout rendered beside the slider (aria-hidden).

### Task 2: `src/components/Mixer/MasterVolumeKnob.module.css` (NEW)

- Dark themed range slider matching the mixer panel aesthetic.
- Custom `-webkit-slider-thumb` and `-moz-range-thumb` styling using `--color-accent`.
- Focus-visible ring via `--shadow-focus` CSS variable.

### Task 3: `src/components/Mixer/Mixer.tsx` (UPDATED)

Changes made:
- Removed the disabled "BEAT SYNC" button section and `.beatSyncBtn` class usage (the CSS class remains in `Mixer.module.css` but is no longer referenced — harmless).
- Added `import { CrossfaderCurveSelector } from './CrossfaderCurveSelector'`.
- Added `import { MasterVolumeKnob } from './MasterVolumeKnob'`.
- Rendered `<CrossfaderCurveSelector />` below `<Crossfader />` within the crossfader section.
- Added a new `<section aria-label="Master volume">` containing `<MasterVolumeKnob />` at the bottom of the mixer panel.

### Task 4: `src/test/volume-map.test.ts` (UPDATED)

Added three new `describe` blocks with 9 new tests covering explicit curve arguments:

**Sharp curve tests (3)**:
- `position=0.5` → `{ a: 100, b: 100 }` (both on at centre)
- `position=1.0` → `{ a: 0, b: 100 }`
- `position=0.0` → `{ a: 100, b: 0 }`

**Linear curve tests (3)**:
- `position=0.5` → `{ a: 50, b: 50 }`
- `position=0.0` → `{ a: 100, b: 0 }`
- `position=1.0` → `{ a: 0, b: 100 }`

**Smooth curve explicit tests (3)**:
- `position=0.0` → `{ a: 100, b: 0 }`
- `position=1.0` → `{ a: 0, b: 100 }`
- `position=0.5` → both values within `±1` of 71

---

## Acceptance Criteria Verification

| Criterion | Status |
|---|---|
| `crossfaderToVolumes` supports `sharp`, `linear`, `smooth` curves | Pre-existing, verified by tests |
| `CrossfaderCurveSelector` renders in Mixer panel | Done |
| `MasterVolumeKnob` reads/writes `settingsStore.masterVolume` | Done |
| `MasterVolumeKnob` range 0–100, default 100 | Done (persisted default from store) |
| Volume map tests cover all three curves | Done (9 new tests added) |
| All tests pass | 403/403 passing |
| TypeScript type check clean | 0 errors, 0 warnings |

---

## Build Status

| Check | Result |
|---|---|
| `npm test -- --run` | 403 tests passed, 18 test files, 0 failures |
| `npx tsc --noEmit` | 0 errors |
| Lint | N/A (no lint script in project) |

---

## Files Created

- `src/components/Mixer/MasterVolumeKnob.tsx`
- `src/components/Mixer/MasterVolumeKnob.module.css`

## Files Modified

- `src/components/Mixer/Mixer.tsx` — added CrossfaderCurveSelector, MasterVolumeKnob; removed Beat Sync section
- `src/test/volume-map.test.ts` — added 9 multi-curve tests

---

## Notes for Code Reviewer

- The Beat Sync placeholder section was removed from `Mixer.tsx` per task instructions. The `.beatSyncBtn` CSS class in `Mixer.module.css` is now dead code; it can be cleaned up in a future pass or left for reference.
- `MasterVolumeKnob` uses a plain `<input type="range">` rather than the `RotaryKnob` component, which is documented as a visual stub awaiting full implementation in STORY-012. This is intentional — the range input provides real interaction now.
- The master volume section in Mixer has no `sectionLabel` div; the label is baked into the `MasterVolumeKnob` component itself ("MASTER") to keep it self-contained.
