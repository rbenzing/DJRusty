/**
 * beatmatch.ts — Pure tempo/phase readout for the beatmatch guide.
 * No React/DOM/store imports.
 */
import { type BeatGrid, phase } from './beatGrid';

export interface DeckBeatState {
  bpm: number | null;
  pitchRate: number;
  anchor: number | null;
  currentTime: number;
}

export interface BeatmatchReadout {
  /** True only when both decks have a bpm and an anchor. */
  hasGrids: boolean;
  /** Effective-tempo difference (B minus A), in BPM. */
  tempoDeltaBpm: number;
  /** Downbeat phase offset in beats, wrapped to [-0.5, 0.5). */
  phaseOffset: number;
}

/** Compute tempo + phase alignment between two decks. */
export function beatmatchReadout(a: DeckBeatState, b: DeckBeatState): BeatmatchReadout {
  if (!a.bpm || !b.bpm || a.anchor === null || b.anchor === null) {
    return { hasGrids: false, tempoDeltaBpm: 0, phaseOffset: 0 };
  }
  const aEff = a.bpm * a.pitchRate;
  const bEff = b.bpm * b.pitchRate;
  // Phase is a within-beat position in TRACK-TIME coordinates (currentTime/anchor),
  // so it must use the native bpm — pitchRate only changes how fast track-time
  // advances in real time, not the beat spacing within track-time.
  const aGrid: BeatGrid = { bpm: a.bpm, anchor: a.anchor };
  const bGrid: BeatGrid = { bpm: b.bpm, anchor: b.anchor };
  const raw = phase(bGrid, b.currentTime) - phase(aGrid, a.currentTime);
  const phaseOffset = ((raw + 0.5) % 1 + 1) % 1 - 0.5; // wrap to [-0.5, 0.5)
  return { hasGrids: true, tempoDeltaBpm: bEff - aEff, phaseOffset };
}
