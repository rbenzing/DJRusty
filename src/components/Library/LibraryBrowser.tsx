import { useState } from 'react';
import { useLibraryStore, libraryTrackToEntry } from '../../store/libraryStore';
import { usePlaylistStore } from '../../store/playlistStore';
import styles from './LibraryBrowser.module.css';

export function LibraryBrowser() {
  const tracks = useLibraryStore((s) => s.tracks);
  const removeTrack = useLibraryStore((s) => s.removeTrack);
  const addTrack = usePlaylistStore((s) => s.addTrack);
  const [filter, setFilter] = useState('');

  const q = filter.trim().toLowerCase();
  const shown = q
    ? tracks.filter((t) => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
    : tracks;

  return (
    <div className={styles.browser} aria-label="Library">
      <input
        className={styles.filter}
        placeholder="Filter library…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Filter library"
      />
      {shown.length === 0 ? (
        <p className={styles.empty}>{tracks.length === 0 ? 'No tracks imported yet.' : 'No matches.'}</p>
      ) : (
        <ul className={styles.list}>
          {shown.map((t) => (
            <li key={t.id} className={styles.row}>
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
