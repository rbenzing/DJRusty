import { useCallback, useEffect, useState } from 'react';
import { AuthButton } from './components/Auth/AuthButton';
import { SettingsModal } from './components/Auth/SettingsModal';
import { Deck } from './components/Deck/Deck';
import { YouTubePlayer } from './components/Deck/YouTubePlayer';
import { Mixer } from './components/Mixer/Mixer';
import { SearchPanel } from './components/Search/SearchPanel';
import { loadYouTubeIframeApi } from './services/youtubeIframeApi';
import { useDeckStore } from './store/deckStore';
import { useMixerStore } from './store/mixerStore';
import { useSettingsStore } from './store/settingsStore';
import { useSearchPreload } from './hooks/useSearchPreload';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { addRecentTrack } from './utils/recentlyPlayed';
import type { TrackSummary } from './types/search';

/**
 * App.tsx — Root application shell.
 *
 * Initialises the YouTube IFrame API singleton on mount (STORY-003).
 * Renders hidden YT.Player containers for Deck A and Deck B so that players
 * are always present in the DOM regardless of layout state (YouTube ToS requirement).
 *
 * Layout: 3-column flex row (Deck A | Mixer | Deck B) + Track Browser at bottom.
 * Search browser implemented in STORY-007.
 *
 * STORY-008: Listens for 'dj-rusty:load-track' CustomEvents dispatched by
 * SearchPanel and routes them to the deck store loadTrack action.
 */

/**
 * Detail payload shape dispatched by SearchPanel when user clicks LOAD A/B.
 */
interface LoadTrackEventDetail {
  deckId: 'A' | 'B';
  result: TrackSummary;
}

function App() {
  const openSettings = useSettingsStore((s) => s.openSettings);

  // Search drawer — closed by default so decks get full height.
  const [searchOpen, setSearchOpen] = useState(false);
  const toggleSearch = useCallback(() => setSearchOpen((v) => !v), []);

  // Press "/" to toggle the search drawer (only when not typing in an input).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      toggleSearch();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleSearch]);

  useEffect(() => {
    // Load the YouTube IFrame API script once on app mount.
    // The singleton loader ensures subsequent calls return the same promise.
    loadYouTubeIframeApi().catch((err: unknown) => {
      console.error('[App] Failed to load YouTube IFrame API:', err);
    });
    // Sync mixer computed volumes into deckStore on startup so both stores
    // agree from the first render (BUG-002: deckStore initialises volume at 80
    // but mixer computes 71 at crossfader centre — this reconciles them).
    const mixer = useMixerStore.getState();
    mixer.setCrossfaderPosition(mixer.crossfaderPosition);
  }, []);

  // STORY-008: Bridge CustomEvent from SearchPanel to deck store loadTrack action.
  // SearchPanel dispatches 'dj-rusty:load-track' with { deckId, result } to keep
  // the search components decoupled from the deck store.
  //
  // STORY-012: Also persists the loaded track to the recently-played localStorage list.
  useEffect(() => {
    function handleLoadTrack(event: Event) {
      const { deckId, result } = (event as CustomEvent<LoadTrackEventDetail>).detail;
      const { sourceType, videoId, title, artist, duration, thumbnailUrl } = result;
      useDeckStore.getState().loadTrack(deckId, videoId!, {
        sourceType,
        title,
        artist,
        duration,
        thumbnailUrl,
      });
      // STORY-012: Record this track in the recently-played list.
      addRecentTrack({
        videoId: videoId!,
        title,
        channelTitle: artist,
        duration,
        thumbnailUrl,
        loadedAt: Date.now(),
      });
    }

    window.addEventListener('dj-rusty:load-track', handleLoadTrack);
    return () => {
      window.removeEventListener('dj-rusty:load-track', handleLoadTrack);
    };
  }, []);

  // STORY-SEARCH-001: Pre-load genre search results into cache on sign-in.
  useSearchPreload();

  // STORY-DJ-004: Global keyboard shortcuts for deck transport, cue, beat jump, hot cues, tap tempo.
  useKeyboardShortcuts();

  return (
    <div className={`app${searchOpen ? ' search-open' : ''}`}>
      {/*
        Hidden YouTube IFrame players — must be present in the DOM at all times.
        They are positioned absolute at opacity 0.01 so they do not affect layout
        but satisfy the YouTube Terms of Service requirement to render the player.
      */}
      <YouTubePlayer deckId="A" />
      <YouTubePlayer deckId="B" />

      {/* Settings Modal — rendered via React portal, mounted here so it is
          always available regardless of the current view state. */}
      <SettingsModal />

      <header className="app-header">
        <span className="app-logo">DJ RUSTY</span>
        <div className="app-header-actions">
          {/* STORY-013: Gear icon opens settings modal */}
          <button
            type="button"
            className="app-header-settings-btn"
            onClick={openSettings}
            aria-label="Open settings"
            title="Settings"
          >
            {/* Inline SVG cog icon — 8-tooth gear matching ui-spec.md §3.3 */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          {/* AuthButton: clicking authenticated state also opens settings */}
          <AuthButton onAuthenticatedClick={openSettings} />
        </div>
      </header>

      <main className="app-main">
        <div className="app-deck-row">
          {/* Deck A — left column (~38% width) */}
          <div className="app-deck-col">
            <Deck deckId="A" />
          </div>

          {/* Mixer — center column (~24% width), implemented in STORY-006 */}
          <div className="app-mixer-col">
            <Mixer />
          </div>

          {/* Deck B — right column (~38% width), fully implemented in STORY-005 */}
          <div className="app-deck-col">
            <Deck deckId="B" />
          </div>
        </div>

        {/* Track Browser — slide-up drawer, collapsed by default */}
        <SearchPanel isOpen={searchOpen} onToggle={toggleSearch} />
      </main>
    </div>
  );
}

export default App;
