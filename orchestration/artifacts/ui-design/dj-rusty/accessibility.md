# Accessibility Guide

> Project: `dj-rusty`
> Version: 1.0
> Date: 2026-03-21
> Standard: WCAG 2.1 Level AA

---

## 1. Overview

DJRusty must meet WCAG 2.1 Level AA accessibility standards. This document defines requirements, patterns, and implementation guidance for every interactive component in the application.

The interface is a complex web application with many custom controls (rotary knobs, sliders, animated elements). Each custom control must provide a semantic, keyboard-operable, and screen-reader-friendly equivalent of its visual representation.

---

## 2. Color Contrast

All text and interactive elements must meet minimum contrast ratios per WCAG 2.1 SC 1.4.3 (AA) and 1.4.11 (non-text contrast).

### 2.1 Text Contrast Requirements

| Foreground | Background | Ratio | Passes AA |
|-----------|-----------|-------|-----------|
| `#e0e0e0` (primary text) | `#111111` (surface) | ~13.5:1 | Yes (AAA) |
| `#e0e0e0` on `#0a0a0a` | — | ~14.5:1 | Yes (AAA) |
| `#aaaaaa` (secondary text) | `#111111` | ~7.0:1 | Yes (AAA) |
| `#888888` (muted text) | `#111111` | ~4.5:1 | Yes (AA) |
| `#ff6b00` (accent) | `#111111` | ~5.3:1 | Yes (AA) |
| `#000000` (inverse) | `#ff6b00` | ~9.7:1 | Yes (AAA) |
| `#7ab8f5` (deck-a text) | `#1a3a5c` | ~4.6:1 | Yes (AA) |
| `#f57a7a` (deck-b text) | `#3a1a1a` | ~4.7:1 | Yes (AA) |
| `#7fd97f` (success text) | `#1a3a1a` | ~5.1:1 | Yes (AA) |

**Warning**: `#555555` used for disabled/placeholder text on dark backgrounds may fall below 3:1. Use `#666666` minimum for any informational disabled text. Purely decorative disabled state text (e.g., slider end labels at full disable) is exempt.

### 2.2 Non-Text Contrast

Interactive control boundaries (button borders, input borders, slider tracks, knob outlines) must have at least 3:1 contrast against adjacent background:

- Control border `#333333` on `#111111` → ~1.5:1 — **below threshold for default state**
  - Mitigation: Use background color difference and size cues to compensate; add `#444` on hover as minimum. Consider `#3a3a3a` as minimum default border on `#111`.
- Focus indicator `#ff6b00` ring on `#111111` → ~5.3:1 — passes
- Active button `#ff6b00` on `#111111` → ~5.3:1 — passes

**Developer note**: The dark-on-dark border scheme is the primary contrast risk. Ensure control shapes are distinguishable by at least one additional cue (background fill difference, size, label proximity) even if border contrast is marginal.

---

## 3. Keyboard Navigation

### 3.1 Focus Order

The tab order must follow the logical reading order of the interface:

1. Header: Logo (skip link target) → Settings button → Auth button / User area
2. Deck A: Play/Pause → Jump to Cue → Set Cue → Hot Cue 1 → Hot Cue 2 → Hot Cue 3 → Hot Cue 4 → Loop 4B → Loop 8B → Loop 16B → Loop EXIT → TAP BPM → Pitch Slider → EQ Bass Knob → EQ Mid Knob → EQ Treble Knob → Volume Fader
3. Mixer: Gain A Knob → Gain B Knob → Crossfader
4. Deck B: (same order as Deck A)
5. Track Browser: Search Input → Search Button → My Uploads Tab → Search Results Tab → Track list items (Load A / Load B per row) → Prev Page → Next Page

### 3.2 Skip Navigation Link

A visually hidden "Skip to main content" link must be the first focusable element on the page:

```html
<a href="#main-content" class="skip-link">Skip to main content</a>
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: #ff6b00;
  color: #000;
  padding: 8px 16px;
  font-weight: bold;
  z-index: 9999;
  border-radius: 0 0 4px 0;
  transition: top 150ms ease;
}
.skip-link:focus {
  top: 0;
}
```

### 3.3 Focus Visibility

