import type { PitchRate } from '../constants/pitchRates';
import type { TrackSourceType } from './playlist';

export type { PitchRate };

/**
 * Current playback state of a deck, mapped from YT.PlayerState values.
 */
export type PlaybackState = 'unstarted' | 'playing' | 'paused' | 'ended' | 'buffering';

/**
 * State slice for a single DJ deck (A or B).
 */
export interface DeckState {
  /** Identifies which deck this state belongs to. */
  deckId: 'A' | 'B';

  /**
   * Source-agnostic track identifier currently loaded into the deck, or null if empty.
   * For YouTube entries this equals the YouTube video ID.
   * For MP3 entries this equals the PlaylistEntry.id.
   * Renamed from `videoId` to support both source types.
   */
  trackId: string | null;

  /**
   * Source type of the currently loaded track, or null when no track is loaded.
   * Used to select the correct playback engine (YouTube IFrame vs Web Audio API).
   */
  sourceType: TrackSourceType | null;

  /** Track title. */
  title: string;

  /**
   * Artist / channel name.
   * Renamed from `channelTitle` for source-agnostic naming.
   */
  artist: string;

  /**
   * Waveform peak data extracted from the decoded AudioBuffer, or null until
   * waveform analysis completes (populated by mp3-008 story).
   */
  waveformPeaks: Float32Array | null;

  /**
   * True while the Web Audio API is decoding an MP3 ArrayBuffer.
   * Populated by mp3-002 story; always false until then.
   */
  decoding: boolean;

  /**
   * True while BPM detection is running in the background worker.
   * Populated by mp3-010 story; always false until then.
   */
  bpmDetecting: boolean;

  /** Total duration of the loaded track in seconds. */
  duration: number;

  /** Current playback position in seconds, polled from IFrame API at 250ms intervals. */
  currentTime: number;

  /** Thumbnail URL from search result, used as vinyl label image. */
  thumbnailUrl: string | null;

  /** Current playback state, derived from YT.PlayerState events. */
  playbackState: PlaybackState;

  /** Current playback rate. Must be one of the discrete PITCH_RATES values. */
  pitchRate: PitchRate;

  /** User-defined BPM via tap-tempo, or null if not set. */
  bpm: number | null;

  /** Deck volume level (0–100). Controlled by the deck volume fader. */
  volume: number;

  /** Whether a loop is currently active. */
  loopActive: boolean;

  /** Loop start position in seconds, or null if no loop is set. */
  loopStart: number | null;

  /** Loop end position in seconds, or null if no loop is set. */
  loopEnd: number | null;

  /**
   * The beat count of the currently active loop (1, 2, 4, or 8), or null when
   * no loop is active. Used to highlight the active loop button in the UI.
   */
  loopBeatCount: 1 | 2 | 4 | 8 | null;

  /** Currently selected beat jump size. Controls how far the beat jump buttons seek. */
  beatJumpSize: number;

  /** Whether the YT.Player instance is ready to receive commands. */
  playerReady: boolean;

  /** Hot cue timestamps keyed by index (0–7). Only set cues are present. */
  hotCues: Record<number, number>;

  /** EQ knob values in dB (visual only in v1). Range: -12 to +12. */
  eqLow: number;
  eqMid: number;
  eqHigh: number;

  /** Error message if the deck is in an error state, or null if healthy. */
  error: string | null;

  /**
   * Whether the pitch slider is locked because the loaded video only supports
   * playback at 1× speed (getAvailablePlaybackRates() returned [1] only).
   */
  pitchRateLocked: boolean;

  /** Whether this deck's pitch rate is currently beat-synced to the other deck. */
  synced: boolean;

  /** Whether slip mode is enabled for this deck. */
  slipMode: boolean;

  /** The shadow playhead position (seconds) that advances in real time while slip is active. Null when slip is off or no anchor is set. */
  slipPosition: number | null;

  /** Wall-clock timestamp (ms) when slip tracking started. Used to compute elapsed time. */
  slipStartTime: number | null;

  /** Track position (seconds) when slip tracking started. Anchor for computing slipPosition. */
  slipStartPosition: number | null;

  /** Whether loop-roll mode is active (loop buttons act as momentary roll triggers). */
  rollMode: boolean;

  /** Wall-clock timestamp (ms) when the current loop roll press began. Null when no roll is in progress. */
  rollStartWallClock: number | null;

  /** Track position (seconds) at the moment the loop roll press began. Null when no roll is in progress. */
  rollStartPosition: number | null;

  /**
   * When true, useYouTubePlayer will call loadVideoById (auto-plays immediately)
   * instead of cueVideoById the next time the videoId changes. Set by playlist
   * auto-advance actions (skipToNext, skipToPrev, jumpToTrack) and cleared
   * immediately after the player issues the load command.
   */
  autoPlayOnLoad: boolean;

}
