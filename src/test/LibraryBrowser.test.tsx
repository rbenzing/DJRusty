import { it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibraryBrowser } from '../components/Library/LibraryBrowser';
import { useLibraryStore } from '../store/libraryStore';
import { usePlaylistStore } from '../store/playlistStore';

beforeEach(() => {
  useLibraryStore.getState().clear();
  usePlaylistStore.getState().clearPlaylist('A');
  usePlaylistStore.getState().clearPlaylist('B');
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() } as unknown as typeof URL);
});

function seed(name: string) {
  return useLibraryStore.getState().addFiles([new File([new Uint8Array([1])], name, { type: 'audio/mpeg' })])[0]!;
}

it('lists imported tracks and filters by title', () => {
  seed('House Anthem.mp3'); seed('Techno Roller.mp3');
  render(<LibraryBrowser />);
  expect(screen.getByText('House Anthem')).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText(/filter/i), { target: { value: 'techno' } });
  expect(screen.queryByText('House Anthem')).not.toBeInTheDocument();
  expect(screen.getByText('Techno Roller')).toBeInTheDocument();
});

it('Load to Deck A appends the track to deck A\'s queue', () => {
  const t = seed('Track.mp3');
  render(<LibraryBrowser />);
  fireEvent.click(screen.getByRole('button', { name: /load .*deck a/i }));
  const queue = usePlaylistStore.getState().playlists.A;
  expect(queue).toHaveLength(1);
  expect(queue[0]!.id).toBe(t.id);
});
