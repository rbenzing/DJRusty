# Design System

> Project: `dj-rusty`
> Version: 1.0
> Date: 2026-03-21

---

## 1. Design Philosophy

DJRusty uses a **dark skeuomorphic** aesthetic inspired by professional DJ hardware (Numark, Pioneer CDJ). The interface should feel like a physical device: tactile controls, subtle gradients that simulate depth, amber/orange accent lighting, and purposeful contrast between active and inactive states. It is not a flat design.

Core principles:
- **Dark first**: near-black backgrounds everywhere; never use white as a background
- **Amber accent**: a single amber-orange primary accent color drives all interactive highlights
- **Depth through gradient**: buttons, knobs, and panels use subtle radial or linear gradients to simulate dimension
- **High contrast on interactive states**: active controls must be immediately visible against the dark background
- **Consistent spacing**: an `8px` base grid throughout

---

## 2. Color Tokens

### 2.1 Background Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg-base` | `#0a0a0a` | Page/app root background |
| `--color-bg-surface` | `#111111` | Primary panel background (decks, mixer) |
| `--color-bg-elevated` | `#1a1a1a` | Raised elements (track rows, input fields) |
| `--color-bg-overlay` | `#222222` | Slightly raised sections within panels |
| `--color-bg-modal-backdrop` | `rgba(0, 0, 0, 0.75)` | Modal overlay backdrop |
| `--color-bg-modal` | `#1a1a1a` | Modal container background |

### 2.2 Border Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-border-subtle` | `#1a1a1a` | Separator lines, row dividers |
| `--color-border-default` | `#2a2a2a` | Panel borders, section dividers |
| `--color-border-muted` | `#333333` | Control borders (buttons, inputs) |
| `--color-border-strong` | `#444444` | Focused controls (secondary) |

### 2.3 Text Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-text-primary` | `#e0e0e0` | Main readable text |
| `--color-text-secondary` | `#aaaaaa` | Time displays, durations, secondary labels |
| `--color-text-muted` | `#888888` | Deck labels, channel names, minor labels |
| `--color-text-disabled` | `#444444` | Placeholder text, disabled state text |
| `--color-text-inverse` | `#000000` | Text on amber/bright backgrounds |

### 2.4 Brand / Accent Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-accent-primary` | `#ff6b00` | Logo, active controls, highlights, play state |
| `--color-accent-primary-dim` | `rgba(255, 107, 0, 0.15)` | Accent glow / focus rings |
| `--color-accent-primary-bright` | `#ff8c33` | Hover state on accent elements |

### 2.5 Deck A Accent (Blue)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-deck-a-bg` | `#1a3a5c` | Deck A hot cues, load button, active indicators |
| `--color-deck-a-border` | `#2a6aaa` | Deck A borders (active) |
| `--color-deck-a-text` | `#7ab8f5` | Deck A text accents |

### 2.6 Deck B Accent (Red)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-deck-b-bg` | `#3a1a1a` | Deck B hot cues, load button, active indicators |
| `--color-deck-b-border` | `#aa3a3a` | Deck B borders (active) |
| `--color-deck-b-text` | `#f57a7a` | Deck B text accents |

### 2.7 State Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-state-success` | `#27ae60` | Toast success, loop active (green) |
| `--color-state-success-dim` | `#1a3a1a` | Loop active button background |
| `--color-state-success-border` | `#4a9a4a` | Loop active button border |
| `--color-state-success-text` | `#7fd97f` | Loop active button text |
| `--color-state-warning` | `#f39c12` | Toast warning, VU meter yellow segments |
| `--color-state-error` | `#c0392b` | Toast error, VU meter red segments, sign-out |
| `--color-state-info` | `#2980b9` | Toast info |

### 2.8 VU Meter Segment Colors

| Segment Range | Color |
|--------------|-------|
| 1–8 (low) | `#27ae60` |
| 9–10 (mid) | `#f39c12` |
| 11–12 (peak) | `#c0392b` |
| Inactive | `#1a1a1a` |

---

## 3. Typography

### 3.1 Font Stack

