/**
 * FileImportZone.tsx — Drag-and-drop / file-picker zone for local MP3/WAV/OGG/FLAC imports.
 *
 * Story: MP3-001 — File Import UI
 *
 * Accepts audio files via:
 *  - Drag-and-drop onto the zone
 *  - "Browse Files" button or Enter/Space keyboard activation
 *
 * Validates: MIME type must start with "audio/", file size must be <= 500 MB.
 * Rejected files trigger an error state; valid files are added to the playlist store.
 *
 * Duration is extracted asynchronously via an HTMLAudioElement loadedmetadata event
 * and then the PlaylistEntry is committed to the store.
 */

import { useRef, useState } from 'react';
import type { KeyboardEvent, DragEvent, ChangeEvent } from 'react';
import { usePlaylistStore } from '../../store/playlistStore';
import { useLibraryStore, libraryTrackToEntry } from '../../store/libraryStore';
import styles from './FileImportZone.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true when the MIME type indicates an audio file. */
function isAudioType(type: string): boolean {
  return type.startsWith('audio/');
}

// ── Types ─────────────────────────────────────────────────────────────────────

type DropZoneState = 'idle' | 'dragover' | 'error';

// ── Props ─────────────────────────────────────────────────────────────────────

interface FileImportZoneProps {
  /** Which deck this import zone is associated with. */
  deckId: 'A' | 'B';
  /**
   * Optional callback invoked once per accepted file.
   * Called BEFORE the file is committed to the playlist store.
   */
  onFileAccepted?: (file: File) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FileImportZone({ deckId, onFileAccepted }: FileImportZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [zoneState, setZoneState] = useState<DropZoneState>('idle');

  /** Open the native file picker programmatically. */
  function openFilePicker(): void {
    inputRef.current?.click();
  }

  /**
   * Validate and process all files in the given FileList.
   * Valid files are added to the library, then appended to the deck playlist.
   * Only audio files under 500 MB are accepted.
   * Any invalid file triggers the error state but processing continues for valid ones.
   */
  function handleFiles(files: FileList | null): void {
    if (!files || files.length === 0) return;

    let hasInvalid = false;
    const validFiles: File[] = [];

    Array.from(files).forEach((file) => {
      if (!isAudioType(file.type) || file.size > MAX_FILE_SIZE_BYTES) {
        hasInvalid = true;
        return;
      }
      onFileAccepted?.(file);
      validFiles.push(file);
    });

    if (validFiles.length > 0) {
      const created = useLibraryStore.getState().addFiles(validFiles);
      for (const t of created) {
        usePlaylistStore.getState().addTrack(deckId, libraryTrackToEntry(t));
      }
    }

    if (hasInvalid) {
      setZoneState('error');
    } else {
      setZoneState('idle');
    }
  }

  // ── Event handlers ──────────────────────────────────────────────────────────

  function handleDragOver(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setZoneState('dragover');
  }

  function handleDragLeave(): void {
    setZoneState('idle');
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setZoneState('idle');
    handleFiles(event.dataTransfer.files);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openFilePicker();
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    handleFiles(event.target.files);
    // Reset so the same file can be re-selected if needed.
    event.target.value = '';
  }

  function handleBrowseClick(event: React.MouseEvent<HTMLButtonElement>): void {
    // Prevent the click from bubbling to the zone's click handler.
    event.stopPropagation();
    openFilePicker();
  }

  // ── Derived state ───────────────────────────────────────────────────────────

  const isDragover = zoneState === 'dragover';
  const isError = zoneState === 'error';

  const className = [
    styles.zone,
    isDragover ? styles.dragover : '',
    isError ? styles.error : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={className}
      role="button"
      tabIndex={0}
      aria-label={`File import zone — Deck ${deckId}`}
      data-dragover={isDragover ? 'true' : undefined}
      data-error={isError ? 'true' : undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.wav,.flac,.ogg,.m4a,.aac,audio/*"
        multiple
        className={styles.hiddenInput}
        onChange={handleInputChange}
        aria-hidden="true"
        tabIndex={-1}
        data-testid="file-input"
      />

      <p className={styles.instructions}>
        Add audio files to the deck
      </p>

      {isError && (
        <p className={styles.errorText} role="alert">
          Unsupported file type or file too large
        </p>
      )}

      <button
        type="button"
        className={styles.browseButton}
        onClick={handleBrowseClick}
      >
        Browse Files
      </button>
    </div>
  );
}
