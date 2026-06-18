import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLibraryStore } from '../store/libraryStore';

const ACCEPTED = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'];

function makeFile(name: string, type = 'audio/mpeg'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

describe('libraryStore', () => {
  beforeEach(() => {
    useLibraryStore.getState().clear();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() } as unknown as typeof URL);
  });

  it('addFiles imports accepted audio files with id/title/format and a blob url', () => {
    const created = useLibraryStore.getState().addFiles([makeFile('My Track.mp3')]);
    const t = useLibraryStore.getState().tracks[0]!;
    expect(useLibraryStore.getState().tracks).toHaveLength(1);
    expect(t.title).toBe('My Track');
    expect(t.format).toBe('mp3');
    expect(t.audioUrl).toBe('blob:x');
    expect(t.id).toMatch(/.+/);
    expect(created[0]!.id).toBe(t.id);
  });

  it('removeTrack revokes its blob url and drops it', () => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:y', revokeObjectURL: revoke } as unknown as typeof URL);
    const [t] = useLibraryStore.getState().addFiles([makeFile('a.wav', 'audio/wav')]);
    useLibraryStore.getState().removeTrack(t!.id);
    expect(revoke).toHaveBeenCalledWith('blob:y');
    expect(useLibraryStore.getState().tracks).toHaveLength(0);
  });

  it('skips files whose extension is not accepted', () => {
    useLibraryStore.getState().addFiles([makeFile('notes.txt', 'text/plain')]);
    expect(useLibraryStore.getState().tracks).toHaveLength(0);
  });
});
void ACCEPTED;