```css
--font-primary: 'Rajdhani', 'Orbitron', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

- `Rajdhani` or `Orbitron` from Google Fonts provides the hardware/technical aesthetic
- Fallback to `system-ui` for loading performance
- Monospace font used exclusively for time displays (current time, duration, BPM values)

### 3.2 Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `--text-xs` | `10px` | 400 | 1.4 | EQ labels, slider end labels, minor captions |
| `--text-sm` | `11px` | 400 | 1.4 | Track list channel names, durations, button text |
| `--text-base` | `13px` | 400 | 1.5 | Track titles, UI labels, search results |
| `--text-md` | `14px` | 600 | 1.4 | BPM display, track info |
| `--text-lg` | `16px` | 600 | 1.3 | Transport button icons, section labels |
| `--text-xl` | `20px` | 700 | 1.2 | Logo text |
| `--text-mono-sm` | `12px` | 400 | 1.0 | Time display (mm:ss) |
| `--text-mono-md` | `13px` | 400 | 1.0 | Playback rate display (×1.25) |
| `--text-mono-lg` | `16px` | 700 | 1.0 | BPM number |

### 3.3 Letter Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--tracking-tight` | `-0.01em` | Large headings |
| `--tracking-normal` | `0` | Body text |
| `--tracking-wide` | `0.08em` | Button labels |
| `--tracking-widest` | `0.15em` | Deck labels (DECK A / DECK B), section headers |

---

## 4. Spacing

Base unit: `8px`. All spacing values are multiples of 4px.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | `4px` | Micro gaps (icon padding, inner control padding) |
| `--space-2` | `8px` | Default small gap (between related controls) |
| `--space-3` | `12px` | Section internal padding |
| `--space-4` | `16px` | Standard padding (panel content padding) |
| `--space-5` | `20px` | Medium separation |
| `--space-6` | `24px` | Header horizontal padding, large gaps |
| `--space-8` | `32px` | Section separation within a deck |
| `--space-10` | `40px` | Inter-panel separation |

---

## 5. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-none` | `0` | Separators, track rows (square feel) |
| `--radius-sm` | `2px` | Thumbnails, small chips |
| `--radius-md` | `4px` | Buttons, inputs, toasts |
| `--radius-lg` | `6px` | Modals, large cards |
| `--radius-full` | `50%` | Circular elements (knobs, platters, avatar) |

---

## 6. Shadows & Elevation

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.5)` | Subtle raised controls |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.6)` | Modals, floating panels |
| `--shadow-platter` | `0 0 16px rgba(0,0,0,0.8), inset 0 0 8px rgba(0,0,0,0.6)` | Vinyl platter |
| `--shadow-button-active` | `0 0 8px rgba(255,107,0,0.4)` | Active/playing button glow |
| `--shadow-focus` | `0 0 0 2px rgba(255,107,0,0.25)` | Keyboard focus outline |
| `--shadow-knob` | `0 2px 4px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05)` | Rotary knob depth |

---

## 7. Component Visual Specifications

### 7.1 Buttons — Base

All buttons share a base token set:

```css
--btn-height-sm: 28px;
--btn-height-md: 36px;
--btn-height-lg: 44px;
--btn-font-size: 11px;
--btn-font-weight: 700;
--btn-letter-spacing: 0.08em;
--btn-border-radius: var(--radius-md);
--btn-transition: background 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
```

#### Button States

| State | Background | Border | Text | Shadow |
|-------|-----------|--------|------|--------|
| Default | `#1e1e1e` | `1px solid #333` | `#cccccc` | none |
| Hover | `#2a2a2a` | `1px solid #444` | `#ffffff` | none |
| Active (pressed) | `#ff6b00` | `1px solid #ff8c33` | `#000000` | `--shadow-button-active` |
| Focused | `#1e1e1e` | `1px solid #ff6b00` | `#ffffff` | `--shadow-focus` |
| Disabled | `#141414` | `1px solid #222` | `#444` | none |

#### Play/Pause Button (special)

- Size: `52px × 40px`
- Playing state: `background: #ff6b00`, icon: ❙❙, `color: #000`
- Paused/stopped state: `background: #1e1e1e`, icon: ▶, `color: #ccc`
- Glow when playing: `box-shadow: 0 0 12px rgba(255,107,0,0.5)`

### 7.2 Vinyl Platter

