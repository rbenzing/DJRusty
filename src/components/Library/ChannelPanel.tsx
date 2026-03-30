/**
 * ChannelPanel.tsx — Lists videos from the configured YouTube channel.
 *
 * Uses VITE_YOUTUBE_CHANNEL_ID from env (no manual input needed).
 * Fetches from the backend /api/videos endpoint.
 */
import { useState, useCallback } from 'react';
import { useDownloadStore } from '../../store/downloadStore';
import { useDownloadManager } from '../../hooks/useDownloadManager';
import styles from './ChannelPanel.module.css';

const CHANNEL_ID = (import.meta as unknown as { env: Record<string, string | undefined> })
  .env.VITE_YOUTUBE_CHANNEL_ID ?? '';

const SERVER = 'http://localhost:3001';

interface ChannelVideo {
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
}

interface ChannelResponse {
  items: ChannelVideo[];
  nextPageToken: string | null;
}

export function ChannelPanel() {
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
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
      const url = new URL(`${SERVER}/api/videos`);
      url.searchParams.set('channelId', CHANNEL_ID);
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const resp = await fetch(url.toString());
      if (!resp.ok) {
        const body = await resp.json() as { error?: string };
        throw new Error(body.error ?? `HTTP ${resp.status}`);
      }
      const data = await resp.json() as ChannelResponse;
      setVideos((prev) => pageToken ? [...prev, ...data.items] : data.items);
      setNextPageToken(data.nextPageToken);
      setHasFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch channel videos');
    } finally {
      setLoading(false);
    }
  }, []);

  function getStatus(videoId: string) {
    return statusOverrides[videoId] ?? tracks.find((t) => t.videoId === videoId)?.status ?? null;
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
          const status = getStatus(video.videoId);
          const pct = progress[video.videoId] ?? 0;
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
                      void requestDownload({ videoId: video.videoId, title: video.title, artist: video.artist });
                    }
                  }}
                >
                  {isReady ? '✓' : 'DL'}
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
