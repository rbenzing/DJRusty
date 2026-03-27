# UI Specification — MP3 Extension
**Project:** mp3-extension
**Phase:** UI Design
**Date:** 2026-03-25
**Framework:** React + TypeScript + CSS Modules (no Tailwind, no external UI library)

---

## Section 1: Change Inventory

### 1.1 LOAD A / LOAD B Buttons — Remove

**Location:** `src/components/Search/SearchResult.tsx`, lines 130–145

**Current markup:**
```tsx
<button className={`${styles.loadBtn} ${styles.loadBtnA}`}
        onClick={() => onLoadToDeck('A', result)}>
  LOAD A
</button>
<button className={`${styles.loadBtn} ${styles.loadBtnB}`}
        onClick={() => onLoadToDeck('B', result)}>
  LOAD B
</button>
```

**Associated CSS:** `SearchResult.module.css` — classes `.loadBtn`, `.loadBtnA`, `.loadBtnB` (lines 107–137)

**Associated prop:** `onLoadToDeck: (deckId: 'A' | 'B', result: YouTubeVideoSummary) => void` on `SearchResultProps`

**Current behavior:**
- Clicking "LOAD A" dispatches a `dj-rusty:load-track` CustomEvent with `{ deckId: 'A', result }` via `SearchPanel.handleLoadToDeck`
- The event is caught in `App.tsx` `handleLoadTrack`, which calls `useDeckStore.getState().loadTrack(...)` to cue the track directly into the deck — bypassing the playlist
- The event also calls `addRecentTrack` to record the track in recently-played

**Removal scope:**
1. Remove both `<button>` elements from `SearchResult.tsx`
2. Remove `onLoadToDeck` prop from `SearchResultProps` interface
3. Remove `onLoadToDeck` prop threading in `SearchResultList.tsx`, `SearchPanel.tsx`
4. Remove `handleLoadToDeck` function from `SearchPanel.tsx`
5. Remove the `dj-rusty:load-track` listener from `App.tsx` (the event is no longer dispatched)
6. Remove `LoadTrackEventDetail` interface from `App.tsx`
7. Remove `.loadBtn`, `.loadBtnA`, `.loadBtnB` CSS classes from `SearchResult.module.css`
8. Update `Deck.tsx` empty state hint text: change "Search for a track below and click LOAD {deckId}" to "Search for a track below and click +{deckId} to add it to this playlist"

**Replacement:** The `+A` / `+B` queue buttons in `SearchResult.tsx` (lines 147–164) already add tracks to the deck playlist. They become the sole add-to-deck action. No new button is needed.

**Still required after removal:** `addRecentTrack` must now be called when a track advances to the active position from the playlist (in `playlistStore.loadDeckTrack`), not from the load-track event handler.

---

### 1.2 A+ / B+ Buttons — Remove

**Location:** There are NO standalone "A+" or "B+" buttons in the codebase separate from the `+A` / `+B` queue buttons in `SearchResult.tsx`.

**Verification:** Searching the codebase for "A+" / "B+" / "A\+" / "B\+" shows:
- `SearchResult.tsx` lines 154 and 163: button labels `+A` and `+B` — these are the queue buttons and must STAY
- `PlaylistPanel.tsx` line 51: text `+{deckId}` in the empty state hint — keep this
- No separate "A+" or "B+" buttons exist anywhere else

**Conclusion:** The project brief references "A+ / B+ buttons" as duplicates of Load A/B. In the current codebase, the `+A` / `+B` buttons ARE the queue buttons, not a duplicate. They should be kept and promoted as the primary add-to-deck action. No additional removal is required beyond what is covered in Section 1.1.

---

### 1.3 Queue +A / +B Buttons — Keep and Promote

**Location:** `src/components/Search/SearchResult.tsx`, lines 147–164

**Current state:** The `+A` and `+B` buttons call `onQueueToDeck(deckId, result)`, which calls `playlistStore.addTrack(deckId, entry)`. They show a brief `✓A` / `✓B` confirmation for 1500ms after clicking.