All focusable elements must have a visible focus indicator. Never use `outline: none` without a custom replacement.

Default focus ring (applied globally):
```css
:focus-visible {
  outline: 2px solid #ff6b00;
  outline-offset: 2px;
}
```

For elements with `border-radius: 50%` (knobs, platter), use `box-shadow` instead:
```css
.knob:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px #ff6b00, 0 0 0 4px rgba(255, 107, 0, 0.3);
}
```

### 3.4 Keyboard Shortcuts

All keyboard shortcuts are documented in the UI Specification (Section 10). Key bindings must:
- Not conflict with browser or screen reader shortcuts when possible
- Be applied only when focus is within the relevant section (Deck A or Deck B context), not globally for deck-specific keys
- Global shortcuts (crossfader, search focus) apply regardless of focus location

| Key | Action | Scope |
|-----|--------|-------|
| `Space` | Play/Pause | When focus is in Deck A area |
| `Enter` | Play/Pause | When focus is in Deck B area |
| `←` / `→` | Crossfader left/right by 5 | Global |
| `q` | Set Cue Deck A | Global |
| `w` | Jump to Cue Deck A | Global |
| `o` | Set Cue Deck B | Global |
| `p` | Jump to Cue Deck B | Global |
| `1`–`4` | Hot Cue 1–4 on focused deck | Context (focused deck) |
| `t` | Tap BPM Deck A | Global |
| `y` | Tap BPM Deck B | Global |
| `Escape` | Close modal | When modal open |
| `/` | Focus search bar | Global |
| `?` | Open keyboard shortcut help | Global |

**Important**: `Space` and `Enter` default browser behaviors (scrolling, clicking focused elements) must be conditionally `preventDefault()`-ed only when the specific DJ shortcut applies. Do not disable Enter/Space globally.

---

## 4. ARIA Roles, Labels, and Properties

### 4.1 Page Landmarks

```html
<header role="banner">...</header>
<main id="main-content" role="main">
  <section aria-label="Deck A">...</section>
  <section aria-label="Mixer">...</section>
  <section aria-label="Deck B">...</section>
</main>
<section aria-label="Track Browser" role="complementary">...</section>
```

### 4.2 Buttons

All icon-only buttons require `aria-label`:

```html
<button aria-label="Open settings">⚙</button>
<button aria-label="Play Deck A" aria-pressed="false">▶</button>
<button aria-label="Jump to cue point on Deck A" disabled>◀◀ CUE</button>
<button aria-label="Set cue point on Deck A">SET CUE</button>
```

Play/Pause uses `aria-pressed` to reflect playing state:
```html
<button aria-label="Play/Pause Deck A" aria-pressed="true">❙❙</button>
```

### 4.3 Hot Cue Buttons

```html
<button
  aria-label="Hot cue 1: empty"
  aria-pressed="false"
  data-cue-index="0"
>1</button>

<!-- When a cue is set at 1:34 -->
<button
  aria-label="Hot cue 1: set at 1:34. Press to jump. Hold to clear."
  aria-pressed="true"
  data-cue-index="0"
>1</button>
```

Update `aria-label` dynamically when cue state changes.

### 4.4 Loop Buttons

```html
<button
  aria-label="4-beat loop"
  aria-pressed="false"
  aria-disabled="true"
  title="Set BPM first using TAP"
>4B</button>

<!-- When loop is active -->
<button
  aria-label="4-beat loop: active"
  aria-pressed="true"
>4B</button>

<button
  aria-label="Exit loop"
  aria-disabled="true"
>EXIT</button>
```

### 4.5 Sliders

Use `<input type="range">` for all sliders. Native range inputs provide built-in keyboard support (arrow keys, Home/End).

**Pitch Slider:**
```html
<label for="pitch-a" class="sr-only">Deck A playback speed</label>
<input
  type="range"
  id="pitch-a"
  min="0"
  max="7"
  step="1"
  value="3"
  aria-label="Deck A playback speed"
  aria-valuetext="1× (normal speed)"
/>
```

Note: The `min/max` of 0–7 maps to the 8 discrete values. Use `aria-valuetext` to convey the actual playback rate (e.g., "1.25×") instead of the internal index number.

