/**
 * YouTube IFrame API type claudeations.
 *
 * The @types/youtube package provides the global `YT` namespace declaration.
 * This file re-exports key types for use within the application and adds
 * any claudeations needed beyond what @types/youtube provides.
 *
 * Note: The `window.YT` global is typed by @types/youtube via the `YT` namespace.
 * This module does not need to re-declare it.
 */

/**
 * YouTube IFrame Player state values, mirroring YT.PlayerState constants.
 * Typed as a plain enum-like object here for use in switch statements.
 */
export const YouTubePlayerState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

export type YouTubePlayerStateValue =
  (typeof YouTubePlayerState)[keyof typeof YouTubePlayerState];

/**
 * YouTube IFrame API error codes relevant to the application.
 */
export const YouTubePlayerError = {
  /** The video requested was not found. */
  NOT_FOUND: 100,
  /** The video owner has not allowed it to be played in embedded players. */
  EMBED_NOT_ALLOWED: 101,
  /** Another embed not allowed variant. */
  EMBED_NOT_ALLOWED_2: 150,
} as const;

export type YouTubePlayerErrorCode =
  (typeof YouTubePlayerError)[keyof typeof YouTubePlayerError];
