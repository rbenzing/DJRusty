# Story mp3-004: MP3 File Picker

## Summary
Add a "Add MP3 Files" button to the PlaylistPanel header that opens a native file picker, allowing users to browse and select MP3 files to add to a deck's playlist.

## Background
Drag-and-drop is the primary way to add MP3 files (mp3-005), but a file picker button is needed as a keyboard-accessible fallback and for discoverability. The button triggers a hidden `<input type="file">` element. Selected files become `PlaylistEntry` objects with `sourceType: 'mp3'`.

## Acceptance Criteria
- [ ] Each deck column in `PlaylistPanel.tsx` has a "+ Add MP3 Files" button in the `deckHeader` area, next to the CLEAR button
- [ ] Clicking the button opens a native file picker dialog with `accept=".mp3,audio/mpeg"` and `multiple` enabled
- [ ] Selected MP3 files are each added to the target deck's playlist via `playlistStore.addTrack()` with `sourceType: 'mp3'`, `title` parsed from filename (strip `.mp3` extension), `artist: 'Local File'`, `duration: 0` (duration unknown until decode), `file` set to the File object
- [ ] The hidden `<input type="file">` is visually hidden (`sr-only` class), has `tabIndex={-1}` and `aria-hidden="true"`
- [ ] The visible button has `aria-label="Add MP3 files to Deck {deckId} playlist"`
- [ ] Non-MP3 files selected in the picker are silently ignored (only `.mp3` / `audio/mpeg` accepted by the input's `accept` attribute)
- [ ] If the playlist was empty and files are added, the first track is cued in the deck (existing `addTrack` behavior)
- [ ] Button styled consistently with existing CLEAR button in PlaylistPanel

## Technical Notes
- Use a `useRef<HTMLInputElement>` to imperatively trigger `.click()` on the hidden input.
- Parse title from filename: `file.name.replace(/\.mp3$/i, '')`.
- Duration will be 0 initially; it gets updated when the track is decoded and loaded into the AudioEngine (handled by `useAudioEngine` hook in mp3-003).
- The `file` reference on `PlaylistEntry` is a live `File` object. It is valid for the current browser session only.

### Files to modify
- `src/components/Playlist/PlaylistPanel.tsx` -- add button and hidden file input per deck column
- `src/components/Playlist/PlaylistPanel.module.css` -- add button styles

### Files to create
- None (all changes in existing files)

### Edge cases
- User selects 0 files (cancels picker): no-op
- User selects a mix of MP3 and non-MP3 files: only MP3s pass the `accept` filter (browser-level)
- File with very long name: title will be truncated by CSS in PlaylistTrack (existing behavior)

## Dependencies
- mp3-003 (AudioEngine + Store Integration -- so added MP3 tracks can actually play)

## Out of Scope
- OS drag-and-drop (mp3-005)
- Audio decoding and playback (handled by useAudioEngine from mp3-003)
- File type validation beyond the `accept` attribute
