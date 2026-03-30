/**
 * SearchPanel.tsx — Track browser / search panel.
 *
 * Rendered at the bottom of the application layout.
 *
 * Features:
 *   - Search bar (disabled when credentials unavailable)
 *   - Results list with thumbnail, title, channel, duration
 *   - Loading skeleton while a request is in flight
 *   - Error state with descriptive message
 *   - "Load Next Page" pagination button
 *   - Greyed-out overlay when unauthenticated AND no API key configured
 *
 * STORY-012 additions:
 *   - Tab switcher: "Search" tab and "Recent" tab.
 *   - Recent tab shows the last 10 tracks loaded to either deck.
 *   - Clear (×) button in SearchBar resets query only; results persist.
 */
import { useState, useEffect, useCallback } from 'react';
import { useSearchStore } from '../../store/searchStore';
import { useAuthStore } from '../../store/authStore';
import { usePlaylistStore } from '../../store/playlistStore';
import { searchVideos } from '../../services/youtubeDataApi';
import { getCached, setCached } from '../../utils/searchCache';
import { SearchBar } from './SearchBar';
import { SearchResultList } from './SearchResultList';
import { SearchResult } from './SearchResult';
import { PlaylistPanel } from '../Playlist/PlaylistPanel';
import { getRecentTracks, type RecentTrack } from '../../utils/recentlyPlayed';
import { useDownloadManager } from '../../hooks/useDownloadManager';
import { DownloadLibrary } from '../Library/DownloadLibrary';
import { ChannelPanel } from '../Library/ChannelPanel';
import type { TrackSummary } from '../../types/search';
import styles from './SearchPanel.module.css';

/** Returns true when the user has credentials to perform searches. */
function hasCredentials(accessToken: string | null): boolean {
  if (accessToken) return true;
  const apiKey = (import.meta as unknown as { env: Record<string, string | undefined> })
    .env.VITE_YOUTUBE_API_KEY;
  return Boolean(apiKey);
}

/** Convert a RecentTrack to the TrackSummary shape used by SearchResult. */
function recentTrackToSummary(track: RecentTrack): TrackSummary {
  return {
    sourceType: 'youtube',
    videoId: track.videoId,
    title: track.title,
    artist: track.channelTitle,
    duration: track.duration,
    thumbnailUrl: track.thumbnailUrl,
  };
}

type ActiveTab = 'search' | 'recent' | 'playlist' | 'library';

interface SearchPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function SearchPanel({ isOpen, onToggle }: SearchPanelProps) {
  const { query, results, nextPageToken, loading, error, setQuery, setResults,
    appendResults, setLoading, setError } = useSearchStore();
  const { accessToken, signedIn } = useAuthStore();
  const { requestDownload, removeFromLibrary } = useDownloadManager();
  const [showChannel, setShowChannel] = useState(false);

  // Track whether the user has submitted at least one search this session.
  const [hasSearched, setHasSearched] = useState(false);

  // Track whether a next-page (pagination) fetch is in progress.
  const [loadingMore, setLoadingMore] = useState(false);

  // STORY-012: Tab state.
  const [activeTab, setActiveTab] = useState<ActiveTab>('search');

  // STORY-012: Recent tracks list — refreshed whenever the tab becomes active
  // or after any load-track event.
  const [recentTracks, setRecentTracks] = useState<RecentTrack[]>([]);

  /** Refresh the recentTracks list from localStorage. */
  const refreshRecentTracks = useCallback(() => {
    setRecentTracks(getRecentTracks());
  }, []);

  // Listen for dj-rusty:load-track to refresh the Recent list.
  useEffect(() => {
    function handleLoadTrack() {
      refreshRecentTracks();
    }
    window.addEventListener('dj-rusty:load-track', handleLoadTrack);
    return () => window.removeEventListener('dj-rusty:load-track', handleLoadTrack);
  }, [refreshRecentTracks]);

  // Also refresh when the Recent tab becomes active.
  useEffect(() => {
    if (activeTab === 'recent') {
      refreshRecentTracks();
    }
  }, [activeTab, refreshRecentTracks]);

