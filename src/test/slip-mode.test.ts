/**
 * Unit tests for STORY-DJ-005: Loop Roll & Slip Mode.
 *
 * Tests cover:
 * - Slip mode toggle actions (setSlipMode, startSlipTracking, updateSlipPosition)
 * - Roll mode toggle and press-hold actions (setRollMode, startRoll, endRoll)
 * - Slip-aware deactivateLoop behavior
 * - State reset on loadTrack and clearTrack
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';

/** Full initial state for a deck, including all slip/roll fields. */
function makeDeckState(deckId: 'A' | 'B') {
  return {
    deckId,
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
    playbackState: 'unstarted' as const,
    pitchRate: 1 as const,
    bpm: null,
    volume: 80,
    loopActive: false,
    loopStart: null,
    loopEnd: null,
    loopBeatCount: null,
    beatJumpSize: 4,
    playerReady: false,
    hotCues: {},
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    error: null,
    pitchRateLocked: false,
    synced: false,
    slipMode: false,
    slipPosition: null,
    slipStartTime: null,
    slipStartPosition: null,
    rollMode: false,
    rollStartWallClock: null,
    rollStartPosition: null,
    autoPlayOnLoad: false,
  };
}

beforeEach(() => {
  useDeckStore.setState({
    decks: {
      A: makeDeckState('A'),
      B: makeDeckState('B'),
    },
  });
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Slip Mode — Store Actions
// ---------------------------------------------------------------------------

describe('Slip Mode - Store Actions', () => {
  it('setSlipMode(true) enables slipMode without setting start fields', () => {
    act(() => {
      useDeckStore.getState().setSlipMode('A', true);
    });

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.slipMode).toBe(true);
    expect(deck.slipStartTime).toBeNull();
    expect(deck.slipStartPosition).toBeNull();
    expect(deck.slipPosition).toBeNull();
  });

  it('setSlipMode(false) clears all slip fields', () => {
    // Manually set some slip state to confirm it is cleared.
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: {
          ...useDeckStore.getState().decks['A'],
          slipMode: true,
          slipStartTime: 1000,
          slipStartPosition: 30,
          slipPosition: 35,
        },
      },
    });

    act(() => {
      useDeckStore.getState().setSlipMode('A', false);
    });

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.slipMode).toBe(false);
    expect(deck.slipStartTime).toBeNull();
    expect(deck.slipStartPosition).toBeNull();
    expect(deck.slipPosition).toBeNull();
  });

  it('startSlipTracking sets slipStartTime and slipStartPosition from deck state', () => {
    // Enable slip mode and set a known current time.
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: {
          ...useDeckStore.getState().decks['A'],
          slipMode: true,
          currentTime: 42.5,
        },
      },
    });

    const before = Date.now();
    act(() => {
      useDeckStore.getState().startSlipTracking('A');
    });
    const after = Date.now();

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.slipStartPosition).toBe(42.5);
    expect(deck.slipPosition).toBe(42.5);
    expect(deck.slipStartTime).toBeGreaterThanOrEqual(before);
    expect(deck.slipStartTime).toBeLessThanOrEqual(after);
  });

  it('startSlipTracking is no-op when slipMode is false', () => {
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: {
          ...useDeckStore.getState().decks['A'],
          slipMode: false,
          currentTime: 10,
        },
      },
    });

    act(() => {
      useDeckStore.getState().startSlipTracking('A');
    });

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.slipStartTime).toBeNull();
    expect(deck.slipStartPosition).toBeNull();
    expect(deck.slipPosition).toBeNull();
  });

  it('updateSlipPosition computes correct position with pitchRate 1.0', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1000000);

      useDeckStore.setState({
        decks: {
          ...useDeckStore.getState().decks,
          A: {
            ...useDeckStore.getState().decks['A'],
            slipMode: true,
            currentTime: 10,
            pitchRate: 1,
            duration: 300,
          },
        },
      });

      act(() => {
        useDeckStore.getState().startSlipTracking('A');
      });

      // Advance time by 3 seconds.
      vi.setSystemTime(1003000);

      act(() => {
        useDeckStore.getState().updateSlipPosition('A');
      });

      const deck = useDeckStore.getState().decks['A'];
      // 10 + (3000ms / 1000) * 1.0 = 13
      expect(deck.slipPosition).toBeCloseTo(13, 5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('updateSlipPosition computes correct position with pitchRate 0.75', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(2000000);

      useDeckStore.setState({
        decks: {
          ...useDeckStore.getState().decks,
          A: {
            ...useDeckStore.getState().decks['A'],
            slipMode: true,
            currentTime: 20,
            pitchRate: 0.75 as const,
            duration: 300,
          },
        },
      });

      act(() => {
        useDeckStore.getState().startSlipTracking('A');
      });

      // Advance time by 4 seconds.
      vi.setSystemTime(2004000);

      act(() => {
        useDeckStore.getState().updateSlipPosition('A');
      });

      const deck = useDeckStore.getState().decks['A'];
      // 20 + (4000ms / 1000) * 0.75 = 20 + 3 = 23
      expect(deck.slipPosition).toBeCloseTo(23, 5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('updateSlipPosition clamps to [0, duration]', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(3000000);

      useDeckStore.setState({
        decks: {
          ...useDeckStore.getState().decks,
          A: {
            ...useDeckStore.getState().decks['A'],
            slipMode: true,
            currentTime: 290,
            pitchRate: 1,
            duration: 300,
          },
        },
      });

      act(() => {
        useDeckStore.getState().startSlipTracking('A');
      });

      // Advance time by 100 seconds → would push position to 390, exceeds duration 300.
      vi.setSystemTime(3100000);

      act(() => {
        useDeckStore.getState().updateSlipPosition('A');
      });

      const deck = useDeckStore.getState().decks['A'];
      expect(deck.slipPosition).toBe(300); // clamped to duration
    } finally {
      vi.useRealTimers();
    }
  });

  it('updateSlipPosition is no-op when slipStartTime is null', () => {
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: {
          ...useDeckStore.getState().decks['A'],
          slipStartTime: null,
          slipStartPosition: null,
          slipPosition: null,
        },
      },
    });

    act(() => {
      useDeckStore.getState().updateSlipPosition('A');
    });

    expect(useDeckStore.getState().decks['A'].slipPosition).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Roll Mode — Store Actions
