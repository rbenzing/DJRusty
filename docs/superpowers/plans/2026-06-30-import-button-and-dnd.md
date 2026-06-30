# Import Button + Drag-and-Drop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visible "＋ Import Files" button to the Library tab and native HTML5 drag-and-drop (library rows → deck panels; playlist rows → cross-deck move).

**Architecture:** Three independent tasks: (1) shared DnD type + library→deck drop in `Deck.tsx`; (2) import button + draggable rows in `LibraryBrowser`; (3) cross-deck drag in `PlaylistPanel`/`PlaylistTrack`. All DnD uses `dataTransfer` with a namespaced key `application/dj-rusty` to avoid collision with OS file drops. `playlistStore.removeTrack` (already exists) handles the move-from-source step.

**Tech Stack:** React, TypeScript (strict), Zustand, Vitest + Testing Library, CSS Modules, native HTML5 DnD API.

## Global Constraints

- Zero new runtime dependencies.
- `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` — indexed access is `T | undefined`, optional props cannot be set to `undefined` explicitly.
- ESLint zero-warnings policy (`--max-warnings 0`).
- Every task ends with `npm run test`, `npm run lint`, `npm run build` all passing.
- Commit message format: `feat: <description>`.

---

## Task 1: Shared DnD type + library→deck drop in Deck.tsx

**Files:**
- Create: `src/types/dnd.ts`
- Modify: `src/components/Deck/Deck.tsx`
- Test: `src/test/dnd-library-to-deck.test.tsx`

**Interfaces:**
- Produces:
  - `DND_KEY = 'application/dj-rusty'` (string constant)
  - `type DragPayload = { source: 'library'; trackId: string } | { source: 'playlist'; fromDeck: 'A'|'B'; trackId: string; entry: PlaylistEntry }`
  - `Deck.tsx` extended to handle `DND_KEY` payload in `onDrop` and `onDragOver`
- Consumes: `useLibraryStore`, `libraryTrackToEntry`, `usePlaylistStore.addTrack` (all already imported in `Deck.tsx`)

---

- [ ] **Step 1: Write the failing test** at `src/test/dnd-library-to-deck.test.tsx`

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useLibraryStore } from '../store/libraryStore';
import { usePlaylistStore } from '../store/playlistStore';
import { DND_KEY } from '../types/dnd';

// Minimal Deck mock — we only care about the drop handler wiring, not audio engine.
vi.mock('../hooks/useAudioEngine', () => ({ useAudioEngine: vi.fn() }));
vi.mock('../services/playerRegistry', () => ({
  getActivePlayer: vi.fn(() => null),
  registerPlayer: vi.fn(),
  unregisterPlayer: vi.fn(),
}));

// Import Deck AFTER mocks
// eslint-disable-next-line import/first
import { Deck } from '../components/Deck/Deck';

beforeEach(() => {
  useLibraryStore.getState().clear();
  usePlaylistStore.getState().clearPlaylist('A');
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() } as unknown as typeof URL);
});

function seedLibrary(name = 'Track.mp3') {
  return useLibraryStore.getState().addFiles([
    new File([new Uint8Array([1])], name, { type: 'audio/mpeg' }),
  ])[0]!;
}

it('drops a library DnD payload onto Deck A and appends the track', () => {
  const t = seedLibrary();
  render(<Deck deckId="A" />);

  const deckEl = document.querySelector('[data-deck="a"]')!;
  const payload = JSON.stringify({ source: 'library', trackId: t.id });

  // Simulate dragover with DND_KEY type to check it's accepted
  fireEvent.dragOver(deckEl, {
    dataTransfer: { types: [DND_KEY], files: [], getData: () => payload },
  });

  // Simulate drop
  fireEvent.drop(deckEl, {
    dataTransfer: { types: [DND_KEY], files: [], getData: () => payload },
  });

  const queue = usePlaylistStore.getState().playlists.A;
  expect(queue).toHaveLength(1);
  expect(queue[0]!.id).toBe(t.id);
});

