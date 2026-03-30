/**
 * FileImportZone.test.tsx — TDD Red Phase specs for MP3-001: File Import UI
 *
 * Tests cover:
 *  FileImportZone component rendering:
 *    - Renders with correct ARIA attributes (role, aria-label containing deck ID)
 *    - Shows idle instruction text
 *    - Renders a "Browse Files" button
 *    - Renders for both Deck A and Deck B
 *  Drag-and-drop interactions:
 *    - Visual state changes on dragover (dragover CSS class applied)
 *    - Visual state restored on dragleave (dragover CSS class removed)
 *    - Valid audio file drop invokes onFileAccepted callback with the File
 *    - Invalid file drop shows error state (does not call onFileAccepted)
 *    - All accepted MIME types: audio/mpeg, audio/wav, audio/ogg, audio/flac
 *    - Non-audio MIME types: text/plain, image/jpeg are rejected
 *  File picker interactions:
 *    - Enter key on drop zone triggers file input click
 *    - Space key on drop zone triggers file input click
 *    - Valid file selected via picker calls onFileAccepted
 *    - Multiple files via picker: all are passed (one per onFileAccepted call)
 *  Integration — file-to-playlistStore:
 *    - MP3 file adds PlaylistEntry with sourceType 'mp3'
 *    - WAV file adds PlaylistEntry with sourceType 'mp3' (same enum value)
 *    - OGG file adds PlaylistEntry with sourceType 'mp3'
 *    - FLAC file adds PlaylistEntry with sourceType 'mp3'
 *    - Title is derived from filename without extension
 *    - artist is set to 'Local File'
 *    - thumbnailUrl is null
 *    - file field is the original File object
 *    - audioUrl starts with 'blob:' (URL.createObjectURL called)
 *    - Large file (> 500 MB) is rejected without calling addTrack
 *    - File with no extension is rejected without calling addTrack
 *    - Non-audio MIME type does not call addTrack
 *  Contract tests:
 *    - onFileAccepted receives a File (not null, not a string)
 *    - PlaylistEntry shape: id (string), title (string), sourceType 'mp3',
 *      file (File), audioUrl starts with 'blob:'
 *    - Multiple file drops each result in a separate addTrack call
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileImportZone } from '../components/FileImport/FileImportZone';
import { usePlaylistStore } from '../store/playlistStore';

// ── Mock playlistStore so addTrack calls are interceptable ────────────────────

const mockAddTrack = vi.fn();

vi.mock('../store/playlistStore', () => ({
  usePlaylistStore: {
    getState: () => ({
      addTrack: mockAddTrack,
    }),
  },
}));

// ── Mock deckStore (required by playlistStore module graph) ───────────────────

vi.mock('../store/deckStore', () => ({
  useDeckStore: {
    getState: () => ({
      loadTrack: vi.fn(),
    }),
  },
}));

// ── Mock URL.createObjectURL / URL.revokeObjectURL ────────────────────────────

const mockCreateObjectURL = vi.fn(() => 'blob:http://localhost/mock-uuid');
const mockRevokeObjectURL = vi.fn();

Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  writable: true,
  value: mockCreateObjectURL,
});

Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  writable: true,
  value: mockRevokeObjectURL,
});

// ── Mock HTMLMediaElement (Audio) for duration extraction ─────────────────────
//
// FileImportZone creates a temporary Audio element to read duration from the
// 'loadedmetadata' event. We mock it so tests resolve synchronously.

function mockAudioElement(duration: number) {
  const audioInstance = {
    src: '',
    duration,
    onloadedmetadata: null as ((this: HTMLAudioElement, ev: Event) => void) | null,
    load: vi.fn(function (this: typeof audioInstance) {
      // Fire loadedmetadata synchronously so tests don't need to wait.
      if (typeof this.onloadedmetadata === 'function') {
        this.onloadedmetadata.call(this as unknown as HTMLAudioElement, new Event('loadedmetadata'));
      }
    }),
    remove: vi.fn(),
  };

  vi.spyOn(globalThis, 'Audio' as never).mockImplementation(
    () => audioInstance as unknown as HTMLAudioElement,
  );

  return audioInstance;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Create a File with the given name, type, and size in bytes. */
