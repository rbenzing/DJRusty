# SPRINT-004 Implementation Notes
**Story**: Update EQ Panel Tooltip and Badge to Explain CORS Limitation
**Date**: 2026-03-24
**Agent**: Developer
**Status**: Complete

---

## Implementation Progress

- 1 / 1 acceptance criteria groups complete (100%)
- 1 file modified, 0 files created, 0 files deleted

---

## Changes Made

### `src/components/Deck/EQPanel.tsx`

**Badge text** (line 168): Changed from `Visual Only (v1)` to `Visual Only`.
Removes the misleading version suffix. The limitation is permanent as long as
YouTube iframes are used, not a v1 shortcut.

**Badge tooltip** (`title` on `.v1Badge` span, line 166): Changed from:
```
EQ is visual only in v1 — audio EQ requires a future audio pipeline upgrade (CORS limitation)
```
To:
```
YouTube embeds play inside a cross-origin iframe, which prevents the browser from
accessing the audio stream. EQ knobs are visual only — values are stored and ready
for a future direct-audio playback mode.
```
This explains the technical root cause (cross-origin iframe) without promising a
versioned fix.

**Knob tooltip** (`title` on each `.knob` div, line 134): Changed from:
```
Visual Only — EQ processing coming in v2
```
To:
```
Visual only — cross-origin iframe audio cannot be processed
```
Removes the "coming in v2" promise and replaces it with a concise technical
explanation.

**File header comment** (lines 4-8): Updated to reflect the same CORS rationale
in the module-level documentation. No functional change.

**Knob aria-label** (line 129): No change — the existing `(visual only)` suffix
is already accurate and no update was requested.

---

## Specification Compliance

| Criterion | Status |
|-----------|--------|
| Badge text reads "Visual Only" (not "Visual Only (v1)") | Pass |
| Badge tooltip explains cross-origin iframe limitation | Pass |
| Badge tooltip does not promise EQ in a future version | Pass |
| Each knob title explains the limitation without "v2" | Pass |
| Knob aria-label still includes "(visual only)" | Pass |
| Knob interaction (drag, arrow keys, double-click reset) unchanged | Pass |
| EQ values still stored in deckStore | Pass |
| Build passes with zero TypeScript errors | Pass |

---

## Build Status

| Check | Result |
|-------|--------|
| TypeScript (`tsc -b`) | Pass |
| Vite production build | Pass (798 ms, 105 modules) |
| Lint | Not separately run (tsc covers type errors; no lint config change) |

---

## Notes for Code Reviewer

- Only text/string content was changed — no logic, state, or CSS modifications.
- The `.v1Badge` CSS class name was intentionally left unchanged; renaming it
  would require a CSS module change and is out of scope for this trivial story.
- The knob's `aria-label` wording `(visual only)` was left as-is per the spec
  (item 4 of the story explicitly states "No change needed").
- No regressions are possible from these changes — only `title` attributes and
  one text node were touched.
