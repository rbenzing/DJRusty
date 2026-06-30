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
