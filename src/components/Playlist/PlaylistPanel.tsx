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
import styles from './PlaylistPanel.module.css';

export function PlaylistPanel() {
  const playlists = usePlaylistStore((s) => s.playlists);
  const currentIndex = usePlaylistStore((s) => s.currentIndex);
  const clearPlaylist = usePlaylistStore((s) => s.clearPlaylist);
  const jumpToTrack = usePlaylistStore((s) => s.jumpToTrack);
  const removeTrack = usePlaylistStore((s) => s.removeTrack);
  const addTrack = usePlaylistStore((s) => s.addTrack);

  const [dragoverDeck, setDragoverDeck] = useState<'A' | 'B' | null>(null);

  function makeDropHandlers(deckId: 'A' | 'B') {
    return {
      onDragOver(e: DragEvent<HTMLDivElement>) {
        if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragoverDeck(deckId); }
      },
      onDragLeave(e: DragEvent<HTMLDivElement>) {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragoverDeck(null);
      },
      onDrop(e: DragEvent<HTMLDivElement>) {
        e.preventDefault();
        setDragoverDeck(null);
        Array.from(e.dataTransfer.files)
          .filter((f) => f.type.startsWith('audio/'))
          .forEach((file) => {
            const audioUrl = URL.createObjectURL(file);
            const title = file.name.replace(/\.[^/.]+$/, '');
            const entry: Omit<PlaylistEntry, 'id'> = {
              sourceType: 'mp3', title, artist: 'Local File',
              duration: 0, thumbnailUrl: null, file, audioUrl,
            };
            addTrack(deckId, entry);
          });
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