**Outer ring** (full circle):
- `background: #1a1a1a`
- `border-radius: 50%`
- `box-shadow: var(--shadow-platter)`
- Border: `2px solid #2a2a2a`

**Groove rings** (CSS radial gradient):
```css
background: radial-gradient(
  circle,
  transparent 0%,
  transparent 38%,
  #1e1e1e 39%,
  #242424 40%,
  #1e1e1e 41%,
  #242424 46%,
  #1e1e1e 47%,
  #242424 52%,
  #1e1e1e 53%,
  #242424 58%,
  #1e1e1e 59%,
  #1a1a1a 100%
);
```

**Center label** (inner circle, ~38% of platter diameter):
- `border-radius: 50%`
- Contains track thumbnail: `object-fit: cover`, `border-radius: 50%`
- Fallback: `background: #111`, centered "DR" text in `#ff6b00`
- Border: `2px solid #333`

**Tonearm notch**:
- Small triangle `▲` at 12 o'clock, `color: #ff6b00`, `font-size: 10px`
- Positioned absolutely above the platter edge

**Animation**:
```css
@keyframes vinyl-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.platter {
  animation: vinyl-spin linear infinite;
  animation-duration: var(--spin-duration, 1.8s);
  animation-play-state: var(--spin-state, paused);
  will-change: transform;
}
```

### 7.3 Rotary Knob

**Knob body** (40px × 40px for EQ, 48px × 48px for gain):
```css
background: radial-gradient(circle at 35% 35%, #3a3a3a, #111111);
border-radius: 50%;
border: 1px solid #444444;
box-shadow: var(--shadow-knob);
```

**Indicator marker**:
```css
width: 3px;
height: 8px;
background: #ffffff;
border-radius: 1px;
position: absolute;
bottom: 50%;
left: calc(50% - 1.5px);
transform-origin: bottom center;
transform: rotate(var(--knob-angle, 0deg)) translateY(-12px);
```

- Range: −135° (min) to +135° (max), center = 0°
- Interaction: mousedown + mousemove delta Y — each 1px movement = 1° rotation change
- Scroll wheel: 5° per notch
- Double-click: reset to 0° (center)

### 7.4 Sliders (Pitch and Volume)

**Track**:
```css
height: 4px;
border-radius: 2px;
background: #333333;
```

**Fill** (pitch — amber):
```css
background: linear-gradient(to right, #ff6b00, #ff8c33);
```

**Fill** (volume — green):
```css
background: linear-gradient(to right, #27ae60, #2ecc71);
```

**Thumb**:
```css
width: 16px;
height: 16px;
border-radius: 50%;
background: #e0e0e0;
border: 2px solid var(--thumb-color); /* amber for pitch, green for volume */
box-shadow: 0 1px 4px rgba(0,0,0,0.6);
cursor: grab;
```

**Thumb: hover / focus**:
```css
box-shadow: 0 0 0 4px rgba(255, 107, 0, 0.3); /* or green equivalent */
```

**Thumb: active (dragging)**:
```css
cursor: grabbing;
transform: scale(1.15);
```

### 7.5 Crossfader

**Track** (wider than deck sliders):
```css
height: 8px;
border-radius: 4px;
background: linear-gradient(
  to right,
  #1a3a5c 0%,
  #1a1a1a 40%,
  #1a1a1a 60%,
  #3a1a1a 100%
);
```

**Center notch** (decorative):
```css
position: absolute;
left: 50%;
top: -4px;
width: 1px;
height: calc(100% + 8px);
background: #444;
transform: translateX(-50%);
```

**Thumb** (fader cap):
```css
width: 24px;
height: 18px;
border-radius: 3px;
background: linear-gradient(to bottom, #d0d0d0, #a0a0a0);
border: 1px solid #666;
box-shadow: 0 2px 4px rgba(0,0,0,0.6);
cursor: grab;
```

### 7.6 Hot Cue Buttons

```css
/* Empty state */
.hotcue {
  width: 36px;
  height: 28px;
  background: #1a1a1a;
  border: 1px solid #333333;
  color: #555555;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 700;
}

/* Set state */
.hotcue--set {
  background: #1a3a5c;
  border-color: #2a6aaa;
  color: #7ab8f5;
  box-shadow: 0 0 6px rgba(42, 106, 170, 0.3);
}

/* Hover */
.hotcue:hover {
  border-color: #555;
}

/* Hover on set */
.hotcue--set:hover {
  background: #1e4a72;
  border-color: #3a7abb;
}
```

