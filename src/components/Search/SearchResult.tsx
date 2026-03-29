/**
 * SearchResult.tsx — Single search result row.
 *
 * Displays thumbnail, title, channel name, and formatted duration.
 * Includes "LOAD A" and "LOAD B" action buttons.
 *
 * STORY-012 additions:
 *   - "Now Playing" A/B badge when this video is loaded on a deck.
 *   - "Copy URL" button that copies https://youtu.be/{videoId} to clipboard.
 *   - title tooltip on the title element (via `title` attribute) for truncated text.
 */
import { useEffect, useRef, useState } from 'react';
import { formatTime } from '../../utils/formatTime';
import { useDeckStore } from '../../store/deckStore';
import { useDownloadStore } from '../../store/downloadStore';
import type { TrackSummary } from '../../types/search';
import styles from './SearchResult.module.css';

interface SearchResultProps {
  result: TrackSummary;
  onLoadToDeck: (deckId: 'A' | 'B', result: TrackSummary) => void;
  /** Called when the user clicks +A or +B to add the track to a deck's playlist. */
  onQueueToDeck: (deckId: 'A' | 'B', result: TrackSummary) => void;
  /** Called when the user clicks the DL (download) button. */
  onDownload?: (result: TrackSummary) => void;
  /** Whether this row is keyboard-highlighted (for arrow-key navigation). */
  highlighted?: boolean;
}

/** Duration in ms that the "Copied!" and "Added!" confirmation badges are shown. */
const COPY_FEEDBACK_DURATION_MS = 2000;
const QUEUE_FEEDBACK_DURATION_MS = 1500;