it('ignores a DnD payload for a trackId not in the library', () => {
  render(<Deck deckId="A" />);

  const deckEl = document.querySelector('[data-deck="a"]')!;
  const payload = JSON.stringify({ source: 'library', trackId: 'does-not-exist' });

  fireEvent.drop(deckEl, {
    dataTransfer: { types: [DND_KEY], files: [], getData: () => payload },
  });

  expect(usePlaylistStore.getState().playlists.A).toHaveLength(0);
});
```

- [ ] **Step 2: Run to verify the test fails**

```
npx vitest run src/test/dnd-library-to-deck.test.tsx
```

Expected: FAIL — `DND_KEY` not exported from `src/types/dnd.ts` (file doesn't exist yet).

- [ ] **Step 3: Create `src/types/dnd.ts`**

```ts
import type { PlaylistEntry } from './playlist';

export const DND_KEY = 'application/dj-rusty';

export type DragPayload =
  | { source: 'library'; trackId: string }
  | { source: 'playlist'; fromDeck: 'A' | 'B'; trackId: string; entry: PlaylistEntry };
```

- [ ] **Step 4: Extend `Deck.tsx` to handle `DND_KEY` payload**

Add `import { DND_KEY } from '../../types/dnd';` at the top of `src/components/Deck/Deck.tsx`.

Replace `handleDeckDragOver` with:

```ts
function handleDeckDragOver(e: DragEvent<HTMLDivElement>) {
  const hasFiles = e.dataTransfer.types.includes('Files');
  const hasDndPayload = e.dataTransfer.types.includes(DND_KEY);
  if (hasFiles || hasDndPayload) {
    e.preventDefault();
    setDeckDragover(true);
  }
}
```

Replace `handleDeckDrop` with:

```ts
function handleDeckDrop(e: DragEvent<HTMLDivElement>) {
  e.preventDefault();
  setDeckDragover(false);

  // Branch 1: OS file drop — import to library + append to this deck's queue
  if (e.dataTransfer.files.length > 0) {
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('audio/'));
    if (files.length > 0) {
      const created = useLibraryStore.getState().addFiles(files);
      created.forEach((t) => usePlaylistStore.getState().addTrack(deckId, libraryTrackToEntry(t)));
    }
    return;
  }

  // Branch 2: DnD payload from the library browser
  const raw = e.dataTransfer.getData(DND_KEY);
  if (!raw) return;
  try {
    const payload = JSON.parse(raw) as { source: string; trackId: string };
    if (payload.source !== 'library') return;
    const track = useLibraryStore.getState().tracks.find((t) => t.id === payload.trackId);
    if (!track) return;
    usePlaylistStore.getState().addTrack(deckId, libraryTrackToEntry(track));
  } catch {
    // malformed payload — ignore
  }
}
```

- [ ] **Step 5: Run to verify the test passes**

```
npx vitest run src/test/dnd-library-to-deck.test.tsx
```

Expected: PASS (2 tests).

- [ ] **Step 6: Run full suite + lint + build**

```
npm run test && npm run lint && npm run build
```

Expected: all PASS, 0 lint warnings.

- [ ] **Step 7: Commit**

```bash
git add src/types/dnd.ts src/components/Deck/Deck.tsx src/test/dnd-library-to-deck.test.tsx
git commit -m "feat: shared DnD type + library→deck drop in Deck"
```

---

## Task 2: Import button + draggable library rows

**Files:**
- Modify: `src/components/Library/LibraryBrowser.tsx`
- Modify: `src/components/Library/LibraryBrowser.module.css`
- Test: `src/test/library-import-button.test.tsx`

**Interfaces:**
- Consumes: `DND_KEY`, `DragPayload` from `src/types/dnd.ts`; `useLibraryStore.addFiles`
- Produces: `LibraryBrowser` now renders "＋ Import Files" button + each row is `draggable`

---

- [ ] **Step 1: Write the failing test** at `src/test/library-import-button.test.tsx`

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibraryBrowser } from '../components/Library/LibraryBrowser';
import { useLibraryStore } from '../store/libraryStore';
import { DND_KEY } from '../types/dnd';

beforeEach(() => {
  useLibraryStore.getState().clear();
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() } as unknown as typeof URL);
});

function seed(name: string) {
  return useLibraryStore.getState().addFiles([
    new File([new Uint8Array([1])], name, { type: 'audio/mpeg' }),
  ])[0]!;
}

it('renders an Import Files button', () => {
  render(<LibraryBrowser />);
  expect(screen.getByRole('button', { name: /import files/i })).toBeInTheDocument();
});

it('clicking Import Files triggers the hidden file input', () => {
  render(<LibraryBrowser />);
  const input = screen.getByTestId('library-file-input') as HTMLInputElement;
  const clickSpy = vi.spyOn(input, 'click');
  fireEvent.click(screen.getByRole('button', { name: /import files/i }));
  expect(clickSpy).toHaveBeenCalledOnce();
});

it('selecting files via the input adds them to the library', () => {
  render(<LibraryBrowser />);
  const input = screen.getByTestId('library-file-input') as HTMLInputElement;
  const files = [new File([new Uint8Array([1])], 'New.mp3', { type: 'audio/mpeg' })];
  fireEvent.change(input, { target: { files } });
  expect(useLibraryStore.getState().tracks.map((t) => t.title)).toContain('New');
});

it('library row sets correct DnD payload on dragstart', () => {
  const t = seed('Drag Me.mp3');
  render(<LibraryBrowser />);

  const row = screen.getByText('Drag Me').closest('li')!;
  const setData = vi.fn();
  fireEvent.dragStart(row, {
    dataTransfer: { setData, effectAllowed: '' },
  });

  expect(setData).toHaveBeenCalledWith(
    DND_KEY,
    JSON.stringify({ source: 'library', trackId: t.id }),
  );
});
```