### 7.7 Loop Buttons

```css
/* Inactive */
.loopbtn {
  width: 44px;
  height: 28px;
  background: #1a1a1a;
  border: 1px solid #333;
  color: #888;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 700;
  letter-spacing: var(--tracking-wide);
}

/* Active loop */
.loopbtn--active {
  background: #1a3a1a;
  border-color: #4a9a4a;
  color: #7fd97f;
  box-shadow: 0 0 8px rgba(74, 154, 74, 0.4);
}

/* Disabled */
.loopbtn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
```

### 7.8 Text Input (Search Bar)

```css
input[type="text"] {
  height: 36px;
  background: #1a1a1a;
  border: 1px solid #333333;
  border-radius: var(--radius-md);
  color: #e0e0e0;
  font-size: var(--text-base);
  padding: 0 var(--space-3);
  outline: none;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

input[type="text"]::placeholder {
  color: #555555;
}

input[type="text"]:focus {
  border-color: #ff6b00;
  box-shadow: 0 0 0 2px rgba(255, 107, 0, 0.25);
}

input[type="text"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### 7.9 Modal

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal {
  background: #1a1a1a;
  border: 1px solid #333333;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  max-width: 420px;
  width: 100%;
  padding: var(--space-6);
  position: relative;
}

.modal__close {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  background: none;
  border: none;
  color: #888;
  font-size: 20px;
  cursor: pointer;
  line-height: 1;
}

.modal__close:hover {
  color: #fff;
}
```

### 7.10 Toast Notification

```css
.toast {
  max-width: 320px;
  background: #1e1e1e;
  border: 1px solid #444;
  border-left: 4px solid var(--toast-accent);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  color: #e0e0e0;
  font-size: var(--text-base);
  box-shadow: var(--shadow-md);
  position: relative;
}

/* Accent colors by type */
.toast--error   { --toast-accent: #c0392b; }
.toast--warning { --toast-accent: #f39c12; }
.toast--success { --toast-accent: #27ae60; }
.toast--info    { --toast-accent: #2980b9; }
```

### 7.11 VU Meter Segments

```css
.vu-segment {
  width: 16px;
  height: 6px;
  border-radius: 1px;
  margin-bottom: 2px;
  background: #1a1a1a; /* inactive */
  transition: background 80ms ease;
}

.vu-segment--active-low    { background: #27ae60; }
.vu-segment--active-mid    { background: #f39c12; }
.vu-segment--active-peak   { background: #c0392b; }
```

---

## 8. Iconography

Use **Heroicons** (24px outline or 20px solid variant) for all icons. Supplement with Unicode characters for transport symbols.

| Symbol | Source | Usage |
|--------|--------|-------|
| ▶ | Unicode `U+25B6` | Play button |
| ❙❙ | Unicode pause symbol or Heroicons `pause` | Pause button |
| ◀◀ | Unicode or custom SVG | Jump to Cue |
| ⚙ | Heroicons `cog-6-tooth` | Settings |
| ✕ | Unicode or Heroicons `x-mark` | Close/dismiss |
| 🔍 | Heroicons `magnifying-glass` | Search |
| ← → | Heroicons `arrow-left` / `arrow-right` | Pagination |
| ⓘ | Unicode `U+24D8` | EQ info hint |

All icon-only buttons must have visible `aria-label` or a visually hidden `<span>` for screen readers.

---

## 9. Animation Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--transition-fast` | `120ms ease` | Button hover, active |
| `--transition-base` | `150ms ease` | Input focus, color changes |
| `--transition-slow` | `300ms ease` | Modal entrance, toast appear |
| `--spin-duration-1x` | `1.8s` | Vinyl spin at 1× speed |

**Vinyl spin duration formula** (applied via inline style or CSS variable):
```
spinDuration = 1.8 / playbackRate (seconds)
```

**Modal entrance**:
```css
@keyframes modal-enter {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}
.modal { animation: modal-enter 300ms ease; }
```

**Toast entrance**:
```css
@keyframes toast-enter {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.toast { animation: toast-enter 200ms ease; }
```

