import { describe, it, expect } from 'vitest';
import { beatmatchReadout, type DeckBeatState } from '../utils/beatmatch';

const base: DeckBeatState = { bpm: 120, pitchRate: 1, anchor: 0, currentTime: 0 };

describe('beatmatchReadout', () => {
  it('reports hasGrids=false when a deck lacks a grid', () => {
    const r = beatmatchReadout({ ...base, bpm: null }, base);
    expect(r.hasGrids).toBe(false);
  });

  it('matched decks have zero tempo delta and zero phase offset', () => {
    const r = beatmatchReadout(base, base);
    expect(r.hasGrids).toBe(true);
    expect(r.tempoDeltaBpm).toBeCloseTo(0, 6);
    expect(r.phaseOffset).toBeCloseTo(0, 6);
  });

  it('tempo delta uses effective bpm (bpm * pitchRate)', () => {
    const r = beatmatchReadout(base, { ...base, pitchRate: 1.05 });
    expect(r.tempoDeltaBpm).toBeCloseTo(6, 6); // 126 - 120
  });

  it('phase offset reflects downbeat drift', () => {
    // B is 0.125 s ahead at 120 bpm (0.5 s/beat) → quarter-beat = 0.25
    const r = beatmatchReadout(base, { ...base, currentTime: 0.125 });
    expect(r.phaseOffset).toBeCloseTo(0.25, 6);
  });

  it('phase math uses native bpm, not pitch-adjusted bpm, when a deck is pitched', () => {
    // Deck A: bpm=120, pitchRate=1.1, anchor=0, currentTime=0.5 — exactly on the
    // NATIVE downbeat (native spb = 0.5s), so phase should be 0 there.
    // Deck B: bpm=120, pitchRate=1, anchor=0, currentTime=0 — also on a downbeat.
    // The two decks are therefore aligned; the buggy pitch-adjusted-bpm phase grid
    // would report ~0.1 instead of ~0.
    const aPitched: DeckBeatState = { bpm: 120, pitchRate: 1.1, anchor: 0, currentTime: 0.5 };
    const bUnpitched: DeckBeatState = { bpm: 120, pitchRate: 1, anchor: 0, currentTime: 0 };
    const r = beatmatchReadout(aPitched, bUnpitched);
    expect(r.hasGrids).toBe(true);
    expect(r.phaseOffset).toBeCloseTo(0, 6);
  });
});