  const credentialsAvailable = hasCredentials(accessToken);
  const panelDisabled = !credentialsAvailable;

  async function performSearch(searchQuery: string, pageToken?: string) {
    setQuery(searchQuery);

    // Cache lookup — only for first-page searches (not pagination)
    if (!pageToken) {
      const cached = getCached(searchQuery);
      if (cached) {
        setResults(cached, null);
        setHasSearched(true);
        return;
      }
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const { results: newResults, nextPageToken: newPageToken } =
        await searchVideos(searchQuery, accessToken, pageToken);

      if (pageToken) {
        appendResults(newResults, newPageToken);
      } else {
        setResults(newResults, newPageToken);
        // Cache the first-page results on successful network fetch
        setCached(searchQuery, newResults);
      }
      setHasSearched(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      setError(message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function handleSearch(searchQuery: string) {
    void performSearch(searchQuery);
  }

  // STORY-012: Clear button handler — resets query only; results persist.
  function handleClear() {
    setQuery('');
  }

  function handleNextPage() {
    if (nextPageToken) {
      void performSearch(query, nextPageToken);
    }
  }

  function handleLoadToDeck(deckId: 'A' | 'B', result: TrackSummary) {
    const event = new CustomEvent('dj-rusty:load-track', {
      detail: { deckId, result },
    });
    window.dispatchEvent(event);
  }

  function handleQueueToDeck(deckId: 'A' | 'B', result: TrackSummary) {
    usePlaylistStore.getState().addTrack(deckId, {
      sourceType: result.sourceType,
      videoId: result.videoId!,
      title: result.title,
      artist: result.artist,
      duration: result.duration,
      thumbnailUrl: result.thumbnailUrl,
    });
  }

  const disabledReason = !signedIn
    ? 'Sign in with Google to search YouTube'
    : !credentialsAvailable
      ? 'Configure VITE_YOUTUBE_API_KEY to enable search'
      : undefined;

  // Label shown in the collapsed handle bar.
  const handleQueryLabel = query
    ? `"${query}"`
    : 'Search for tracks to load to a deck';

  return (
    <section
      className={[
        styles.panel,
        isOpen ? styles.panelOpen : '',
        panelDisabled ? styles.panelDisabled : '',
      ].filter(Boolean).join(' ')}
      aria-label="Track browser"
    >
      {/* ── Drawer handle — always visible, click or press / to toggle ── */}
      <button
        type="button"
        className={styles.handle}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls="search-drawer-content"
        title={isOpen ? 'Collapse search (/)' : 'Open search (/)'}
      >
        <span className={`${styles.handleChevron} ${isOpen ? styles.handleChevronOpen : ''}`}>
          ▲
        </span>
        <span className={styles.handleLabel}>SEARCH</span>
        <span className={styles.handleQuery}>{handleQueryLabel}</span>
        <kbd className={styles.handleKbd}>/</kbd>
      </button>

      {/* ── Drawer content — hidden when collapsed ── */}
      <div id="search-drawer-content" className={styles.content} aria-hidden={!isOpen}>
        {panelDisabled && (
          <div className={styles.disabledOverlay} aria-hidden="true">
            <span>{disabledReason}</span>
          </div>
        )}

        <div className={styles.searchRow}>
          <SearchBar
            initialQuery={query}
            loading={loading}
            disabled={panelDisabled}
            onSearch={handleSearch}
            onClear={handleClear}
          />
          <button
            type="button"
            className={`${styles.channelToggleBtn} ${showChannel ? styles.channelToggleBtnActive : ''}`}
            onClick={() => setShowChannel((v) => !v)}
            title="Browse My Channel"
            aria-pressed={showChannel}
          >
            📺
          </button>
        </div>

      {/* STORY-012: Tab switcher — STORY-014: full ARIA tabs pattern */}
      <div className={styles.tabBar} role="tablist" aria-label="Track browser tabs">
        <button
          role="tab"
          type="button"
          id="search-tab"
          className={`${styles.tab} ${activeTab === 'search' ? styles.tabActive : ''}`}
          aria-selected={activeTab === 'search'}
          aria-controls="search-tab-panel"
          onClick={() => setActiveTab('search')}
        >
          Search
        </button>
        <button
          role="tab"
          type="button"
          id="recent-tab"
          className={`${styles.tab} ${activeTab === 'recent' ? styles.tabActive : ''}`}
          aria-selected={activeTab === 'recent'}
          aria-controls="recent-tab-panel"
          onClick={() => setActiveTab('recent')}
        >
          Recent
        </button>
        <button
          role="tab"
          type="button"
          id="playlist-tab"
          className={`${styles.tab} ${activeTab === 'playlist' ? styles.tabActive : ''}`}
          aria-selected={activeTab === 'playlist'}
          aria-controls="playlist-tab-panel"
          onClick={() => setActiveTab('playlist')}
        >
          Playlist
        </button>
        <button
          role="tab"
          type="button"
          id="library-tab"
          className={`${styles.tab} ${activeTab === 'library' ? styles.tabActive : ''}`}
          aria-selected={activeTab === 'library'}
          aria-controls="library-tab-panel"
          onClick={() => setActiveTab('library')}
        >
          Library
        </button>
      </div>

      {/* STORY-014: role="tabpanel" with aria-labelledby wired to matching tab id */}
      <div
        role="tabpanel"
        id="search-tab-panel"
        aria-labelledby="search-tab"
        hidden={activeTab !== 'search'}
      >
        {showChannel ? (
          <ChannelPanel />
        ) : (
          <>
        {error && (
          <div className={styles.errorBanner} role="alert">
            <span className={styles.errorIcon}>!</span>
            <span>{error}</span>
          </div>
        )}

        <SearchResultList
          results={results}
          loading={loading}
          hasSearched={hasSearched}
          onLoadToDeck={handleLoadToDeck}
          onQueueToDeck={handleQueueToDeck}
          onDownload={(result) => void requestDownload({
            videoId: result.videoId!,
            title: result.title,
            artist: result.artist,
            duration: result.duration,
            thumbnailUrl: result.thumbnailUrl,
          })}
        />

        {nextPageToken && !loading && (
          <div className={styles.pagination}>
            <button
              type="button"
              className={styles.nextPageBtn}
              onClick={handleNextPage}
              disabled={loadingMore}
              aria-label="Load next page of results"
            >
              {loadingMore ? 'Loading...' : 'Load Next Page'}
            </button>
          </div>
        )}
          </>
        )}
      </div>

      {/* STORY-014: role="tabpanel" with aria-labelledby wired to matching tab id */}
      <div
        role="tabpanel"
        id="recent-tab-panel"
        aria-labelledby="recent-tab"
        hidden={activeTab !== 'recent'}
      >
        <div className={styles.recentTab} aria-label="Recently played tracks">
          {recentTracks.length === 0 ? (
            <div className={styles.recentEmpty}>
              <p>No recently played tracks yet. Load a track to a deck to see it here.</p>
            </div>
          ) : (
            <ul className={styles.recentList} aria-label="Recently played">
              {recentTracks.map((track) => (
                <SearchResult
                  key={track.videoId}
                  result={recentTrackToSummary(track)}
                  onLoadToDeck={handleLoadToDeck}
                  onQueueToDeck={handleQueueToDeck}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Playlist tab panel — split view of Deck A and Deck B queues */}
      <div
        role="tabpanel"
        id="playlist-tab-panel"
        aria-labelledby="playlist-tab"
        hidden={activeTab !== 'playlist'}
      >
        <PlaylistPanel />
      </div>

      <div
        role="tabpanel"
        id="library-tab-panel"
        aria-labelledby="library-tab"
        hidden={activeTab !== 'library'}
      >
        <DownloadLibrary onRemove={removeFromLibrary} />
      </div>

      </div>{/* end .content */}
    </section>
  );
}

export default SearchPanel;