- [ ] **Step 2: Run to verify the test fails**

```
npx vitest run src/test/library-import-button.test.tsx
```

Expected: FAIL — no import button in LibraryBrowser yet.

- [ ] **Step 3: Update `LibraryBrowser.tsx`**

Replace the contents of `src/components/Library/LibraryBrowser.tsx` with:

```tsx
import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useLibraryStore, libraryTrackToEntry } from '../../store/libraryStore';
import { usePlaylistStore } from '../../store/playlistStore';
import { DND_KEY } from '../../types/dnd';
import styles from './LibraryBrowser.module.css';

export function LibraryBrowser() {
  const tracks = useLibraryStore((s) => s.tracks);
  const removeTrack = useLibraryStore((s) => s.removeTrack);
  const addTrack = usePlaylistStore((s) => s.addTrack);
  const [filter, setFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const q = filter.trim().toLowerCase();
  const shown = q
    ? tracks.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
    : tracks;

  function handleImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) useLibraryStore.getState().addFiles(files);
    // Reset so the same file can be re-selected
    e.target.value = '';
  }

  function handleRowDragStart(e: DragEvent<HTMLLIElement>, trackId: string) {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(DND_KEY, JSON.stringify({ source: 'library', trackId }));
  }

  return (
    <div className={styles.browser} aria-label="Library">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".mp3,.wav,.flac,.ogg,.m4a,.aac,audio/*"
        className={styles.hiddenInput}
        data-testid="library-file-input"
        onChange={handleImportChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.importBtn}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Import files"
        >
          ＋ Import Files
        </button>
        <input
          className={styles.filter}
          placeholder="Filter library…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter library"
        />
      </div>

      {shown.length === 0 ? (
        <p className={styles.empty}>{tracks.length === 0 ? 'No tracks imported yet.' : 'No matches.'}</p>
      ) : (
        <ul className={styles.list}>
          {shown.map((t) => (
            <li
              key={t.id}
              className={styles.row}
              draggable
              onDragStart={(e) => handleRowDragStart(e, t.id)}
            >
              <span className={styles.title} title={t.title}>{t.title}</span>
              <span className={styles.meta}>{t.artist} · {t.format}{t.decodeError ? ' · ⚠' : ''}</span>
              <button onClick={() => addTrack('A', libraryTrackToEntry(t))} aria-label={`Load ${t.title} to Deck A`}>A</button>
              <button onClick={() => addTrack('B', libraryTrackToEntry(t))} aria-label={`Load ${t.title} to Deck B`}>B</button>
              <button onClick={() => removeTrack(t.id)} aria-label={`Remove ${t.title} from library`}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update `LibraryBrowser.module.css`**

Add these classes to the end of the existing `src/components/Library/LibraryBrowser.module.css`:

```css
.hiddenInput {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  padding: var(--space-2) var(--space-3);
}

