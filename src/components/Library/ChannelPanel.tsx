/**
 * ChannelPanel.tsx — Lists videos from the configured YouTube channel.
 *
 * Calls the YouTube Data API directly from the frontend (no backend proxy needed).
 * Uses VITE_YOUTUBE_CHANNEL_ID from env. Falls back to OAuth token or API key.
 */
import { useState, useCallback } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useDownloadStore } from '../../store/downloadStore';
import { useDownloadManager } from '../../hooks/useDownloadManager';
import { fetchChannelVideos } from '../../services/youtubeDataApi';
import type { TrackSummary } from '../../types/search';
import styles from './ChannelPanel.module.css';

const CHANNEL_ID = (import.meta as unknown as { env: Record<string, string | undefined> })
  .env.VITE_YOUTUBE_CHANNEL_ID ?? '';

export function ChannelPanel() {
  const { accessToken } = useAuthStore();
  const [videos, setVideos] = useState<TrackSummary[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const { requestDownload } = useDownloadManager();
  const progress = useDownloadStore((s) => s.progress);
  const statusOverrides = useDownloadStore((s) => s.statusOverrides);
  const tracks = useDownloadStore((s) => s.tracks);

  const fetchVideos = useCallback(async (pageToken?: string) => {
    if (!CHANNEL_ID) {
      setError('VITE_YOUTUBE_CHANNEL_ID is not set in .env');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { results, nextPageToken: newPageToken } = await fetchChannelVideos(
        CHANNEL_ID,
        accessToken,
        pageToken,
      );
      setVideos((prev) => pageToken ? [...prev, ...results] : results);
      setNextPageToken(newPageToken);
      setHasFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch channel videos');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  function getStatus(videoId: string) {
    return statusOverrides[videoId] ?? tracks.find((t) => t.videoId === videoId)?.status ?? null;
  }

  function handleLoadToDeck(deckId: 'A' | 'B', video: TrackSummary) {
    const event = new CustomEvent('dj-rusty:load-track', {
      detail: { deckId, result: video },
    });
    window.dispatchEvent(event);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <span className={styles.channelLabel}>
          {CHANNEL_ID ? `Channel: ${CHANNEL_ID.slice(0, 16)}…` : 'No channel configured'}
        </span>
        <button
          className={styles.syncBtn}
          onClick={() => { setVideos([]); void fetchVideos(); }}
          disabled={loading || !CHANNEL_ID}
        >
          {loading ? 'Loading…' : 'Sync Channel'}
        </button>
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}

      {!hasFetched && !loading && (
        <div className={styles.hint}>Click Sync Channel to load your videos.</div>
      )}

      {hasFetched && videos.length === 0 && !loading && (
        <div className={styles.empty}>No videos found.</div>
      )}

      <ul className={styles.list}>
        {videos.map((video) => {
          const status = getStatus(video.videoId!);
          const pct = progress[video.videoId!] ?? 0;
          const isReady = status === 'ready';
          const isDownloading = status === 'downloading' || status === 'pending';
          return (
            <li key={video.videoId} className={styles.item} data-status={status ?? 'none'}>
              {video.thumbnailUrl && (
                <img src={video.thumbnailUrl} alt="" className={styles.thumb} aria-hidden="true" />
              )}
              <span className={styles.title}>{video.title}</span>
              <div className={styles.actions}>
                {isDownloading && <span className={styles.progress}>{Math.round(pct)}%</span>}
                <button
                  className={`${styles.dlBtn} ${isReady ? styles.dlBtnReady : ''}`}
                  disabled={isDownloading}
                  onClick={() => {
                    if (!isReady && !isDownloading) {
                      void requestDownload({
                        videoId: video.videoId!,
                        title: video.title,
                        artist: video.artist,
                        duration: video.duration,
                        thumbnailUrl: video.thumbnailUrl,
                      });
                    }
                  }}
                >
                  {isReady ? '✓' : 'DL'}
                </button>
                <button
                  className={styles.loadBtn}
                  onClick={() => handleLoadToDeck('A', video)}
                  title="Load to Deck A"
                >
                  A
                </button>
                <button
                  className={`${styles.loadBtn} ${styles.loadBtnB}`}
                  onClick={() => handleLoadToDeck('B', video)}
                  title="Load to Deck B"
                >
                  B
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {nextPageToken && !loading && (
        <button className={styles.loadMoreBtn} onClick={() => void fetchVideos(nextPageToken)}>
          Load More
        </button>
      )}
    </div>
  );
}

export default ChannelPanel;