// ---------------------------------------------------------------------------

describe('Roll Mode - Store Actions', () => {
  it('setRollMode(true) sets rollMode', () => {
    act(() => {
      useDeckStore.getState().setRollMode('A', true);
    });

    expect(useDeckStore.getState().decks['A'].rollMode).toBe(true);
  });

  it('setRollMode(false) clears rollMode and roll timestamps', () => {
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: {
          ...useDeckStore.getState().decks['A'],
          rollMode: true,
          rollStartWallClock: 9999,
          rollStartPosition: 50,
        },
      },
    });

    act(() => {
      useDeckStore.getState().setRollMode('A', false);
    });

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.rollMode).toBe(false);
    expect(deck.rollStartWallClock).toBeNull();
    expect(deck.rollStartPosition).toBeNull();
  });

  it('startRoll records wall clock and position, activates loop', () => {
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: {
          ...useDeckStore.getState().decks['A'],
          bpm: 120,
          currentTime: 10,
          duration: 300,
        },
      },
    });

    const before = Date.now();
    act(() => {
      useDeckStore.getState().startRoll('A', 4);
    });
    const after = Date.now();

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.rollStartPosition).toBe(10);
    expect(deck.rollStartWallClock).toBeGreaterThanOrEqual(before);
    expect(deck.rollStartWallClock).toBeLessThanOrEqual(after);
    expect(deck.loopActive).toBe(true);
    expect(deck.loopStart).toBe(10);
    // 4 beats at 120 BPM = 2 s
    expect(deck.loopEnd).toBeCloseTo(12, 5);
    expect(deck.loopBeatCount).toBe(4);
  });

  it('startRoll triggers startSlipTracking when slipMode is on', () => {
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: {
          ...useDeckStore.getState().decks['A'],
          bpm: 120,
          currentTime: 10,
          duration: 300,
          slipMode: true,
        },
      },
    });

    act(() => {
      useDeckStore.getState().startRoll('A', 4);
    });

    const deck = useDeckStore.getState().decks['A'];
    // startSlipTracking should have been triggered, setting slipStartPosition.
    expect(deck.slipStartPosition).toBe(10);
    expect(deck.slipStartTime).not.toBeNull();
  });

  it('startRoll is no-op when bpm is null', () => {
    // bpm is null by default from makeDeckState
    act(() => {
      useDeckStore.getState().startRoll('A', 4);
    });

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.loopActive).toBe(false);
    expect(deck.rollStartWallClock).toBeNull();
    expect(deck.rollStartPosition).toBeNull();
  });

  it('endRoll computes correct seek target from elapsed time', () => {
    const mockSeekTo = vi.fn();
    vi.spyOn(playerRegistry, 'get').mockReturnValue({
      seekTo: mockSeekTo,
    } as unknown as YT.Player);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(5000000);

      useDeckStore.setState({
        decks: {
          ...useDeckStore.getState().decks,
          A: {
            ...useDeckStore.getState().decks['A'],
            bpm: 120,
            currentTime: 10,
            pitchRate: 1,
            duration: 300,
          },
        },
      });

      act(() => {
        useDeckStore.getState().startRoll('A', 4);
      });

      // Advance 2 seconds.
      vi.setSystemTime(5002000);

      act(() => {
        useDeckStore.getState().endRoll('A');
      });

      // 10 + 2 * 1.0 = 12
      expect(mockSeekTo).toHaveBeenCalledWith(12, true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('endRoll clamps seek target to duration', () => {
    const mockSeekTo = vi.fn();
    vi.spyOn(playerRegistry, 'get').mockReturnValue({
      seekTo: mockSeekTo,
    } as unknown as YT.Player);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(6000000);

      useDeckStore.setState({
        decks: {
          ...useDeckStore.getState().decks,
          A: {
            ...useDeckStore.getState().decks['A'],
            bpm: 120,
            currentTime: 250,
            pitchRate: 1,
            duration: 300,
          },
        },
      });

      act(() => {
        useDeckStore.getState().startRoll('A', 4);
      });

      // Advance 200 seconds → 250 + 200 = 450, clamped to 300.
      vi.setSystemTime(6200000);

      act(() => {
        useDeckStore.getState().endRoll('A');
      });

      expect(mockSeekTo).toHaveBeenCalledWith(300, true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('endRoll clears roll state and deactivates loop', () => {
    const mockSeekTo = vi.fn();
    vi.spyOn(playerRegistry, 'get').mockReturnValue({
      seekTo: mockSeekTo,
    } as unknown as YT.Player);

    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: {
          ...useDeckStore.getState().decks['A'],
          bpm: 120,
          currentTime: 10,
          pitchRate: 1,
          duration: 300,
        },
      },
    });

    act(() => {
      useDeckStore.getState().startRoll('A', 4);
    });
    act(() => {
      useDeckStore.getState().endRoll('A');
    });

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.loopActive).toBe(false);
    expect(deck.loopStart).toBeNull();
    expect(deck.loopEnd).toBeNull();
    expect(deck.loopBeatCount).toBeNull();
    expect(deck.rollStartWallClock).toBeNull();
    expect(deck.rollStartPosition).toBeNull();
  });

  it('endRoll is no-op when rollStartWallClock is null', () => {
    const mockSeekTo = vi.fn();
    vi.spyOn(playerRegistry, 'get').mockReturnValue({
      seekTo: mockSeekTo,
    } as unknown as YT.Player);

    act(() => {
      useDeckStore.getState().endRoll('A');
    });

    expect(mockSeekTo).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deactivateLoop with Slip Mode
// ---------------------------------------------------------------------------

describe('deactivateLoop with Slip Mode', () => {
  it('seeks to slipPosition when slipMode is on and slipPosition is set', () => {
    const mockSeekTo = vi.fn();
    vi.spyOn(playerRegistry, 'get').mockReturnValue({
      seekTo: mockSeekTo,
    } as unknown as YT.Player);

    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: {
          ...useDeckStore.getState().decks['A'],
          slipMode: true,
          slipPosition: 55.5,
          slipStartTime: 12345,
          slipStartPosition: 50,
          loopActive: true,
          loopStart: 50,
          loopEnd: 52,
          loopBeatCount: 4,
        },
      },
    });

    act(() => {
      useDeckStore.getState().deactivateLoop('A');
    });

    expect(mockSeekTo).toHaveBeenCalledWith(55.5, true);
  });

  it('clears slip tracking fields after seeking', () => {
    const mockSeekTo = vi.fn();
    vi.spyOn(playerRegistry, 'get').mockReturnValue({
      seekTo: mockSeekTo,
    } as unknown as YT.Player);

    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: {
          ...useDeckStore.getState().decks['A'],
          slipMode: true,
          slipPosition: 55.5,
          slipStartTime: 12345,
          slipStartPosition: 50,
          loopActive: true,
          loopStart: 50,
          loopEnd: 52,
        },
      },
    });

    act(() => {
      useDeckStore.getState().deactivateLoop('A');
    });

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.slipPosition).toBeNull();
    expect(deck.slipStartTime).toBeNull();
    expect(deck.slipStartPosition).toBeNull();
    expect(deck.loopActive).toBe(false);
  });

  it('behaves normally when slipMode is off', () => {
    const mockSeekTo = vi.fn();
    vi.spyOn(playerRegistry, 'get').mockReturnValue({
      seekTo: mockSeekTo,
    } as unknown as YT.Player);

    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: {
          ...useDeckStore.getState().decks['A'],
          slipMode: false,
          loopActive: true,
          loopStart: 10,
          loopEnd: 12,
          loopBeatCount: 4,
        },
      },
    });

    act(() => {
      useDeckStore.getState().deactivateLoop('A');
    });

    // No seek should happen when slip mode is off
    expect(mockSeekTo).not.toHaveBeenCalled();

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.loopActive).toBe(false);
    expect(deck.loopStart).toBeNull();
    expect(deck.loopEnd).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// State Reset
