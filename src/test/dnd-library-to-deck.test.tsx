import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useLibraryStore } from '../store/libraryStore';
import { usePlaylistStore } from '../store/playlistStore';
import { DND_KEY } from '../types/dnd';

// Minimal Deck mock — we only care about the drop handler wiring, not audio engine.
vi.mock('../hooks/useAudioEngine', () => ({ useAudioEngine: vi.fn() }));
vi.mock('../services/playerRegistry', () => ({
  getActivePlayer: vi.fn(() => null),
  registerPlayer: vi.fn(),
  unregisterPlayer: vi.fn(),
}));

// Import Deck AFTER mocks
import { Deck } from '../components/Deck/Deck';

describe('DnD library→deck', () => {
  beforeEach(() => {
    useLibraryStore.getState().clear();
    usePlaylistStore.getState().clearPlaylist('A');
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() } as unknown as typeof URL);
  });

  function seedLibrary(name = 'Track.mp3') {
    return useLibraryStore.getState().addFiles([
      new File([new Uint8Array([1])], name, { type: 'audio/mpeg' }),
    ])[0]!;
  }

  it('drops a library DnD payload onto Deck A and appends the track', () => {
    const t = seedLibrary();
    render(<Deck deckId="A" />);

    const deckEl = document.querySelector('[data-deck="a"]')!;
    const payload = JSON.stringify({ source: 'library', trackId: t.id });

    // Simulate dragover with DND_KEY type to check it's accepted
    fireEvent.dragOver(deckEl, {
      dataTransfer: { types: [DND_KEY], files: [], getData: () => payload },
    });

    // Simulate drop
    fireEvent.drop(deckEl, {
      dataTransfer: { types: [DND_KEY], files: [], getData: () => payload },
    });

    const queue = usePlaylistStore.getState().playlists.A;
    expect(queue).toHaveLength(1);
    expect(queue[0]!.id).toBe(t.id);
  });

  it('ignores a DnD payload for a trackId not in the library', () => {
    render(<Deck deckId="A" />);

    const deckEl = document.querySelector('[data-deck="a"]')!;
    const payload = JSON.stringify({ source: 'library', trackId: 'does-not-exist' });

    fireEvent.drop(deckEl, {
      dataTransfer: { types: [DND_KEY], files: [], getData: () => payload },
    });

    expect(usePlaylistStore.getState().playlists.A).toHaveLength(0);
  });
});
