# UI Specification

> Project: `dj-rusty`
> Version: 1.0
> Date: 2026-03-21

---

## 1. Overview

DJRusty is a dark-themed, browser-based DJ controller interface modelled after the Numark MP3 hardware style. The application is a single-page React + TypeScript SPA with no backend. The interface must look and feel like professional DJ hardware: heavy use of blacks, deep greys, amber/orange accent lighting, and tactile-looking controls.

The interface is **desktop-only** (min-width: 1280px). Mobile and tablet layouts are out of scope for v1.

---

## 2. Page Layout

### 2.1 Top-Level Grid

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HEADER  (full width, ~56px tall)                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  DECK A (left, ~38% width)  │  MIXER (center, ~24%)  │  DECK B (right, ~38%)  │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  TRACK BROWSER  (full width, ~220px tall, scrollable)                   │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Minimum viewport**: 1280 × 768px
- **Main content area height**: `calc(100vh - 56px - 220px)` — fills available space between header and browser
- **Deck A / Mixer / Deck B** sit side-by-side in a flex row, full height of the middle zone
- All sections have a `1px solid #1a1a1a` separator between them

### 2.2 Z-Index Layers

| Layer | Z-Index | Purpose |
|-------|---------|---------|
| Base content | 0 | Decks, Mixer, Browser |
| Tooltips | 100 | Hover labels on knobs/buttons |
| Modals | 200 | Settings modal, Error dialogs |
| Toast notifications | 300 | Error / info toasts |

---

## 3. Header

### 3.1 Layout

```
┌───────────────────────────────────────────────────────────────────────┐
│  [Logo: DJ Rusty]          [Settings ⚙]   [Avatar + Name | Sign In]   │
└───────────────────────────────────────────────────────────────────────┘
```

- Full-width, fixed or sticky to top
- Height: `56px`
- Background: `#0d0d0d`
- Bottom border: `1px solid #2a2a2a`
- Padding: `0 24px`

### 3.2 Logo

- Text: "DJ RUSTY" in a bold, wide-tracked font (e.g., `Orbitron`, `Rajdhani`, or `system-ui` bold uppercase)
- Color: `#ff6b00` (amber-orange brand color)
- Font size: `20px`
- Left-aligned

### 3.3 Settings Icon

- Gear icon (Heroicons `cog-6-tooth` or equivalent)
- Color: `#888` idle, `#fff` on hover
- Click opens Settings Modal (see Section 10)
- `aria-label="Open settings"`

### 3.4 Authentication Area (Unauthenticated State)

- Google Sign-In button using Google's official branding guidelines
- Button label: "Sign in with Google"
- Standard Google blue `#4285F4` background or outlined variant
- Positioned at the right end of the header
- `aria-label="Sign in with Google"`

### 3.5 Authentication Area (Authenticated State)

- User avatar (circular, 32px diameter) — fetched from Google profile
- Display name next to avatar, truncated with ellipsis at 140px max-width
- Small chevron/down icon to hint at dropdown (v1: clicking the avatar opens Settings Modal)
- Color: `#e0e0e0`

---

## 4. Deck Component

Both Deck A and Deck B share an identical component structure. Deck A is on the left; Deck B is on the right. They are visually mirrored (labels and layout identical; no functional difference).

### 4.1 Deck Layout (Top to Bottom)

```
┌──────────────────────────────────────────┐
│  DECK LABEL (A or B)    BPM: 128         │
│  Track Title (truncated)                 │
│  Channel Name                            │
├──────────────────────────────────────────┤
│                                          │
│         VINYL PLATTER (circle)           │
│           (spinning animation)           │
│                                          │
├──────────────────────────────────────────┤
│  Time: 01:24 / 04:35      ×1.00          │
├──────────────────────────────────────────┤
│  [◀◀ CUE] [▶ PLAY/PAUSE] [SET CUE]      │
├──────────────────────────────────────────┤
│  HOT CUES: [1] [2] [3] [4]              │
├──────────────────────────────────────────┤
│  LOOPS:  [4B] [8B] [16B] [EXIT]         │
├──────────────────────────────────────────┤
│  TAP BPM: [TAP]                         │
├──────────────────────────────────────────┤
│  PITCH:  [──────●──────] (slider)       │
├──────────────────────────────────────────┤
│  EQ:  BASS [knob]  MID [knob]  TREBLE [knob]  │
├──────────────────────────────────────────┤
│  VOL: [────●──────────] (fader)         │
└──────────────────────────────────────────┘
```

### 4.2 Deck Label & Track Info