// ---------------------------------------------------------------------------

describe('State Reset', () => {
  it('loadTrack resets all slip and roll fields', () => {
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: {
          ...useDeckStore.getState().decks['A'],
          slipMode: true,
          slipPosition: 30,
          slipStartTime: 9999,
          slipStartPosition: 20,
          rollMode: true,
          rollStartWallClock: 8888,
          rollStartPosition: 25,
        },
      },
    });

    act(() => {
      useDeckStore.getState().loadTrack('A', 'test-video-id', {
        sourceType: 'youtube',
        title: 'Test',
        artist: 'Channel',
        duration: 200,
        thumbnailUrl: null,
      });
    });

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.slipMode).toBe(false);
    expect(deck.slipPosition).toBeNull();
    expect(deck.slipStartTime).toBeNull();
    expect(deck.slipStartPosition).toBeNull();
    expect(deck.rollMode).toBe(false);
    expect(deck.rollStartWallClock).toBeNull();
    expect(deck.rollStartPosition).toBeNull();
  });

  it('clearTrack resets all slip and roll fields', () => {
    useDeckStore.setState({
      decks: {
        ...useDeckStore.getState().decks,
        A: {
          ...useDeckStore.getState().decks['A'],
          slipMode: true,
          slipPosition: 30,
          slipStartTime: 9999,
          slipStartPosition: 20,
          rollMode: true,
          rollStartWallClock: 8888,
          rollStartPosition: 25,
        },
      },
    });

    act(() => {
      useDeckStore.getState().clearTrack('A');
    });

    const deck = useDeckStore.getState().decks['A'];
    expect(deck.slipMode).toBe(false);
    expect(deck.slipPosition).toBeNull();
    expect(deck.slipStartTime).toBeNull();
    expect(deck.slipStartPosition).toBeNull();
    expect(deck.rollMode).toBe(false);
    expect(deck.rollStartWallClock).toBeNull();
    expect(deck.rollStartPosition).toBeNull();
  });
});
