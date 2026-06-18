import { it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileImportZone } from '../components/FileImport/FileImportZone';
import { useLibraryStore } from '../store/libraryStore';

beforeEach(() => {
  useLibraryStore.getState().clear();
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:z', revokeObjectURL: vi.fn() } as unknown as typeof URL);
});

it('importing files adds them to the library (accepts flac/ogg/m4a too)', () => {
  render(<FileImportZone deckId="A" />);
  const input = screen.getByTestId('file-input') as HTMLInputElement;
  const files = [
    new File([new Uint8Array([1])], 'song.flac', { type: 'audio/flac' }),
    new File([new Uint8Array([1])], 'beat.m4a', { type: 'audio/mp4' }),
  ];
  fireEvent.change(input, { target: { files } });
  const titles = useLibraryStore.getState().tracks.map((t) => t.title);
  expect(titles).toEqual(['song', 'beat']);
});