.importBtn {
  flex-shrink: 0;
  padding: var(--space-1) var(--space-2);
  background: none;
  border: 1px solid var(--color-border-muted);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-weight: 700;
  font-family: var(--font-primary);
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--transition-fast), color var(--transition-fast),
    border-color var(--transition-fast);
}

.importBtn:hover {
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  border-color: var(--color-accent);
}
```

Also remove the standalone `.filter` top margin/padding since it's now inside `.toolbar`. Update the existing `.filter` rule — remove `margin` lines and change padding to 0:

```css
.filter {
  flex: 1;
  min-width: 0;
  padding: var(--space-1) var(--space-2);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  font-size: var(--text-sm);
  font-family: var(--font-primary);
  outline: none;
}
```

- [ ] **Step 5: Run to verify the test passes**

```
npx vitest run src/test/library-import-button.test.tsx
```

Expected: PASS (4 tests).

- [ ] **Step 6: Run full suite + lint + build**

```
npm run test && npm run lint && npm run build
```

Expected: all PASS, 0 lint warnings.

- [ ] **Step 7: Commit**

```bash
git add src/components/Library/LibraryBrowser.tsx src/components/Library/LibraryBrowser.module.css src/test/library-import-button.test.tsx
git commit -m "feat: import button + draggable rows in LibraryBrowser"
```

---

## Task 3: Cross-deck drag in PlaylistPanel + PlaylistTrack

**Files:**
- Modify: `src/components/Playlist/PlaylistTrack.tsx`
- Modify: `src/components/Playlist/PlaylistPanel.tsx`
- Test: `src/test/dnd-playlist-crossdeck.test.tsx`

**Interfaces:**
- Consumes:
  - `DND_KEY`, `DragPayload` from `src/types/dnd.ts`
  - `usePlaylistStore.removeTrack(deckId, id)` — already exists; removes by trackId, adjusts `currentIndex`
  - `usePlaylistStore.addTrack(deckId, entry)` — already exists; appends entry preserving id
- Produces:
  - `PlaylistTrack` accepts new optional prop: `onDragStart?: (e: DragEvent<HTMLLIElement>) => void`
  - `PlaylistPanel` makes each row draggable and handles cross-deck DnD drops

---

- [ ] **Step 1: Write the failing test** at `src/test/dnd-playlist-crossdeck.test.tsx`

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlaylistPanel } from '../components/Playlist/PlaylistPanel';
import { usePlaylistStore } from '../store/playlistStore';
import type { PlaylistEntry } from '../types/playlist';
import { DND_KEY } from '../types/dnd';

function makeEntry(id: string, title: string): PlaylistEntry {
  return { id, title, artist: 'Artist', duration: 120, thumbnailUrl: null,
    file: new File([new Uint8Array([1])], `${title}.mp3`, { type: 'audio/mpeg' }),
    audioUrl: 'blob:x' };
}

beforeEach(() => {
  usePlaylistStore.getState().clearPlaylist('A');
  usePlaylistStore.getState().clearPlaylist('B');
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() } as unknown as typeof URL);
});

it('playlist row has draggable attribute and sets DnD payload on dragstart', () => {
  const entry = makeEntry('t1', 'Track One');
  usePlaylistStore.setState({
    playlists: { A: [entry], B: [] },
    currentIndex: { A: 0, B: -1 },
  });
  render(<PlaylistPanel />);

  const li = screen.getByText('Track One').closest('li')!;
  expect(li).toHaveAttribute('draggable', 'true');

  const setData = vi.fn();
  fireEvent.dragStart(li, { dataTransfer: { setData, effectAllowed: '' } });
  expect(setData).toHaveBeenCalledWith(
    DND_KEY,
    JSON.stringify({ source: 'playlist', fromDeck: 'A', trackId: 't1', entry }),
  );
});

it('dropping a playlist row on the other deck moves it', () => {
  const entry = makeEntry('t1', 'Move Me');
  usePlaylistStore.setState({
    playlists: { A: [entry], B: [] },
    currentIndex: { A: 0, B: -1 },
  });
  render(<PlaylistPanel />);

  const payload = JSON.stringify({ source: 'playlist', fromDeck: 'A', trackId: 't1', entry });
  const dt = {
    types: [DND_KEY],
    files: [],
    getData: () => payload,
    setData: vi.fn(),
    dropEffect: '',
  };

  // The Deck B column has aria-label="Deck B queue"
  const deckBCol = screen.getByLabelText('Deck B queue');
  fireEvent.dragOver(deckBCol, { dataTransfer: dt });
  fireEvent.drop(deckBCol, { dataTransfer: dt });

  expect(usePlaylistStore.getState().playlists.A).toHaveLength(0);
  expect(usePlaylistStore.getState().playlists.B).toHaveLength(1);
  expect(usePlaylistStore.getState().playlists.B[0]!.id).toBe('t1');
});

it('dropping a playlist row on the same deck is ignored', () => {
  const entry = makeEntry('t1', 'Stay Here');
  usePlaylistStore.setState({
    playlists: { A: [entry], B: [] },
    currentIndex: { A: 0, B: -1 },
  });
  render(<PlaylistPanel />);

  const payload = JSON.stringify({ source: 'playlist', fromDeck: 'A', trackId: 't1', entry });
  const dt = {
    types: [DND_KEY],
    files: [],
    getData: () => payload,
    setData: vi.fn(),
    dropEffect: '',
  };

  const deckACol = screen.getByLabelText('Deck A queue');
  fireEvent.dragOver(deckACol, { dataTransfer: dt });
  fireEvent.drop(deckACol, { dataTransfer: dt });

  expect(usePlaylistStore.getState().playlists.A).toHaveLength(1);
  expect(usePlaylistStore.getState().playlists.B).toHaveLength(0);
});
```

