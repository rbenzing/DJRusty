/**
 * ChannelPanel.tsx — Lists videos from the user's YouTube channel.
 *
 * Fetches from the backend /api/videos endpoint (which proxies YouTube Data API).
 * Shows each video with a DL button to trigger download.
 */
import { useState, useCallback } from 'react';
import { useDownloadStore } from '../../store/downloadStore';
import { useDownloadManager } from '../../hooks/useDownloadManager';
import styles from './ChannelPanel.module.css';

interface ChannelVideo {
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string | null;
  publishedAt: string;
}

interface ChannelResponse {
  items: ChannelVideo[];
  nextPageToken: string | null;
  totalResults: number;
}

const SERVER = 'http://localhost:3001';

export function ChannelPanel() {
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState('');
  const [hasFetched, setHasFetched] = useState(false);

  const { requestDownload } = useDownloadManager();
  const progress = useDownloadStore((s) => s.progress);
  const statusOverrides = useDownloadStore((s) => s.statusOverrides);
  const tracks = useDownloadStore((s) => s.tracks);

  const fetchVideos = useCallback(async (pageToken?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${SERVER}/api/videos`);
      if (channelId.trim()) url.searchParams.set('channelId', channelId.trim());
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
  }, [channelId]);

  function getStatus(videoId: string) {
    return statusOverrides[videoId] ?? tracks.find((t) => t.videoId === videoId)?.status ?? null;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <input
          className={styles.channelInput}
          type="text"
          placeholder="Channel ID (leave blank for own channel)"
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          aria-label="YouTube channel ID"
        />
        <button
          className={styles.syncBtn}
          onClick={() => { setVideos([]); void fetchVideos(); }}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Sync Channel'}
        </button>
      </div>

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}

      {hasFetched && videos.length === 0 && !loading && (
        <div className={styles.empty}>No videos found.</div>
      )}

      {!hasFetched && !loading && (
        <div className={styles.hint}>
          Enter a Channel ID and click Sync Channel to list videos.
        </div>
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
              <div className={styles.info}>
                <span className={styles.title}>{video.title}</span>
              </div>
              <div className={styles.actions}>
                {isDownloading && (
                  <span className={styles.progress}>{Math.round(pct)}%</span>
                )}
                <button
                  className={`${styles.dlBtn} ${isReady ? styles.dlBtnReady : ''}`}
                  disabled={isDownloading}
                  onClick={() => {
                    if (!isReady && !isDownloading) {
                      void requestDownload({
                        videoId: video.videoId,
                        title: video.title,
                        artist: video.artist,
                      });
                    }
                  }}
                  aria-label={isReady ? 'Downloaded' : `Download ${video.title}`}
                >
                  {isReady ? '✓' : 'DL'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {nextPageToken && !loading && (
        <button
          className={styles.loadMoreBtn}
          onClick={() => void fetchVideos(nextPageToken)}
        >
          Load More
        </button>
      )}
    </div>
  );
}

export default ChannelPanel;
