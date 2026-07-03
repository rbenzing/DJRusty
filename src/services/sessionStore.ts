import { useLibraryStore, type ImportedTrack, libraryTrackToEntry } from '../store/libraryStore';
import { usePlaylistStore } from '../store/playlistStore';
import { useDeckStore } from '../store/deckStore';
import { useSamplerStore, type SampleSlot } from '../store/samplerStore';
import { getHotCues, setHotCue } from '../utils/hotCues';
import { decodeAudioFile } from './audioDecoder';

const DB = 'dj-rusty';
const STORE = 'sessions';

const pendingGrids = new Map<string, { bpm: number | null; anchor: number | null }>();
const pendingLoops = new Map<string, { loopStart: number | null; loopEnd: number | null; loopBeatCount: number | null }>();

export function consumePendingGrid(trackId: string): { bpm: number | null; anchor: number | null } | undefined {
  const v = pendingGrids.get(trackId);
  pendingGrids.delete(trackId);
  return v;
}

export function consumePendingLoop(trackId: string): { loopStart: number | null; loopEnd: number | null; loopBeatCount: number | null } | undefined {
  const v = pendingLoops.get(trackId);
  pendingLoops.delete(trackId);
  return v;
}

export interface SavedSession {
  name: string;
  savedAt: number;
  tracks: { id: string; title: string; artist: string; duration: number; format: string; blob: Blob }[];
  deckA: { queue: string[]; currentIndex: number };
  deckB: { queue: string[]; currentIndex: number };
  cues: Record<string, Record<number, number>>;
  grids: Record<string, { bpm: number | null; anchor: number | null }>;
  loops: Record<string, { loopStart: number | null; loopEnd: number | null; loopBeatCount: number | null }>;
  samplers: {
    A: ({ fileName: string; blob: Blob } | null)[];
    B: ({ fileName: string; blob: Blob } | null)[];
  };
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
  const samplerSlots = useSamplerStore.getState().slots;
  const samplers: SavedSession['samplers'] = { A: [], B: [] };
  for (const deckId of ['A', 'B'] as const) {
    samplers[deckId] = await Promise.all(
      samplerSlots[deckId].map(async (slot: SampleSlot | null) => {
        if (!slot) return null;
        return { fileName: slot.fileName, blob: await fileToBlob(slot.file) };
      }),
    );
  }
  return {
    name, savedAt: Date.now(),
    tracks,
    deckA: { queue: pl.playlists.A.map((e) => e.id), currentIndex: pl.currentIndex.A },
    deckB: { queue: pl.playlists.B.map((e) => e.id), currentIndex: pl.currentIndex.B },
    cues, grids, loops, samplers,
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
  // Stash grids/loops BEFORE queue rebuild so the auto-cued first track gets its grid
  for (const [trackId, grid] of Object.entries(session.grids)) pendingGrids.set(trackId, grid);
  for (const [trackId, loop] of Object.entries(session.loops)) pendingLoops.set(trackId, loop);
  if (session.samplers) {
    for (const deckId of ['A', 'B'] as const) {
      const deckSlots = session.samplers[deckId] ?? [];
      for (let i = 0; i < deckSlots.length; i++) {
        const saved = deckSlots[i];
        if (!saved) continue;
        const restoredFile = new File([saved.blob], saved.fileName, { type: saved.blob.type });
        try {
          const buffer = await decodeAudioFile(restoredFile);
          useSamplerStore.getState().restoreSlot(deckId, i, {
            fileName: saved.fileName, file: restoredFile, buffer, decoding: false, decodeError: null,
          });
        } catch {
          useSamplerStore.getState().restoreSlot(deckId, i, {
            fileName: saved.fileName, file: restoredFile, buffer: null, decoding: false,
            decodeError: "Couldn't decode — this format may be unsupported in your browser",
          });
        }
      }
    }
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
