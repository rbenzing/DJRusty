# Design Spec: Import Button + Drag-and-Drop

**Date:** 2026-06-30  
**Status:** Approved

---

## Overview

Two UX improvements to the DJ Rusty local-audio mixer:

1. **Import button in the Library tab** — a visible "＋ Import Files" button so users can add audio files to the library without needing an empty deck.
2. **Drag-and-drop** — library rows draggable onto deck panels; playlist rows moveable between deck queue columns (cross-deck move).

Approach: native HTML5 drag-and-drop (`draggable`, `dataTransfer`), consistent with existing OS-file drop handling in `Deck.tsx`. No new dependencies.

---

## Feature 1: Import Button in LibraryBrowser

### Problem

`FileImportZone` (inside each Deck) is hidden once a track loads (`!hasTrack`). Once both decks have tracks, there is no visible UI to import more files into the library.

### Solution

Add a **"＋ Import Files" button** and a hidden `<input type="file">` to `LibraryBrowser.tsx`, rendered above the filter input.

**Behaviour:**
- Button click programmatically triggers the hidden file input.
- Input: `multiple`, `accept=".mp3,.wav,.flac,.ogg,.m4a,.aac,audio/*"`.
- On change: calls `useLibraryStore.getState().addFiles(Array.from(e.target.files ?? []))`.
- No deck assignment — files land in the library only. The user loads them to a deck via the existing Load A/B buttons or via drag-and-drop (Feature 2).

**Unchanged:** `FileImportZone` inside each Deck stays as-is — it imports to the library AND appends to that deck's queue.

### Files

| File | Change |
|------|--------|
| `src/components/Library/LibraryBrowser.tsx` | Add hidden file input + "＋ Import Files" button |
| `src/components/Library/LibraryBrowser.module.css` | Style the import button |

---

## Feature 2: Drag-and-Drop

### Shared drag payload type

New file `src/types/dnd.ts`:

```ts
import type { PlaylistEntry } from './playlist';

export type DragPayload =
  | { source: 'library'; trackId: string }
  | { source: 'playlist'; fromDeck: 'A' | 'B'; trackId: string; entry: PlaylistEntry };

export const DND_KEY = 'application/dj-rusty';
```

All drag interactions use `dataTransfer.setData(DND_KEY, JSON.stringify(payload))` and `dataTransfer.getData(DND_KEY)` to read it. The `DND_KEY` namespace avoids collisions with OS file drops.

---

### 2a: Library rows → Deck panels

**Source — `LibraryBrowser.tsx`:**
- Each track row gets `draggable={true}`.
- `onDragStart`: `dataTransfer.setData(DND_KEY, JSON.stringify({ source: 'library', trackId: t.id }))`.
- `dataTransfer.effectAllowed = 'copy'` (it's a copy from library to deck, library entry stays).

**Drop target — `Deck.tsx`:**
- The existing `onDrop` handler already handles OS file drops (`dataTransfer.files`). A new branch is added: if `dataTransfer.getData(DND_KEY)` is present and `source === 'library'`, look up the track in `useLibraryStore.getState().tracks`, then call `usePlaylistStore.getState().addTrack(deckId, libraryTrackToEntry(track))`.
- OS file drop path is unchanged (checked first via `dataTransfer.files.length > 0`).

**Visual feedback:**
- The deck panel already applies a `deckDragover` CSS class on `dragover`. This same class is applied for library drags (no additional style needed).

---

### 2b: Cross-deck playlist drag (Playlist tab)

**Source — `PlaylistPanel.tsx`:**
- Each track row gets `draggable={true}`.
- `onDragStart`: sets `dataTransfer` with `{ source: 'playlist', fromDeck, trackId: entry.id, entry }`.
- `dataTransfer.effectAllowed = 'move'`.

**Drop target — `PlaylistPanel.tsx`:**
- Each deck's queue column gets `onDragOver` (prevent default + set `dropEffect = 'move'`) and `onDrop`.
- On drop, parse `DragPayload`:
  - If `source !== 'playlist'` → ignore (could be a library drag; deck panels handle those).
  - If `fromDeck === toDeck` → ignore (no within-queue reorder).
  - If `fromDeck !== toDeck` → **move**: call `removeEntry(fromDeck, trackId)` then `addTrack(toDeck, entry)`.

**New store action — `src/store/playlistStore.ts`:**

```ts
removeEntry: (deckId: 'A' | 'B', trackId: string) => void
```

Filters the queue by `id !== trackId`. Safe under async state updates (keyed by id, not index). Also adjusts `currentIndex` if the removed entry was before or at the current position.

---

## Data Flow Summary

```
LibraryBrowser row (draggable)
  └─ onDragStart → DND_KEY: { source:'library', trackId }
        └─ Deck.onDrop → addTrack(deckId, libraryTrackToEntry(track))

PlaylistPanel row (draggable)
  └─ onDragStart → DND_KEY: { source:'playlist', fromDeck, trackId, entry }
        └─ PlaylistPanel column.onDrop
              └─ removeEntry(fromDeck, trackId)
              └─ addTrack(toDeck, entry)
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/types/dnd.ts` | New — `DragPayload` union + `DND_KEY` constant |
| `src/components/Library/LibraryBrowser.tsx` | Import button + hidden file input + row `draggable` + `onDragStart` |
| `src/components/Library/LibraryBrowser.module.css` | Import button styles |
| `src/components/Playlist/PlaylistPanel.tsx` | Row `draggable` + `onDragStart`; column `onDragOver`/`onDrop` |
| `src/components/Deck/Deck.tsx` | Extend `onDrop` to handle `DND_KEY` payload (library-to-deck) |
| `src/store/playlistStore.ts` | Add `removeEntry(deckId, trackId)` action |

---

## Testing

| Test file | Covers |
|-----------|--------|
| `src/test/library-import-button.test.tsx` | Import button triggers file input; accepted files appear in library store |
| `src/test/dnd-library-to-deck.test.tsx` | Library row `onDragStart` sets correct `dataTransfer`; `Deck.onDrop` with DND payload calls `addTrack` |
| `src/test/dnd-playlist-crossdeck.test.tsx` | Playlist row drag; cross-deck drop calls `removeEntry` on source + `addTrack` on destination; same-deck drop is ignored |
| `src/test/playlistStore-removeEntry.test.ts` | `removeEntry` removes correct entry; adjusts `currentIndex` correctly |

---

## Out of Scope

- Within-queue reordering (not requested)
- Touch / mobile drag support
- Animated drag-preview customisation
- Drag from Deck panel (e.g. dragging the loaded track name to the other deck)
