/**
 * useDownloadManager.ts — Hook that connects the WebSocket client to downloadStore
 * and exposes download/load functions.
 *
 * Call once at the App root. Connects to the server WebSocket, loads the library,
 * and wires incoming messages to downloadStore actions.
 */
import { useEffect, useCallback } from 'react';
import { wsClient } from '../services/wsClient';
import { useDownloadStore } from '../store/downloadStore';
import type { LibraryTrack } from '../store/downloadStore';

const SERVER = 'http://localhost:3001';

export function useDownloadManager() {
  const { setTracks, setProgress, setStatusOverride, markReady, markError, setLoadingLibrary } =
    useDownloadStore();

  // Connect WebSocket + wire messages
  useEffect(() => {
    wsClient.connect();
    const remove = wsClient.addHandler((msg) => {
      switch (msg.type) {
        case 'download_progress':
          setProgress(msg.videoId, msg.percent);
          break;
        case 'download_complete':
          markReady(msg.videoId, msg.audioUrl);
          break;
        case 'download_error':
          markError(msg.videoId, msg.error);
          break;
        case 'status_update':
          setStatusOverride(msg.videoId, msg.status as LibraryTrack['status']);
          break;
      }
    });
    return remove;
  }, [setProgress, markReady, markError, setStatusOverride]);

  // Load library from server on mount
  useEffect(() => {
    void fetchLibrary();
  }, []);

  async function fetchLibrary() {
    setLoadingLibrary(true);
    try {
      const resp = await fetch(`${SERVER}/api/library`);
      if (!resp.ok) return;
      const data = await resp.json() as Array<{
        id: string; videoId: string; title: string; artist: string;
        duration: number; thumbnailUrl: string | null; filePath: string;
        format: string; status: string; errorMessage: string | null;
      }>;
      const tracks: LibraryTrack[] = data.map((t) => ({
        ...t,
        status: t.status as LibraryTrack['status'],
        audioUrl: `/api/audio/${t.videoId}`,
      }));
      setTracks(tracks);
    } catch { /* server offline — ignore */ }
    finally { setLoadingLibrary(false); }
  }

  const requestDownload = useCallback(async (opts: {
    videoId: string;
    title: string;
    artist?: string;
    duration?: number;
    thumbnailUrl?: string | null;
  }) => {
    setStatusOverride(opts.videoId, 'pending');
    try {
      await fetch(`${SERVER}/api/download/${opts.videoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts),
      });
    } catch { /* server offline */ }
  }, [setStatusOverride]);

  const removeFromLibrary = useCallback(async (videoId: string) => {
    useDownloadStore.getState().removeTrack(videoId);
    try {
      await fetch(`${SERVER}/api/library/${videoId}`, { method: 'DELETE' });
    } catch { /* ignore */ }
  }, []);

  const refreshLibrary = useCallback(() => { void fetchLibrary(); }, []);

  return { requestDownload, removeFromLibrary, refreshLibrary };
}