export function SearchResult({ result, onLoadToDeck, onQueueToDeck, onDownload, highlighted = false }: SearchResultProps) {
  const { videoId, title, artist, duration, thumbnailUrl } = result;
  const vid = videoId ?? '';

  // Download status from downloadStore
  const dlStatusOverride = useDownloadStore((s) => s.statusOverrides[vid]);
  const dlTrack = useDownloadStore((s) => s.tracks.find((t) => t.videoId === vid));
  const dlStatus = dlStatusOverride ?? dlTrack?.status ?? null;
  const dlProgress = useDownloadStore((s) => s.progress[vid] ?? 0);

  // STORY-012: Read both deck track IDs to determine Now Playing badges.
  const deckATrackId = useDeckStore((state) => state.decks.A.trackId);
  const deckBTrackId = useDeckStore((state) => state.decks.B.trackId);

  const loadedOnA = deckATrackId === videoId;
  const loadedOnB = deckBTrackId === videoId;

  // STORY-012: Copy URL feedback state.
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Playlist queue feedback: brief "✓" on the +A / +B buttons.
  const [queuedA, setQueuedA] = useState(false);
  const [queuedB, setQueuedB] = useState(false);
  const queueTimerARef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueTimerBRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel all pending timers on unmount.
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
      if (queueTimerARef.current !== null) clearTimeout(queueTimerARef.current);
      if (queueTimerBRef.current !== null) clearTimeout(queueTimerBRef.current);
    };
  }, []);

  function handleQueueToDeck(deckId: 'A' | 'B') {
    onQueueToDeck(deckId, result);
    if (deckId === 'A') {
      if (queueTimerARef.current !== null) clearTimeout(queueTimerARef.current);
      setQueuedA(true);
      queueTimerARef.current = setTimeout(() => {
        queueTimerARef.current = null;
        setQueuedA(false);
      }, QUEUE_FEEDBACK_DURATION_MS);
    } else {
      if (queueTimerBRef.current !== null) clearTimeout(queueTimerBRef.current);
      setQueuedB(true);
      queueTimerBRef.current = setTimeout(() => {
        queueTimerBRef.current = null;
        setQueuedB(false);
      }, QUEUE_FEEDBACK_DURATION_MS);
    }
  }

  function handleCopyUrl() {
    const url = `https://youtu.be/${videoId}`;
    navigator.clipboard.writeText(url).then(() => {
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
      setCopied(true);
      copyTimerRef.current = setTimeout(() => {
        copyTimerRef.current = null;
        setCopied(false);
      }, COPY_FEEDBACK_DURATION_MS);
    }).catch(() => {
      // Clipboard API may fail (permissions/HTTPS); fail silently.
    });
  }

  return (
    <li
      className={`${styles.row} ${highlighted ? styles.rowHighlighted : ''}`}
      key={videoId}
    >
      <img
        className={styles.thumbnail}
        src={thumbnailUrl ?? undefined}
        alt={`Thumbnail for ${title}`}
        width={72}
        height={40}
        loading="lazy"
      />

      <div className={styles.info}>
        <div className={styles.titleRow}>
          {/* STORY-012: Now Playing badges */}
          {loadedOnA && (
            <span className={`${styles.deckBadge} ${styles.deckBadgeA}`} aria-label="Loaded on Deck A">
              A
            </span>
          )}
          {loadedOnB && (
            <span className={`${styles.deckBadge} ${styles.deckBadgeB}`} aria-label="Loaded on Deck B">
              B
            </span>
          )}
          {/* STORY-012: title attribute provides a tooltip for truncated titles. */}
          <span className={styles.title} title={title}>
            {title}
          </span>
          <span className={styles.duration}>{formatTime(duration)}</span>
        </div>
        <span className={styles.channel}>{artist}</span>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.loadBtn} ${styles.loadBtnA}`}
          onClick={() => onLoadToDeck('A', result)}
          aria-label={`Load ${title} to Deck A`}
        >
          LOAD A
        </button>
        <button
          type="button"
          className={`${styles.loadBtn} ${styles.loadBtnB}`}
          onClick={() => onLoadToDeck('B', result)}
          aria-label={`Load ${title} to Deck B`}
        >
          LOAD B
        </button>
        {/* Queue to playlist buttons */}
        <button
          type="button"
          className={`${styles.saveBtn} ${queuedA ? styles.saveBtnAdding : ''}`}
          onClick={() => handleQueueToDeck('A')}
          aria-label={`Add ${title} to Deck A playlist`}
          title={queuedA ? 'Added to Deck A!' : 'Add to Deck A playlist'}
        >
          {queuedA ? '✓A' : '+A'}
        </button>
        <button
          type="button"
          className={`${styles.saveBtn} ${queuedB ? styles.saveBtnAdding : ''}`}
          onClick={() => handleQueueToDeck('B')}
          aria-label={`Add ${title} to Deck B playlist`}
          title={queuedB ? 'Added to Deck B!' : 'Add to Deck B playlist'}
        >
          {queuedB ? '✓B' : '+B'}
        </button>
        {/* STORY-012: Copy YouTube URL button */}
        <button
          type="button"
          className={`${styles.copyBtn} ${copied ? styles.copyBtnSuccess : ''}`}
          onClick={handleCopyUrl}
          aria-label={`Copy YouTube URL for ${title}`}
          title={copied ? 'Copied!' : 'Copy YouTube URL'}
        >
          {copied ? '✓' : '⎘'}
        </button>
        {/* Download to local library */}
        {onDownload && (
          <button
            type="button"
            className={`${styles.dlBtn} ${dlStatus ? styles[`dlBtn_${dlStatus}`] : ''}`}
            onClick={() => dlStatus !== 'ready' && dlStatus !== 'downloading' && onDownload(result)}
            aria-label={`Download ${title}`}
            title={
              dlStatus === 'ready' ? 'Downloaded' :
              dlStatus === 'downloading' ? `Downloading ${Math.round(dlProgress)}%` :
              dlStatus === 'error' ? 'Download failed — retry' :
              'Download to local library'
            }
            disabled={dlStatus === 'downloading' || dlStatus === 'pending'}
          >
            {dlStatus === 'ready' ? '✓DL' : dlStatus === 'downloading' ? `${Math.round(dlProgress)}%` : 'DL'}
          </button>
        )}
      </div>
    </li>
  );
}

export default SearchResult;