**After removing Load A/B:** These become the primary and only way to add a YouTube track to a deck. No behavior change needed.

**Visual enhancement (recommended):** After Load A/B removal, the action buttons area is less crowded. The `+A` / `+B` buttons may be widened slightly from 28px to 40px wide, with a text label ("+ A" / "+ B") that is more discoverable. See Section 1.3a below.

#### 1.3a Queue Button Enhancement Spec
- Width: 40px (from 28px)
- Label: "+ A" and "+ B" (space between + and letter for readability)
- Success state label: "A" / "B" with a checkmark prefix: "A" (unchanged, already clear)
- Color: retain existing `.saveBtn` styles, no change to interaction behavior
- Deck A button hover: matches deck A accent (`--color-deck-a-text` #7ab8f5 on hover border)
- Deck B button hover: matches deck B accent (`--color-deck-b-text` #f57a7a on hover border)

---

## Section 2: Waveform Display

### 2.1 Component: WaveformDisplay

**New file:** `src/components/Deck/WaveformDisplay.tsx` + `WaveformDisplay.module.css`

**Placement:** Inside `Deck.tsx`, between `DeckDisplay` (track info header) and the `.platterSection` (vinyl platter). Rendered below the VinylPlatter section when a track is loaded, or as the primary visual when in MP3-only mode where there is no vinyl platter animation.

**Revised Deck layout order (top to bottom):**
1. `DeckDisplay` — track title, BPM, time
2. `VinylPlatter` (existing, kept for YouTube and MP3 both)
3. **`WaveformDisplay`** — NEW, inserted here
4. `DeckControls`
5. `HotCues`
6. `LoopControls`
7. `SlipButton`
8. `BeatJump`
9. `TapTempo`
10. `PitchSlider`
11. `EQPanel`
12. Volume section

**Dimensions:**
- Width: 100% of deck column (fills the panel with `padding: 0 var(--space-2)`)
- Height: 56px fixed — compact enough to not push controls off screen at typical desktop heights (1080px)
- Min-height: 56px; do not allow the waveform to collapse below this

**Visual Design:**

Background:
- Color: `var(--color-bg-overlay)` (`#222222`)
- Border: 1px solid `var(--color-border-default)` (`#2a2a2a`)
- Border-radius: `var(--radius-md)` (4px)

Waveform bars:
- Rendered as an HTML5 `<canvas>` element filling the full width and height
- Bar color idle: `rgba(122, 184, 245, 0.6)` for Deck A; `rgba(245, 122, 122, 0.6)` for Deck B
  - (Uses the deck accent text colors with 0.6 alpha)
- Bar color for the "played" region (left of playhead): `rgba(255, 107, 0, 0.8)` (accent primary)
- Bar width: 2px with 1px gap (so each "sample" column is 3px total)
- Bar height: proportional to amplitude, centered vertically (mirrored above/below center line)

Playhead:
- A 2px-wide vertical line in white (`#ffffff`)
- Positioned at `currentTime / duration * canvasWidth` pixels from the left
- Has a small triangle notch at the top (4px wide, pointing down) to aid precision seeking
- Moves in real-time as the track plays (on each `currentTime` store update)

Click-to-seek:
- The entire canvas is a click target
- On `mousedown`, compute `seekTime = (clickX / canvasWidth) * duration`
- Dispatch seek via `playerRegistry.get(deckId).seekTo(seekTime, true)`
- Cursor: `crosshair` over the canvas
- On `mouseover`: show a thin ghost playhead (50% opacity white line) following the cursor to preview seek position

**States:**

Empty state (no track loaded):
- Canvas background: `var(--color-bg-overlay)`
- No bars rendered
- Centered text: "No track loaded" in `var(--color-text-disabled)` `#444444`, font-size `var(--text-sm)` 11px, font-family `var(--font-primary)`

Loading state (track ID set but waveform data not yet analyzed):
- Show an animated shimmer: 8 equally-spaced vertical bars at 40% height, cycling through opacity 0.2 → 0.6 → 0.2 with a 1.2s loop
- Animation should respect `prefers-reduced-motion`: if reduced motion, show static bars at 0.4 opacity with no animation
- Accessible label: `aria-label="Waveform loading"`

Ready state (waveform data available):
- Render all bars from the pre-analyzed waveform data array
- Playhead at correct position

**Props:**
```typescript
interface WaveformDisplayProps {
  deckId: 'A' | 'B';
  /** Array of amplitude values 0.0–1.0, one per pixel column of waveform */
  waveformData: Float32Array | null;
  /** Current playback position in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** True while waveform is being analyzed */
  isAnalyzing: boolean;
  /** Called when user clicks to seek; provides the target time in seconds */
  onSeek: (timeSeconds: number) => void;
}
```

**State (internal):**
- `hoverX: number | null` — current mouse X position for ghost playhead preview

**ARIA:**
- `role="img"` on the `<canvas>` with `aria-label="Waveform for {title}, {formatTime(currentTime)} of {formatTime(duration)}"`
- The seek interaction is not keyboard-accessible via the canvas directly; instead a hidden `<input type="range">` positioned below provides keyboard seek (screen reader users use the range input)

---

## Section 3: EQ Controls

### 3.1 Component: EQPanel (Modified, not new)

**Existing file:** `src/components/Deck/EQPanel.tsx` + `EQPanel.module.css`

**Current state:** EQPanel exists and is FULLY implemented with functional rotary knobs that store values in `deckStore` (`eqLow`, `eqMid`, `eqHigh`). The panel is currently labeled "Visual Only" because YouTube cross-origin iframe audio cannot be processed.

**Change required for MP3 mode:** Remove the "Visual Only" badge and update the `aria-label` and `title` attributes to reflect that EQ is now functional for MP3 tracks. No layout change required.

**Specifically:**
- Remove the `<span className={styles.v1Badge}>Visual Only</span>` element
- Remove the `.v1Badge` CSS class
- Update `EqKnob` `aria-label` from `"Deck ${deckId} ${label} EQ: ${valueLabel} (visual only)"` to `"Deck ${deckId} ${label} EQ: ${valueLabel}"`
- Update `EqKnob` `title` from `"Visual only — cross-origin iframe audio cannot be processed"` to `"Double-click to reset to 0 dB"`

**EQ band labels remain as-is:**
- BASS (Low shelf, 80 Hz)
- MID (Peak, 1 kHz)
- TREBLE (High shelf, 12 kHz)

**EQ range remains:** -12 dB to +12 dB, mapped to -135° to +135° knob rotation.

**For the developer's implementation note:** When audio source is YouTube (cross-origin iframe), the EQ store values are saved but Web Audio cannot process the stream. When audio source is MP3 (Web Audio API), the EQ values should be applied to a `BiquadFilterNode` chain:
- Bass: `type: 'lowshelf'`, `frequency: 80`
- Mid: `type: 'peaking'`, `frequency: 1000`, `Q: 1.0`
- Treble: `type: 'highshelf'`, `frequency: 12000`

**No visual redesign of EQPanel.** The existing knob design (40px circular knob, white indicator line, drag to adjust, double-click to reset) is retained verbatim.

---

## Section 4: Drag and Drop UX

### 4.1 OS File Drop — Into PlaylistPanel

**Drop target:** The `PlaylistPanel` deck columns (`.deckCol` in `PlaylistPanel.module.css`) become drop zones for OS MP3 files.

**Drop zone states:**

**Idle (no drag):**
- No visual change; existing panel appearance

**Drag-over (MP3 files detected from OS):**
- Background: `rgba(255, 107, 0, 0.08)` overlay applied to the `.deckCol` element
- Border: 2px dashed `var(--color-accent-primary)` (`#ff6b00`), replacing the existing 1px solid border
- Transition: `border var(--transition-base)` (150ms ease), `background var(--transition-base)`
- A centered overlay message appears inside the drop zone:
  - Text: "Drop MP3 files here" in `var(--color-accent-primary)` (`#ff6b00`)
  - Font: `var(--font-primary)`, 13px, letter-spacing `var(--tracking-wide)`
  - A downward-arrow icon (↓, Unicode U+2193) at 20px above the text, in the same color
  - This overlay is `position: absolute`, `inset: 0`, flex-centered, `pointer-events: none`

**Invalid file type (non-MP3 dragged over):**
- Background: `rgba(192, 57, 43, 0.08)`
- Border: 2px dashed `var(--color-state-error)` (`#c0392b`)
- Overlay message: "MP3 files only" in `#e87070`

**Dropped (files accepted and processing):**
- Drop zone immediately returns to idle state
- Each accepted file becomes a playlist entry appended to the respective deck's playlist
- Toast notification: "Added {n} track(s) to Deck {deckId}" (uses existing `Toast` / `ToastContainer` component in `src/components/common/`)

**File validation on drop:**
- Accept only files with MIME type `audio/mpeg` or extension `.mp3`
- Multiple files accepted in a single drop (each becomes its own playlist entry)
- Reject files that are not MP3 (show invalid-file state, then revert)

### 4.2 DropZone Component

**New file:** `src/components/Playlist/DropZone.tsx` + `DropZone.module.css`

**Purpose:** A wrapper component around the `.deckCol` area that handles `onDragEnter`, `onDragOver`, `onDragLeave`, `onDrop` events and provides the visual states described in 4.1.

**Props:**
```typescript
interface DropZoneProps {
  deckId: 'A' | 'B';
  /** Called with accepted File objects after drop */
  onFilesDropped: (deckId: 'A' | 'B', files: File[]) => void;
  children: React.ReactNode;
}
```

**Internal state:**
- `dragState: 'idle' | 'over-valid' | 'over-invalid'`

**Implementation note:** Use `event.dataTransfer.items` to inspect MIME types during `dragover` (before drop). If all items are `audio/mpeg`, set `over-valid`; if any item is not `audio/mpeg`, set `over-invalid`.

### 4.3 In-App Playlist Row Drag — Reorder Within a Deck

**Component:** `PlaylistTrack.tsx` (modified)

**Drag handle:**
- A `⠿` (U+28FF, braille 6-dot all-filled, visually looks like a grip) or `⋮⋮` (6-dot grip icon) added as the first child of the `<li>`, left of the track index
- Width: 16px, color: `var(--color-text-disabled)` (#444444) at rest
- On hover of the `.track` row: color transitions to `var(--color-text-muted)` (#888888)
- Cursor: `grab` on the handle; `grabbing` while dragging
- The drag handle is the `draggable` element or the `<li>` itself has `draggable="true"`

**Dragging state:**
- The dragged row shows opacity: 0.4 (ghost)
- A 2px orange dashed line appears between rows to indicate drop position (insert indicator)
- Drop indicator line color: `var(--color-accent-primary)` (#ff6b00)
- Other rows are NOT highlighted; only the insert indicator moves

**Drop behavior:**
- On successful drop within the same deck: reorder the playlist entries
- Dispatch a new `playlistStore.reorderTrack(deckId, fromIndex, toIndex)` action (new action to add to playlistStore)

**Cross-deck drag (Deck A playlist to Deck B playlist):**
- Tracks CAN be dragged from one deck column to the other
- Drop target column shows a blue (Deck A) or red (Deck B) 2px dashed border to indicate cross-deck drop
- On successful cross-deck drop: the track is MOVED (removed from source deck, added to target deck) — not copied
- Visual: the dragged row's ghost image shows the track title

### 4.4 In-App Track Drag — From Search Results to Playlist

**Not in scope for this version.** Adding tracks from search is handled via the `+A` / `+B` buttons. Drag from search results to playlist is a future enhancement.

---

## Section 5: Updated PlaylistPanel

### 5.1 Drop Zone Integration

`PlaylistPanel.tsx` is restructured: the `renderDeck(deckId)` output is wrapped in `<DropZone deckId={deckId} onFilesDropped={handleFilesDropped}>`. The `.deckCol` div remains but the drop zone visual states are applied via the `DropZone` component.

### 5.2 Draggable Track Rows

`PlaylistTrack.tsx` receives two new props:
- `onDragStart: (deckId: 'A' | 'B', index: number, event: React.DragEvent) => void`
- `onDrop: (deckId: 'A' | 'B', dropIndex: number, event: React.DragEvent) => void`

The `<li>` element gains `draggable={true}` and drag event handlers.

### 5.3 Source Type Badge (MP3 vs YouTube)

`PlaylistEntry` type gains a new optional field: `sourceType: 'youtube' | 'mp3'`.

Each `PlaylistTrack` row displays a small badge left of the track title:

**YouTube badge:**
- 16x16px rounded square
- Background: `#1a1a1a`
- Border: 1px solid `#333`
- Icon: YT triangle play icon inline SVG or text "YT" at 8px font
- Color: `#ff0000` dimmed to `rgba(255, 0, 0, 0.7)`

**MP3 badge:**
- 16x16px rounded square
- Background: `#1a1a1a`
- Border: 1px solid `#333`
- Icon: text "MP3" at 7px font, letter-spacing 0
- Color: `var(--color-accent-primary)` (#ff6b00)

Badge placement: after the `trackIndex` (position number / play indicator), before the thumbnail.

**Empty state update:** The empty state of each deck column adds a new paragraph:
```
Drag MP3 files here, or search for a track and click +{deckId}
```
This replaces the current single-action hint with the dual-action hint.

---

## Section 6: BPM Display

### 6.1 Existing BPM Display

**Component:** `src/components/Deck/BpmDisplay.tsx` — Already exists.

**Location in layout:** BPM is shown in `DeckDisplay.tsx` as `{bpm} BPM` in the header row (top of deck), displayed via inline span (not using `BpmDisplay.tsx` component). `BpmDisplay.tsx` component exists but is not wired into the main deck — it appears to be unused in the current deck layout.

**Current state in DeckDisplay:**
- Shows `bpm` value from `deckStore.decks[deckId].bpm`
- `bpm` is set via `useDeckStore.setBpm(deckId, bpm)`; currently populated only by tap-tempo
- Color: `var(--color-accent-primary)` (#ff6b00) when set; `#555` when null

**Change required for MP3 mode:** BPM will be auto-detected for MP3 files. The display needs two new visual states:

**BPM Detecting (auto-analysis in progress):**
- Show a small animated spinner (CSS only, 16px) to the left of the `-- BPM` text
- Spinner: 2px border, `var(--color-text-muted)` color, rotates 360° in 0.8s
- Label: `-- BPM` (unchanged text, but spinner communicates loading)
- Accessible: `aria-label="BPM: detecting..."` `aria-busy="true"` on the span

**BPM Detected:**
- Existing display: `{bpm} BPM` in `var(--color-accent-primary)`
- Add `aria-live="polite"` so screen readers announce the new value
- The spinner disappears; the BPM number appears

**BPM Not Set (no track, or YouTube track with no tap tempo):**
- `-- BPM` in `#555` (unchanged)

**DeckStore change needed:** Add a new `bpmDetecting: boolean` field to `DeckState` (default `false`). Set to `true` when MP3 analysis begins, `false` when complete.

**No layout change:** BPM is displayed in the existing position within `DeckDisplay.tsx` header row. No new component placement needed.

---

## Screen Inventory

| Screen | Route | Purpose |
|--------|-------|---------|
| Main App | `/` | Single-page app; 3-column layout: Deck A, Mixer, Deck B |
| Search Drawer | (panel, no route) | Slide-up panel at bottom with Search / Recent / Playlist tabs |
| Playlist Tab | (tab within drawer) | Split view of Deck A and Deck B playlists with drag-drop |

The application is a single-page app with no routing. All UI is contained within one viewport.

---

## Component Tree

```
App
├── YouTubePlayer (hidden, deckId="A")
├── YouTubePlayer (hidden, deckId="B")
├── SettingsModal (portal)
├── header.app-header
│   ├── span.app-logo
│   └── div.app-header-actions
│       ├── button.app-header-settings-btn
│       └── AuthButton
└── main.app-main
    ├── div.app-deck-row
    │   ├── div.app-deck-col [Deck A]
    │   │   └── Deck (deckId="A")
    │   │       ├── DeckDisplay
    │   │       ├── div.platterSection > VinylPlatter
    │   │       ├── WaveformDisplay [NEW]
    │   │       ├── DeckControls
    │   │       ├── HotCues
    │   │       ├── LoopControls
    │   │       ├── SlipButton
    │   │       ├── BeatJump
    │   │       ├── TapTempo
    │   │       ├── PitchSlider
    │   │       ├── EQPanel [MODIFIED: remove Visual Only badge]
    │   │       └── div.volumeSection
    │   ├── div.app-mixer-col
    │   │   └── Mixer
    │   └── div.app-deck-col [Deck B]
    │       └── Deck (deckId="B") [same tree as Deck A]
    └── SearchPanel (isOpen, onToggle)
        ├── button.handle
        └── div.content
            ├── SearchBar
            ├── div[role="tablist"]
            │   ├── button[role="tab"] Search
            │   ├── button[role="tab"] Recent
            │   └── button[role="tab"] Playlist
            ├── div[role="tabpanel"] Search
            │   └── SearchResultList
            │       └── SearchResult[] [MODIFIED: remove LOAD A/B buttons]
            ├── div[role="tabpanel"] Recent
            │   └── SearchResult[] [MODIFIED: same as above]
            └── div[role="tabpanel"] Playlist
                └── PlaylistPanel [MODIFIED]
                    ├── DropZone (deckId="A") [NEW]
                    │   └── div.deckCol
                    │       ├── div.deckHeader
                    │       └── ul.trackList
                    │           └── PlaylistTrack[] [MODIFIED: drag handle, source badge]
                    ├── div.divider
                    └── DropZone (deckId="B") [NEW]
                        └── div.deckCol [same structure]
```

---

## State Management Summary

| UI State | Location | Scope |
|----------|----------|-------|
| `bpm` — detected BPM value | `deckStore.decks[id].bpm` | Per-deck |
| `bpmDetecting` — analysis in progress | `deckStore.decks[id].bpmDetecting` (NEW) | Per-deck |
| `eqLow / eqMid / eqHigh` | `deckStore.decks[id].eqLow/Mid/High` | Per-deck |
| Waveform data | New `waveformData: Float32Array` in deckStore or separate audioStore (Architect decision) | Per-deck |
| Drag state (OS files over drop zone) | Local component state in `DropZone` | Local |
| Drag state (playlist row drag) | Local component state in `PlaylistPanel` | Local |
| Playlist track source type | `playlistStore.playlists[id][n].sourceType` (NEW field) | Per-entry |

---

## Interaction Patterns

### Form Interactions
No new forms are added. EQ knob interactions unchanged (vertical drag, double-click reset, arrow keys).

### Modal Interactions
No new modals.

### Toast Notifications
File drop success: "Added {n} track(s) to Deck {deckId}" using existing `Toast` component in `src/components/common/Toast.tsx`. Toast should auto-dismiss after 3000ms (matches existing pattern if applicable).

### Keyboard Shortcuts
- The "/" key toggles the search drawer (existing, unchanged)
- New: Arrow Up/Down on a focused playlist row cycles between rows (keyboard navigation)
- New: EQ knob ArrowUp/Down already implemented (+1 dB / -1 dB per keypress)
