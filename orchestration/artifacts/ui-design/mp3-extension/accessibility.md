# Accessibility Specification — MP3 Extension
**Project:** mp3-extension
**Phase:** UI Design
**Date:** 2026-03-25
**Standard:** WCAG 2.1 Level AA

---

## 1. Keyboard Navigation

### 1.1 Global Keyboard Shortcuts (Existing — Unchanged)
| Key | Action |
|-----|--------|
| `/` | Toggle search drawer (when not focused in input) |
| Arrow keys | Various deck transport actions (via `useKeyboardShortcuts`) |

### 1.2 WaveformDisplay — Keyboard Seek Alternative

The `<canvas>` element is not natively keyboard-operable. Provide a companion `<input type="range">` for keyboard and screen reader users:

```html
<canvas
  aria-hidden="true"
  tabindex="-1"
  ...
/>
<input
  type="range"
  class="sr-only"
  aria-label="Seek position in {title}"
  min="0"
  max="{duration}"
  step="1"
  value="{currentTime}"
  aria-valuetext="{formatTime(currentTime)} of {formatTime(duration)}"
/>
```

- The `<input type="range">` is visually hidden using `.sr-only` (exists in `src/index.css`)
- It responds to arrow keys in 1-second increments (step="1")
- On `onChange`, dispatch seek via `playerRegistry.get(deckId).seekTo(value, true)`
- Tab order: the range input receives focus when the user tabs into the waveform area
- The `<canvas>` has `tabindex="-1"` and `aria-hidden="true"` to remove it from tab order

### 1.3 EQ Knobs — Keyboard (Existing — Unchanged)
The existing `EqKnob` component already implements:
- `tabIndex={0}` — knob is focusable
- `ArrowUp` → `onChange(band, clamp(value + 1, -12, 12))`
- `ArrowDown` → `onChange(band, clamp(value - 1, -12, 12))`
- `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`

No change needed for EQ keyboard navigation.

### 1.4 Playlist Rows — Keyboard Reorder Alternative

Drag-and-drop reordering is not keyboard-accessible by default. Provide Move Up / Move Down buttons as an alternative:

Each `PlaylistTrack` row receives two visually-hidden buttons that appear on focus (visible only when row is focused, using CSS `:focus-within`):

```html
<button
  class="moveBtn"
  aria-label="Move {title} up in Deck {deckId} playlist"
  onClick={() => onMoveUp(deckId, index)}
  disabled={index === 0}
>
  ↑
</button>
<button
  class="moveBtn"
  aria-label="Move {title} down in Deck {deckId} playlist"
  onClick={() => onMoveDown(deckId, index)}
  disabled={index === lastIndex}
>
  ↓
</button>
```

CSS for these buttons:
```css
.moveBtn {
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition-fast);
}
.track:focus-within .moveBtn {
  opacity: 1;
  pointer-events: auto;
}
```

This satisfies WCAG 2.1 SC 2.1.1 (Keyboard) for all functionality being operable by keyboard.

### 1.5 Drop Zone — Keyboard Alternative

OS file drag-and-drop has no keyboard equivalent. Provide a fallback file input button inside the PlaylistPanel:

```html
<button
  type="button"
  class={styles.addFilesBtn}
  aria-label="Add MP3 files to Deck {deckId} playlist"
  onClick={() => fileInputRef.current?.click()}
>
  + Add MP3 Files
</button>
<input
  ref={fileInputRef}
  type="file"
  accept=".mp3,audio/mpeg"
  multiple
  class="sr-only"
  onChange={handleFileInputChange}
  aria-hidden="true"
  tabIndex={-1}
/>
```

This button appears in the `deckHeader` area next to the CLEAR button. It opens the OS file picker. The file input is hidden from tab order (the visible button triggers it).

### 1.6 Tab Order Within Deck
Top-to-bottom tab order through a deck column:
1. Deck display (no interactive elements — skipped)
2. Waveform seek range input (sr-only)
3. Transport control buttons (Restart, Skip Back, Cue, Play/Pause, Set Cue, Skip Forward, Sync, Skip)
4. Hot cue buttons (4 buttons)
5. Loop control buttons
6. Slip button
7. Beat jump buttons
8. Tap tempo button
9. Pitch slider
10. EQ knobs (BASS, MID, TREBLE) — each `tabIndex={0}`
11. Volume slider

---

## 2. ARIA Specification

### 2.1 WaveformDisplay
```html
<!-- The canvas: aria-hidden, mouse/touch only -->
<canvas
  aria-hidden="true"
  tabindex="-1"
/>

<!-- Wrapper div provides the accessible context -->
<div
  role="group"
  aria-label="Waveform for Deck {deckId}: {title}"
>
  <!-- Hidden range input for keyboard/AT seek -->
  <input
    type="range"
    class="sr-only"
    aria-label="Seek position: {formatTime(currentTime)} of {formatTime(duration)}"
    aria-valuetext="{formatTime(currentTime)} of {formatTime(duration)}"
    min="0"
    max="{duration}"
    step="1"
    value="{currentTime}"
  />
</div>

<!-- Loading state -->
<div
  role="status"
  aria-label="Waveform loading"
  aria-live="polite"
  aria-busy="true"
>
  <!-- shimmer bars (aria-hidden) -->
</div>
```

