import { it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibraryBrowser } from '../components/Library/LibraryBrowser';
import { useLibraryStore } from '../store/libraryStore';
import { DND_KEY } from '../types/dnd';

beforeEach(() => {
  useLibraryStore.getState().clear();
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() } as unknown as typeof URL);
});

function seed(name: string) {
  return useLibraryStore.getState().addFiles([
    new File([new Uint8Array([1])], name, { type: 'audio/mpeg' }),
  ])[0]!;
}

it('renders an Import Files button', () => {
  render(<LibraryBrowser />);
  expect(screen.getByRole('button', { name: /import files/i })).toBeInTheDocument();
});

it('clicking Import Files triggers the hidden file input', () => {
  render(<LibraryBrowser />);
  const input = screen.getByTestId('library-file-input') as HTMLInputElement;
  const clickSpy = vi.spyOn(input, 'click');
  fireEvent.click(screen.getByRole('button', { name: /import files/i }));
  expect(clickSpy).toHaveBeenCalledOnce();
});

it('selecting files via the input adds them to the library', () => {
  render(<LibraryBrowser />);
  const input = screen.getByTestId('library-file-input') as HTMLInputElement;
  const files = [new File([new Uint8Array([1])], 'New.mp3', { type: 'audio/mpeg' })];
  fireEvent.change(input, { target: { files } });
  expect(useLibraryStore.getState().tracks.map((t) => t.title)).toContain('New');
});

it('library row sets correct DnD payload on dragstart', () => {
  const t = seed('Drag Me.mp3');
  render(<LibraryBrowser />);

  const row = screen.getByText('Drag Me').closest('li')!;
  const setData = vi.fn();
  fireEvent.dragStart(row, {
    dataTransfer: { setData, effectAllowed: '' },
  });

  expect(setData).toHaveBeenCalledWith(
    DND_KEY,
    JSON.stringify({ source: 'library', trackId: t.id }),
  );
});