- [ ] **Step 2: Run to verify the test fails**

```
npx vitest run src/test/dnd-playlist-crossdeck.test.tsx
```

Expected: FAIL — no `draggable` on rows and no `aria-label="Deck A queue"` yet.

- [ ] **Step 3: Update `PlaylistTrack.tsx`** — add optional `onDragStart` prop

Replace `src/components/Playlist/PlaylistTrack.tsx` with:

```tsx
/**
 * PlaylistTrack.tsx — A single row in a deck's playlist panel.
 *
 * Clicking the track info area jumps to that track (loads + plays it).
 * The × button removes the entry from the playlist.
 * The active track is highlighted with a ▶ indicator.
 */
import type { DragEvent } from 'react';
import { formatTime } from '../../utils/formatTime';
import type { PlaylistEntry } from '../../types/playlist';
import styles from './PlaylistTrack.module.css';

interface PlaylistTrackProps {
  entry: PlaylistEntry;
  index: number;
  isActive: boolean;
  deckId: 'A' | 'B';
  onJump: (deckId: 'A' | 'B', index: number) => void;
  onRemove: (deckId: 'A' | 'B', id: string) => void;
  onDragStart?: (e: DragEvent<HTMLLIElement>) => void;
}

export function PlaylistTrack({
  entry,
  index,
  isActive,
  deckId,
  onJump,
  onRemove,
  onDragStart,
}: PlaylistTrackProps) {
  return (
    <li
      className={`${styles.track} ${isActive ? styles.trackActive : ''}`}
      draggable={onDragStart !== undefined}
      onDragStart={onDragStart}
    >
      <button
        type="button"
        className={styles.trackInfo}
        onClick={() => onJump(deckId, index)}
        aria-label={`Play ${entry.title}`}
        aria-current={isActive ? 'true' : undefined}
      >
        <span className={styles.trackIndex} aria-hidden="true">
          {isActive ? '▶' : String(index + 1)}
        </span>
        {entry.thumbnailUrl && (
          <img
            className={styles.thumb}
            src={entry.thumbnailUrl}
            alt=""
            width={40}
            height={22}
            loading="lazy"
            aria-hidden="true"
          />
        )}
        <span className={styles.trackMeta}>
          <span className={styles.trackTitle} title={entry.title}>
            {entry.title}
          </span>
          <span className={styles.trackChannel}>{entry.artist}</span>
        </span>
        <span className={styles.trackDuration}>{formatTime(entry.duration)}</span>
      </button>
      <button
        type="button"
        className={styles.removeBtn}
        onClick={() => onRemove(deckId, entry.id)}
        aria-label={`Remove ${entry.title} from playlist`}
        title="Remove from playlist"
      >
        ×
      </button>
    </li>
  );
}

export default PlaylistTrack;
```