### 2.2 BPM Display (DeckDisplay)
```html
<!-- Detecting state -->
<span
  aria-live="polite"
  aria-label="BPM: detecting..."
  aria-busy="true"
>
  -- BPM
  <span class="sr-only">detecting BPM</span>
</span>

<!-- Detected state -->
<span
  aria-live="polite"
  aria-label="BPM: {bpm}"
>
  {bpm} BPM
</span>

<!-- Unset state -->
<span aria-label="BPM not set">
  -- BPM
</span>
```

### 2.3 EQ Knobs (Existing — Confirmed Correct)
```html
<div
  role="slider"
  tabIndex={0}
  aria-label="Deck {deckId} {BAND} EQ: {value} dB"
  aria-valuemin="-12"
  aria-valuemax="12"
  aria-valuenow="{value}"
  aria-valuetext="{value} dB"
>
```
The `title` attribute is updated to: `"Double-click to reset to 0 dB"`.

### 2.4 DropZone
```html
<div
  role="region"
  aria-label="Deck {deckId} playlist — drop MP3 files here"
  aria-dropeffect="copy"
  aria-grabbed="false"  <!-- set to true when a drag is in progress over this zone -->
>
```
Note: `aria-dropeffect` and `aria-grabbed` are deprecated in ARIA 1.1 but still useful for AT compatibility. The primary accessible alternative is the file picker button (Section 1.5).

### 2.5 Playlist Track Drag Handle
```html
<span
  role="button"
  aria-label="Drag to reorder {title}"
  aria-roledescription="reorder handle"
  tabIndex={-1}  <!-- removed from tab order; Move Up/Down buttons are the keyboard path -->
  aria-hidden="true"  <!-- purely decorative for mouse users; keyboard users use Move buttons -->
>
  ⠿
</span>
```

### 2.6 Source Type Badge
```html
<!-- MP3 badge -->
<span aria-label="MP3 file" class={styles.sourceBadgeMp3}>MP3</span>

<!-- YouTube badge -->
<span aria-label="YouTube video" class={styles.sourceBadgeYt}>YT</span>
```

### 2.7 PlaylistTrack Row (with new elements)
```html
<li
  class={styles.track}
  aria-label="{isActive ? 'Now playing: ' : ''}{title} — {formatTime(duration)}"
>
  <!-- Drag handle: aria-hidden, keyboard users use Move buttons -->
  <span aria-hidden="true" class={styles.dragHandle}>⠿</span>

  <!-- Source badge -->
  <span aria-label="{sourceType === 'mp3' ? 'MP3 file' : 'YouTube video'}" ...>

  <!-- Existing track button -->
  <button aria-label="Play {title}" aria-current={isActive ? 'true' : undefined}>

  <!-- Move buttons (visible on :focus-within) -->
  <button aria-label="Move {title} up" ...>↑</button>
  <button aria-label="Move {title} down" ...>↓</button>

  <!-- Remove button -->
  <button aria-label="Remove {title} from playlist" ...>×</button>
</li>
```

---

## 3. WCAG 2.1 AA Compliance Matrix

### New and Modified Components

| Component | Criterion | Requirement | Status |
|-----------|-----------|-------------|--------|
| WaveformDisplay (canvas) | 1.1.1 Non-text Content | Canvas has `aria-hidden`; companion range input provides text alternative | Met via design |
| WaveformDisplay | 1.4.11 Non-text Contrast | Waveform bars `rgba(122,184,245,0.6)` on `#222222` background — check below | Needs verification |
| WaveformDisplay | 2.1.1 Keyboard | Seek via companion `<input type="range">` | Met via design |
| WaveformDisplay (loading) | 1.4.3 Contrast | Loading text "No track loaded" `#444444` on `#222222` — ratio ~2:1 — FAILS | FAIL — must fix |
| WaveformDisplay (loading) | 2.3.3 Animation from Interactions | Loading shimmer respects `prefers-reduced-motion` | Met via design |
| EQPanel | 2.1.1 Keyboard | Arrow keys implemented | Met (existing) |
| EQPanel | 4.1.3 Status Messages | No status messages emitted | N/A |
| BPM display | 4.1.3 Status Messages | `aria-live="polite"` on BPM span | Met via design |
| DropZone | 2.1.1 Keyboard | File picker button fallback provided | Met via design |
| DropZone | 4.1.3 Status Messages | Toast "Added N tracks" uses existing Toast component | Met via design |
| PlaylistTrack (drag) | 2.1.1 Keyboard | Move Up/Down buttons provided | Met via design |
| Source badge | 1.4.3 Contrast | MP3 text `#ff6b00` on `#1a1a1a` — ratio ~5.2:1 | PASS |
| Source badge | 1.1.1 Non-text Content | `aria-label` on badge span | Met via design |

