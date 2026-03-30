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
import type { PlaylistEntry } from '../../types/playlist';
import styles from './FileImportZone.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true when the MIME type indicates an audio file. */
function isAudioType(type: string): boolean {
  return type.startsWith('audio/');
}

/** Strips the final extension from a filename (e.g. "My Track.mp3" → "My Track"). */
function stripExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  // If the dot is at position 0 (e.g. ".mp3"), keep the name as-is but strip extension.
  if (lastDot === -1) return filename;
  return filename.slice(0, lastDot);
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
   * Process a single validated File object:
   *  1. Create a blob URL.
   *  2. Extract duration via Audio element.
   *  3. Build a PlaylistEntry and commit it to the store.
   *  4. Invoke the optional onFileAccepted callback.
   */
  function processFile(file: File): void {
    onFileAccepted?.(file);

    const audioUrl = URL.createObjectURL(file);
    const title = stripExtension(file.name);

    // Add track immediately — duration starts at 0 and is updated by
    // useAudioEngine after the AudioBuffer is decoded.
    const entry: Omit<PlaylistEntry, 'id'> = {
      sourceType: 'mp3',
      title,
      artist: 'Local File',
      duration: 0,
      thumbnailUrl: null,
      file,
      audioUrl,
    };

    usePlaylistStore.getState().addTrack(deckId, entry);
  }

  /**
   * Validate and process all files in the given FileList.
   * Only audio files under 500 MB are accepted.
   * Any invalid file triggers the error state but processing continues for valid ones.
   */
  function handleFiles(files: FileList | null): void {
    if (!files || files.length === 0) return;

    let hasInvalid = false;

    Array.from(files).forEach((file) => {
      if (!isAudioType(file.type) || file.size > MAX_FILE_SIZE_BYTES) {
        hasInvalid = true;
        return;
      }
      processFile(file);
    });

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
        accept=".mp3,.wav,.ogg,.flac,audio/mpeg,audio/wav,audio/ogg,audio/flac"
        multiple
        className={styles.hiddenInput}
        onChange={handleInputChange}
        aria-hidden="true"
        tabIndex={-1}
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
