# Design System — MP3 Extension
**Project:** mp3-extension
**Phase:** UI Design
**Date:** 2026-03-25
**Source:** Extracted from `src/index.css` (CSS custom properties) and component CSS Modules

---

## Color Tokens

All tokens are CSS custom properties defined in `src/index.css` `:root`.

### Backgrounds
| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg-base` | `#0a0a0a` | Page/app background |
| `--color-bg-surface` | `#111111` | Card and panel surfaces (decks, search panel) |
| `--color-bg-elevated` | `#1a1a1a` | Elevated elements (hover backgrounds, dropdowns) |
| `--color-bg-overlay` | `#222222` | Overlays, input backgrounds, waveform background |
| `--color-bg-modal` | `#1a1a1a` | Modal backgrounds |
| `--color-bg-modal-backdrop` | `rgba(0,0,0,0.75)` | Modal backdrop scrim |

### Borders
| Token | Value | Usage |
|-------|-------|-------|
| `--color-border-subtle` | `#1a1a1a` | Very subtle section dividers |
| `--color-border-default` | `#2a2a2a` | Default panel and component borders |
| `--color-border-muted` | `#333333` | Button borders at rest |
| `--color-border-strong` | `#444444` | Button borders on hover |

### Text
| Token | Value | Usage |
|-------|-------|-------|
| `--color-text-primary` | `#e0e0e0` | Primary readable text |
| `--color-text-secondary` | `#aaaaaa` | Secondary/supporting text |
| `--color-text-muted` | `#888888` | Labels, placeholders |
| `--color-text-disabled` | `#444444` | Disabled text, empty state hints |
| `--color-text-inverse` | `#000000` | Text on colored/accent backgrounds |

### Accent (Orange — Brand)
| Token | Value | Usage |
|-------|-------|-------|
| `--color-accent-primary` | `#ff6b00` | Active states, highlights, played-region on waveform |
| `--color-accent-primary-dim` | `rgba(255,107,0,0.15)` | Subtle accent backgrounds (e.g. `saveBtnAdding`) |
| `--color-accent-primary-bright` | `#ff8c33` | Hover on accent elements |

### Deck A (Blue)
| Token | Value | Usage |
|-------|-------|-------|
| `--color-deck-a-bg` | `#1a3a5c` | Deck A button backgrounds |
| `--color-deck-a-border` | `#2a6aaa` | Deck A borders |
| `--color-deck-a-text` | `#7ab8f5` | Deck A text, waveform bar color |

### Deck B (Red)
| Token | Value | Usage |
|-------|-------|-------|
| `--color-deck-b-bg` | `#3a1a1a` | Deck B button backgrounds |
| `--color-deck-b-border` | `#aa3a3a` | Deck B borders |
| `--color-deck-b-text` | `#f57a7a` | Deck B text, waveform bar color |

### State Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--color-state-success` | `#27ae60` | Success states, active volume slider thumb border |
| `--color-state-success-dim` | `#1a3a1a` | Success dimmed background |
| `--color-state-success-border` | `#4a9a4a` | Success border |
| `--color-state-success-text` | `#7fd97f` | Success text |
| `--color-state-warning` | `#f39c12` | Warning states |
| `--color-state-error` | `#c0392b` | Error states, invalid drag targets |
| `--color-state-info` | `#2980b9` | Info states |

### New Tokens to Add for MP3 Extension
Add these to `src/index.css` `:root`:

```css
/* Waveform */
--color-waveform-a: rgba(122, 184, 245, 0.6);     /* Deck A waveform bars */
--color-waveform-b: rgba(245, 122, 122, 0.6);     /* Deck B waveform bars */
--color-waveform-played: rgba(255, 107, 0, 0.8);  /* Played region bars */
--color-waveform-playhead: #ffffff;               /* Playhead line */

/* Drop zone */
--color-dropzone-valid-bg: rgba(255, 107, 0, 0.08);
--color-dropzone-invalid-bg: rgba(192, 57, 43, 0.08);
--color-dropzone-valid-border: var(--color-accent-primary);
--color-dropzone-invalid-border: var(--color-state-error);
```