- [ ] **Step 4: Update `PlaylistPanel.tsx`** — add drag source + extend drop handlers

Replace `src/components/Playlist/PlaylistPanel.tsx` with:

```tsx
/**
 * PlaylistPanel.tsx — Split-view playlist panel for Deck A and Deck B.
 *
 * Rendered as a tab inside the search drawer. Shows both deck queues
 * side-by-side, with the active track highlighted. Clicking a track in
 * the list calls jumpToTrack which loads and auto-plays it.
 */
import { useState } from 'react';
import type { DragEvent } from 'react';
import { usePlaylistStore } from '../../store/playlistStore';
import { PlaylistTrack } from './PlaylistTrack';
import type { PlaylistEntry } from '../../types/playlist';
import { DND_KEY } from '../../types/dnd';
import type { DragPayload } from '../../types/dnd';
import styles from './PlaylistPanel.module.css';

export function PlaylistPanel() {
  const playlists = usePlaylistStore((s) => s.playlists);
  const currentIndex = usePlaylistStore((s) => s.currentIndex);
  const clearPlaylist = usePlaylistStore((s) => s.clearPlaylist);
  const jumpToTrack = usePlaylistStore((s) => s.jumpToTrack);
  const removeTrack = usePlaylistStore((s) => s.removeTrack);
  const addTrack = usePlaylistStore((s) => s.addTrack);

  const [dragoverDeck, setDragoverDeck] = useState<'A' | 'B' | null>(null);

  function makeRowDragStart(deckId: 'A' | 'B', entry: PlaylistEntry) {
    return (e: DragEvent<HTMLLIElement>) => {
      e.dataTransfer.effectAllowed = 'move';
      const payload: DragPayload = { source: 'playlist', fromDeck: deckId, trackId: entry.id, entry };
      e.dataTransfer.setData(DND_KEY, JSON.stringify(payload));
    };
  }

  function makeDropHandlers(deckId: 'A' | 'B') {
    return {
      onDragOver(e: DragEvent<HTMLDivElement>) {
        const hasFiles = e.dataTransfer.types.includes('Files');
        const hasDndPayload = e.dataTransfer.types.includes(DND_KEY);
        if (hasFiles || hasDndPayload) {
          e.preventDefault();
          setDragoverDeck(deckId);
        }
      },
      onDragLeave(e: DragEvent<HTMLDivElement>) {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragoverDeck(null);
      },
      onDrop(e: DragEvent<HTMLDivElement>) {
        e.preventDefault();
        setDragoverDeck(null);

        // Branch 1: OS file drop
        if (e.dataTransfer.files.length > 0) {
          Array.from(e.dataTransfer.files)
            .filter((f) => f.type.startsWith('audio/'))
            .forEach((file) => {
              const audioUrl = URL.createObjectURL(file);
              const title = file.name.replace(/\.[^/.]+$/, '');
              const entry: Omit<PlaylistEntry, 'id'> = {
                title, artist: 'Local File',
                duration: 0, thumbnailUrl: null, file, audioUrl,
              };
              addTrack(deckId, entry);
            });
          return;
        }

        // Branch 2: DnD payload — cross-deck playlist move
        const raw = e.dataTransfer.getData(DND_KEY);
        if (!raw) return;
        try {
          const payload = JSON.parse(raw) as DragPayload;
          if (payload.source !== 'playlist') return;
          if (payload.fromDeck === deckId) return; // same deck — ignore
          removeTrack(payload.fromDeck, payload.trackId);
          addTrack(deckId, payload.entry);
        } catch {
          // malformed payload — ignore
        }
      },
    };
  }

  function renderDeck(deckId: 'A' | 'B') {
    const playlist = playlists[deckId];
    const activeIdx = currentIndex[deckId];
    const deckColorVar =
      deckId === 'A' ? 'var(--color-deck-a-text)' : 'var(--color-deck-b-text)';

    const dropHandlers = makeDropHandlers(deckId);
    return (
      <div
        className={`${styles.deckCol}${dragoverDeck === deckId ? ` ${styles.deckColDragover}` : ''}`}
        aria-label={`Deck ${deckId} queue`}
        {...dropHandlers}
      >
        <div className={styles.deckHeader}>
          <span className={styles.deckLabel} style={{ color: deckColorVar }}>
            DECK {deckId}
          </span>
          <span className={styles.deckCount}>
            {playlist.length} {playlist.length === 1 ? 'track' : 'tracks'}
          </span>
          {playlist.length > 0 && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => clearPlaylist(deckId)}
              aria-label={`Clear Deck ${deckId} playlist`}
              title="Clear all tracks"
            >
              CLEAR
            </button>
          )}
        </div>

        {playlist.length === 0 ? (
          <div className={styles.emptyState} aria-label={`Deck ${deckId} playlist empty`}>
            <p>No tracks queued.</p>
            <p>
              Search for a track and click <strong>+{deckId}</strong> to add it here.
            </p>
          </div>
        ) : (
          <ul
            className={styles.trackList}
            aria-label={`Deck ${deckId} playlist — ${playlist.length} tracks`}
          >
            {playlist.map((entry, index) => (
              <PlaylistTrack
                key={entry.id}
                entry={entry}
                index={index}
                isActive={index === activeIdx}
                deckId={deckId}
                onJump={jumpToTrack}
                onRemove={removeTrack}
                onDragStart={makeRowDragStart(deckId, entry)}
              />
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className={styles.panel} aria-label="Deck playlists">
      {renderDeck('A')}
      <div className={styles.divider} role="separator" />
      {renderDeck('B')}
    </div>
  );
}

export default PlaylistPanel;
```

- [ ] **Step 5: Run to verify the test passes**

```
npx vitest run src/test/dnd-playlist-crossdeck.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 6: Run full suite + lint + build**

```
npm run test && npm run lint && npm run build
```

Expected: all PASS, 0 lint warnings.

- [ ] **Step 7: Commit**

```bash
git add src/components/Playlist/PlaylistTrack.tsx src/components/Playlist/PlaylistPanel.tsx src/test/dnd-playlist-crossdeck.test.tsx
git commit -m "feat: cross-deck drag-and-drop in PlaylistPanel"
```
