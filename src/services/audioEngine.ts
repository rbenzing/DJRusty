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

  /** Kill/un-kill a specific EQ band (instantly silences that band). */
  setEQKill(band: 'low' | 'mid' | 'high', kill: boolean): void;

  /**
   * Set the filter sweep position.
   * -1 = full high-pass (cuts bass), 0 = bypass, 1 = full low-pass (cuts highs).
   */
  setFilterSweep(position: number): void;

  /**
   * Enable/disable and configure an effect.
   * type 'none' bypasses all effects.
   * type 'echo' uses a DelayNode, 'reverb' uses a ConvolverNode.
   */
  setEffect(type: 'none' | 'echo' | 'reverb', wetDry: number, bpm?: number): void;

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
  // Kill gain nodes — set to 0 to silence a band
  private lowKillGain: GainNode;
  private midKillGain: GainNode;
  private highKillGain: GainNode;
  // Filter sweep: single BiquadFilter inserted after EQ
  private sweepFilter: BiquadFilterNode;
  // Effects: dry/wet nodes + delay + convolver
  private dryGain: GainNode;
  private wetGain: GainNode;
  private effectNode: DelayNode | ConvolverNode | null = null;
  private analyser: AnalyserNode;

  // Playback state
  private sourceNode: AudioBufferSourceNode | null = null;
  private isPlayingFlag = false;
  private seekOffset = 0;
  private startedAt = 0;
  private playbackRate = 1.0;
  private generation = 0; // incremented on every intentional stop; onended ignores stale generations
  private endedCallback: (() => void) | null = null;

  constructor() {
    this.context = getAudioContext();

    // Create persistent signal chain nodes
    this.gainNode = this.context.createGain();
    this.lowFilter = this.context.createBiquadFilter();
    this.midFilter = this.context.createBiquadFilter();
    this.highFilter = this.context.createBiquadFilter();
    this.lowKillGain = this.context.createGain();
    this.midKillGain = this.context.createGain();
    this.highKillGain = this.context.createGain();
    this.sweepFilter = this.context.createBiquadFilter();
    this.dryGain = this.context.createGain();
    this.wetGain = this.context.createGain();
    this.analyser = this.context.createAnalyser();

    // Configure EQ filters
    this.lowFilter.type = 'lowshelf';
    this.lowFilter.frequency.value = 320;

    this.midFilter.type = 'peaking';
    this.midFilter.frequency.value = 1000;
    this.midFilter.Q.value = 0.7;

    this.highFilter.type = 'highshelf';
    this.highFilter.frequency.value = 3200;

    // Sweep filter starts as allpass (transparent)
    this.sweepFilter.type = 'allpass';
    this.sweepFilter.frequency.value = 20000;

    // Effects: start fully dry
    this.dryGain.gain.value = 1;
    this.wetGain.gain.value = 0;

    // Signal chain:
    // Gain → LowFilter → LowKillGain → MidFilter → MidKillGain → HighFilter → HighKillGain
    //      → SweepFilter → DryGain → Analyser → Destination
    //                    ↘ WetGain → [effectNode] → Analyser
    this.gainNode.connect(this.lowFilter);
    this.lowFilter.connect(this.lowKillGain);
    this.lowKillGain.connect(this.midFilter);
    this.midFilter.connect(this.midKillGain);
    this.midKillGain.connect(this.highFilter);
    this.highFilter.connect(this.highKillGain);
    this.highKillGain.connect(this.sweepFilter);
    this.sweepFilter.connect(this.dryGain);
    this.dryGain.connect(this.analyser);
    this.analyser.connect(this.context.destination);
    // wetGain is connected when an effect is activated
  }

  loadBuffer(buffer: AudioBuffer): void {
    this.buffer = buffer;
  }

  async play(offset?: number): Promise<void> {
    if (!this.buffer) {
      throw new Error('No audio buffer loaded');
    }

    await ensureAudioContextResumed();

    // Bump generation — any pending onended from the old source will see a stale generation
    const myGeneration = ++this.generation;
    this.stopSource();

    // Calculate start position
    const startOffset = offset !== undefined ? offset : this.seekOffset;
    this.seekOffset = startOffset;

    // Create and configure new source node
    this.sourceNode = this.context.createBufferSource();
    this.sourceNode.buffer = this.buffer;
    this.sourceNode.playbackRate.value = this.playbackRate;
    this.sourceNode.connect(this.gainNode);

    // onended only fires the callback when this source is still the current generation
    this.sourceNode.onended = () => {
      this.isPlayingFlag = false;
      if (this.generation === myGeneration && this.endedCallback) {
        this.endedCallback();
      }
    };

    this.sourceNode.start(0, startOffset);
    this.startedAt = this.context.currentTime;
    this.isPlayingFlag = true;
  }

  pause(): void {
    if (!this.isPlayingFlag || !this.sourceNode) return;
    ++this.generation; // invalidate pending onended
    this.seekOffset = this.getCurrentTime();
    this.stopSource();
  }

  stop(): void {
    ++this.generation; // invalidate pending onended
    this.seekOffset = 0;
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

  setEQKill(band: 'low' | 'mid' | 'high', kill: boolean): void {
    const killGain = {
      low: this.lowKillGain,
      mid: this.midKillGain,
      high: this.highKillGain,
    }[band];
    killGain.gain.value = kill ? 0 : 1;
  }

  setFilterSweep(position: number): void {
    // position: -1 = full HPF, 0 = bypass, 1 = full LPF
    const p = Math.max(-1, Math.min(1, position));
    if (Math.abs(p) < 0.01) {
      // Flat/bypass — allpass at Nyquist
      this.sweepFilter.type = 'allpass';
      this.sweepFilter.frequency.value = 20000;
      return;
    }
    // Logarithmic frequency sweep: 20 Hz ↔ 20 kHz
    // At p = -1 (HPF): frequency goes from 20 Hz (deep) to 2 kHz as p goes -1 → 0
    // At p = +1 (LPF): frequency goes from 20 kHz (open) to 200 Hz as p goes 0 → 1
    const sampleRate = this.context.sampleRate;
    const nyquist = sampleRate / 2;
    if (p < 0) {
      // High-pass: cuts bass — sweeps HPF cutoff from near 0 Hz up to ~2 kHz
      this.sweepFilter.type = 'highpass';
      const freq = 20 * Math.pow(2000 / 20, -p); // 20 Hz at p=0 → 2000 Hz at p=-1
      this.sweepFilter.frequency.value = Math.min(freq, nyquist * 0.9);
      this.sweepFilter.Q.value = 0.8;
    } else {
      // Low-pass: cuts highs — sweeps LPF cutoff from 20 kHz down to ~200 Hz
      this.sweepFilter.type = 'lowpass';
      const freq = 20000 * Math.pow(200 / 20000, p); // 20000 Hz at p=0 → 200 Hz at p=1
      this.sweepFilter.frequency.value = Math.max(freq, 20);
      this.sweepFilter.Q.value = 0.8;
    }
  }

  setEffect(type: 'none' | 'echo' | 'reverb', wetDry: number, bpm = 120): void {
    // Disconnect and destroy any previous effect node
    if (this.effectNode) {
      try { this.effectNode.disconnect(); } catch { /* already disconnected */ }
      this.effectNode = null;
    }
    this.wetGain.disconnect();

    if (type === 'none' || wetDry === 0) {
      this.dryGain.gain.value = 1;
      this.wetGain.gain.value = 0;
      return;
    }

    this.dryGain.gain.value = 1 - wetDry * 0.5; // keep some dry signal
    this.wetGain.gain.value = wetDry;

    if (type === 'echo') {
      const delay = this.context.createDelay(4.0);
      const beatSeconds = 60 / bpm;
      delay.delayTime.value = beatSeconds * 0.5; // half-beat echo
      const feedbackGain = this.context.createGain();
      feedbackGain.gain.value = 0.4;
      // Echo chain: sweepFilter → wetGain → delay → feedbackGain → delay (loop) → analyser
      this.sweepFilter.connect(this.wetGain);
      this.wetGain.connect(delay);
      delay.connect(feedbackGain);
      feedbackGain.connect(delay); // feedback loop
      delay.connect(this.analyser);
      this.effectNode = delay;
    } else if (type === 'reverb') {
      const convolver = this.context.createConvolver();
      convolver.buffer = this.createReverbImpulse(2.5, 0.7);
      this.sweepFilter.connect(this.wetGain);
      this.wetGain.connect(convolver);
      convolver.connect(this.analyser);
      this.effectNode = convolver;
    }
  }

  /**
   * Generate a synthetic reverb impulse response (exponentially decaying noise).
   * Duration in seconds, decay controls how quickly it fades.
   */
  private createReverbImpulse(duration: number, decay: number): AudioBuffer {
    const rate = this.context.sampleRate;
    const length = Math.round(rate * duration);
    const impulse = this.context.createBuffer(2, length, rate);
    for (let c = 0; c < 2; c++) {
      const ch = impulse.getChannelData(c);
      for (let i = 0; i < length; i++) {
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
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
    if (this.effectNode) { try { this.effectNode.disconnect(); } catch { /* ok */ } }
    [
      this.gainNode, this.lowFilter, this.lowKillGain,
      this.midFilter, this.midKillGain, this.highFilter, this.highKillGain,
      this.sweepFilter, this.dryGain, this.wetGain, this.analyser,
    ].forEach((n) => { try { n.disconnect(); } catch { /* ok */ } });
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