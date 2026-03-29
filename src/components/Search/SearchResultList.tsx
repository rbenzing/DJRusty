/**
 * SearchResultList.tsx — List of YouTube search result rows.
 *
 * Handles three content states:
 *   - loading: renders skeleton placeholder rows
 *   - empty: renders a contextual empty-state message
 *   - results: renders a SearchResult row for each item
 *
 * STORY-012 additions:
 *   - Keyboard navigation: ArrowDown / ArrowUp moves the highlighted index.
 *   - Enter key on the highlighted row dispatches Load to Deck A.
 */
import { useRef, useState } from 'react';
import { SearchResult } from './SearchResult';
import type { TrackSummary } from '../../types/search';
import styles from './SearchResultList.module.css';

interface SearchResultListProps {
  results: TrackSummary[];
  loading: boolean;
  /** True when the user has submitted a search query at least once. */
  hasSearched: boolean;
  onLoadToDeck: (deckId: 'A' | 'B', result: TrackSummary) => void;
  onQueueToDeck: (deckId: 'A' | 'B', result: TrackSummary) => void;
  onDownload?: (result: TrackSummary) => void;
}

/** Skeleton row displayed while results are loading. */
function SkeletonRow() {
  return (
    <li className={styles.skeletonRow} aria-hidden="true">
      <div className={styles.skeletonThumb} />
      <div className={styles.skeletonInfo}>
        <div className={styles.skeletonLine} style={{ width: '60%' }} />
        <div className={styles.skeletonLine} style={{ width: '40%' }} />
      </div>
    </li>
  );
}

export function SearchResultList({
  results,
  loading,
  hasSearched,
  onLoadToDeck,
  onQueueToDeck,
  onDownload,
}: SearchResultListProps) {
  // STORY-012: Track the keyboard-highlighted result index (-1 = none).
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        onLoadToDeck('A', results[highlightedIndex]!);
      }
    }
  }

  if (loading) {
    return (
      <ul className={styles.list} aria-busy="true" aria-label="Loading search results">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </ul>
    );
  }

  if (results.length === 0) {
    const message = hasSearched
      ? 'No results found for your search.'
      : 'Search for a track to get started.';

    return (
      <div className={styles.emptyState}>
        <p>{message}</p>
      </div>
    );
  }

  return (
    <ul
      ref={listRef}
      className={styles.list}
      aria-label="Search results"
      // STORY-012: make the list focusable so keyboard events register.
      tabIndex={0}
      onKeyDown={handleKeyDown}
      // Reset highlight when the list loses focus.
      onBlur={() => setHighlightedIndex(-1)}
    >
      {results.map((result, index) => (
        <SearchResult
          key={result.videoId}
          result={result}
          onLoadToDeck={onLoadToDeck}
          onQueueToDeck={onQueueToDeck}
          {...(onDownload ? { onDownload } : {})}
          highlighted={index === highlightedIndex}
        />
      ))}
    </ul>
  );
}

export default SearchResultList;
