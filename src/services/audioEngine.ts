/**
 * audioEngine.ts — Web Audio API audio engine for MP3 playback.
 *
 * Implements the complete signal chain for MP3 audio playback with EQ, gain,
 * and analysis capabilities. Provides a clean interface for deck operations.
 */

import { getAudioContext, ensureAudioContextResumed } from './audioContext';
import type { DeckPlayer } from './playerRegistry';

export interface AudioEngine extends DeckPlayer {
  /** Load an AudioBuffer for playback. */
  loadBuffer(buffer: AudioBuffer): void;

  /** Start playback from the given offset (default: current position). */
  play(offset?: number): Promise<void>;

  /** Pause playback, preserving current position. */
  pause(): void;

  /** Stop playback and reset position to 0. */
  stop(): void;

  /** Seek to the given position in seconds. */
  seekTo(seconds: number): void;

  /** Set the playback rate (pitch control). */
  setPlaybackRate(rate: number): void;

  /** Set the volume level (0-100). */
  setVolume(volume: number): void;

  /** Set EQ gain for a specific band in dB. */
  setEQ(band: 'low' | 'mid' | 'high', gainDb: number): void;

  /** Get the AnalyserNode for visualization. */
  getAnalyser(): AnalyserNode;

  /** Check if the engine is ready for playback. */
  isReady(): boolean;

  /** Check if audio is currently playing. */
  isPlaying(): boolean;

  /** Register a callback for when playback naturally ends. */
  onEnded(callback: () => void): void;

  /** Clean up all Web Audio nodes. */
  destroy(): void;
}

/**
 * AudioEngine implementation using Web Audio API.
 * Manages a persistent signal chain for EQ, gain, and analysis.
 */
export class AudioEngineImpl implements AudioEngine {
  private context: AudioContext;
  private buffer: AudioBuffer | null = null;

  // Signal chain nodes (persistent)
  private gainNode: GainNode;
  private lowFilter: BiquadFilterNode;
  private midFilter: BiquadFilterNode;
  private highFilter: BiquadFilterNode;
  private analyser: AnalyserNode;

  // Playback state
  private sourceNode: AudioBufferSourceNode | null = null;
  private isPlayingFlag = false;
  private seekOffset = 0;
  private startedAt = 0;
  private playbackRate = 1.0;
  private stoppedManually = false;
  private endedCallback: (() => void) | null = null;

  constructor() {
    this.context = getAudioContext();

    // Create persistent signal chain
    this.gainNode = this.context.createGain();
    this.lowFilter = this.context.createBiquadFilter();
    this.midFilter = this.context.createBiquadFilter();
    this.highFilter = this.context.createBiquadFilter();
    this.analyser = this.context.createAnalyser();

    // Configure filters
    this.lowFilter.type = 'lowshelf';
    this.lowFilter.frequency.value = 320;

    this.midFilter.type = 'peaking';
    this.midFilter.frequency.value = 1000;
    this.midFilter.Q.value = 0.7;

    this.highFilter.type = 'highshelf';
    this.highFilter.frequency.value = 3200;

    // Connect signal chain: Gain -> Low -> Mid -> High -> Analyser -> Destination
    this.gainNode.connect(this.lowFilter);
    this.lowFilter.connect(this.midFilter);
    this.midFilter.connect(this.highFilter);
    this.highFilter.connect(this.analyser);
    this.analyser.connect(this.context.destination);
  }

  loadBuffer(buffer: AudioBuffer): void {
    this.buffer = buffer;
  }

  async play(offset?: number): Promise<void> {
    if (!this.buffer) {
      throw new Error('No audio buffer loaded');
    }

    await ensureAudioContextResumed();

    // Stop any existing playback
    this.stopSource();

    // Calculate start position
    const startOffset = offset !== undefined ? offset : this.seekOffset;

    // Update seek offset to match start position
    this.seekOffset = startOffset;

    // Create and configure new source node
    this.sourceNode = this.context.createBufferSource();
    this.sourceNode.buffer = this.buffer;
    this.sourceNode.playbackRate.value = this.playbackRate;

    // Connect to signal chain
    this.sourceNode.connect(this.gainNode);

    // Set up ended handler
    this.sourceNode.onended = () => {
      this.isPlayingFlag = false;
      if (!this.stoppedManually && this.endedCallback) {
        this.endedCallback();
      }
    };

    // Start playback
    this.sourceNode.start(0, startOffset);
    this.startedAt = this.context.currentTime;
    this.isPlayingFlag = true;
    this.stoppedManually = false;
  }

  pause(): void {
    if (!this.isPlayingFlag || !this.sourceNode) return;

    // Calculate current position for resume
    this.seekOffset = this.getCurrentTime();
    this.stopSource();
  }

  stop(): void {
    this.seekOffset = 0;
    this.stoppedManually = true;
    this.stopSource();
  }

  seekTo(seconds: number): void {
    // Clamp to valid range
    const clampedSeconds = Math.max(0, Math.min(seconds, this.getDuration()));

    if (this.isPlayingFlag) {
      // Seek while playing: stop current source and start new one
      this.seekOffset = clampedSeconds;
      this.play(clampedSeconds);
    } else {
      // Seek while paused: just update offset
      this.seekOffset = clampedSeconds;
    }
  }

  getCurrentTime(): number {
    if (!this.isPlayingFlag) {
      return this.seekOffset;
    }

    return this.seekOffset + (this.context.currentTime - this.startedAt) * this.playbackRate;
  }

  getDuration(): number {
    return this.buffer?.duration ?? 0;
  }

  setPlaybackRate(rate: number): void {
    this.playbackRate = rate;
    if (this.sourceNode) {
      this.sourceNode.playbackRate.value = rate;
    }
  }

  setVolume(volume: number): void {
    // Map 0-100 to 0.0-1.0
    const gain = Math.max(0, Math.min(volume, 100)) / 100;
    this.gainNode.gain.value = gain;
  }

  setEQ(band: 'low' | 'mid' | 'high', gainDb: number): void {
    const filter = {
      low: this.lowFilter,
      mid: this.midFilter,
      high: this.highFilter,
    }[band];

    filter.gain.value = gainDb;
  }

  getAnalyser(): AnalyserNode {
    return this.analyser;
  }

  isReady(): boolean {
    return this.buffer !== null;
  }

  isPlaying(): boolean {
    return this.isPlayingFlag;
  }

  onEnded(callback: () => void): void {
    this.endedCallback = callback;
  }

  destroy(): void {
    this.stopSource();
    this.gainNode.disconnect();
    this.lowFilter.disconnect();
    this.midFilter.disconnect();
    this.highFilter.disconnect();
    this.analyser.disconnect();
  }

  private stopSource(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch (e) {
        // Source might already be stopped
      }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.isPlayingFlag = false;
  }
}