- Deck label: "DECK A" or "DECK B" — `12px`, `letter-spacing: 0.15em`, `#888`, uppercase
- BPM display: right-aligned in the same row — `14px bold`, `#ff6b00` when set, `#555` when unset
  - Format: `"128 BPM"` or `"-- BPM"` when unset
- Track title: `14px`, `#e0e0e0`, single line, `text-overflow: ellipsis`
  - Placeholder when empty: `"No track loaded"` in `#444`
- Channel name: `12px`, `#888`, single line, `text-overflow: ellipsis`

### 4.3 Vinyl Platter

- A circular element, diameter `200px` on standard layouts, `240px` on large (≥1440px) viewports
- Background: concentric ring texture — achieved via radial gradients in CSS:
  - Outermost: `#1a1a1a` (dark rubber edge)
  - Mid rings: alternating `#242424` / `#1e1e1e` (grooves)
  - Label center circle (~80px diameter): track thumbnail image (`object-fit: cover`, `border-radius: 50%`), or fallback to a stylized "DR" logo on `#1a1a1a`
- Outer ring shadow: `box-shadow: 0 0 16px rgba(0,0,0,0.8), inset 0 0 8px rgba(0,0,0,0.6)`
- Tonearm indicator: a small triangular notch at the 12 o'clock position, `#ff6b00`, width `4px`

**Spinning Animation:**

```css
@keyframes vinyl-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.platter {
  animation: vinyl-spin linear infinite;
  animation-duration: var(--spin-duration, 1.8s);
  animation-play-state: var(--spin-state, paused);
}
```

- At 1× playback rate: `--spin-duration: 1.8s` (33⅓ RPM equivalent)
- Formula: `duration = 1.8 / playbackRate` (e.g., 1.25× → 1.44s, 0.75× → 2.4s)
- `--spin-state: running` when the deck is playing; `paused` when paused or stopped
- The animation must **not** reset to 0° when paused — CSS `animation-play-state: paused` preserves the angle

### 4.4 Transport Controls

Controls arranged in a single horizontal row, centered beneath the platter.

| Control | Label | State |
|---------|-------|-------|
| Jump to Cue | `◀◀ CUE` | Disabled if no cue set |
| Play/Pause | `▶` / `❙❙` | Toggles; disabled if no track loaded |
| Set Cue | `SET CUE` | Sets cue point at current time |

- Button size: `44px × 36px` minimum touch target
- Play/Pause is the largest and most prominent button (`52px × 40px`), centered
- Active state: `background: #ff6b00`, `color: #000`
- Idle state: `background: #1e1e1e`, `color: #ccc`, `border: 1px solid #333`
- Disabled state: `opacity: 0.35`, `cursor: not-allowed`

**Playback Time Display:**

- Row between platter and transport: `"01:24 / 04:35"` left-aligned, `"×1.00"` right-aligned
- Font: monospace, `13px`, `#aaa`
- Time format: `mm:ss`

### 4.5 Hot Cue Buttons

- 4 buttons labeled `1`, `2`, `3`, `4`
- Size: `36px × 28px`
- Empty cue: `background: #1a1a1a`, `border: 1px solid #333`, `color: #555`
- Set cue: `background: #1a3a5c`, `border: 1px solid #2a6aaa`, `color: #7ab8f5` (blue, denoting stored)
- On hover: slightly brighter border
- Behavior: first click sets; subsequent click jumps; long-press (500ms) clears the cue — show tooltip `"Hold to clear"`
- `aria-label="Hot cue {n}: {set/jump to timestamp}"`

### 4.6 Loop Controls

- 4 buttons: `4B`, `8B`, `16B`, `EXIT`
- `4B` = 4-beat loop, `8B` = 8-beat loop, `16B` = 16-beat loop
- Size: `44px × 28px`
- Inactive: `background: #1a1a1a`, `border: 1px solid #333`, `color: #888`
- Active loop: `background: #1a3a1a`, `border: 1px solid #4a9a4a`, `color: #7fd97f` (green)
- Disabled (no BPM set): `opacity: 0.35`, `cursor: not-allowed`, tooltip `"Set BPM first using TAP"`
- `EXIT` button always enabled when a loop is active; dims otherwise

### 4.7 Tap BPM

- Single button labeled `TAP`
- Size: `80px × 32px`
- Appearance: `background: #1e1e1e`, `border: 1px solid #444`, `color: #ccc`
- On each tap: brief flash to `background: #ff6b00` for 120ms (visual feedback)
- BPM text displayed in the deck header row (see 4.2)
- Tooltip: `"Tap to the beat (4 taps to calculate BPM)"`
- After 3 seconds of inactivity, BPM sequence resets; if only 1–3 taps have occurred, show `"Keep tapping..."` in BPM display area

