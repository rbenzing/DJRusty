/**
 * playerRegistry.ts — Lightweight module-level registry for deck player instances.
 *
 * The player instance lives in a useRef inside useYouTubePlayer (by design
 * it must never enter Zustand state). Components outside the hook that need to
 * issue imperative player commands (e.g. HotCues seeking to a timestamp) can look
 * up the relevant player here.
 *
 * useYouTubePlayer registers a YouTubePlayerAdapter on creation and unregisters on unmount.
 * Future stories will register an AudioEngine adapter for MP3 playback.
 * All access is synchronous so there are no timing issues.
 */

type DeckId = 'A' | 'B';

/**
 * Common interface implemented by all deck player backends.
 * YouTube IFrame players use YouTubePlayerAdapter; MP3 players will use AudioEngine.
 */
export interface DeckPlayer {
  /** Seek to the given position in seconds. */
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  /** Return the current playback position in seconds. */
  getCurrentTime(): number;
  /** Return the total duration of the loaded track in seconds. */
  getDuration(): number;
}

/**
 * Thin adapter that wraps a raw YT.Player instance to conform to DeckPlayer.
 * This keeps the registry typed to DeckPlayer rather than the YouTube-specific YT.Player,
 * enabling MP3 AudioEngine instances to be stored in the same registry in future stories.
 */
export class YouTubePlayerAdapter implements DeckPlayer {
  constructor(private readonly player: YT.Player) {}

  seekTo(seconds: number, allowSeekAhead = true): void {
    this.player.seekTo(seconds, allowSeekAhead);
  }

  getCurrentTime(): number {
    return this.player.getCurrentTime();
  }

  getDuration(): number {
    return this.player.getDuration();
  }
}

const registry = new Map<DeckId, DeckPlayer>();

export const playerRegistry = {
  /**
   * Register a DeckPlayer for a deck. Called by useYouTubePlayer when the player
   * adapter is created, and will be called by the AudioEngine hook in mp3-002.
   */
  register(deckId: DeckId, player: DeckPlayer): void {
    registry.set(deckId, player);
  },

  /**
   * Unregister the player for a deck. Called by useYouTubePlayer on unmount.
   */
  unregister(deckId: DeckId): void {
    registry.delete(deckId);
  },

  /**
   * Get the DeckPlayer for a deck, or undefined if not yet ready.
   */
  get(deckId: DeckId): DeckPlayer | undefined {
    return registry.get(deckId);
  },
};
