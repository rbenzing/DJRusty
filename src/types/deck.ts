import type { PitchRate } from '../constants/pitchRates';
import type { ColoredPeak } from '../utils/extractColoredPeaks';
import type { TransportState } from '../utils/transport';
export type { ColoredPeak };
export type { TransportState };

export type { PitchRate };

/**
 * Current playback state of a deck.
 */
export type PlaybackState = 'unstarted' | 'playing' | 'paused' | 'ended' | 'buffering';

/**
 * State slice for a single DJ deck (A or B).
 */
export interface DeckState {
  /** Identifies which deck this state belongs to. */
  deckId: 'A' | 'B';

  /**
   * Track identifier currently loaded into the deck, or null if empty.
   * Equals the PlaylistEntry.id.
   */
  trackId: string | null;

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
   * Frequency-colored peak data for the CenterWaveform display.
   * Each entry corresponds to one bar; contains amplitude + bass/mid/high energy shares.
   * Null until waveform analysis completes (MP3 only).
   */
  waveformColoredPeaks: ColoredPeak[] | null;

  /**
   * Filter sweep position: -1 = full high-pass, 0 = flat (bypass), 1 = full low-pass.
   * Applied to a dedicated BiquadFilterNode in the Web Audio signal chain.
   * EQ kill: instantly silence a specific EQ band.
   */
  filterSweep: number;
  eqKillLow: boolean;
  eqKillMid: boolean;
  eqKillHigh: boolean;

  /**
   * Effects (Echo / Reverb) state.
   * 'none' = bypass, 'echo' = delay node, 'reverb' = convolver.
   */
  effectType: 'none' | 'echo' | 'reverb';
  effectEnabled: boolean;
  /** Wet/dry mix: 0 = fully dry, 1 = fully wet. */
  effectWetDry: number;

  /** FX BEAT/TIME knob position (0..1). Maps to a musical division; default 0.5 = half-beat. */
  effectBeat: number;

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

  /** Current playback position in seconds, polled from the audio engine at 250ms intervals. */
  currentTime: number;

  /** Thumbnail URL from search result, used as vinyl label image. */
  thumbnailUrl: string | null;

  /** Current playback state. */
  playbackState: PlaybackState;

  /**
   * Current playback rate. Supports any continuous positive number.
   */
  pitchRate: number;

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

  /** Whether the audio engine is ready to receive commands. */
  playerReady: boolean;

  /** Hot cue timestamps keyed by index (0–7). Only set cues are present. */
  hotCues: Record<number, number>;

  /** EQ knob values in dB (visual only in v1). Range: -12 to +12. */
  eqLow: number;
  eqMid: number;
  eqHigh: number;

  /** Channel input trim (GAIN) in dB. Range -24..+12, unity at 0. */
  gainDb: number;

  /** Error message if the deck is in an error state, or null if healthy. */
  error: string | null;

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
   * When true, the player will auto-play immediately on the next track load.
   * Set by playlist auto-advance actions (skipToNext, skipToPrev, jumpToTrack)
   * and cleared immediately after the player issues the load command.
   */
  autoPlayOnLoad: boolean;

  /**
   * Beat-grid anchor: the position (seconds) of beat zero within the track.
   * Null until a grid is set via setGrid or tap-tempo analysis.
   */
  anchor: number | null;

  /**
   * Whether the beat grid has been confirmed by the user or analysis.
   * False until setGrid is called.
   */
  gridConfirmed: boolean;

  /**
   * The hardware CUE point position in seconds, or null if not set.
   * Mirrors Pioneer CDJ cue behaviour: pressing CUE without a set cue sets this.
   */
  cuePoint: number | null;

  /**
   * Current transport state, following Pioneer CDJ conventions.
   * Resets to 'CUED' on track load/clear.
   */
  transportState: TransportState;

}
