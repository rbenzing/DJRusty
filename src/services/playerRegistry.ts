/**
 * playerRegistry.ts — Lightweight module-level registry for deck player instances.
 *
 * The player instance lives in a useRef inside useYouTubePlayer (by design
 * it must never enter Zustand state). Components outside the hook that need to
 * issue imperative player commands (e.g. HotCues seeking to a timestamp) can look
 * up the relevant player here.
 *
 * useYouTubePlayer registers a YouTubePlayerAdapter on creation and unregisters on unmount.
 * useAudioEngine registers an AudioEngine adapter for MP3 playback.
 * All access is synchronous so there are no timing issues.
 *
 * The registry supports two calling conventions:
 *   - Legacy (single-backend):  register(deckId, player) / unregister(deckId) / get(deckId)
 *   - Multi-backend:            register(deckId, backendType, player) / unregister(deckId, backendType)
 *                               getActivePlayer(deckId, sourceType) — maps sourceType → backend, routes to correct player
 *
 * Backend type names:
 *   'youtube' — YouTube IFrame player (registered by useYouTubePlayer)
 *   'audio'   — Web Audio engine for MP3 playback (registered by useAudioEngine)
 *
 * Source type → backend mapping (used by getActivePlayer):
 *   'youtube' → 'youtube'
 *   'mp3'     → 'audio'
 */

import type { TrackSourceType } from '../types/playlist';

type DeckId = 'A' | 'B';

/** Backend type names used as the key in the multi-backend registry. */
export type BackendType = 'youtube' | 'audio';

/**
 * Common interface implemented by all deck player backends.
 * YouTube IFrame players use YouTubePlayerAdapter; MP3 players use AudioEngine.
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

// Legacy single-backend map (keyed by deckId only — backward compat for existing callers).
const legacyRegistry = new Map<DeckId, DeckPlayer>();

// Multi-backend map: key is `${deckId}:${backendType}`.
const multiRegistry = new Map<string, DeckPlayer>();

function multiKey(deckId: DeckId, backendType: BackendType): string {
  return `${deckId}:${backendType}`;
}

/**
 * Map a TrackSourceType to the backend type name used in the multi-backend registry.
 *   'youtube' → 'youtube'
 *   'mp3'     → 'audio'
 */
function sourceTypeToBackend(sourceType: TrackSourceType): BackendType {
  return sourceType === 'mp3' ? 'audio' : 'youtube';
}

export const playerRegistry = {
  /**
   * Register a DeckPlayer for a deck.
   *
   * Two-arg form (legacy): register(deckId, player)
   *   — used by existing callers (useYouTubePlayer, useAudioEngine, tests).
   *   — stores in the legacy map; get(deckId) returns this player.
   *
   * Three-arg form (multi-backend): register(deckId, backendType, player)
   *   — backendType is 'youtube' or 'audio'.
   *   — stores in the backend-keyed map; getActivePlayer(deckId, sourceType) returns this.
   */
  register(deckId: DeckId, playerOrBackendType: DeckPlayer | BackendType, player?: DeckPlayer): void {
    if (player !== undefined) {
      // Three-arg form: register(deckId, backendType, player)
      const backendType = playerOrBackendType as BackendType;
      multiRegistry.set(multiKey(deckId, backendType), player);
    } else {
      // Two-arg form: register(deckId, player)
      legacyRegistry.set(deckId, playerOrBackendType as DeckPlayer);
    }
  },

  /**
   * Unregister the player for a deck.
   *
   * One-arg form (legacy): unregister(deckId)
   * Two-arg form (multi-backend): unregister(deckId, backendType)
   */
  unregister(deckId: DeckId, backendType?: BackendType): void {
    if (backendType !== undefined) {
      multiRegistry.delete(multiKey(deckId, backendType));
    } else {
      legacyRegistry.delete(deckId);
    }
  },

  /**
   * Get the DeckPlayer for a deck (legacy single-backend API).
   * Returns undefined if not registered.
   */
  get(deckId: DeckId): DeckPlayer | undefined {
    return legacyRegistry.get(deckId);
  },
};

/**
 * Get the active backend player for a deck based on its source type.
 * Maps sourceType to the appropriate backend registration key:
 *   'youtube' → looks up the 'youtube' backend
 *   'mp3'     → looks up the 'audio' backend
 *
 * Returns undefined if no player has been registered for that (deckId, backendType) pair.
 *
 * Use this instead of playerRegistry.get() when the deck may have multiple
 * backend types registered (e.g. both YouTube and audio engine).
 */
export function getActivePlayer(deckId: DeckId, sourceType: TrackSourceType | null | undefined): DeckPlayer | undefined {
  if (!sourceType) return undefined;
  const backendType = sourceTypeToBackend(sourceType);
  return multiRegistry.get(multiKey(deckId, backendType));
}
