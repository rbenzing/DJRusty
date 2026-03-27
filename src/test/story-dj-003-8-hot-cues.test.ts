/**
 * story-dj-003-8-hot-cues.test.ts — STORY-DJ-003: 8 Hot Cues Per Deck.
 *
 * Validates:
 *   1. HOT_CUE_COLORS array has exactly 8 entries.
 *   2. HOT_CUE_COUNT constant equals 8 (validated indirectly — HOT_CUE_COLORS.length
 *      must equal 8, and HOT_CUE_COUNT === HOT_CUE_COLORS.length by design).
 *   3. All 8 colour values are correct.
 *   4. Hot cue indexes 4–7 work in deckStore (set, read, clear).
 *   5. Hot cue indexes 4–7 work in localStorage utilities (set, get, clear).
 *   6. Backward compatibility: existing cues at indexes 0–3 unaffected.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { HOT_CUE_COLORS } from '../components/Deck/HotCueButton';
import { useDeckStore } from '../store/deckStore';
import { getHotCues, setHotCue, clearHotCue } from '../utils/hotCues';

// ---------------------------------------------------------------------------
// Helpers / setup
// ---------------------------------------------------------------------------

function resetDeckStore() {
  useDeckStore.setState({
    decks: {
      A: {
        deckId: 'A',
        trackId: null,
        sourceType: null,
        title: '',
        artist: '',
        waveformPeaks: null,
        decoding: false,
        bpmDetecting: false,
        duration: 0,
        currentTime: 0,
        thumbnailUrl: null,
        playbackState: 'unstarted',
        pitchRate: 1,
        bpm: null,
        volume: 80,
        loopActive: false,
        loopStart: null,
        loopEnd: null,
        loopBeatCount: null,
        beatJumpSize: 4,
        synced: false,
        slipMode: false,
        slipPosition: null,
        slipStartTime: null,
        slipStartPosition: null,
        rollMode: false,
        rollStartWallClock: null,
        rollStartPosition: null,
        autoPlayOnLoad: false,
        playerReady: false,
        hotCues: {},
        eqLow: 0,
        eqMid: 0,
        eqHigh: 0,
        error: null,
        pitchRateLocked: false,
      },
      B: {
        deckId: 'B',
        trackId: null,
        sourceType: null,
        title: '',
        artist: '',
        waveformPeaks: null,
        decoding: false,
        bpmDetecting: false,
        duration: 0,
        currentTime: 0,
        thumbnailUrl: null,
        playbackState: 'unstarted',
        pitchRate: 1,
        bpm: null,
        volume: 80,
        loopActive: false,
        loopStart: null,
        loopEnd: null,
        loopBeatCount: null,
        beatJumpSize: 4,
        synced: false,
        slipMode: false,
        slipPosition: null,
        slipStartTime: null,
        slipStartPosition: null,
        rollMode: false,
        rollStartWallClock: null,
        rollStartPosition: null,
        autoPlayOnLoad: false,
        playerReady: false,
        hotCues: {},
        eqLow: 0,
        eqMid: 0,
        eqHigh: 0,
        error: null,
        pitchRateLocked: false,
      },
    },
  });
}

beforeEach(() => {
  localStorage.clear();
  resetDeckStore();
});

// ---------------------------------------------------------------------------
// 1. HOT_CUE_COLORS has exactly 8 entries
// ---------------------------------------------------------------------------

describe('STORY-DJ-003: HOT_CUE_COLORS array', () => {
  it('HOT_CUE_COLORS has exactly 8 entries', () => {
    expect(HOT_CUE_COLORS.length).toBe(8);
  });

  it('Original 4 colours are unchanged (indexes 0–3)', () => {
    expect(HOT_CUE_COLORS[0]).toBe('#ff4444'); // red
    expect(HOT_CUE_COLORS[1]).toBe('#ff9900'); // orange
    expect(HOT_CUE_COLORS[2]).toBe('#44ff44'); // green
    expect(HOT_CUE_COLORS[3]).toBe('#4488ff'); // blue
  });

  it('New 4 colours are correct (indexes 4–7)', () => {
    expect(HOT_CUE_COLORS[4]).toBe('#cc44ff'); // purple
    expect(HOT_CUE_COLORS[5]).toBe('#ff44aa'); // pink
    expect(HOT_CUE_COLORS[6]).toBe('#ffcc00'); // gold
    expect(HOT_CUE_COLORS[7]).toBe('#cccccc'); // white
  });
});

// ---------------------------------------------------------------------------
// 4. deckStore: setHotCue and clearHotCue work for indexes 4–7
// ---------------------------------------------------------------------------

describe('STORY-DJ-003: deckStore.setHotCue works for indexes 4–7', () => {
  it('can set and read cues at indexes 4, 5, 6, and 7 on deck A', () => {
    act(() => {
      useDeckStore.getState().setHotCue('A', 4, 44.4);
      useDeckStore.getState().setHotCue('A', 5, 55.5);
      useDeckStore.getState().setHotCue('A', 6, 66.6);
      useDeckStore.getState().setHotCue('A', 7, 77.7);
    });

    const { hotCues } = useDeckStore.getState().decks['A'];
    expect(hotCues[4]).toBe(44.4);
    expect(hotCues[5]).toBe(55.5);
    expect(hotCues[6]).toBe(66.6);
    expect(hotCues[7]).toBe(77.7);
  });

  it('deckStore.clearHotCue works for indexes 4–7 and leaves adjacent cues intact', () => {
    act(() => {
      useDeckStore.getState().setHotCue('A', 4, 40.0);
      useDeckStore.getState().setHotCue('A', 5, 50.0);
    });
    act(() => {
      useDeckStore.getState().clearHotCue('A', 5);
    });

    const { hotCues } = useDeckStore.getState().decks['A'];
    expect(hotCues[5]).toBeUndefined();
    expect(hotCues[4]).toBe(40.0); // index 4 untouched
  });
});

// ---------------------------------------------------------------------------
// 5–6. localStorage utilities work for indexes 4–7
// ---------------------------------------------------------------------------

describe('STORY-DJ-003: localStorage setHotCue/getHotCues works for indexes 4–7', () => {
  it('setHotCue at index 6 persists; getHotCues reads back the correct value', () => {
    setHotCue('vid001', 6, 120.5);

    const cues = getHotCues('vid001');
    expect(cues[6]).toBe(120.5);
  });

  it('clearHotCue removes index 7; index 0 remains untouched', () => {
    setHotCue('vid002', 0, 10.0);
    setHotCue('vid002', 7, 70.0);

    clearHotCue('vid002', 7);

    const cues = getHotCues('vid002');
    expect(cues[7]).toBeUndefined();
    expect(cues[0]).toBe(10.0);
  });
});

// ---------------------------------------------------------------------------
// 7–8. Backward compatibility: existing 0–3 cues unaffected by 4–7 operations
// ---------------------------------------------------------------------------

describe('STORY-DJ-003: backward compatibility — existing 0–3 cues unaffected by 4–7 operations', () => {
  it('setting and clearing cues 4–7 does not affect cues 0–3 in localStorage', () => {
    setHotCue('vidBC', 0, 1.0);
    setHotCue('vidBC', 1, 2.0);
    setHotCue('vidBC', 2, 3.0);
    setHotCue('vidBC', 3, 4.0);
    setHotCue('vidBC', 4, 5.0);
    setHotCue('vidBC', 5, 6.0);
    setHotCue('vidBC', 6, 7.0);
    setHotCue('vidBC', 7, 8.0);

    // Clear one of the new cues.
    clearHotCue('vidBC', 5);

    const cues = getHotCues('vidBC');
    // Original cues intact.
    expect(cues[0]).toBe(1.0);
    expect(cues[1]).toBe(2.0);
    expect(cues[2]).toBe(3.0);
    expect(cues[3]).toBe(4.0);
    // Cleared cue gone.
    expect(cues[5]).toBeUndefined();
    // Other new cues intact.
    expect(cues[4]).toBe(5.0);
    expect(cues[6]).toBe(7.0);
    expect(cues[7]).toBe(8.0);
  });
});