### Contrast Fix Required: Empty Waveform State Text
The "No track loaded" text uses `--color-text-disabled` (#444444) on `--color-bg-overlay` (#222222).

Contrast ratio: #444444 on #222222 ≈ 1.9:1. **This fails WCAG 1.4.3 (4.5:1 minimum for normal text).**

**Fix:** Use `--color-text-muted` (#888888) instead of `--color-text-disabled` for the waveform empty state text. Ratio: #888888 on #222222 ≈ 4.6:1. **Passes.**

Note: The existing deck empty state ("No Track Loaded") in `Deck.module.css` `.emptyStateTitle` uses `--color-text-disabled` (#444444) and also fails WCAG 1.4.3. This is a pre-existing issue, not introduced by the MP3 extension. It is noted here but flagged as a separate fix.

### Waveform Bar Contrast
- Deck A bars: `rgba(122,184,245,0.6)` on `#222222` background
  - Effective color: approximately `rgb(86,128,172)` — ratio vs `#222222` ≈ 3.8:1
  - This is a purely decorative/informational waveform visualization, not text. WCAG 1.4.11 (non-text contrast) requires 3:1 for UI components. 3.8:1 passes.
- Deck B bars: `rgba(245,122,122,0.6)` on `#222222`
  - Effective color: approximately `rgb(172,86,86)` — ratio vs `#222222` ≈ 3.1:1. Passes.
- Played-region bars: `rgba(255,107,0,0.8)` on `#222222`
  - Effective color: approximately `rgb(204,86,0)` — ratio vs `#222222` ≈ 4.9:1. Passes.

---

## 4. Color and Motion

### 4.1 Color Independence
All state information is conveyed by both color AND text/shape:
- Active play button: orange background AND "❚❚" icon changes to indicate pause available
- EQ center (0 dB): indicator line at top (12 o'clock) AND value text "0 dB" in aria-valuetext
- Drop zone valid: orange border AND "Drop MP3 files here" text
- Drop zone invalid: red border AND "MP3 files only" text

### 4.2 Reduced Motion
`src/index.css` already has:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
This global rule suppresses:
- Waveform loading shimmer animation
- BPM detecting spinner rotation
- Vinyl platter spin animation
- All CSS transitions

New components must NOT override this with inline styles that include `animation` or `transition` — use CSS classes only so the global rule applies.

For the waveform loading shimmer specifically, the `prefers-reduced-motion` media query should also have an explicit override in `WaveformDisplay.module.css`:
```css
@media (prefers-reduced-motion: reduce) {
  .shimmerBar {
    animation: none;
    opacity: 0.4; /* static fallback */
  }
  .bpmSpinner {
    animation: none;
    /* Replace spinning circle with static indicator */
    border-color: var(--color-text-muted);
    border-top-color: var(--color-text-muted);
  }
}
```

### 4.3 Focus Visibility
All interactive elements must have a visible focus indicator. The project's global focus pattern:
```css
:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus); /* 0 0 0 2px rgba(255,107,0,0.25) */
  border-color: var(--color-accent-primary);
}
```
The orange focus ring is 2px solid with 25% opacity — this meets minimum WCAG 2.1 SC 2.4.7 (Focus Visible). For WCAG 2.2 SC 2.4.11 (Enhanced Focus Appearance), increase to `rgba(255,107,0,0.5)` if targeting AA+ compliance.

New components (WaveformDisplay range input, DropZone file button, playlist Move buttons) must apply the same focus pattern.

---

## 5. Screen Reader Behavior

### 5.1 WaveformDisplay
When a screen reader user navigates to the waveform group:
1. Reads: "Waveform for Deck A: [track title]"
2. Tab to range input: "[track title] seek position, [current time] of [total time], slider"
3. Arrow keys move in 1-second increments
4. Value change announces: "[new time] of [total time]"

### 5.2 BPM Detection Announcement
When BPM detection completes:
- The `aria-live="polite"` span announces: "BPM: 128" (example)
- This fires after the current speech queue completes — polite priority is appropriate

### 5.3 File Drop / Add Files Toast
After adding files via drag-drop or file picker:
- The Toast component (existing) should have `role="status"` or `aria-live="polite"` to announce "Added 3 tracks to Deck A"
- The Toast is already in `src/components/common/Toast.tsx` — verify it uses `role="status"` or `aria-live`

### 5.4 Playlist Track Reorder
After using Move Up/Move Down buttons:
- Announce: "[title] moved to position [new index + 1] of [total]"
- Use an `aria-live="polite"` region outside the list that updates on each reorder action
- This region is invisible: `class="sr-only"`

### 5.5 Track Source Type
When a screen reader navigates a playlist row:
- "1. Now playing: [title] — MP3 file — 3 minutes 45 seconds"
- The source badge `aria-label` ("MP3 file" or "YouTube video") is read inline