function makeFile(name: string, type: string, sizeBytes = 1024 * 1024): File {
  const content = new Uint8Array(Math.min(sizeBytes, 8)); // minimal content
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

/** Build a DataTransfer containing the supplied files. */
function makeDataTransfer(files: File[]): DataTransfer {
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  return dt;
}

// ── Reset ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Restore a sensible Audio mock for every test that doesn't override it.
  mockAudioElement(180);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Rendering
// ─────────────────────────────────────────────────────────────────────────────

describe('FileImportZone — rendering', () => {
  it('renders a region with role="button" for Deck A', () => {
    render(<FileImportZone deckId="A" />);
    expect(screen.getByRole('button', { name: /deck a/i })).toBeInTheDocument();
  });

  it('renders a region with role="button" for Deck B', () => {
    render(<FileImportZone deckId="B" />);
    expect(screen.getByRole('button', { name: /deck b/i })).toBeInTheDocument();
  });

  it('aria-label includes the deck ID', () => {
    const { rerender } = render(<FileImportZone deckId="A" />);
    const zoneA = screen.getByRole('button', { name: /deck a/i });
    expect(zoneA.getAttribute('aria-label')).toMatch(/a/i);

    rerender(<FileImportZone deckId="B" />);
    const zoneB = screen.getByRole('button', { name: /deck b/i });
    expect(zoneB.getAttribute('aria-label')).toMatch(/b/i);
  });

  it('shows idle instruction text when no file is being dragged', () => {
    render(<FileImportZone deckId="A" />);
    // Any reasonable idle text — the spec says "Drop MP3 or WAV here" style text.
    expect(screen.getByText(/drop|drag|browse/i)).toBeInTheDocument();
  });

  it('renders a "Browse Files" button', () => {
    render(<FileImportZone deckId="A" />);
    expect(
      screen.getByRole('button', { name: /browse files/i }),
    ).toBeInTheDocument();
  });

  it('renders a hidden file input with accept="audio/*"', () => {
    const { container } = render(<FileImportZone deckId="A" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input!.accept).toMatch(/audio/);
  });

  it('file input accepts multiple files', () => {
    const { container } = render(<FileImportZone deckId="A" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(input!.multiple).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — Drag-and-drop visual states
// ─────────────────────────────────────────────────────────────────────────────

describe('FileImportZone — drag-and-drop visual states', () => {
  it('applies a dragover highlight class when a file is dragged over', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });

    fireEvent.dragOver(zone, {
      dataTransfer: makeDataTransfer([makeFile('track.mp3', 'audio/mpeg')]),
    });

    // The component must add some class or data attribute indicating dragover state.
    // We test via the aria-grabbed/aria-dropeffect or a data attribute or class.
    expect(
      zone.classList.contains('dragover') ||
      zone.getAttribute('data-dragover') === 'true' ||
      zone.getAttribute('aria-grabbed') === 'true',
    ).toBe(true);
  });

  it('removes the dragover highlight class when the drag leaves', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });

    fireEvent.dragOver(zone, {
      dataTransfer: makeDataTransfer([makeFile('track.mp3', 'audio/mpeg')]),
    });
    fireEvent.dragLeave(zone);

    expect(
      zone.classList.contains('dragover') ||
      zone.getAttribute('data-dragover') === 'true',
    ).toBe(false);
  });

  it('shows an error state after an invalid file is dropped', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const invalidFile = makeFile('document.txt', 'text/plain');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([invalidFile]) });

    // Error state: a class, data attribute, or visible error text.
    const hasErrorClass = zone.classList.contains('error');
    const hasErrorAttr = zone.getAttribute('data-error') === 'true';
    const hasErrorText = !!screen.queryByText(/invalid|unsupported|not supported|error/i);
    expect(hasErrorClass || hasErrorAttr || hasErrorText).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — onFileAccepted callback (used for single-file contract tests)
// ─────────────────────────────────────────────────────────────────────────────

describe('FileImportZone — onFileAccepted callback', () => {
  it('calls onFileAccepted with the File object when a valid MP3 is dropped', () => {
    const onFileAccepted = vi.fn();
    render(<FileImportZone deckId="A" onFileAccepted={onFileAccepted} />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const mp3 = makeFile('my-track.mp3', 'audio/mpeg');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([mp3]) });

    expect(onFileAccepted).toHaveBeenCalledTimes(1);
    expect(onFileAccepted).toHaveBeenCalledWith(expect.any(File));
  });

  it('calls onFileAccepted with a File (not null, not a string)', () => {
    const onFileAccepted = vi.fn();
    render(<FileImportZone deckId="A" onFileAccepted={onFileAccepted} />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const wav = makeFile('loop.wav', 'audio/wav');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([wav]) });

    expect(onFileAccepted).toHaveBeenCalledWith(expect.any(File));
    expect(onFileAccepted).not.toHaveBeenCalledWith(null);
    expect(onFileAccepted).not.toHaveBeenCalledWith(expect.any(String));
  });

  it('does NOT call onFileAccepted when a .txt file is dropped', () => {
    const onFileAccepted = vi.fn();
    render(<FileImportZone deckId="A" onFileAccepted={onFileAccepted} />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const txt = makeFile('notes.txt', 'text/plain');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([txt]) });

    expect(onFileAccepted).not.toHaveBeenCalled();
  });

  it('does NOT call onFileAccepted when a .jpg file is dropped', () => {
    const onFileAccepted = vi.fn();
    render(<FileImportZone deckId="A" onFileAccepted={onFileAccepted} />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const jpg = makeFile('photo.jpg', 'image/jpeg');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([jpg]) });

    expect(onFileAccepted).not.toHaveBeenCalled();
  });

  it('calls onFileAccepted once per valid file when multiple files are dropped', () => {
    const onFileAccepted = vi.fn();
    render(<FileImportZone deckId="A" onFileAccepted={onFileAccepted} />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const files = [
      makeFile('track1.mp3', 'audio/mpeg'),
      makeFile('track2.wav', 'audio/wav'),
    ];

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer(files) });

    expect(onFileAccepted).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Accepted MIME types
// ─────────────────────────────────────────────────────────────────────────────

describe('FileImportZone — accepted MIME types', () => {
  const acceptedFiles = [
    { name: 'song.mp3', type: 'audio/mpeg' },
    { name: 'loop.wav', type: 'audio/wav' },
    { name: 'track.ogg', type: 'audio/ogg' },
    { name: 'master.flac', type: 'audio/flac' },
  ];

  acceptedFiles.forEach(({ name, type }) => {
    it(`accepts ${type} and calls addTrack`, () => {
      render(<FileImportZone deckId="A" />);
      const zone = screen.getByRole('button', { name: /deck a/i });
      const file = makeFile(name, type);

      fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) });

      expect(mockAddTrack).toHaveBeenCalledTimes(1);
    });
  });

  const rejectedFiles = [
    { name: 'document.txt', type: 'text/plain' },
    { name: 'photo.jpg', type: 'image/jpeg' },
    { name: 'video.mp4', type: 'video/mp4' },
    { name: 'archive.zip', type: 'application/zip' },
  ];

  rejectedFiles.forEach(({ name, type }) => {
    it(`rejects ${type} and does NOT call addTrack`, () => {
      render(<FileImportZone deckId="A" />);
      const zone = screen.getByRole('button', { name: /deck a/i });
      const file = makeFile(name, type);

      fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) });

      expect(mockAddTrack).not.toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — PlaylistEntry contract (integration with playlistStore)
// ─────────────────────────────────────────────────────────────────────────────

describe('FileImportZone — PlaylistEntry contract', () => {
  it('calls addTrack with sourceType "mp3" for an MP3 file', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const file = makeFile('my-song.mp3', 'audio/mpeg');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) });

    expect(mockAddTrack).toHaveBeenCalledWith(
      'A',
      expect.objectContaining({ sourceType: 'mp3' }),
    );
  });

  it('calls addTrack with sourceType "mp3" for a WAV file', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const file = makeFile('loop.wav', 'audio/wav');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) });

    expect(mockAddTrack).toHaveBeenCalledWith(
      'A',
      expect.objectContaining({ sourceType: 'mp3' }),
    );
  });

  it('calls addTrack with sourceType "mp3" for an OGG file', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const file = makeFile('bass.ogg', 'audio/ogg');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) });

    expect(mockAddTrack).toHaveBeenCalledWith(
      'A',
      expect.objectContaining({ sourceType: 'mp3' }),
    );
  });

  it('calls addTrack with sourceType "mp3" for a FLAC file', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const file = makeFile('master.flac', 'audio/flac');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) });

    expect(mockAddTrack).toHaveBeenCalledWith(
      'A',
      expect.objectContaining({ sourceType: 'mp3' }),
    );
  });

  it('derives title from the filename without extension', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const file = makeFile('My Awesome Track.mp3', 'audio/mpeg');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) });

    expect(mockAddTrack).toHaveBeenCalledWith(
      'A',
      expect.objectContaining({ title: 'My Awesome Track' }),
    );
  });

  it('strips the extension from filenames with multiple dots', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const file = makeFile('DJ.Set.2024.mp3', 'audio/mpeg');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) });

    // Only the final extension is stripped; title should be 'DJ.Set.2024'
    expect(mockAddTrack).toHaveBeenCalledWith(
      'A',
      expect.objectContaining({ title: 'DJ.Set.2024' }),
    );
  });

  it('sets artist to "Local File"', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const file = makeFile('track.mp3', 'audio/mpeg');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) });

    expect(mockAddTrack).toHaveBeenCalledWith(
      'A',
      expect.objectContaining({ artist: 'Local File' }),
    );
  });

  it('sets thumbnailUrl to null', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const file = makeFile('track.mp3', 'audio/mpeg');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) });

    expect(mockAddTrack).toHaveBeenCalledWith(
      'A',
      expect.objectContaining({ thumbnailUrl: null }),
    );
  });

  it('sets file field to the original File object', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const file = makeFile('track.mp3', 'audio/mpeg');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) });

    const call = mockAddTrack.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![1].file).toBeInstanceOf(File);
    expect(call![1].file).toBe(file);
  });

  it('calls URL.createObjectURL and sets audioUrl to a blob URL', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const file = makeFile('track.mp3', 'audio/mpeg');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) });

    expect(mockCreateObjectURL).toHaveBeenCalledWith(file);

    const call = mockAddTrack.mock.calls[0];
    expect(call).toBeDefined();
    expect(call![1].audioUrl).toMatch(/^blob:/);
  });

  it('passes the correct deckId ("A") to addTrack', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const file = makeFile('track.mp3', 'audio/mpeg');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) });

    expect(mockAddTrack.mock.calls[0]![0]).toBe('A');
  });

  it('passes the correct deckId ("B") to addTrack', () => {
    render(<FileImportZone deckId="B" />);
    const zone = screen.getByRole('button', { name: /deck b/i });
    const file = makeFile('track.mp3', 'audio/mpeg');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) });

    expect(mockAddTrack.mock.calls[0]![0]).toBe('B');
  });

  it('adds each file in order when multiple valid files are dropped', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const file1 = makeFile('first.mp3', 'audio/mpeg');
    const file2 = makeFile('second.wav', 'audio/wav');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file1, file2]) });

    expect(mockAddTrack).toHaveBeenCalledTimes(2);
    expect(mockAddTrack.mock.calls[0]![1].title).toBe('first');
    expect(mockAddTrack.mock.calls[1]![1].title).toBe('second');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 6 — Boundary / edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('FileImportZone — boundary and edge cases', () => {
  it('rejects a file larger than 500 MB and does NOT call addTrack', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });

    // Create a File whose size property reports > 500 MB.
    const FIVE_HUNDRED_ONE_MB = 501 * 1024 * 1024;
    const oversized = Object.defineProperty(
      makeFile('huge.mp3', 'audio/mpeg'),
      'size',
      { value: FIVE_HUNDRED_ONE_MB, configurable: true },
    ) as File;

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([oversized]) });

    expect(mockAddTrack).not.toHaveBeenCalled();
  });

  it('rejects a file with no extension and does NOT call addTrack', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    // A file named with no extension but an invalid MIME type.
    const noExt = makeFile('noextension', 'application/octet-stream');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([noExt]) });

    expect(mockAddTrack).not.toHaveBeenCalled();
  });

  it('does not call addTrack when nothing is dropped (empty DataTransfer)', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });

    fireEvent.drop(zone, { dataTransfer: new DataTransfer() });

    expect(mockAddTrack).not.toHaveBeenCalled();
  });

  it('handles a file whose name consists only of an extension (e.g., ".mp3")', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const file = makeFile('.mp3', 'audio/mpeg');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) });

    // Should still be processed. Title should be empty string or the bare name.
    // The critical assertion is that addTrack IS called (valid MIME type).
    expect(mockAddTrack).toHaveBeenCalledTimes(1);
  });

  it('mixed drop (valid + invalid): only valid file calls addTrack', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const valid = makeFile('song.mp3', 'audio/mpeg');
    const invalid = makeFile('notes.txt', 'text/plain');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([valid, invalid]) });

    expect(mockAddTrack).toHaveBeenCalledTimes(1);
    expect(mockAddTrack.mock.calls[0]![1].title).toBe('song');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 7 — Keyboard accessibility
