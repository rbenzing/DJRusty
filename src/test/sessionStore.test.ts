import 'fake-indexeddb/auto';
import { it, expect, beforeEach, vi } from 'vitest';
import { saveSession, loadSession, listSessions, deleteSession } from '../services/sessionStore';
import { useLibraryStore } from '../store/libraryStore';
import { usePlaylistStore } from '../store/playlistStore';
import { libraryTrackToEntry } from '../store/libraryStore';
import { useDeckStore } from '../store/deckStore';
import { useSamplerStore } from '../store/samplerStore';

beforeEach(async () => {
  useLibraryStore.getState().clear();
  usePlaylistStore.getState().clearPlaylist('A');
  usePlaylistStore.getState().clearPlaylist('B');
  useSamplerStore.setState({ slots: { A: Array(8).fill(null), B: Array(8).fill(null) } });
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:s', revokeObjectURL: vi.fn() } as unknown as typeof URL);
  for (const s of await listSessions()) await deleteSession(s.name);
});

it('save → load round-trips the library and a deck queue', async () => {
  const [t] = useLibraryStore.getState().addFiles([new File([new Uint8Array([1, 2, 3])], 'Set Track.mp3', { type: 'audio/mpeg' })]);
  usePlaylistStore.getState().addTrack('A', libraryTrackToEntry(t!));

  await saveSession('Friday');
  expect((await listSessions()).map((s) => s.name)).toContain('Friday');

  // wipe live state, then restore
  useLibraryStore.getState().clear();
  usePlaylistStore.getState().clearPlaylist('A');
  await loadSession('Friday');

  expect(useLibraryStore.getState().tracks.map((x) => x.title)).toEqual(['Set Track']);
  expect(usePlaylistStore.getState().playlists.A.map((e) => e.id)).toEqual([useLibraryStore.getState().tracks[0]!.id]);
});

it('save → load round-trips per-track bpm/anchor (grid restore)', async () => {
  const [t] = useLibraryStore.getState().addFiles([new File([new Uint8Array([1])], 'Grid.mp3', { type: 'audio/mpeg' })]);
  usePlaylistStore.getState().addTrack('A', libraryTrackToEntry(t!));

  // Simulate a loaded track on deck A with a grid set
  useDeckStore.getState().loadTrack('A', t!.id, { title: 'Grid', artist: 'Local File', duration: 120, thumbnailUrl: null });
  useDeckStore.getState().setGrid('A', 128, 0.25);

  await saveSession('GridSet');
  useLibraryStore.getState().clear();
  usePlaylistStore.getState().clearPlaylist('A');
  useDeckStore.getState().clearTrack('A');

  await loadSession('GridSet');
  // loadSession populates pendingGrids BEFORE the queue rebuild, so the auto-cued
  // first track (loaded via addTrack → loadDeckTrack) already consumed the grid.

  const deck = useDeckStore.getState().decks.A;
  expect(deck.bpm).toBe(128);
  expect(deck.anchor).toBeCloseTo(0.25);
});

it('deleteSession removes it', async () => {
  const [t] = useLibraryStore.getState().addFiles([new File([new Uint8Array([1])], 'x.wav', { type: 'audio/wav' })]);
  void t;
  await saveSession('Temp');
  await deleteSession('Temp');
  expect((await listSessions()).map((s) => s.name)).not.toContain('Temp');
});

it('save → load round-trips a sampler slot (fileName always restored; buffer/decodeError depend on decode outcome)', async () => {
  const buffer = { duration: 1 } as AudioBuffer;
  const file = new File([new Uint8Array([1, 2, 3])], 'kick.wav', { type: 'audio/wav' });
  useSamplerStore.getState().restoreSlot('A', 0, { fileName: 'kick.wav', file, buffer, decoding: false, decodeError: null });

  await saveSession('WithSamples');

  useSamplerStore.setState({ slots: { A: Array(8).fill(null), B: Array(8).fill(null) } });
  await loadSession('WithSamples');

  const restored = useSamplerStore.getState().slots.A[0];
  expect(restored?.fileName).toBe('kick.wav');
  expect(restored?.decoding).toBe(false);
  // jsdom has no AudioContext implementation and this test doesn't mock
  // audioDecoder/audioContext, so loadSession's real decodeAudioFile call
  // deterministically throws (ReferenceError: AudioContext is not defined),
  // landing in the catch branch — buffer stays null, decodeError is set.
  // This still proves the round-trip (blob saved, file reconstructed,
  // fileName preserved, decode genuinely attempted) without needing a mock.
  expect(restored?.buffer).toBeNull();
  expect(restored?.decodeError).toBe("Couldn't decode — this format may be unsupported in your browser");
});

it('loadSession clears stale sampler slots that are empty/absent in the loaded session', async () => {
  // Save a session with NOTHING in sampler slot A[0] (it's empty at save time).
  await saveSession('NoSamplesHere');

  // Simulate loading that session while stale data is still live on the deck
  // (e.g. left over from a previously loaded session or manual pad load).
  const staleBuffer = { duration: 1 } as AudioBuffer;
  const staleFile = new File([new Uint8Array([9])], 'stale.wav', { type: 'audio/wav' });
  useSamplerStore.getState().restoreSlot('A', 0, {
    fileName: 'stale.wav', file: staleFile, buffer: staleBuffer, decoding: false, decodeError: null,
  });

  await loadSession('NoSamplesHere');

  expect(useSamplerStore.getState().slots.A[0]).toBeNull();
});

it('loadSession clears all sampler slots for a session saved before the SAMPLER feature existed (missing samplers key)', async () => {
  const staleBuffer = { duration: 1 } as AudioBuffer;
  const staleFile = new File([new Uint8Array([9])], 'stale2.wav', { type: 'audio/wav' });
  useSamplerStore.getState().restoreSlot('B', 3, {
    fileName: 'stale2.wav', file: staleFile, buffer: staleBuffer, decoding: false, decodeError: null,
  });

  await saveSession('LegacySession');

  // Manually strip the samplers key from the stored record to simulate a
  // genuinely pre-Task-5 session (IndexedDB records are plain objects; an
  // older save simply never had this key).
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('dj-rusty', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    const getReq = store.get('LegacySession');
    getReq.onsuccess = () => {
      const record = getReq.result as Record<string, unknown>;
      delete record.samplers;
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });

  await loadSession('LegacySession');

  expect(useSamplerStore.getState().slots.B[3]).toBeNull();
});
