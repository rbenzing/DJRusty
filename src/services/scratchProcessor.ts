/**
 * scratchProcessor.ts — AudioWorkletProcessor for real scratch audio.
 *
 * Loaded once via audioContext.audioWorklet.addModule(...) (see
 * audioEngine.ts's ensureScratchWorkletLoaded). Each deck creates its own
 * AudioWorkletNode instance from this registered processor. Holds a copy of
 * the track's channel data (sent once via postMessage when the track loads)
 * and advances a fractional read position by the signed `readRate` AudioParam
 * each sample — this is what makes both reverse playback and arbitrary
 * scratch speeds possible without relying on unsupported negative native
 * playbackRate (see docs/superpowers/specs/2026-07-04-jogwheel-scratch-phase3-design.md).
 */
import { interpolateSample } from '../utils/scratchMath';

// AudioWorklet global scope declarations
declare const sampleRate: number;
declare class AudioWorkletProcessor {
  port: MessagePort;
  constructor();
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}
declare function registerProcessor(name: string, processorCtor: new () => AudioWorkletProcessor): void;

// ~64 render quanta (128 samples each) ≈ 186ms at 44.1kHz — throttles how
// often the live read-position is reported back to the main thread.
const POSITION_REPORT_INTERVAL = 64;

interface LoadMessage { type: 'load'; channels: Float32Array[]; }
interface SetPositionMessage { type: 'setPosition'; position: number; }
interface SetLoopBoundsMessage { type: 'setLoopBounds'; start: number | null; end: number | null; }
type InboundMessage = LoadMessage | SetPositionMessage | SetLoopBoundsMessage;

class ScratchProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'readRate', defaultValue: 0, minValue: -8, maxValue: 8, automationRate: 'a-rate' as const },
    ];
  }

  private channels: Float32Array[] = [];
  private positionSamples = 0;
  private loopStartSamples: number | null = null;
  private loopEndSamples: number | null = null;
  private reportCounter = 0;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<InboundMessage>) => {
      const msg = event.data;
      if (msg.type === 'load') {
        this.channels = msg.channels;
        this.positionSamples = 0;
      } else if (msg.type === 'setPosition') {
        this.positionSamples = msg.position * sampleRate;
      } else if (msg.type === 'setLoopBounds') {
        this.loopStartSamples = msg.start === null ? null : msg.start * sampleRate;
        this.loopEndSamples = msg.end === null ? null : msg.end * sampleRate;
      }
    };
  }

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean {
    const output = outputs[0];
    if (!output || output.length === 0 || this.channels.length === 0) return true;

    const readRate = parameters.readRate;
    const frameCount = output[0]?.length ?? 0;

    for (let i = 0; i < frameCount; i++) {
      const rate = readRate && readRate.length > 1 ? (readRate[i] ?? 0) : (readRate?.[0] ?? 0);

      for (let ch = 0; ch < output.length; ch++) {
        const data = this.channels[ch % this.channels.length];
        const outChannel = output[ch];
        if (data && outChannel) outChannel[i] = interpolateSample(data, this.positionSamples);
      }

      this.positionSamples += rate;
      const maxSample = (this.channels[0]?.length ?? 1) - 1;
      if (this.loopStartSamples !== null && this.loopEndSamples !== null) {
        this.positionSamples = Math.max(this.loopStartSamples, Math.min(this.positionSamples, this.loopEndSamples));
      } else {
        this.positionSamples = Math.max(0, Math.min(this.positionSamples, maxSample));
      }
    }

    this.reportCounter++;
    if (this.reportCounter >= POSITION_REPORT_INTERVAL) {
      this.reportCounter = 0;
      this.port.postMessage({ type: 'position', position: this.positionSamples / sampleRate });
    }

    return true;
  }
}

registerProcessor('scratch-processor', ScratchProcessor);
