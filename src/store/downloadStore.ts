/**
 * downloadStore.ts — Zustand store for download queue and library state.
 *
 * Tracks per-video download status so the UI can show progress,
 * and the loaded library tracks from the server.
 */
import { create } from 'zustand';

export type DownloadStatus = 'pending' | 'downloading' | 'transcoding' | 'ready' | 'error';

export interface LibraryTrack {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnailUrl: string | null;
  filePath: string;
  format: string;
  status: DownloadStatus;
  errorMessage: string | null;
  audioUrl: string;
}

interface DownloadState {
  /** Library tracks fetched from server */
  tracks: LibraryTrack[];
  /** Per-videoId download progress (0–100) */
  progress: Record<string, number>;
  /** Per-videoId download status (overrides track.status while in-flight) */
  statusOverrides: Record<string, DownloadStatus>;
  isLoadingLibrary: boolean;

  // Actions
  setTracks: (tracks: LibraryTrack[]) => void;
  setProgress: (videoId: string, percent: number) => void;
  setStatusOverride: (videoId: string, status: DownloadStatus) => void;
  markReady: (videoId: string, audioUrl: string) => void;
  markError: (videoId: string, error: string) => void;
  setLoadingLibrary: (v: boolean) => void;
  removeTrack: (videoId: string) => void;
}

export const useDownloadStore = create<DownloadState>((set) => ({
  tracks: [],
  progress: {},
  statusOverrides: {},
  isLoadingLibrary: false,

  setTracks: (tracks) => set({ tracks }),
  setProgress: (videoId, percent) =>
    set((s) => ({ progress: { ...s.progress, [videoId]: percent } })),
  setStatusOverride: (videoId, status) =>
    set((s) => ({ statusOverrides: { ...s.statusOverrides, [videoId]: status } })),
  markReady: (videoId, audioUrl) =>
    set((s) => {
      const { [videoId]: _p, ...progress } = s.progress;
      const { [videoId]: _o, ...statusOverrides } = s.statusOverrides;
      const tracks = s.tracks.map((t) =>
        t.videoId === videoId ? { ...t, status: 'ready' as DownloadStatus, audioUrl } : t,
      );
      return { progress, statusOverrides, tracks };
    }),
  markError: (videoId, _error) =>
    set((s) => ({
      statusOverrides: { ...s.statusOverrides, [videoId]: 'error' },
      progress: { ...s.progress, [videoId]: 0 },
    })),
  setLoadingLibrary: (v) => set({ isLoadingLibrary: v }),
  removeTrack: (videoId) =>
    set((s) => ({ tracks: s.tracks.filter((t) => t.videoId !== videoId) })),
}));