---

## Typography

### Font Families
| Token | Value | Usage |
|-------|-------|-------|
| `--font-primary` | `'Rajdhani', 'Orbitron', system-ui, sans-serif` | UI labels, buttons, headings |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', 'Consolas', monospace` | Numbers, time displays, BPM |

### Type Scale
| Token | Value | Usage |
|-------|-------|-------|
| `--text-xs` | `10px` | Micro labels (section headers, track count) |
| `--text-sm` | `11px` | Secondary text, channel names |
| `--text-base` | `13px` | Body text, track titles in search |
| `--text-md` | `14px` | Deck display values, EQ labels |
| `--text-lg` | `16px` | Play button icon |
| `--text-xl` | `20px` | App logo |

### Letter Spacing
| Token | Value | Usage |
|-------|-------|-------|
| `--tracking-wide` | `0.08em` | Most uppercase labels |
| `--tracking-widest` | `0.15em` | Section headers (DECK A, MIXER, EQ) |

---

## Spacing Scale

| Token | Value |
|-------|-------|
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `20px` |
| `--space-6` | `24px` |
| `--space-8` | `32px` |
| `--space-10` | `40px` |

---

## Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| `--radius-none` | `0` | Sharp edges |
| `--radius-sm` | `2px` | Badges, small elements |
| `--radius-md` | `4px` | Buttons, input fields |
| `--radius-lg` | `6px` | Deck outer container |
| `--radius-full` | `50%` | Circular knobs |

---

## Shadows
| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.5)` | Subtle card shadow |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.6)` | Modal/elevated shadow |
| `--shadow-platter` | `0 0 16px rgba(0,0,0,0.8), inset 0 0 8px rgba(0,0,0,0.6)` | Vinyl platter |
| `--shadow-button-active` | `0 0 8px rgba(255,107,0,0.4)` | Active button glow |
| `--shadow-focus` | `0 0 0 2px rgba(255,107,0,0.25)` | Focus ring (all focusable elements) |
| `--shadow-knob` | `0 2px 4px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05)` | EQ/rotary knobs |

---

## Transitions
| Token | Value | Usage |
|-------|-------|-------|
| `--transition-fast` | `120ms ease` | Micro-interactions (button hover, drag state) |
| `--transition-base` | `150ms ease` | Standard transitions (tab change, panel open) |
| `--transition-slow` | `300ms ease` | Search drawer slide, modal enter |

---

## Z-Index Layers
Not tokenized in current codebase. Follow this implicit layering:
- `0` — base content
- `10` — sticky headers
- `50` — search panel drawer
- `100` — modals
- `200` — toasts / notifications

---

## Button Heights
| Token | Value |
|-------|-------|
| `--btn-height-sm` | `28px` |
| `--btn-height-md` | `36px` |
| `--btn-height-lg` | `44px` |

---

## Breakpoints

No breakpoint tokens are defined; the app is desktop-only (mobile out of scope per project brief). The layout uses `flex` with fixed percentage widths: Deck A 38%, Mixer 24%, Deck B 38%.

---

## Component Patterns

### Button Pattern (Transport/Action Buttons)
All transport controls follow the pattern in `DeckControls.module.css`:
```css
height: 36px;
padding: 0 8px;
min-width: 44px;
background: #1e1e1e;
border: 1px solid var(--color-border-muted);
border-radius: var(--radius-md);
color: #cccccc;
font-family: var(--font-primary);
font-size: var(--text-sm);
font-weight: 700;
letter-spacing: var(--tracking-wide);
text-transform: uppercase;
```
Focus state: `box-shadow: var(--shadow-focus)`, `border-color: var(--color-accent-primary)`
Disabled state: `opacity: 0.35`, `cursor: not-allowed`
Active/pressed state (e.g. play button): `background: var(--color-accent-primary)`

