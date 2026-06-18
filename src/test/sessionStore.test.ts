import 'fake-indexeddb/auto';
import { it, expect, beforeEach, vi } from 'vitest';
import { saveSession, loadSession, listSessions, deleteSession } from '../services/sessionStore';
import { useLibraryStore } from '../store/libraryStore';
import { usePlaylistStore } from '../store/playlistStore';
import { libraryTrackToEntry } from '../store/libraryStore';
import { useDeckStore } from '../store/deckStore';

beforeEach(async () => {
  useLibraryStore.getState().clear();
  usePlaylistStore.getState().clearPlaylist('A');
  usePlaylistStore.getState().clearPlaylist('B');
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
  // Loading the track onto the deck should apply the pending grid
  useDeckStore.getState().loadTrack('A', t!.id, { title: 'Grid', artist: 'Local File', duration: 120, thumbnailUrl: null });

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
