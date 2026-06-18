import { create } from 'zustand';
import type { PlaylistEntry } from '../types/playlist';

export interface ImportedTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
  format: string;       // lowercase extension, e.g. 'mp3'
  file: File;
  audioUrl: string;     // blob: URL
  decodeError?: string;
}

const ACCEPTED_EXT = new Set(['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac']);

function extOf(name: string): string { return name.split('.').pop()?.toLowerCase() ?? ''; }
function stripExt(name: string): string { return name.replace(/\.[^/.]+$/, ''); }

interface LibraryState {
  tracks: ImportedTrack[];
  addFiles: (files: File[]) => ImportedTrack[];
  removeTrack: (id: string) => void;
  clear: () => void;
  setDuration: (id: string, duration: number) => void;
  setDecodeError: (id: string, message: string) => void;
  restore: (tracks: ImportedTrack[]) => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  tracks: [],
  addFiles: (files) => {
    const created: ImportedTrack[] = [];
    for (const file of files) {
      const format = extOf(file.name);
      if (!ACCEPTED_EXT.has(format)) continue;
      created.push({
        id: crypto.randomUUID(),
        title: stripExt(file.name),
        artist: 'Local File',
        duration: 0,
        format,
        file,
        audioUrl: URL.createObjectURL(file),
      });
    }
    if (created.length) set({ tracks: [...get().tracks, ...created] });
    return created;
  },
  removeTrack: (id) => {
    const t = get().tracks.find((x) => x.id === id);
    if (t) URL.revokeObjectURL(t.audioUrl);
    set({ tracks: get().tracks.filter((x) => x.id !== id) });
  },
  clear: () => {
    for (const t of get().tracks) URL.revokeObjectURL(t.audioUrl);
    set({ tracks: [] });
  },
  setDuration: (id, duration) =>
    set({ tracks: get().tracks.map((t) => (t.id === id ? { ...t, duration } : t)) }),
  setDecodeError: (id, message) =>
    set({ tracks: get().tracks.map((t) => (t.id === id ? { ...t, decodeError: message } : t)) }),
  restore: (tracks) => {
    for (const t of get().tracks) URL.revokeObjectURL(t.audioUrl);
    set({ tracks });
  },
}));

/** Full PlaylistEntry for a library track — id preserved so cues/grid/sessions align by id. */
export function libraryTrackToEntry(t: ImportedTrack): PlaylistEntry {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    duration: t.duration,
    thumbnailUrl: null,
    file: t.file,
    audioUrl: t.audioUrl,
  };
}
