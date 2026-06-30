import { it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlaylistPanel } from '../components/Playlist/PlaylistPanel';
import { usePlaylistStore } from '../store/playlistStore';
import type { PlaylistEntry } from '../types/playlist';
import { DND_KEY } from '../types/dnd';

function makeEntry(id: string, title: string): PlaylistEntry {
  return { id, title, artist: 'Artist', duration: 120, thumbnailUrl: null,
    file: new File([new Uint8Array([1])], `${title}.mp3`, { type: 'audio/mpeg' }),
    audioUrl: 'blob:x' };
}

beforeEach(() => {
  usePlaylistStore.getState().clearPlaylist('A');
  usePlaylistStore.getState().clearPlaylist('B');
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() } as unknown as typeof URL);
});

it('playlist row has draggable attribute and sets DnD payload on dragstart', () => {
  const entry = makeEntry('t1', 'Track One');
  usePlaylistStore.setState({
    playlists: { A: [entry], B: [] },
    currentIndex: { A: -1, B: -1 }, // no active track → draggable=true
  });
  render(<PlaylistPanel />);

  const li = screen.getByText('Track One').closest('li')!;
  expect(li).toHaveAttribute('draggable', 'true');

  const setData = vi.fn();
  fireEvent.dragStart(li, { dataTransfer: { setData, effectAllowed: '' } });
  expect(setData).toHaveBeenCalledWith(
    DND_KEY,
    JSON.stringify({ source: 'playlist', fromDeck: 'A', trackId: 't1' }),
  );
});

it('dropping a playlist row on the other deck moves it', () => {
  const entry = makeEntry('t1', 'Move Me');
  usePlaylistStore.setState({
    playlists: { A: [entry], B: [] },
    currentIndex: { A: -1, B: -1 },
  });
  render(<PlaylistPanel />);

  // Payload no longer embeds entry — just trackId; drop handler looks up from store
  const payload = JSON.stringify({ source: 'playlist', fromDeck: 'A', trackId: 't1' });
  const dt = {
    types: [DND_KEY],
    files: [],
    getData: () => payload,
    setData: vi.fn(),
    dropEffect: '',
  };

  // The Deck B column has aria-label="Deck B queue"
  const deckBCol = screen.getByLabelText('Deck B queue');
  fireEvent.dragOver(deckBCol, { dataTransfer: dt });
  fireEvent.drop(deckBCol, { dataTransfer: dt });

  expect(usePlaylistStore.getState().playlists.A).toHaveLength(0);
  expect(usePlaylistStore.getState().playlists.B).toHaveLength(1);
  expect(usePlaylistStore.getState().playlists.B[0]!.id).toBe('t1');
});

it('dropping a playlist row on the same deck is ignored', () => {
  const entry = makeEntry('t1', 'Stay Here');
  usePlaylistStore.setState({
    playlists: { A: [entry], B: [] },
    currentIndex: { A: -1, B: -1 },
  });
  render(<PlaylistPanel />);

  // Payload no longer embeds entry
  const payload = JSON.stringify({ source: 'playlist', fromDeck: 'A', trackId: 't1' });
  const dt = {
    types: [DND_KEY],
    files: [],
    getData: () => payload,
    setData: vi.fn(),
    dropEffect: '',
  };

  const deckACol = screen.getByLabelText('Deck A queue');
  fireEvent.dragOver(deckACol, { dataTransfer: dt });
  fireEvent.drop(deckACol, { dataTransfer: dt });

  expect(usePlaylistStore.getState().playlists.A).toHaveLength(1);
  expect(usePlaylistStore.getState().playlists.B).toHaveLength(0);
});