### 4.8 Pitch Slider

- Horizontal slider control
- Range: visual range maps to discrete values `[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]`
- Default value: `1` (center position)
- Snapping: input value snaps to the nearest valid discrete step
- Track: `height: 4px`, `background: #333`, `border-radius: 2px`
- Fill (left of thumb): `background: #ff6b00`
- Thumb: `16px × 16px` circle, `background: #e0e0e0`, `border: 2px solid #ff6b00`
- Thumb on hover/focus: `box-shadow: 0 0 0 4px rgba(255,107,0,0.3)`
- Labels below: `"0.25×"` at left end, `"1×"` at center, `"2×"` at right end, `10px`, `#666`
- Current value displayed in transport row as `"×1.25"`

### 4.9 EQ Knobs (Visual Only)

Three rotary knobs in a row: `BASS`, `MID`, `TREBLE`.

- Knob size: `40px × 40px`
- Range: −∞ to +6 dB (visual representation only — no audio effect in v1)
- Default position: 12 o'clock (center / 0 dB)
- Knob body: `background: radial-gradient(circle at 35% 35%, #3a3a3a, #111)`, `border-radius: 50%`, `border: 1px solid #444`
- Indicator dot: `width: 3px; height: 8px` white bar positioned at the knob's angle, `transform-origin: bottom center`
- Min rotation: −135° (fully CCW), Max rotation: +135° (fully CW), Center: 0°
- Interaction: click-drag vertical (mouse delta Y controls rotation); scroll wheel supported
- Label below knob: `"BASS"` / `"MID"` / `"TREBLE"`, `10px`, `#666`, uppercase
- **Visual-only badge**: a small `"V1"` or info icon (ⓘ) next to the EQ section label; tooltip on hover: `"EQ is visual only in v1 — audio EQ requires a future audio pipeline upgrade (CORS limitation)"`

### 4.10 Volume Fader

- Horizontal slider, range 0–100
- Default: 80 (80% volume)
- Visually identical to the pitch slider but uses green fill: `background: #3a9a3a`
- Thumb: white circle, `16px`, green border
- Labels: `"0"` at left, `"100"` at right, `10px`, `#666`
- `aria-label="Deck {A/B} volume"`

### 4.11 Hidden YouTube IFrame Container

Each deck contains a hidden (but DOM-present and browser-visible) YouTube IFrame player:

- Positioned in a small section at the bottom of the deck, or in a dedicated mini-player strip
- Dimensions: `min 200px × 113px` (16:9 minimum for ToS compliance)
- Visible to the browser (NOT `display:none` or `visibility:hidden`) but visually de-emphasized:
  - Wrapped in a collapsible `<details>` element labeled `"YouTube Player (required)"`, collapsed by default
  - Or positioned at low opacity in a mini-player bar — `opacity: 1` but `pointer-events: none` so users cannot interact with the raw player
- YouTube attribution and controls must remain per ToS

---

## 5. Mixer Panel

The center column between the two decks. Narrower than the deck panels.

### 5.1 Mixer Layout (Top to Bottom)

```
┌──────────────────────┐
│  MIXER label         │
├──────────────────────┤
│  Channel Gain A  [knob]        │
│  Channel Gain B  [knob]        │
├──────────────────────┤
│  EQ (per-channel visual)       │
│  (optional v1 enhancement)     │
├──────────────────────┤
│  VU Meter A  ||||||||          │
│  VU Meter B  ||||||||          │
├──────────────────────┤
│                      │
│  [═══════●══════]    │
│  CROSSFADER          │
│                      │
│  A ←──────────→ B    │
└──────────────────────┘
```

### 5.2 Channel Gain Knobs

- One rotary knob per channel, positioned at the top of the mixer
- Range: 0–100 (maps to `setVolume()` on the respective player)
- Visual style: same as EQ knobs (Section 4.9) but slightly larger: `48px × 48px`
- Label: `"A"` or `"B"` above knob

### 5.3 VU Meters (Visual)

- Vertical bar stack of 12 segments per channel
- Segments: green for 1–8, yellow for 9–10, red for 11–12
- Active when deck is playing — animate pseudo-randomly to simulate level activity
- When deck is paused/stopped: all segments dark
- Width: `16px` per meter, `4px` gap between segments
- `aria-hidden="true"` (decorative)

### 5.4 Crossfader

