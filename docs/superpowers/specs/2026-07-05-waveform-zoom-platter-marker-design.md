# Waveform Zoom Controls + Platter Spin Marker — Design Spec

Two small, independent per-deck visual features:

1. Zoom +/- buttons above each deck's color waveform, to widen or
   narrow the time window shown around the playhead.
2. A rotating marker on the vinyl platter, so spin is visibly obvious
   and a full rotation is easy to count.

Both are additive UI changes with no effect on audio playback, EQ,
loops, or any other deck behavior.

## 1. Waveform zoom

### Current behavior (for reference)

`DeckWaveform.tsx` always renders a fixed window: `VISIBLE_HALF = 180`
bars on each side of the playhead (`VISIBLE_BARS = 361`), out of
`TOTAL_BARS = 1000` peaks representing the whole track
(`WAVEFORM_PEAKS` in `useAudioEngine.ts`). The visible time window
therefore scales with track length — e.g. for a 3-minute track, ~65
seconds of context is shown (32.5s each side). There is no existing
zoom concept; `VISIBLE_HALF` is a module-level constant today.

### New behavior

A shared constant, `src/utils/waveformZoom.ts`:

```ts
/** VISIBLE_HALF values (bars each side of the playhead) for each zoom level, narrowest to widest. */
export const WAVEFORM_ZOOM_LEVELS = [20, 60, 180, 300, 500] as const;
/** Index into WAVEFORM_ZOOM_LEVELS matching today's fixed 180-bar-half default. */
export const DEFAULT_WAVEFORM_ZOOM_INDEX = 2;
```

These produce visible-bar counts of 41, 121, 361 (today's default),
601, and 1001 (the full 1000-bar track, i.e. the entire waveform at
once) — five discrete zoom levels from a tight close-up to the whole
track structure.

`DeckState` (`src/types/deck.ts`) gains one field:

```ts
/** Index into WAVEFORM_ZOOM_LEVELS controlling how many bars are visible around the playhead. Persists across track loads (a per-deck display preference, like vinylMode). */
waveformZoomIndex: number;
```

Default: `DEFAULT_WAVEFORM_ZOOM_INDEX`. Not reset by `loadTrack` or
`clearTrack` — same persistence pattern as `vinylMode`/`padMode`.

`deckStore.ts` gains two actions:

```ts
zoomWaveformIn: (deckId: 'A' | 'B') => void;  // move toward a narrower window (lower index), clamped at 0
zoomWaveformOut: (deckId: 'A' | 'B') => void; // move toward a wider window (higher index), clamped at WAVEFORM_ZOOM_LEVELS.length - 1
```

Each is a no-op at its respective end of the array (clamped, not
wrapping).

`DeckWaveform.tsx` changes: `VISIBLE_HALF`/`VISIBLE_BARS` move from
module-level constants to values derived inside the component from
`deck.waveformZoomIndex` (`WAVEFORM_ZOOM_LEVELS[waveformZoomIndex]`).
Everything downstream (bar drawing loop, hot-cue marker projection,
playhead centering) already works in terms of `VISIBLE_HALF`/
`VISIBLE_BARS`, so no other rendering logic changes — it just operates
on a different-sized window. `barWidth = width / VISIBLE_BARS` means
narrower windows draw fewer, wider bars (more detail per sample) and
wider windows draw more, thinner bars (more of the track at a glance).

### New component: `WaveformZoomControls`

`src/components/Deck/WaveformZoomControls.tsx` (+ `.module.css`): two
small buttons, "−" and "+", calling `zoomWaveformIn`/`zoomWaveformOut`.
Rendered in `DeckDisplay.tsx`'s existing `waveformRow` div, in a thin
row directly above `<DeckWaveform>`, left-aligned (top-left of the
waveform area). Each button is `disabled` when already at that end of
`WAVEFORM_ZOOM_LEVELS` (matching the existing disabled-button pattern
used elsewhere, e.g. `PadGridLoop`'s roll-disabled state). `aria-label`s:
`"Zoom in Deck {deckId} waveform"` / `"Zoom out Deck {deckId} waveform"`.

## 2. Platter spin marker

### Current behavior (for reference)

`VinylPlatter.tsx` renders a `.platter` div whose `background` is a
radial-gradient of concentric, perfectly circular grooves — visually
identical at every rotation angle. Rotation is driven by a CSS
`vinyl-spin` keyframe animation (`--platter-state`/`--platter-duration`
custom properties) during normal playback, or by an inline
`transform: rotate(...)` (`rotationOverrideDeg` prop) during an active
jog-wheel drag. The only fixed reference point is the `.tonearmNotch`
(▲) rendered *outside* the platter at 12 o'clock. Because the platter
itself has no asymmetric visual feature, spinning is imperceptible in
practice — there's nothing to track by eye.

### New behavior

One new decorative child element inside `.platter` in
`VinylPlatter.tsx`:

```tsx
<div className={styles.spinMarker} aria-hidden="true" />
```

CSS (`VinylPlatter.module.css`):

```css
.spinMarker {
  position: absolute;
  top: 0;
  left: 50%;
  width: 3px;
  height: 31%; /* platter radius (50%) minus the center label's radius (19%, i.e. its 38%-diameter / 2) */
  transform: translateX(-50%);
  background: var(--color-accent-primary);
  border-radius: 2px;
}
```

This draws a single vertical bar from the platter's rim in to the edge
of the center label, at the platter's own 12-o'clock position — a
"spoke", like the visible seam of a paper label glued to a real vinyl
record. Because it is a DOM child of `.platter`, it is included in
every transform already applied to the platter (the CSS animation
during normal spin, and the inline `rotationOverrideDeg` transform
during a scratch/bend drag) with no new state, props, or JS — it
rotates automatically and in perfect sync. It sweeps past the fixed
tonearm notch exactly once per revolution, making a full spin obvious
and countable. It sits entirely in the outer band of the platter
(between the label's edge and the rim), so it never visually overlaps
the opaque center label or thumbnail image; the existing buffering
overlay (`position: absolute; inset: 0`) still covers it when active,
consistent with how it already covers the label.

Uses the existing `--color-accent-primary` custom property (same
color as the tonearm notch) — no per-deck color variation, keeping it
visually tied to the existing reference marker rather than introducing
a new color association.

## Testing

- `src/utils/waveformZoom.ts`: no logic beyond the two constants — no
  dedicated unit test file needed (nothing to assert beyond the values
  themselves, which the store-action tests below exercise indirectly).
- `deckStore.ts`: unit tests for `zoomWaveformIn`/`zoomWaveformOut`
  (steps through levels, clamps at both ends, defaults to index 2,
  survives `loadTrack`/`clearTrack`).
- `WaveformZoomControls.tsx`: component test — click zoom in/out,
  assert the store index changes; assert buttons disable at the
  extremes.
- `DeckWaveform.tsx`: existing tests continue to pass unchanged at the
  default zoom index; one new test confirms a non-default
  `waveformZoomIndex` changes the number of bars drawn (canvas fillRect
  call count, matching the existing test file's assertion style).
- `VinylPlatter.tsx`: one new test confirms the marker element renders
  (query by class/aria-hidden) — this is a purely visual/CSS feature,
  so there is no rotation-angle behavior to assert in jsdom (no real
  CSS animation timing); the existing Playwright-based manual
  verification pattern used throughout this project covers the visual
  result.