// ─────────────────────────────────────────────────────────────────────────────

describe('FileImportZone — keyboard accessibility', () => {
  it('Enter key on the drop zone triggers the hidden file input click', async () => {
    const { container } = render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    await userEvent.type(zone, '{Enter}');

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('Space key on the drop zone triggers the hidden file input click', async () => {
    const { container } = render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    await userEvent.type(zone, '{ }');

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('drop zone has tabIndex=0 so it is keyboard-focusable', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    expect(zone.getAttribute('tabindex')).toBe('0');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 8 — File picker (input change) pathway
// ─────────────────────────────────────────────────────────────────────────────

describe('FileImportZone — file picker (Browse Files button)', () => {
  it('clicking Browse Files button opens the file picker', async () => {
    const { container } = render(<FileImportZone deckId="A" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    const browseBtn = screen.getByRole('button', { name: /browse files/i });

    await userEvent.click(browseBtn);

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('selecting a valid file via picker calls addTrack', () => {
    const { container } = render(<FileImportZone deckId="A" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('picked-track.mp3', 'audio/mpeg');

    // Simulate file picker selection via input change event.
    Object.defineProperty(input, 'files', {
      value: makeDataTransfer([file]).files,
      configurable: true,
    });
    fireEvent.change(input);

    expect(mockAddTrack).toHaveBeenCalledTimes(1);
    expect(mockAddTrack).toHaveBeenCalledWith(
      'A',
      expect.objectContaining({
        sourceType: 'mp3',
        title: 'picked-track',
        artist: 'Local File',
        thumbnailUrl: null,
        file,
      }),
    );
  });

  it('selecting multiple files via picker calls addTrack for each', () => {
    const { container } = render(<FileImportZone deckId="A" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const files = [
      makeFile('a.mp3', 'audio/mpeg'),
      makeFile('b.wav', 'audio/wav'),
      makeFile('c.flac', 'audio/flac'),
    ];

    const dt = makeDataTransfer(files);
    Object.defineProperty(input, 'files', {
      value: dt.files,
      configurable: true,
    });
    fireEvent.change(input);

    expect(mockAddTrack).toHaveBeenCalledTimes(3);
  });

  it('selecting an invalid file via picker does NOT call addTrack', () => {
    const { container } = render(<FileImportZone deckId="A" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile('presentation.pptx', 'application/vnd.ms-powerpoint');

    Object.defineProperty(input, 'files', {
      value: makeDataTransfer([file]).files,
      configurable: true,
    });
    fireEvent.change(input);

    expect(mockAddTrack).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 9 — Duration extraction
// ─────────────────────────────────────────────────────────────────────────────

describe('FileImportZone — duration extraction', () => {
  it('passes duration 0 to addTrack (duration resolved later by audio decoder)', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const file = makeFile('long-track.mp3', 'audio/mpeg');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) });

    expect(mockAddTrack).toHaveBeenCalledWith(
      'A',
      expect.objectContaining({ duration: 0 }),
    );
  });

  it('addTrack is called synchronously on drop (no onloadedmetadata delay)', () => {
    render(<FileImportZone deckId="A" />);
    const zone = screen.getByRole('button', { name: /deck a/i });
    const file = makeFile('unknown-dur.mp3', 'audio/mpeg');

    fireEvent.drop(zone, { dataTransfer: makeDataTransfer([file]) });

    const call = mockAddTrack.mock.calls[0];
    expect(call).toBeDefined();
    // Duration should be a finite number (0 fallback), not NaN.
    expect(Number.isFinite(call![1].duration)).toBe(true);
  });
});
