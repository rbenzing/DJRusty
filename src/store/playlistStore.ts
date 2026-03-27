/**
 * playlistStore.ts — Per-deck playlist / track queue store.
 *
 * Each deck (A and B) has an independent ordered queue of tracks.
 * The playlist drives deck auto-advance: when a track ends, the next
 * entry in the queue is loaded and played automatically.
 *
 * currentIndex tracks which playlist entry is currently active in the
 * deck. It is -1 when no playlist entry is loaded. Index advances via
 * skipToNext / skipToPrev / jumpToTrack, and automatically on track end
 * (handled by useYouTubePlayer which calls skipToNext when 'ended').
 *
 * Playlist entries added via addTrack: if the deck is empty (first track),
 * the track is cued in the deck immediately. Subsequent entries queue up.
 * Auto-advance and skip actions use loadVideoById (autoPlayOnLoad=true)
 * so the next track starts playing without a manual press.
 */
import { create } from 'zustand';
import type { PlaylistEntry } from '../types/playlist';
import { useDeckStore } from './deckStore';

// ── Types ────────────────────────────────────────────────────────────────────

interface PlaylistStoreState {
  playlists: Record<'A' | 'B', PlaylistEntry[]>;
  /** Index of the entry currently active in the deck. -1 = none. */
  currentIndex: Record<'A' | 'B', number>;
}

interface PlaylistStoreActions {
  /**
   * Add a track to the end of the specified deck's playlist.
   * If the playlist was empty, also cues the track in the deck (no autoplay).
   */
  addTrack(deckId: 'A' | 'B', entry: Omit<PlaylistEntry, 'id'>): void;

  /** Remove a track by its unique entry id. Adjusts currentIndex as needed. */
  removeTrack(deckId: 'A' | 'B', id: string): void;

  /** Remove all tracks from the specified deck's playlist. */
  clearPlaylist(deckId: 'A' | 'B'): void;

  /** Advance to the next track and auto-play it. No-op if already at end. */
  skipToNext(deckId: 'A' | 'B'): void;

  /** Go back to the previous track and auto-play it. No-op if at start. */
  skipToPrev(deckId: 'A' | 'B'): void;

  /** Jump to a specific index and auto-play it. */
  jumpToTrack(deckId: 'A' | 'B', index: number): void;
}

type PlaylistStore = PlaylistStoreState & PlaylistStoreActions;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a unique entry id — not relying on crypto for broad compatibility. */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Imperatively load a playlist entry into the deck store.
 * When autoPlay=true the YouTube player will call loadVideoById (plays immediately).
 * When autoPlay=false it calls cueVideoById (ready to play but not started).
 *
 * trackId derivation:
 *  - YouTube entries: use `entry.videoId` (the actual YouTube video ID, which is
 *    what hot cues and the IFrame API expect).
 *  - MP3 entries: fall back to `entry.id` (the playlist entry UUID) since there
 *    is no videoId. This ensures trackId is always a non-empty string.
 */
function loadDeckTrack(deckId: 'A' | 'B', entry: PlaylistEntry, autoPlay: boolean): void {
  useDeckStore.getState().loadTrack(
    deckId,
    entry.videoId ?? entry.id,
    {
      sourceType: entry.sourceType,
      title: entry.title,
      artist: entry.artist,
      duration: entry.duration,
      thumbnailUrl: entry.thumbnailUrl,
    },
    autoPlay,
  );
}

// ── Store ────────────────────────────────────────────────────────────────────

export const usePlaylistStore = create<PlaylistStore>((set, get) => ({
  playlists: { A: [], B: [] },
  currentIndex: { A: -1, B: -1 },

  addTrack: (deckId, entryData) => {
    const entry: PlaylistEntry = { ...entryData, id: generateId() };
    const wasEmpty = get().playlists[deckId].length === 0;

    set((state) => ({
      playlists: {
        ...state.playlists,
        [deckId]: [...state.playlists[deckId], entry],
      },
      currentIndex: wasEmpty
        ? { ...state.currentIndex, [deckId]: 0 }
        : state.currentIndex,
    }));

    // Cue the first track in the deck so it is ready to play.
    if (wasEmpty) {
      loadDeckTrack(deckId, entry, false);
    }
  },

  removeTrack: (deckId, id) => {
    const { playlists, currentIndex } = get();
    const playlist = playlists[deckId];
    const removedIdx = playlist.findIndex((e) => e.id === id);
    if (removedIdx === -1) return;

    const newPlaylist = playlist.filter((e) => e.id !== id);
    const current = currentIndex[deckId];

    let newCurrentIndex = current;
    if (removedIdx < current) {
      // Entries before current shifted — current moved left by one.
      newCurrentIndex = current - 1;
    } else if (removedIdx === current) {
      // Current track removed — point to the same position (now the next entry)
      // or to the last entry if we removed the last one, or -1 if now empty.
      newCurrentIndex = newPlaylist.length > 0
        ? Math.min(removedIdx, newPlaylist.length - 1)
        : -1;
    }
    // removedIdx > current: nothing changes

    set((state) => ({
      playlists: { ...state.playlists, [deckId]: newPlaylist },
      currentIndex: { ...state.currentIndex, [deckId]: newCurrentIndex },
    }));
  },

  clearPlaylist: (deckId) => {
    set((state) => ({
      playlists: { ...state.playlists, [deckId]: [] },
      currentIndex: { ...state.currentIndex, [deckId]: -1 },
    }));
  },

  skipToNext: (deckId) => {
    const { playlists, currentIndex } = get();
    const playlist = playlists[deckId];
    const idx = currentIndex[deckId];
    if (idx < 0 || idx >= playlist.length - 1) return;
    const nextIdx = idx + 1;
    const nextEntry = playlist[nextIdx];
    if (!nextEntry) return;

    set((state) => ({
      currentIndex: { ...state.currentIndex, [deckId]: nextIdx },
    }));
    loadDeckTrack(deckId, nextEntry, true);
  },

  skipToPrev: (deckId) => {
    const { playlists, currentIndex } = get();
    const playlist = playlists[deckId];
    const idx = currentIndex[deckId];
    if (idx <= 0) return;
    const prevIdx = idx - 1;
    const prevEntry = playlist[prevIdx];
    if (!prevEntry) return;

    set((state) => ({
      currentIndex: { ...state.currentIndex, [deckId]: prevIdx },
    }));
    loadDeckTrack(deckId, prevEntry, true);
  },

  jumpToTrack: (deckId, index) => {
    const { playlists } = get();
    const playlist = playlists[deckId];
    if (index < 0 || index >= playlist.length) return;
    const entry = playlist[index];
    if (!entry) return;

    set((state) => ({
      currentIndex: { ...state.currentIndex, [deckId]: index },
    }));
    loadDeckTrack(deckId, entry, true);
  },
}));