- Horizontal slider, full width of the mixer panel
- Range: 0 (full Deck A) to 100 (full Deck B), default: 50 (equal)
- Track: `height: 8px`, `background: linear-gradient(to right, #1a3a5c, #1a1a1a, #3a1a1a)` (blue-left, neutral-center, red-right hint)
- Thumb: `24px × 18px` rounded rectangle (skeuomorphic crossfader cap feel), `background: #c0c0c0`, `border: 1px solid #666`
- Labels: `"A"` at left (`#4a8aff`), `"B"` at right (`#ff4a4a`), `12px bold`
- Center notch: a subtle tick mark at the 50% position on the track
- On input: calls `deckA.setVolume(100 - value)` and `deckB.setVolume(value)` (or a curve-adjusted version)
- `aria-label="Crossfader: Deck A to Deck B"`
- `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow="{current}"`

---

## 6. Track Browser Panel

### 6.1 Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│  [🔍 Search YouTube...                           ] [SEARCH btn]        │
├────────────────────────────────────────────────────────────────────────┤
│  TABS: [My Uploads]  [Search Results]                                  │
├────────────────────────────────────────────────────────────────────────┤
│  [thumb] Title (truncated)              Channel      Duration          │
│          [LOAD TO DECK A]  [LOAD TO DECK B]                            │
│  [thumb] Title ...                                                     │
│          [LOAD TO DECK A]  [LOAD TO DECK B]                            │
│  ...                                                                   │
├────────────────────────────────────────────────────────────────────────┤
│  [← PREV PAGE]                              [NEXT PAGE →]              │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Search Bar

- Full-width text input, height `36px`
- Placeholder: `"Search YouTube..."`
- `background: #1a1a1a`, `border: 1px solid #333`, `color: #e0e0e0`, `border-radius: 4px`
- Focus: `border-color: #ff6b00`, `box-shadow: 0 0 0 2px rgba(255,107,0,0.25)`
- Search button: `"SEARCH"` to the right, `background: #ff6b00`, `color: #000`, `font-weight: bold`
- Submit on Enter key press
- Disabled when unauthenticated: `opacity: 0.5`, tooltip `"Sign in with Google to search"`

### 6.3 Tabs

- Two tabs: `"My Uploads"` and `"Search Results"`
- Active tab: bottom border `2px solid #ff6b00`, text `#fff`
- Inactive tab: text `#666`
- Tab bar bottom border: `1px solid #2a2a2a`

### 6.4 Track List Item

Each result row:
- Height: `64px`
- Thumbnail: `80px × 45px` (16:9), `border-radius: 2px`, `object-fit: cover`
- Track title: `13px`, `#e0e0e0`, max 1 line, `text-overflow: ellipsis`
- Channel name: `11px`, `#888`
- Duration: `11px`, `#aaa`, right-aligned in the same row as title
- Load buttons: `"LOAD A"` and `"LOAD B"`, each `64px × 24px`, `font-size: 11px`
  - `LOAD A`: `background: #1a3a5c`, `color: #7ab8f5`
  - `LOAD B`: `background: #3a1a1a`, `color: #f57a7a`
  - Hover: brighter background
  - `aria-label="Load {track title} to Deck {A/B}"`
- Row hover: `background: #1a1a1a`
- Row separator: `1px solid #1a1a1a`

### 6.5 Empty States

- **Unauthenticated**: `"Sign in with Google to browse your YouTube uploads and search for tracks"` — centered, `#555`, `14px`
- **My Uploads empty**: `"No uploads found on your YouTube channel"` — centered, `#555`
- **Search no results**: `"No results found for "{query}""` — centered, `#555`
- **Loading**: Spinner (CSS animated border, `32px`, amber color)

### 6.6 Pagination

- `"← PREV"` and `"NEXT →"` text buttons
- Only visible when more than one page exists
- `color: #888`, hover `#fff`
- `disabled` when on first/last page

---

## 7. Settings Modal

### 7.1 Trigger

- Clicking the gear icon in the header or clicking the user avatar

### 7.2 Modal Layout

```
┌──────────────────────────────────────────────┐
│  Settings                              [✕]   │
├──────────────────────────────────────────────┤
│  [avatar 48px]  Name                         │
│                 email@gmail.com              │
│                 YouTube: Channel Name        │
│                 Subscribers: 1,234           │
├──────────────────────────────────────────────┤
│  [Sign Out]                                  │
└──────────────────────────────────────────────┘
```

