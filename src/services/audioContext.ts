/**
 * audioContext.ts — Web Audio API AudioContext singleton.
 *
 * Provides a shared AudioContext instance for the entire application.
 * Handles browser autoplay policies and context suspension/resumption.
 */

let audioContext: AudioContext | null = null;

/**
 * Get the shared AudioContext instance, creating it if necessary.
 * Uses 'interactive' latency hint for low-latency audio playback.
 */
export function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext({
      latencyHint: 'interactive',
    });
  }
  return audioContext;
}

/**
 * Ensure the AudioContext is in a running state.
 * Handles browser autoplay policies by resuming suspended contexts.
 * Must be called before any audio operations that require a running context.
 */
export async function ensureAudioContextResumed(): Promise<void> {
  const context = getAudioContext();
  if (context.state === 'suspended') {
    await context.resume();
  }
}

/**
 * Get the current state of the AudioContext.
 * Useful for UI state management and debugging.
 */
export function getAudioContextState(): AudioContextState {
  return getAudioContext().state;
}