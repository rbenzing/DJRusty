/**
 * SearchPanel.tsx — Track browser panel.
 *
 * Rendered at the bottom of the application layout.
 *
 * Tabs:
 *   - Playlist: Deck A and Deck B queues (PlaylistPanel)
 *   - Library:  Placeholder for future local-library feature
 */
import { useState } from 'react';
import { PlaylistPanel } from '../Playlist/PlaylistPanel';
import { LibraryBrowser } from '../Library/LibraryBrowser';
import { SessionPanel } from '../Session/SessionPanel';
import styles from './SearchPanel.module.css';

type ActiveTab = 'playlist' | 'library' | 'sessions';

interface SearchPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function SearchPanel({ isOpen, onToggle }: SearchPanelProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('playlist');

  return (
    <section
      className={[
        styles.panel,
        isOpen ? styles.panelOpen : '',
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
        title={isOpen ? 'Collapse track browser (/)' : 'Open track browser (/)'}
      >
        <span className={`${styles.handleChevron} ${isOpen ? styles.handleChevronOpen : ''}`}>
          ▲
        </span>
        <span className={styles.handleLabel}>TRACK BROWSER</span>
        <kbd className={styles.handleKbd}>/</kbd>
      </button>

      {/* ── Drawer content — hidden when collapsed ── */}
      <div id="search-drawer-content" className={styles.content} aria-hidden={!isOpen}>

        {/* Tab switcher */}
        <div className={styles.tabBar} role="tablist" aria-label="Track browser tabs">
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
          <button
            role="tab"
            type="button"
            id="sessions-tab"
            className={`${styles.tab} ${activeTab === 'sessions' ? styles.tabActive : ''}`}
            aria-selected={activeTab === 'sessions'}
            aria-controls="sessions-tab-panel"
            onClick={() => setActiveTab('sessions')}
          >
            Sessions
          </button>
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
          <LibraryBrowser />
        </div>

        <div
          role="tabpanel"
          id="sessions-tab-panel"
          aria-labelledby="sessions-tab"
          hidden={activeTab !== 'sessions'}
        >
          <SessionPanel />
        </div>

      </div>{/* end .content */}
    </section>
  );
}

export default SearchPanel;