**Button tap flash** (used on TAP BPM button):
```css
@keyframes btn-flash {
  0%   { background: #ff6b00; }
  100% { background: #1e1e1e; }
}
.tapbtn--flash { animation: btn-flash 120ms ease forwards; }
```

---

## 10. CSS Custom Property Sheet (Root)

The following is the complete root variable declaration intended for `:root` in the global CSS file:

```css
:root {
  /* Backgrounds */
  --color-bg-base: #0a0a0a;
  --color-bg-surface: #111111;
  --color-bg-elevated: #1a1a1a;
  --color-bg-overlay: #222222;
  --color-bg-modal: #1a1a1a;
  --color-bg-modal-backdrop: rgba(0, 0, 0, 0.75);

  /* Borders */
  --color-border-subtle: #1a1a1a;
  --color-border-default: #2a2a2a;
  --color-border-muted: #333333;
  --color-border-strong: #444444;

  /* Text */
  --color-text-primary: #e0e0e0;
  --color-text-secondary: #aaaaaa;
  --color-text-muted: #888888;
  --color-text-disabled: #444444;
  --color-text-inverse: #000000;

  /* Accent */
  --color-accent-primary: #ff6b00;
  --color-accent-primary-dim: rgba(255, 107, 0, 0.15);
  --color-accent-primary-bright: #ff8c33;

  /* Deck A (blue) */
  --color-deck-a-bg: #1a3a5c;
  --color-deck-a-border: #2a6aaa;
  --color-deck-a-text: #7ab8f5;

  /* Deck B (red) */
  --color-deck-b-bg: #3a1a1a;
  --color-deck-b-border: #aa3a3a;
  --color-deck-b-text: #f57a7a;

  /* State */
  --color-state-success: #27ae60;
  --color-state-success-dim: #1a3a1a;
  --color-state-success-border: #4a9a4a;
  --color-state-success-text: #7fd97f;
  --color-state-warning: #f39c12;
  --color-state-error: #c0392b;
  --color-state-info: #2980b9;

  /* Typography */
  --font-primary: 'Rajdhani', 'Orbitron', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  --text-xs: 10px;
  --text-sm: 11px;
  --text-base: 13px;
  --text-md: 14px;
  --text-lg: 16px;
  --text-xl: 20px;
  --tracking-wide: 0.08em;
  --tracking-widest: 0.15em;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;

  /* Border radius */
  --radius-none: 0;
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 6px;
  --radius-full: 50%;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.5);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.6);
  --shadow-platter: 0 0 16px rgba(0,0,0,0.8), inset 0 0 8px rgba(0,0,0,0.6);
  --shadow-button-active: 0 0 8px rgba(255,107,0,0.4);
  --shadow-focus: 0 0 0 2px rgba(255,107,0,0.25);
  --shadow-knob: 0 2px 4px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05);

  /* Transitions */
  --transition-fast: 120ms ease;
  --transition-base: 150ms ease;
  --transition-slow: 300ms ease;

  /* Vinyl */
  --spin-duration: 1.8s;
  --spin-state: paused;

  /* Buttons */
  --btn-height-sm: 28px;
  --btn-height-md: 36px;
  --btn-height-lg: 44px;
}
```

---

## 11. Tailwind Configuration (if using Tailwind)

If the team chooses Tailwind CSS over CSS Modules, extend the default theme with:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'bg-base': '#0a0a0a',
        'bg-surface': '#111111',
        'bg-elevated': '#1a1a1a',
        'accent': '#ff6b00',
        'accent-bright': '#ff8c33',
        'deck-a': '#1a3a5c',
        'deck-b': '#3a1a1a',
        'success': '#27ae60',
        'warning': '#f39c12',
        'error': '#c0392b',
      },
      fontFamily: {
        'dj': ['Rajdhani', 'Orbitron', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      animation: {
        'vinyl-spin': 'vinyl-spin var(--spin-duration, 1.8s) linear infinite',
        'modal-enter': 'modal-enter 300ms ease',
        'toast-enter': 'toast-enter 200ms ease',
        'btn-flash': 'btn-flash 120ms ease forwards',
      },
      keyframes: {
        'vinyl-spin': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'modal-enter': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
};
```
