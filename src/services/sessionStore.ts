import { useLibraryStore, type ImportedTrack, libraryTrackToEntry } from '../store/libraryStore';
import { usePlaylistStore } from '../store/playlistStore';
import { useDeckStore } from '../store/deckStore';
import { getHotCues, setHotCue } from '../utils/hotCues';

const DB = 'dj-rusty';
const STORE = 'sessions';

export interface SavedSession {
  name: string;
  savedAt: number;
  tracks: { id: string; title: string; artist: string; duration: number; format: string; blob: Blob }[];
  deckA: { queue: string[]; currentIndex: number };
  deckB: { queue: string[]; currentIndex: number };
  cues: Record<string, Record<number, number>>;
  grids: Record<string, { bpm: number | null; anchor: number | null }>;
  loops: Record<string, { loopStart: number | null; loopEnd: number | null; loopBeatCount: number | null }>;
}

/** Read a File's bytes into a Blob, compatible with environments that don't support File.arrayBuffer(). */
function fileToBlob(file: File): Promise<Blob> {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer().then((buf) => new Blob([buf], { type: file.type }));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Blob([reader.result as ArrayBuffer], { type: file.type }));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'name' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const r = fn(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

async function snapshot(name: string): Promise<SavedSession> {
  const lib = useLibraryStore.getState().tracks;
  const tracks = await Promise.all(lib.map(async (t) => ({
    id: t.id, title: t.title, artist: t.artist, duration: t.duration, format: t.format,
    blob: await fileToBlob(t.file),
  })));
  const pl = usePlaylistStore.getState();
  const decks = useDeckStore.getState().decks;
  const cues: SavedSession['cues'] = {};
  const grids: SavedSession['grids'] = {};
  const loops: SavedSession['loops'] = {};
  for (const t of lib) {
    cues[t.id] = getHotCues(t.id);
  }
  for (const id of ['A', 'B'] as const) {
    const d = decks[id];
    if (d.trackId) {
      grids[d.trackId] = { bpm: d.bpm, anchor: d.anchor };
      loops[d.trackId] = { loopStart: d.loopStart, loopEnd: d.loopEnd, loopBeatCount: d.loopBeatCount };
    }
  }
  return {
    name, savedAt: Date.now(),
    tracks,
    deckA: { queue: pl.playlists.A.map((e) => e.id), currentIndex: pl.currentIndex.A },
    deckB: { queue: pl.playlists.B.map((e) => e.id), currentIndex: pl.currentIndex.B },
    cues, grids, loops,
  };
}

export async function saveSession(name: string): Promise<void> {
  const session = await snapshot(name);
  try {
    await tx('readwrite', (s) => s.put(session) as unknown as IDBRequest<IDBValidKey>);
  } catch {
    throw new Error('Not enough browser storage to save this session.');
  }
}

export async function listSessions(): Promise<{ name: string; savedAt: number; trackCount: number }[]> {
  const all = await tx<SavedSession[]>('readonly', (s) => s.getAll() as IDBRequest<SavedSession[]>);
  return all.map((x) => ({ name: x.name, savedAt: x.savedAt, trackCount: x.tracks.length }))
            .sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteSession(name: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(name) as unknown as IDBRequest<undefined>);
}

export async function loadSession(name: string): Promise<void> {
  const session = await tx<SavedSession | undefined>('readonly', (s) => s.get(name) as IDBRequest<SavedSession | undefined>);
  if (!session) return;
  const restored: ImportedTrack[] = session.tracks.map((t) => ({
    id: t.id, title: t.title, artist: t.artist, duration: t.duration, format: t.format,
    file: new File([t.blob], `${t.title}.${t.format}`, { type: t.blob.type }),
    audioUrl: URL.createObjectURL(t.blob),
  }));
  useLibraryStore.getState().restore(restored);
  const byId = new Map(restored.map((t) => [t.id, t]));
  for (const [trackId, map] of Object.entries(session.cues)) {
    for (const [idx, sec] of Object.entries(map)) setHotCue(trackId, Number(idx), sec);
  }
  const pl = usePlaylistStore.getState();
  for (const deck of ['A', 'B'] as const) {
    pl.clearPlaylist(deck);
    const snap = deck === 'A' ? session.deckA : session.deckB;
    for (const id of snap.queue) {
      const t = byId.get(id);
      if (t) pl.addTrack(deck, libraryTrackToEntry(t));
    }
  }
}