**Volume Fader:**
```html
<label for="vol-a" class="sr-only">Deck A volume</label>
<input
  type="range"
  id="vol-a"
  min="0"
  max="100"
  step="1"
  value="80"
  aria-label="Deck A volume: 80%"
/>
```

**Crossfader:**
```html
<label for="crossfader" class="sr-only">Crossfader: Deck A to Deck B</label>
<input
  type="range"
  id="crossfader"
  min="0"
  max="100"
  step="1"
  value="50"
  aria-label="Crossfader"
  aria-valuetext="50: equal mix of Deck A and Deck B"
/>
```

Update `aria-valuetext` dynamically:
- 0: "Full Deck A"
- 1–24: "Mostly Deck A"
- 25–74: "Mixed: Deck A {100-value}%, Deck B {value}%"
- 75–99: "Mostly Deck B"
- 100: "Full Deck B"

### 4.6 Rotary Knobs

Rotary knobs are custom controls. Use `role="slider"` with full ARIA attributes:

```html
<div
  role="slider"
  aria-label="Deck A Bass EQ"
  aria-valuemin="-100"
  aria-valuemax="100"
  aria-valuenow="0"
  aria-valuetext="0 (center)"
  tabindex="0"
  class="knob"
>
  <!-- visual knob markup -->
</div>
```

- `aria-valuemin`: −100 (representing −∞ boost/cut, normalized for ARIA)
- `aria-valuemax`: 100
- `aria-valuenow`: current position (−100 to 100)
- `aria-valuetext`: human-readable e.g., "−3 (bass cut)" or "0 (center)" or "+2 (bass boost)"
- `aria-disabled="true"` when in visual-only mode with tooltip

Keyboard interaction on knob (per ARIA Authoring Practices Guide):
- `ArrowUp` / `ArrowRight`: increase value
- `ArrowDown` / `ArrowLeft`: decrease value
- `Home`: set to minimum
- `End`: set to maximum
- `Enter` or `Space` or double-click: reset to 0 (center)

**Note**: Since EQ knobs are visual-only in v1, consider marking them `aria-disabled="true"` and providing `aria-description="Visual only in version 1. EQ requires a future audio pipeline upgrade."` to communicate the limitation.

### 4.7 Vinyl Platter

The vinyl platter is decorative and animated. It must be hidden from the accessibility tree:

```html
<div
  class="platter"
  aria-hidden="true"
  role="presentation"
>
  <!-- groove rings, label, thumbnail -->
</div>
```

The playing state is conveyed through the Play/Pause button's `aria-pressed` attribute and a live region (see Section 4.10).

### 4.8 VU Meters

VU meters are decorative:
```html
<div class="vu-meter" aria-hidden="true" role="presentation">
  <!-- segments -->
</div>
```

### 4.9 Track Browser List

```html
<ul role="list" aria-label="Search results" aria-live="polite" aria-busy="false">
  <li>
    <img src="thumbnail-url" alt="Thumbnail for: House Music Mix Vol.3 by DJ Example" />
    <div>
      <span class="track-title">House Music Mix Vol.3</span>
      <span class="track-channel">DJ Example</span>
      <span class="track-duration">45:32</span>
    </div>
    <button aria-label="Load House Music Mix Vol.3 to Deck A">LOAD A</button>
    <button aria-label="Load House Music Mix Vol.3 to Deck B">LOAD B</button>
  </li>
</ul>
```

Set `aria-busy="true"` while loading, `aria-busy="false"` once results render.

### 4.10 Live Regions

Use `aria-live` regions to announce important state changes without requiring focus:

```html
<!-- Deck status announcements -->
<div
  id="deck-a-status"
  role="status"
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
></div>

<!-- Error/urgent announcements -->
<div
  id="announcements"
  role="alert"
  aria-live="assertive"
  aria-atomic="true"
  class="sr-only"
></div>
```

Inject text into these containers programmatically when:
- A track is loaded: `"House Music Mix loaded to Deck A"`
- Playback starts: `"Deck A playing"`
- Playback pauses: `"Deck A paused"`
- BPM is calculated: `"Deck A BPM set to 128"`
- An error occurs: `"Error: This video cannot be played"`
- Track loaded successfully: `"House Music Mix loaded to Deck B"`