- Max width: `420px`, centered in viewport
- Background: `#1a1a1a`, `border: 1px solid #333`, `border-radius: 8px`
- Overlay backdrop: `rgba(0,0,0,0.75)`
- Close button (×): top-right corner, `aria-label="Close settings"`
- Trap focus within modal when open
- Close on Escape key
- Close on backdrop click

### 7.3 Sign Out Button

- `background: #3a1a1a`, `color: #f57a7a`, `border: 1px solid #aa3a3a`
- On click: clear auth token, reset all app state, close modal

---

## 8. Toast Notifications

- Positioned: top-center, `margin-top: 72px` (below header)
- Width: `320px` max, auto height
- Background: `#1e1e1e`, `border: 1px solid #444`, `border-radius: 6px`
- Left accent border: `4px solid` — color varies by type:
  - Error: `#c0392b`
  - Warning: `#f39c12`
  - Success: `#27ae60`
  - Info: `#2980b9`
- Text: `13px`, `#e0e0e0`
- Auto-dismiss after 5 seconds
- Manual dismiss button (×) at top right
- Stack vertically if multiple toasts

### Toast Message Examples

| Trigger | Message |
|---------|---------|
| Unembeddable video | "This video cannot be played. Choose a different track." |
| Auth denied | "YouTube access required for track browsing. Grant permission to continue." |
| Token expired | "Session expired. Please sign in again." |
| Track loaded | "Track loaded to Deck A." |
| Loop requires BPM | "Set BPM first using the TAP button." |

---

## 9. Responsive Behavior

The interface is desktop-only. The following breakpoints apply:

| Breakpoint | Behavior |
|-----------|----------|
| < 1280px | Show warning banner: "DJRusty requires a minimum viewport of 1280px. Please resize your browser." Interface still renders but may be cramped. |
| 1280px–1439px | Standard layout, vinyl platter 200px diameter |
| 1440px+ | Large layout, vinyl platter 240px diameter, slightly more padding |

---

## 10. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play/Pause Deck A (when focus is on Deck A area) |
| `Enter` | Play/Pause Deck B (when focus is on Deck B area) |
| `←` / `→` | Move crossfader left/right by 5 units |
| `q` | Set Cue on Deck A |
| `w` | Jump to Cue on Deck A |
| `o` | Set Cue on Deck B |
| `p` | Jump to Cue on Deck B |
| `1`–`4` | Jump to Hot Cue 1–4 on focused deck |
| `t` | Tap BPM on Deck A |
| `y` | Tap BPM on Deck B |
| `Escape` | Close open modal |
| `/` | Focus search bar |

Keyboard shortcut reference is available via a `?` icon in the header (tooltip on hover, full list in a help popover).

---

## 11. Component Inventory

| Component | File (suggested) |
|-----------|-----------------|
| `App` | `App.tsx` |
| `Header` | `components/Header.tsx` |
| `DeckPanel` | `components/DeckPanel.tsx` |
| `VinylPlatter` | `components/VinylPlatter.tsx` |
| `TransportControls` | `components/TransportControls.tsx` |
| `HotCues` | `components/HotCues.tsx` |
| `LoopControls` | `components/LoopControls.tsx` |
| `TapBPM` | `components/TapBPM.tsx` |
| `PitchSlider` | `components/PitchSlider.tsx` |
| `EQKnobs` | `components/EQKnobs.tsx` |
| `VolumeFader` | `components/VolumeFader.tsx` |
| `MixerPanel` | `components/MixerPanel.tsx` |
| `Crossfader` | `components/Crossfader.tsx` |
| `VUMeter` | `components/VUMeter.tsx` |
| `TrackBrowser` | `components/TrackBrowser.tsx` |
| `TrackListItem` | `components/TrackListItem.tsx` |
| `SettingsModal` | `components/SettingsModal.tsx` |
| `Toast` | `components/Toast.tsx` |
| `YouTubePlayer` | `components/YouTubePlayer.tsx` |

---

## 12. State Management Summary

The application uses Zustand with the following store slices:

| Slice | Key State |
|-------|-----------|
| `authStore` | `user`, `accessToken`, `isAuthenticated` |
| `deckAStore` | `videoId`, `title`, `channel`, `isPlaying`, `playbackRate`, `volume`, `bpm`, `cuePoint`, `hotCues[4]`, `activeLoop` |
| `deckBStore` | Same as deckA |
| `mixerStore` | `crossfaderValue` (0–100) |
| `browserStore` | `searchQuery`, `searchResults`, `uploads`, `activeTab`, `pageToken` |
| `uiStore` | `settingsOpen`, `toasts[]` |
