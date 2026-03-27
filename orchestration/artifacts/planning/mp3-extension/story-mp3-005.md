# Story mp3-005: OS File Drag-and-Drop into Playlist

## Summary
Implement the `DropZone` component that wraps each deck column in PlaylistPanel, enabling users to drag MP3 files from their OS file explorer and drop them into a deck's playlist.

## Background
Drag-and-drop is the most natural interaction for a DJ application -- users expect to drag tracks from their file system directly into a deck. This uses the native HTML5 Drag and Drop API (not @dnd-kit, which is for in-app drag). The DropZone handles OS file drags exclusively, identified by checking `event.dataTransfer.types.includes('Files')`.

## Acceptance Criteria
- [ ] `src/components/Playlist/DropZone.tsx` created with props: `deckId`, `onFilesDropped`, `children`
- [ ] `src/components/Playlist/DropZone.module.css` created with idle, valid-drag, invalid-drag states
- [ ] Each deck column in `PlaylistPanel.tsx` is wrapped in a `<DropZone>` component
- [ ] **Idle state:** no visual change; existing panel appearance
- [ ] **Valid drag-over state:** background changes to `rgba(255, 107, 0, 0.08)`, border becomes 2px dashed `var(--color-accent-primary)`, centered overlay text "Drop MP3 files here" with arrow icon (U+2193)
- [ ] **Invalid drag-over state:** background `rgba(192, 57, 43, 0.08)`, border 2px dashed `var(--color-state-error)`, text "MP3 files only"
- [ ] On valid drop: each accepted file (MIME `audio/mpeg` or extension `.mp3`) creates a `PlaylistEntry` with `sourceType: 'mp3'` and is added via `playlistStore.addTrack()`
- [ ] On valid drop: a toast notification "Added {n} track(s) to Deck {deckId}" is shown
- [ ] Drop zone returns to idle state immediately after drop
- [ ] File type validation checks `file.type === 'audio/mpeg'` OR `file.name.endsWith('.mp3')` (some browsers report empty MIME type for drag)
- [ ] Multiple files in a single drop are all accepted (each becomes its own entry)
- [ ] `event.preventDefault()` called on `dragover` to enable drop
- [ ] Drag events from in-app drags (no `Files` in dataTransfer.types) are ignored by the DropZone
- [ ] DropZone has `role="region"` and `aria-label="Deck {deckId} playlist -- drop MP3 files here"`
- [ ] New CSS tokens added to `src/index.css`: `--color-dropzone-valid-bg`, `--color-dropzone-invalid-bg`, `--color-dropzone-valid-border`, `--color-dropzone-invalid-border`

## Technical Notes
- Use internal component state `dragState: 'idle' | 'over-valid' | 'over-invalid'` to control visual feedback.
- Check `event.dataTransfer.items` during `dragover` to inspect MIME types before the drop occurs. If all items are `audio/mpeg`, set `over-valid`; if any item is not, set `over-invalid`. Note: some browsers report `application/x-moz-file` for dragged files -- fall back to accepting if types include `Files`.
- The `dragenter`/`dragleave` counter pattern is needed to handle nested elements: increment on enter, decrement on leave, reset on drop.
- Title parsed from filename: `file.name.replace(/\.mp3$/i, '')`.
- `PlaylistEntry.file` stores the `File` reference for later decoding.
- The overlay message uses `pointer-events: none` so it does not interfere with the drop target.

### Files to create
- `src/components/Playlist/DropZone.tsx`
- `src/components/Playlist/DropZone.module.css`

### Files to modify
- `src/components/Playlist/PlaylistPanel.tsx` -- wrap each deck column in `<DropZone>`
- `src/components/Playlist/PlaylistPanel.module.css` -- minor adjustments for drop zone integration
- `src/index.css` -- add drop zone CSS custom property tokens

### Edge cases
- Dragging a folder: browsers expand folders into individual files. Filter for MP3 only.
- Dragging non-file items (text, images): DropZone must ignore (no `Files` in types).
- Dragging over nested elements (track list items): use `dragenter`/`dragleave` counter to prevent flicker.
- Browser returns empty MIME type for some files: fall back to extension check on drop.
- Empty PlaylistPanel (no tracks): the drop zone overlay should appear over the empty state text.

## Dependencies
- mp3-003 (AudioEngine + Store Integration -- so dropped files can actually play)

## Out of Scope
- In-app drag (reorder/cross-deck) -- that is mp3-014
- Audio decoding and playback (handled by useAudioEngine)
- File picker fallback (mp3-004)
