/**
 * DownloadLibrary.tsx — Displays downloaded tracks and their download status.
 *
 * Shows a list of library tracks with progress bars for in-flight downloads.
 * Provides a LOAD button to load a ready track onto a deck.
 */
import { useDownloadStore } from '../../store/downloadStore';
import { usePlaylistStore } from '../../store/playlistStore';
import styles from './DownloadLibrary.module.css';

interface DownloadLibraryProps {
  onRemove?: (videoId: string) => void;
}

export function DownloadLibrary({ onRemove }: DownloadLibraryProps) {
  const tracks = useDownloadStore((s) => s.tracks);
  const progress = useDownloadStore((s) => s.progress);
  const statusOverrides = useDownloadStore((s) => s.statusOverrides);
  const isLoading = useDownloadStore((s) => s.isLoadingLibrary);

  const addTrack = usePlaylistStore((s) => s.addTrack);

  if (isLoading) {
    return <div className={styles.loading}>Loading library…</div>;
  }

  if (tracks.length === 0) {
    return (
      <div className={styles.empty}>
        No downloaded tracks yet. Use the Download button on a YouTube search result.
      </div>
    );
  }

  return (
    <div className={styles.library}>
      <h3 className={styles.heading}>Downloaded Library</h3>
      <ul className={styles.list}>
        {tracks.map((track) => {
          const status = statusOverrides[track.videoId] ?? track.status;
          const pct = progress[track.videoId] ?? 0;
          const isReady = status === 'ready';
          const isDownloading = status === 'downloading' || status === 'pending';
          const isError = status === 'error';

          return (
            <li key={track.videoId} className={styles.item} data-status={status}>
              {track.thumbnailUrl && (
                <img
                  src={track.thumbnailUrl}
                  alt=""
                  className={styles.thumbnail}
                  aria-hidden="true"
                />
              )}
              <div className={styles.info}>
                <span className={styles.title}>{track.title}</span>
                {track.artist && <span className={styles.artist}>{track.artist}</span>}
                {isDownloading && (
                  <div className={styles.progressBar} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                    <span className={styles.progressLabel}>{Math.round(pct)}%</span>
                  </div>
                )}
                {isError && <span className={styles.errorText}>Download failed</span>}
              </div>
              <div className={styles.actions}>
                {isReady && (
                  <>
                    <button
                      className={styles.loadBtn}
                      onClick={() => addTrack('A', {
                        sourceType: 'mp3',
                        title: track.title,
                        artist: track.artist,
                        duration: track.duration,
                        thumbnailUrl: track.thumbnailUrl,
                        audioUrl: `http://localhost:3001/api/audio/${track.videoId}`,
                      })}
                    >
                      LOAD A
                    </button>
                    <button
                      className={styles.loadBtn}
                      onClick={() => addTrack('B', {
                        sourceType: 'mp3',
                        title: track.title,
                        artist: track.artist,
                        duration: track.duration,
                        thumbnailUrl: track.thumbnailUrl,
                        audioUrl: `http://localhost:3001/api/audio/${track.videoId}`,
                      })}
                    >
                      LOAD B
                    </button>
                  </>
                )}
                {onRemove && (
                  <button
                    className={styles.removeBtn}
                    onClick={() => onRemove(track.videoId)}
                    aria-label={`Remove ${track.title}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default DownloadLibrary;