Use `polite` for non-urgent updates (track loaded, BPM set). Use `assertive` for errors and warnings only.

### 4.11 Settings Modal

```html
<dialog
  id="settings-modal"
  aria-labelledby="settings-title"
  aria-modal="true"
>
  <h2 id="settings-title">Settings</h2>
  <!-- content -->
  <button aria-label="Close settings">✕</button>
</dialog>
```

Use the HTML `<dialog>` element where browser support allows (Chrome 37+, Firefox 98+, Safari 15.4+). Fallback: `role="dialog"` on a `<div>` with `aria-modal="true"`.

Focus management:
- On open: move focus to the first focusable element inside (close button or first field)
- While open: trap focus — Tab cycles within the modal, Shift+Tab cycles backward
- On close: return focus to the element that triggered the modal (settings gear or avatar)

### 4.12 Authentication Button

```html
<!-- Unauthenticated -->
<button
  type="button"
  class="google-signin-btn"
  aria-label="Sign in with Google"
>
  <img src="/google-logo.svg" alt="" aria-hidden="true" />
  Sign in with Google
</button>

<!-- Authenticated: user area -->
<button
  type="button"
  aria-label="User account: Jane Smith. Click to open settings."
  aria-expanded="false"
  aria-haspopup="dialog"
>
  <img src="{avatarUrl}" alt="Profile picture of Jane Smith" class="avatar" />
  <span aria-hidden="true">Jane Smith</span>
</button>
```

### 4.13 BPM Display

```html
<output
  id="bpm-a"
  for="tap-a"
  aria-label="Deck A BPM"
  aria-live="polite"
>
  128 BPM
</output>
```

Use `<output>` element to semantically associate the BPM display with the TAP button.

---

## 5. Screen Reader Considerations

### 5.1 Visually Hidden Utility Class

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

Use for:
- Labels for icon-only controls (when `aria-label` is not sufficient)
- Live region containers
- Skip navigation link text supplement

### 5.2 Decorative Elements

Mark purely decorative elements with `aria-hidden="true"`:
- Vinyl platter animation
- VU meter bars
- EQ knob visual decoration
- Groove ring CSS decorations
- Tonearm notch indicator

### 5.3 Dynamic Content Updates

When the application loads a track and updates deck information:
1. Update the `aria-label` / content of all affected elements (title, channel, time)
2. Post a message to the polite live region announcing the change
3. Do NOT move focus automatically unless the user explicitly triggered a modal

### 5.4 Error Messages

For inline errors (e.g., video unembeddable):
```html
<div role="alert" class="toast toast--error">
  This video cannot be played. Choose a different track.
</div>
```

The `role="alert"` automatically triggers `aria-live="assertive"` behavior.

---

## 6. Motion and Animation

### 6.1 Respect prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  /* Pause vinyl spin animation */
  .platter {
    animation-play-state: paused !important;
    animation-duration: 0s;
  }

  /* Disable all transitions */
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }

  /* Modal entrance */
  .modal {
    animation: none;
  }

  /* Toast entrance */
  .toast {
    animation: none;
  }
}
```

When `prefers-reduced-motion: reduce` is active:
- Vinyl platter does NOT spin (static display only)
- No entrance/exit animations for modals or toasts
- Button state changes remain instant (no transition)
- BPM tap flash is suppressed

The playing/paused state is still communicated via `aria-pressed` and live regions — the animation is a visual-only enhancement.

### 6.2 Animation Duration Guidance

- Vinyl spin: continuous, indefinite — acceptable if user has not requested reduced motion
- Transition durations ≤ 150ms are generally not considered triggering for vestibular disorders
- Never use infinite flashing or strobing effects

---

## 7. Forms and Inputs

### 7.1 Search Input

```html
<form role="search" aria-label="YouTube track search">
  <label for="search-input" class="sr-only">Search YouTube</label>
  <input
    type="search"
    id="search-input"
    name="q"
    placeholder="Search YouTube..."
    aria-label="Search YouTube for tracks"
    aria-describedby="search-hint"
    autocomplete="off"
    autocorrect="off"
    spellcheck="false"
  />
  <span id="search-hint" class="sr-only">Press Enter or click Search to find tracks</span>
  <button type="submit" aria-label="Search">SEARCH</button>
