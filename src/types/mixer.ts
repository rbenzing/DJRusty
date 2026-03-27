/**
 * Crossfader curve shape controlling how position maps to per-deck volumes.
 *
 * - 'smooth': Constant-power (cosine) curve. Both decks at ~71% at centre.
 * - 'linear': Linear fade. Both decks at 50% at centre.
 * - 'sharp':  Hard cut. Both decks at 100% at centre; fast cut to 0 at edges.
 */
export type CrossfaderCurve = 'smooth' | 'linear' | 'sharp';

/**
 * State slice for the mixer panel (crossfader and channel faders).
 */
export interface MixerState {
  /**
   * Crossfader position in the range [0.0, 1.0].
   * 0.0 = full Deck A, 0.5 = equal power centre, 1.0 = full Deck B.
   */
  crossfaderPosition: number;

  /**
   * Channel fader level for Deck A (0–100).
   * This is composed with the crossfader-derived volume before calling setVolume().
   */
  channelFaderA: number;

  /**
   * Channel fader level for Deck B (0–100).
   */
  channelFaderB: number;

  /**
   * Computed output volume for Deck A after crossfader + channel fader composition (0–100).
   * This value is what is passed to playerA.setVolume().
   */
  deckAVolume: number;

  /**
   * Computed output volume for Deck B after crossfader + channel fader composition (0–100).
   */
  deckBVolume: number;

  /**
   * Active crossfader curve shape. Default: 'smooth'.
   */
  crossfaderCurve: CrossfaderCurve;
}
