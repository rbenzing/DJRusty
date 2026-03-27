# Story mp3-014: Cross-Deck Playlist Drag

## Summary
Implement in-app drag-and-drop using `@dnd-kit/core` and `@dnd-kit/sortable` to enable reordering tracks within a playlist and moving tracks between Deck A and Deck B playlists.

## Background
OS file drag-and-drop (mp3-005) handles dragging files from the file system into the app. This story handles in-app drag: reordering tracks within a deck's playlist and moving tracks from one deck's playlist to the other. These are separate interaction paths -- OS file drag uses native HTML5 DnD, while in-app drag uses @dnd-kit.

## Acceptance Criteria
- [ ] `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` packages added to `package.json`
- [ ] `DndContext` provider added to `App.tsx` (or `PlaylistPanel.tsx`) wrapping the playlist area
- [ ] **Drag handle:** Each `PlaylistTrack` row has a grip icon (U+28FF) as the first element, visible on row hover. Color: `var(--color-text-disabled)` at rest, `var(--color-text-muted)` on hover. Cursor: `grab` / `grabbing`.
- [ ] **Reorder within deck:** Dragging a track row up or down within the same deck column reorders the playlist. A 2px orange dashed insert indicator line shows the drop position.
- [ ] `playlistStore.reorderTrack(deckId, fromIndex, toIndex)` action implemented. Moves the entry from `fromIndex` to `toIndex` and adjusts `currentIndex` accordingly.
- [ ] **Cross-deck move:** Dragging a track from Deck A column into Deck B column (or vice versa) moves the track. The source deck removes the entry, the target deck gains it.
- [ ] `playlistStore.moveTrackToDeck(fromDeck, toDeck, entryId)` action implemented. Removes entry from source, appends to target. Adjusts both `currentIndex` values.
- [ ] Cross-deck drop target shows a colored dashed border: Deck A border = `var(--color-deck-a-border)`, Deck B border = `var(--color-deck-b-border)`
- [ ] Dragged row shows opacity 0.4 ghost effect
- [ ] **Keyboard alternative:** Move Up / Move Down buttons appear on each `PlaylistTrack` row when the row has `:focus-within`. Buttons call `reorderTrack`. Move Up disabled on first item, Move Down disabled on last item.
- [ ] `aria-live="polite"` region announces reorder results: "{title} moved to position {n} of {total}"
- [ ] Drag handle has `aria-hidden="true"` and `tabIndex={-1}` (keyboard users use Move buttons)
- [ ] In-app drag events do NOT trigger the OS file DropZone (check `dataTransfer.types` does not include `Files`)
- [ ] TypeScript compilation passes
- [ ] Reorder and cross-deck moves work correctly with active tracks (currentIndex adjusted)

## Technical Notes
- **@dnd-kit setup:** Use `SortableContext` within each deck column for reorder. Use `DndContext` `onDragEnd` handler to detect cross-deck drops by checking if the `over` target belongs to a different deck than the `active` item.
- **Distinguishing OS drag from in-app drag:** The `DropZone` component (mp3-005) checks `event.dataTransfer.types.includes('Files')` to handle OS file drops. @dnd-kit uses its own event system and does not trigger native `dragover`/`drop` events, so there should be no interference.
- **`reorderTrack` implementation:**
  ```typescript
  reorderTrack: (deckId, fromIndex, toIndex) => {
    const playlist = [...get().playlists[deckId]];
    const [moved] = playlist.splice(fromIndex, 1);
    playlist.splice(toIndex, 0, moved);
    // Adjust currentIndex
    let newCurrent = get().currentIndex[deckId];
    if (fromIndex === newCurrent) newCurrent = toIndex;
    else if (fromIndex < newCurrent && toIndex >= newCurrent) newCurrent--;
    else if (fromIndex > newCurrent && toIndex <= newCurrent) newCurrent++;
    set(state => ({
      playlists: { ...state.playlists, [deckId]: playlist },
      currentIndex: { ...state.currentIndex, [deckId]: newCurrent },
    }));
  }
  ```
- **Move button announcement:** Use a hidden `<div role="status" aria-live="polite" className="sr-only">` that updates its text content after each reorder.

### Files to modify
- `src/components/Playlist/PlaylistPanel.tsx` -- add `DndContext`, `SortableContext` per column, handle `onDragEnd`
- `src/components/Playlist/PlaylistTrack.tsx` -- add drag handle, move buttons, make row sortable
- `src/components/Playlist/PlaylistTrack.module.css` -- drag handle styles, move button styles, drag ghost styles
- `src/store/playlistStore.ts` -- add `reorderTrack` and `moveTrackToDeck` actions
- `src/App.tsx` or `PlaylistPanel.tsx` -- add `DndContext` provider
- `package.json` -- add @dnd-kit packages

### Edge cases
- Reorder the active track: `currentIndex` must follow the moved entry
- Remove the active track during a cross-deck move: source deck's `currentIndex` must adjust (if the moved track was the active one, the next track becomes active)
- Single-track playlist reorder: no-op
- Cross-deck move of the last track in a playlist: source playlist becomes empty, `currentIndex` set to -1
- Cross-deck move when target playlist is empty: moved track becomes index 0 and auto-cues

## Dependencies
- mp3-005 (OS File Drag-and-Drop -- to ensure the two drag systems do not conflict)

## Out of Scope
- Drag from search results to playlist (future enhancement)
- Multi-select drag (select multiple tracks and drag them)
- Drag to reorder between non-adjacent positions with animation (basic @dnd-kit handles this)