### Rotary Knob Pattern
Established by `EQPanel.tsx` and `RotaryKnob.tsx`:
- Size: 40px diameter
- Background: `radial-gradient(circle at 35% 35%, #3a3a3a, #111111)`
- Border: `1px solid #444444`
- Box-shadow: `var(--shadow-knob)`
- Indicator: 3px wide × 8px tall white bar, rotated via CSS custom property `--knob-angle`
- Interaction: vertical mouse drag (drag up = increase), double-click reset
- Keyboard: ArrowUp +1, ArrowDown -1
- Role: `slider` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`
- Focus ring: `var(--shadow-knob), var(--shadow-focus)` combined

### Section Label Pattern
Used throughout: `EQPanel`, `Mixer`, etc.
```css
font-size: var(--text-xs);
color: var(--color-text-muted);
letter-spacing: var(--tracking-widest);
text-transform: uppercase;
font-family: var(--font-primary);
font-weight: 600;
```

### Panel/Section Border Pattern
All deck sub-panels use `border-bottom: 1px solid var(--color-border-subtle)` to divide sections vertically within the deck column.

### Empty State Pattern
```css
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
gap: var(--space-1);
padding: var(--space-4);
text-align: center;
```
Text: `var(--color-text-muted)` (#888888) for primary message, `var(--color-text-disabled)` (#444444) for hints.

### Scrollbar Pattern
All scrollable lists use:
```css
scrollbar-width: thin;
scrollbar-color: var(--color-border-muted) transparent;
```
Webkit: 4px width, `border-radius: 2px`, track transparent.

---

## Icon System

The project uses **Unicode characters and inline SVG** — no icon library is installed.

| Usage | Character/Method |
|-------|-----------------|
| Play | ▶ (U+25B6) |
| Pause | ❚❚ (U+275A U+275A) |
| Settings/Gear | Inline SVG (in App.tsx) |
| Restart | ↺ (U+21BA) |
| Skip back | ⏪ (U+23EA) |
| Skip forward | ⏩ (U+23E9) |
| Previous track | ⏮ (U+23EE) |
| Cue | ⏮ + text "CUE" |
| Drag handle | ⠿ (U+28FF) or ⋮⋮ — NEW for playlist rows |
| Drop indicator arrow | ↓ (U+2193) — NEW for drop zone overlay |
| MP3 badge | Text "MP3" |
| YouTube badge | Text "YT" |

For new SVG icons (waveform loading shimmer indicator, BPM spinner), use CSS-only animations rather than external icons.

---

## Animation Patterns

### CSS Spin Animation (BPM detecting spinner)
```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
/* Usage */
animation: spin 0.8s linear infinite;
```
Respect `prefers-reduced-motion: reduce` — remove animation, show static indicator.

### Waveform Loading Shimmer
```css
@keyframes shimmer {
  0%, 100% { opacity: 0.2; }
  50%       { opacity: 0.6; }
}
animation: shimmer 1.2s ease-in-out infinite;
animation-delay: calc(var(--bar-index) * 0.15s); /* stagger 8 bars */
```

### Vinyl Platter Spin
Existing: controlled by `--spin-duration: 1.8s` and `--spin-state: running | paused`.

### Drag-Over Transition
Drop zone border and background change via:
```css
transition: border var(--transition-base), background var(--transition-base);
```

---

## CSS Module Convention

The project uses CSS Modules (`*.module.css`) for all component styles. Global styles live in `src/index.css`.

**Naming conventions observed:**
- Block element: `.componentName` (camelCase matching component name)
- Modifier: `.componentNameVariant` (e.g. `.playBtnActive`, `.trackActive`)
- State: `.componentNameState` (e.g. `.bpmValueUnset`, `.saveBtnAdding`)

**New component CSS files to create:**
- `src/components/Deck/WaveformDisplay.module.css`
- `src/components/Playlist/DropZone.module.css`
- Update: `src/components/Playlist/PlaylistTrack.module.css` (add drag handle styles)
- Update: `src/components/Playlist/PlaylistPanel.module.css` (add source type badge styles)