</form>
```

### 7.2 Input Validation Feedback

If the search returns an error (API failure, quota exceeded):
```html
<div role="alert" id="search-error" aria-live="assertive">
  Search failed: YouTube API quota exceeded. Try again later.
</div>
```

---

## 8. Focus Management Patterns

### 8.1 Loading States

When search or track loading is in progress:
- Disable the triggering button: `aria-disabled="true"` (not `disabled` to keep focusability)
- Set `aria-busy="true"` on the results container
- Show a spinner with `role="status"` and `aria-label="Loading..."`

```html
<div role="status" aria-label="Loading search results" class="spinner" aria-hidden="false"></div>
```

Once loaded:
- Remove spinner
- Set `aria-busy="false"` on results container
- Focus the first result if the user triggered search via button click

### 8.2 Track Load Confirmation

After clicking "Load to Deck A":
- Do NOT move focus away from the track browser
- Announce via live region: `"House Music Mix loaded to Deck A"`
- The button briefly shows confirmation state (visual only)

### 8.3 Modal Open/Close

On modal open:
1. Set `aria-hidden="true"` on all elements outside the modal
2. Move focus to modal's first interactive element
3. Lock scroll on the body

On modal close:
1. Remove `aria-hidden` from main content
2. Return focus to the triggering element (settings gear or avatar button)
3. Restore scroll

---

## 9. Accessible Name Computation Checklist

Before shipping, verify each interactive element has a computable accessible name:

| Element | Method | Notes |
|---------|--------|-------|
| Play/Pause buttons | `aria-label` | Update text when state changes |
| Cue buttons | `aria-label` | Reflect set/empty state |
| Hot cue buttons | `aria-label` | Reflect set timestamp or empty |
| Loop buttons | `aria-label` + `aria-pressed` | Reflect active/inactive |
| TAP button | `aria-label` + visible text | Both present |
| Pitch slider | `<label>` + `aria-valuetext` | Show rate in plain language |
| Volume fader | `<label>` + `aria-valuenow` | Show percentage |
| EQ knobs | `role="slider"` + `aria-label` | Knob identity clear |
| Crossfader | `<label>` + `aria-valuetext` | Describe mix ratio |
| Settings button | `aria-label` | "Open settings" |
| Search input | `<label>` (visually hidden) | Explicit for association |
| Load to Deck buttons | `aria-label` | Include track name |
| Sign In button | `aria-label` on button or visible text | Both present |
| Close modal button | `aria-label` | "Close settings" |

---

## 10. Testing Checklist

### Automated Testing

- [ ] Run axe-core (via `@axe-core/react` in development) — zero critical violations
- [ ] Run Lighthouse accessibility audit — score ≥ 90
- [ ] Validate all ARIA roles with W3C ARIA validator

### Manual Keyboard Testing

- [ ] Tab through entire interface in logical order
- [ ] Operate all controls with keyboard only (no mouse)
- [ ] Verify all keyboard shortcuts work correctly
- [ ] Verify focus is never trapped outside a modal
- [ ] Verify Escape closes modals
- [ ] Verify Skip Navigation link appears on first Tab press

### Screen Reader Testing

- [ ] NVDA + Chrome (Windows): read all interactive elements, verify dynamic announcements
- [ ] VoiceOver + Safari (macOS): verify modal, live regions, slider values
- [ ] Narrator + Edge (Windows): basic smoke test

### Visual Accessibility Testing

- [ ] Verify all text passes contrast ratios listed in Section 2
- [ ] Test in Windows High Contrast Mode (forced-colors media query)
- [ ] Test with `prefers-reduced-motion: reduce` — vinyl does not spin, transitions suppressed
- [ ] Test at 200% browser zoom — no content clipping or overflow

### Windows High Contrast Mode

Add `@media (forced-colors: active)` overrides:
```css
@media (forced-colors: active) {
  .platter {
    border: 2px solid ButtonText;
    background: Canvas;
  }

  .btn--active {
    forced-color-adjust: none;
    background: Highlight;
    color: HighlightText;
  }

  :focus-visible {
    outline: 2px solid Highlight;
  }
}
```
