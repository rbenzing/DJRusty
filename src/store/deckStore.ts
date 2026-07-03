import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { DeckState, PlaybackState } from '../types/deck';
import { DEFAULT_PITCH_RATE } from '../constants/pitchRates';
import { exactSyncRate, phaseDelta } from '../utils/beatSync';
import { getHotCues } from '../utils/hotCues';
import { BEAT_JUMP_SIZES, DEFAULT_BEAT_JUMP_SIZE, gridJumpTarget } from '../utils/beatJump';
import { getActivePlayer } from '../services/playerRegistry';
import { snapLoopIn, loopOutFor } from '../utils/loopMath';
import { snapToGrid } from '../utils/quantize';
import { DEFAULT_SLICE_WINDOW_BEATS, sliceStartFor } from '../utils/slicer';
import { transition, type TransportEvent } from '../utils/transport';
import { consumePendingGrid, consumePendingLoop } from '../services/sessionStore';

/**
 * Initial state for a single deck.
 */
function createInitialDeckState(deckId: 'A' | 'B'): DeckState {
  return {
    deckId,
    trackId: null,
    title: '',
    artist: '',
    waveformPeaks: null,
    waveformColoredPeaks: null,
    decoding: false,
    bpmDetecting: false,
    duration: 0,
    currentTime: 0,
    thumbnailUrl: null,
    playbackState: 'unstarted',
    pitchRate: DEFAULT_PITCH_RATE,
    bpm: null,
    volume: 80,
    loopActive: false,
    loopStart: null,
    loopEnd: null,
    loopBeatCount: null,
    manualLoopIn: null,
    lastManualLoop: null,
    beatJumpSize: DEFAULT_BEAT_JUMP_SIZE,
    playerReady: false,
    hotCues: {},
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    gainDb: 0,
    quantize: true,
    shift: false,
    padMode: 'hotcue',
    sliceWindowBeats: DEFAULT_SLICE_WINDOW_BEATS,
    eqKillLow: false,
    eqKillMid: false,
    eqKillHigh: false,
    filterSweep: 0,
    effectType: 'none',
    effectEnabled: false,
    effectWetDry: 0.5,
    effectBeat: 0.5,
    error: null,
    synced: false,
    slipMode: false,
    slipPosition: null,
    slipStartTime: null,
    slipStartPosition: null,
    rollMode: false,
    rollStartWallClock: null,
    rollStartPosition: null,
    autoPlayOnLoad: false,
    anchor: null,
    gridConfirmed: false,
    cuePoint: null,
    transportState: 'CUED',
  };
}

/** Live playhead for a deck, snapped to the grid when quantize is on. */
function quantizedNow(deck: DeckState): number {
  const raw = getActivePlayer(deck.deckId)?.getCurrentTime();
  const pos = raw !== undefined && Number.isFinite(raw) ? raw : deck.currentTime;
  if (deck.quantize && deck.bpm && deck.anchor !== null) {
    return snapToGrid({ bpm: deck.bpm, anchor: deck.anchor }, pos);
  }
  return pos;
}

/**
 * Actions available on the deck store.
 */
interface DeckStoreActions {
  /** Load a track into the specified deck. */
  loadTrack: (
    deckId: 'A' | 'B',
    /** Track identifier — the PlaylistEntry.id. */
    trackId: string,
    metadata: {
      title: string;
      artist: string;
      duration: number;
      thumbnailUrl: string | null;
    },
    /** When true, the player will auto-play immediately after load. */
    autoPlay?: boolean,
  ) => void;

  /** Set the decoding flag while an MP3 AudioBuffer is being decoded (mp3-002). */
  setDecoding: (deckId: 'A' | 'B', decoding: boolean) => void;

  /** Set the BPM-detecting flag while BPM analysis is running in a background worker (mp3-010). */
  setBpmDetecting: (deckId: 'A' | 'B', detecting: boolean) => void;

  /** Set the waveform peak data after waveform analysis completes (mp3-008). */
  setWaveformPeaks: (deckId: 'A' | 'B', peaks: Float32Array | null) => void;

  /** Set the frequency-colored peak data for the center waveform display. */
  setWaveformColoredPeaks: (deckId: 'A' | 'B', peaks: import('../utils/extractColoredPeaks').ColoredPeak[] | null) => void;

  /** Toggle an EQ band kill switch (instantly silences that band). */
  setEqKill: (deckId: 'A' | 'B', band: 'low' | 'mid' | 'high', kill: boolean) => void;

  /** Set the filter sweep position: -1 = full HPF, 0 = flat, 1 = full LPF. */
  setFilterSweep: (deckId: 'A' | 'B', position: number) => void;

  /** Set the active effect type for the deck. */
  setEffectType: (deckId: 'A' | 'B', type: 'none' | 'echo' | 'reverb') => void;

  /** Toggle effects on/off. */
  setEffectEnabled: (deckId: 'A' | 'B', enabled: boolean) => void;

  /** Set the wet/dry mix for the effect (0 = dry, 1 = wet). */
  setEffectWetDry: (deckId: 'A' | 'B', wetDry: number) => void;

  /** Set the FX BEAT/TIME knob position (0..1). */
  setEffectBeat: (deckId: 'A' | 'B', v: number) => void;

  /** Clear the autoPlayOnLoad flag after the player has issued the load command. */
  clearAutoPlayOnLoad: (deckId: 'A' | 'B') => void;

  /** Set the player ready flag for the specified deck. */
  setPlayerReady: (deckId: 'A' | 'B', ready: boolean) => void;

  /** Update the playback state for the specified deck. */
  setPlaybackState: (deckId: 'A' | 'B', state: PlaybackState) => void;

  /** Update the current playback time (polled from IFrame API). */
  setCurrentTime: (deckId: 'A' | 'B', time: number) => void;

  /** Set the pitch rate for the specified deck. Accepts any positive number (MP3 supports continuous rates). */
  setPitchRate: (deckId: 'A' | 'B', rate: number) => void;

  /** Set the BPM for the specified deck (from tap-tempo). */
  setBpm: (deckId: 'A' | 'B', bpm: number | null) => void;

  /** Set the volume for the specified deck (0–100). */
  setVolume: (deckId: 'A' | 'B', volume: number) => void;

  /** Activate a loop for the specified deck. */
  activateLoop: (deckId: 'A' | 'B', loopStart: number, loopEnd: number) => void;

  /**
   * Activate a beat-synced loop for the specified deck.
   * Calculates loopEnd from currentTime + (beatCount / bpm) * 60.
   * No-op if bpm is not set.
   */
  activateLoopBeat: (deckId: 'A' | 'B', beatCount: 1 | 2 | 4 | 8) => void;

  /** Deactivate the active loop for the specified deck. */
  deactivateLoop: (deckId: 'A' | 'B') => void;

  /** Set the manual loop in-point at the (quantized) playhead. */
  setLoopIn: (deckId: 'A' | 'B') => void;

  /** Set the manual loop out-point and arm the loop. No-op without a valid in-point. */
  setLoopOut: (deckId: 'A' | 'B') => void;

  /** Re-arm the last manual loop (toggles it on/off). No-op if none was set. */
  reloop: (deckId: 'A' | 'B') => void;

  /** Set a hot cue timestamp for the specified deck and cue index. */
  setHotCue: (deckId: 'A' | 'B', index: number, timestamp: number) => void;

  /** Clear a hot cue for the specified deck and cue index. */
  clearHotCue: (deckId: 'A' | 'B', index: number) => void;

  /** Load hot cues from localStorage into the specified deck's state. */
  loadHotCues: (deckId: 'A' | 'B', hotCues: Record<number, number>) => void;

  /** Set EQ values for the specified deck. */
  setEq: (deckId: 'A' | 'B', band: 'eqLow' | 'eqMid' | 'eqHigh', value: number) => void;

  /** Set the channel input trim (GAIN) in dB, clamped to [-24, 12]. */
  setGain: (deckId: 'A' | 'B', gainDb: number) => void;

  /** Toggle QUANTIZE for the specified deck. */
  setQuantize: (deckId: 'A' | 'B', on: boolean) => void;

  /** Toggle the SHIFT modifier for the specified deck. */
  setShift: (deckId: 'A' | 'B', on: boolean) => void;

  /** Set the active performance-pad mode for the specified deck. */
  setPadMode: (deckId: 'A' | 'B', mode: 'hotcue' | 'loop' | 'slicer' | 'sampler') => void;

  /** Set the Slicer window size (4/8/16/32 beats) for the specified deck. */
  setSliceWindowBeats: (deckId: 'A' | 'B', size: 4 | 8 | 16 | 32) => void;

  /** Set the track duration (seconds) — used by useAudioEngine after buffer decode. */
  setDuration: (deckId: 'A' | 'B', duration: number) => void;

  /** Set an error state for the specified deck. */
  setError: (deckId: 'A' | 'B', error: string | null) => void;

  /** Set the selected beat jump size for the specified deck. */
  setBeatJumpSize: (deckId: 'A' | 'B', size: number) => void;

  /** Clear the current track from the specified deck. */
  clearTrack: (deckId: 'A' | 'B') => void;

  /** Set the synced state for the specified deck. */
  setSynced: (deckId: 'A' | 'B', synced: boolean) => void;

  /** Enable or disable slip mode for the specified deck. */
  setSlipMode: (deckId: 'A' | 'B', enabled: boolean) => void;

  /** Start slip tracking from current playback position. No-op if slipMode is false. */
  startSlipTracking: (deckId: 'A' | 'B') => void;

  /** Update the shadow slip position based on wall-clock elapsed time. No-op if slipStartTime is null. */
  updateSlipPosition: (deckId: 'A' | 'B') => void;

  /** Enable or disable loop roll mode for the specified deck. */
  setRollMode: (deckId: 'A' | 'B', enabled: boolean) => void;

  /** Begin a loop roll: record start time/position and activate a beat loop. */
  startRoll: (deckId: 'A' | 'B', beatCount: 1 | 2 | 4 | 8) => void;

  /** End a loop roll: seek to the computed target position and deactivate the loop. */
  endRoll: (deckId: 'A' | 'B') => void;

  /**
   * Begin a Slicer hold: arm a loop over the pressed slice (computed from the
   * beat grid, deck.sliceWindowBeats, and the live playhead), record the
   * catch-up fields (rollStartWallClock/rollStartPosition) so releasing via
   * the pre-existing endRoll seeks back to where playback would have been.
   * No-op without a confirmed grid.
   */
  startSlice: (deckId: 'A' | 'B', sliceIndex: number) => void;

  /** Set the beat grid: bpm, anchor position, and mark grid as confirmed. */
  setGrid: (deckId: 'A' | 'B', bpm: number, anchor: number) => void;

  /** Shift the beat-grid anchor by deltaSeconds. No-op if anchor is null. */
  nudgeGrid: (deckId: 'A' | 'B', deltaSeconds: number) => void;

  /** Set the hardware CUE point for the specified deck. */
  setCuePoint: (deckId: 'A' | 'B', time: number) => void;

  /**
   * Dispatch a CDJ transport event through the transport state machine.
   * Applies all resulting intents (play/pause/seek/setCue) to the deck and player,
   * then sets transportState to the machine's nextState (wins over any interim state
   * set by intent side-effects).
   */
  dispatchTransport: (deckId: 'A' | 'B', event: TransportEvent) => void;

  /**
   * Hardware-accurate SYNC: sets this deck's pitch to the exact continuous ratio
   * needed to match the other deck's effective tempo, then performs a one-shot
   * downbeat phase alignment seek. No-op if either deck lacks a beat grid.
   * MP3 only — the exact rate is stored in pitchRate (a continuous number).
   */
  syncToDeck: (deckId: 'A' | 'B', otherId: 'A' | 'B') => void;

  /**
   * Grid-snapped beat jump: snap the playhead to the nearest beat, move N beats
   * in the given direction, then seek the active player. No-op if bpm or anchor
   * is not set (grid not confirmed).
   */
  beatJump: (deckId: 'A' | 'B', dir: 1 | -1) => void;
}

interface DeckStoreState {
  decks: Record<'A' | 'B', DeckState>;
}

type DeckStore = DeckStoreState & DeckStoreActions;

type ZustandSet = (
  partial: DeckStore | Partial<DeckStore> | ((state: DeckStore) => DeckStore | Partial<DeckStore>),
) => void;

/**
 * Helper to update a specific deck within the store.
 */
function updateDeck(
  set: ZustandSet,
  deckId: 'A' | 'B',
  updates: Partial<DeckState>,
): void {
  set((state) => ({
    decks: {
      ...state.decks,
      [deckId]: { ...state.decks[deckId], ...updates },
    },
  }));
}

export const useDeckStore = create<DeckStore>((set, get) => ({
  decks: {
    A: createInitialDeckState('A'),
    B: createInitialDeckState('B'),
  },

  loadTrack: (deckId, trackId, { title, artist, duration, thumbnailUrl }, autoPlay = false) => {
    updateDeck(set, deckId, {
      trackId,
      title,
      artist,
      duration,
      thumbnailUrl,
      currentTime: 0,
      playbackState: 'unstarted',
      playerReady: false,
      loopActive: false,
      loopStart: null,
      loopEnd: null,
      loopBeatCount: null,
      manualLoopIn: null,
      lastManualLoop: null,
      bpm: null,
      // Hot cues are keyed by trackId, persisted in localStorage.
      hotCues: getHotCues(trackId),
      error: null,
      waveformPeaks: null,
      waveformColoredPeaks: null,
      decoding: false,
      bpmDetecting: false,
      synced: false,
      slipMode: false,
      slipPosition: null,
      slipStartTime: null,
      slipStartPosition: null,
      rollMode: false,
      rollStartWallClock: null,
      rollStartPosition: null,
      autoPlayOnLoad: autoPlay,
      anchor: null,
      gridConfirmed: false,
      cuePoint: null,
      transportState: 'CUED',
    });
    // Restore grid/loop from a previously loaded session (if any)
    const pendingGrid = consumePendingGrid(trackId);
    if (pendingGrid?.bpm != null) {
      get().setGrid(deckId, pendingGrid.bpm, pendingGrid.anchor ?? 0);
    }
    const pendingLoop = consumePendingLoop(trackId);
    if (pendingLoop?.loopStart != null) {
      const beatCount = pendingLoop.loopBeatCount;
      const validBeatCount = (beatCount === 1 || beatCount === 2 || beatCount === 4 || beatCount === 8)
        ? beatCount
        : null;
      updateDeck(set, deckId, {
        loopStart: pendingLoop.loopStart,
        loopEnd: pendingLoop.loopEnd,
        loopBeatCount: validBeatCount,
      });
    }
  },

  setDecoding: (deckId, decoding) => {
    updateDeck(set, deckId, { decoding });
  },

  setBpmDetecting: (deckId, detecting) => {
    updateDeck(set, deckId, { bpmDetecting: detecting });
  },

  setWaveformPeaks: (deckId, peaks) => {
    updateDeck(set, deckId, { waveformPeaks: peaks });
  },

  setWaveformColoredPeaks: (deckId, peaks) => {
    updateDeck(set, deckId, { waveformColoredPeaks: peaks });
  },

  setEqKill: (deckId, band, kill) => {
    const key = band === 'low' ? 'eqKillLow' : band === 'mid' ? 'eqKillMid' : 'eqKillHigh';
    updateDeck(set, deckId, { [key]: kill });
  },

  setFilterSweep: (deckId, position) => {
    updateDeck(set, deckId, { filterSweep: Math.max(-1, Math.min(1, position)) });
  },

  setEffectType: (deckId, type) => {
    updateDeck(set, deckId, { effectType: type });
  },

  setEffectEnabled: (deckId, enabled) => {
    updateDeck(set, deckId, { effectEnabled: enabled });
  },

  setEffectWetDry: (deckId, wetDry) => {
    updateDeck(set, deckId, { effectWetDry: Math.max(0, Math.min(1, wetDry)) });
  },

  setEffectBeat: (deckId, v) => {
    updateDeck(set, deckId, { effectBeat: Math.max(0, Math.min(1, v)) });
  },

  clearAutoPlayOnLoad: (deckId) => {
    updateDeck(set, deckId, { autoPlayOnLoad: false });
  },

  setPlayerReady: (deckId, ready) => {
    updateDeck(set, deckId, { playerReady: ready });
  },

  setPlaybackState: (deckId, state) => {
    // Keep transportState in sync for externally-driven play/pause events
    // (autoplay, track-end, YouTube state changes). Only map the two unambiguous
    // cases; other playbackStates (unstarted/ended/buffering) leave transportState
    // alone so the machine's last resolved state (e.g. CUED, PREVIEW) is preserved.
    const transportUpdates: Partial<import('../types/deck').DeckState> =
      state === 'playing' ? { transportState: 'PLAYING' }
      : state === 'paused' ? { transportState: 'PAUSED' }
      : {};
    updateDeck(set, deckId, { playbackState: state, ...transportUpdates });
  },

  setCurrentTime: (deckId, time) => {
    updateDeck(set, deckId, { currentTime: time });
  },

  setPitchRate: (deckId, rate) => {
    updateDeck(set, deckId, { pitchRate: rate });
  },

  setBpm: (deckId, bpm) => {
    updateDeck(set, deckId, { bpm });
    // When this deck's BPM changes, the other deck's sync is no longer valid
    // because it was synced to the old BPM value.
    const otherDeckId = deckId === 'A' ? 'B' : 'A';
    const otherDeck = get().decks[otherDeckId];
    if (otherDeck.synced) {
      updateDeck(set, otherDeckId, { synced: false });
    }
  },

  setVolume: (deckId, volume) => {
    updateDeck(set, deckId, { volume });
  },

  activateLoop: (deckId, loopStart, loopEnd) => {
    updateDeck(set, deckId, { loopActive: true, loopStart, loopEnd });
  },

  activateLoopBeat: (deckId, beatCount) => {
    const deck = get().decks[deckId];
    if (!deck.bpm || deck.anchor === null) return; // needs a confirmed grid (bpm + anchor)
    const grid = { bpm: deck.bpm, anchor: deck.anchor };
    const loopStart = snapLoopIn(grid, deck.currentTime);
    const rawEnd = loopOutFor(loopStart, beatCount, deck.bpm);
    // Clamp loopEnd to the track duration so the 250ms poll can always trigger.
    // When duration is unknown (0), no clamping — the track may still be loading.
    const loopEnd = deck.duration > 0 ? Math.min(rawEnd, deck.duration) : rawEnd;
    getActivePlayer(deckId)?.setLoop?.(loopStart, loopEnd);
    updateDeck(set, deckId, { loopActive: true, loopStart, loopEnd, loopBeatCount: beatCount, manualLoopIn: null });
  },

  deactivateLoop: (deckId) => {
    const deck = get().decks[deckId];
    // Slip-aware exit: if slip mode is on and a shadow position is tracked,
    // seek to the shadow position before deactivating the loop.
    if (deck.slipMode && deck.slipPosition !== null) {
      getActivePlayer(deckId)?.seekTo(deck.slipPosition, true);
    }
    // Clear the native engine loop (no-op via optional chaining on YouTube).
    getActivePlayer(deckId)?.clearLoop?.();
    updateDeck(set, deckId, {
      loopActive: false,
      loopStart: null,
      loopEnd: null,
      loopBeatCount: null,
      slipPosition: null,
      slipStartTime: null,
      slipStartPosition: null,
    });
  },

  setLoopIn: (deckId) => {
    const deck = get().decks[deckId];
    updateDeck(set, deckId, { manualLoopIn: quantizedNow(deck) });
  },

  setLoopOut: (deckId) => {
    const deck = get().decks[deckId];
    if (deck.manualLoopIn === null) return;
    const end = quantizedNow(deck);
    if (end <= deck.manualLoopIn) return;
    getActivePlayer(deckId)?.setLoop?.(deck.manualLoopIn, end);
    updateDeck(set, deckId, {
      loopActive: true,
      loopStart: deck.manualLoopIn,
      loopEnd: end,
      loopBeatCount: null,
      manualLoopIn: null,
      lastManualLoop: { start: deck.manualLoopIn, end },
    });
  },

  reloop: (deckId) => {
    const deck = get().decks[deckId];
    const lm = deck.lastManualLoop;
    if (!lm) return;
    if (deck.loopActive) {
      get().deactivateLoop(deckId);
      return;
    }
    getActivePlayer(deckId)?.setLoop?.(lm.start, lm.end);
    getActivePlayer(deckId)?.seekTo(lm.start, true);
    updateDeck(set, deckId, {
      loopActive: true,
      loopStart: lm.start,
      loopEnd: lm.end,
      loopBeatCount: null,
    });
  },

  setHotCue: (deckId, index, timestamp) => {
    const deck = get().decks[deckId];
    updateDeck(set, deckId, {
      hotCues: { ...deck.hotCues, [index]: timestamp },
    });
  },

  clearHotCue: (deckId, index) => {
    const deck = get().decks[deckId];
    const hotCues = { ...deck.hotCues };
    delete hotCues[index];
    updateDeck(set, deckId, { hotCues });
  },

  loadHotCues: (deckId, hotCues) => {
    updateDeck(set, deckId, { hotCues });
  },

  setEq: (deckId, band, value) => {
    updateDeck(set, deckId, { [band]: value });
  },

  setGain: (deckId, gainDb) => {
    updateDeck(set, deckId, { gainDb: Math.max(-24, Math.min(12, gainDb)) });
  },

  setQuantize: (deckId, on) => {
    updateDeck(set, deckId, { quantize: on });
  },

  setShift: (deckId, on) => {
    updateDeck(set, deckId, { shift: on });
  },

  setPadMode: (deckId, mode) => {
    updateDeck(set, deckId, { padMode: mode });
  },

  setSliceWindowBeats: (deckId, size) => {
    updateDeck(set, deckId, { sliceWindowBeats: size });
  },

  setDuration: (deckId, duration) => {
    updateDeck(set, deckId, { duration });
  },

  setError: (deckId, error) => {
    updateDeck(set, deckId, { error });
  },

  setBeatJumpSize: (deckId, size) => {
    updateDeck(set, deckId, { beatJumpSize: size });
  },

  clearTrack: (deckId) => {
    updateDeck(set, deckId, {
      trackId: null,
      title: '',
      artist: '',
      waveformPeaks: null,
      waveformColoredPeaks: null,
      decoding: false,
      bpmDetecting: false,
      duration: 0,
      currentTime: 0,
      thumbnailUrl: null,
      playbackState: 'unstarted',
      playerReady: false,
      loopActive: false,
      loopStart: null,
      loopEnd: null,
      loopBeatCount: null,
      manualLoopIn: null,
      lastManualLoop: null,
      bpm: null,
      beatJumpSize: DEFAULT_BEAT_JUMP_SIZE,
      sliceWindowBeats: DEFAULT_SLICE_WINDOW_BEATS,
      hotCues: {},
      error: null,
      synced: false,
      slipMode: false,
      slipPosition: null,
      slipStartTime: null,
      slipStartPosition: null,
      rollMode: false,
      rollStartWallClock: null,
      rollStartPosition: null,
      autoPlayOnLoad: false,
      anchor: null,
      gridConfirmed: false,
      cuePoint: null,
      transportState: 'CUED',
    });
  },

  setSynced: (deckId, synced) => {
    updateDeck(set, deckId, { synced });
  },

  setSlipMode: (deckId, enabled) => {
    if (enabled) {
      updateDeck(set, deckId, { slipMode: true });
    } else {
      updateDeck(set, deckId, {
        slipMode: false,
        slipPosition: null,
        slipStartTime: null,
        slipStartPosition: null,
      });
    }
  },

  startSlipTracking: (deckId) => {
    const deck = get().decks[deckId];
    if (!deck.slipMode) return;
    updateDeck(set, deckId, {
      slipStartTime: Date.now(),
      slipStartPosition: deck.currentTime,
      slipPosition: deck.currentTime,
    });
  },

  updateSlipPosition: (deckId) => {
    const deck = get().decks[deckId];
    if (deck.slipStartTime === null || deck.slipStartPosition === null) return;
    const elapsed = (Date.now() - deck.slipStartTime) / 1000;
    let newSlipPos = deck.slipStartPosition + elapsed * deck.pitchRate;
    if (deck.duration > 0) {
      newSlipPos = Math.max(0, Math.min(newSlipPos, deck.duration));
    } else {
      newSlipPos = Math.max(0, newSlipPos);
    }
    updateDeck(set, deckId, { slipPosition: newSlipPos });
  },

  setRollMode: (deckId, enabled) => {
    if (enabled) {
      updateDeck(set, deckId, { rollMode: true });
    } else {
      updateDeck(set, deckId, {
        rollMode: false,
        rollStartWallClock: null,
        rollStartPosition: null,
      });
    }
  },

  startRoll: (deckId, beatCount) => {
    const deck = get().decks[deckId];
    if (!deck.bpm) return; // roll requires BPM just like activateLoopBeat
    // Snap in-point to the grid when a confirmed grid is available; otherwise fall back to currentTime.
    const loopStart = deck.anchor !== null
      ? snapLoopIn({ bpm: deck.bpm, anchor: deck.anchor }, deck.currentTime)
      : deck.currentTime;
    const rawLoopEnd = loopOutFor(loopStart, beatCount, deck.bpm);
    const loopEnd = deck.duration > 0 ? Math.min(rawLoopEnd, deck.duration) : rawLoopEnd;
    // Arm the native engine loop (no-op via optional chaining on YouTube).
    getActivePlayer(deckId)?.setLoop?.(loopStart, loopEnd);
    updateDeck(set, deckId, {
      rollStartWallClock: Date.now(),
      rollStartPosition: deck.currentTime,
      loopActive: true,
      loopStart,
      loopEnd,
      loopBeatCount: beatCount,
    });
    // If slip mode is on, start tracking the shadow playhead from now.
    if (deck.slipMode) {
      get().startSlipTracking(deckId);
    }
  },

  endRoll: (deckId) => {
    const deck = get().decks[deckId];
    if (deck.rollStartWallClock === null || deck.rollStartPosition === null) return;
    const elapsed = (Date.now() - deck.rollStartWallClock) / 1000;
    let seekTarget = deck.rollStartPosition + elapsed * deck.pitchRate;
    if (deck.duration > 0) {
      seekTarget = Math.max(0, Math.min(seekTarget, deck.duration));
    } else {
      seekTarget = Math.max(0, seekTarget);
    }
    // Clear the native engine loop before seeking back (no-op via optional chaining on YouTube).
    getActivePlayer(deckId)?.clearLoop?.();
    getActivePlayer(deckId)?.seekTo(seekTarget, true);
    updateDeck(set, deckId, {
      rollStartWallClock: null,
      rollStartPosition: null,
      loopActive: false,
      loopStart: null,
      loopEnd: null,
      loopBeatCount: null,
      slipPosition: null,
      slipStartTime: null,
      slipStartPosition: null,
    });
  },

  startSlice: (deckId, sliceIndex) => {
    const deck = get().decks[deckId];
    if (!deck.bpm || deck.anchor === null) return; // needs a confirmed grid
    const grid = { bpm: deck.bpm, anchor: deck.anchor };
    const { start, end: rawEnd } = sliceStartFor(grid, deck.currentTime, deck.sliceWindowBeats, sliceIndex);
    // Clamp loopEnd to the track duration so the 250ms poll can always trigger.
    // When duration is unknown (0), no clamping — the track may still be loading.
    const loopEnd = deck.duration > 0 ? Math.min(rawEnd, deck.duration) : rawEnd;
    // Arm the native engine loop (no-op via optional chaining on YouTube).
    getActivePlayer(deckId)?.setLoop?.(start, loopEnd);
    updateDeck(set, deckId, {
      rollStartWallClock: Date.now(),
      rollStartPosition: deck.currentTime,
      loopActive: true,
      loopStart: start,
      loopEnd,
      loopBeatCount: null,
      manualLoopIn: null,
    });
    // If slip mode is on, start tracking the shadow playhead from now.
    if (deck.slipMode) {
      get().startSlipTracking(deckId);
    }
  },

  setGrid: (deckId, bpm, anchor) => updateDeck(set, deckId, { bpm, anchor, gridConfirmed: true }),

  nudgeGrid: (deckId, deltaSeconds) => {
    const deck = get().decks[deckId];
    if (deck.anchor === null) return;
    updateDeck(set, deckId, { anchor: deck.anchor + deltaSeconds, synced: false });
  },

  setCuePoint: (deckId, time) => updateDeck(set, deckId, { cuePoint: time }),

  syncToDeck: (deckId, otherId) => {
    const me = get().decks[deckId], other = get().decks[otherId];
    if (!me.bpm || !other.bpm || me.anchor === null || other.anchor === null) return;
    // exactSyncRate can return null — guard before use.
    const rate = exactSyncRate(me.bpm, other.bpm, other.pitchRate);
    if (rate === null) return;
    get().setPitchRate(deckId, rate);
    const player = getActivePlayer(deckId);
    const myPos = player?.getCurrentTime() ?? me.currentTime;
    const otherPos = getActivePlayer(otherId)?.getCurrentTime() ?? other.currentTime;
    const delta = phaseDelta({ bpm: me.bpm, anchor: me.anchor }, { bpm: other.bpm, anchor: other.anchor }, myPos, otherPos);
    // Fix 1: clamp seek target to [0, duration] so phaseDelta can't push below 0.
    const target = Math.max(0, Math.min(myPos + delta, me.duration || (myPos + delta)));
    // Fix 2: only mark synced when the player exists and the seek actually dispatched.
    if (player) {
      player.seekTo(target, true);
      updateDeck(set, deckId, { synced: true });
    }
  },

  dispatchTransport: (deckId, event) => {
    const deck = get().decks[deckId];
    const player = getActivePlayer(deckId);
    const pos = player?.getCurrentTime() ?? deck.currentTime;
    const r = transition(deck.transportState, event, { position: pos, cuePoint: deck.cuePoint });
    for (const intent of r.intents) {
      if (intent.kind === 'play') get().setPlaybackState(deckId, 'playing');
      else if (intent.kind === 'pause') get().setPlaybackState(deckId, 'paused');
      else if (intent.kind === 'seek') player?.seekTo(intent.to, true);
      else if (intent.kind === 'setCue') updateDeck(set, deckId, { cuePoint: intent.at });
    }
    // Set the resolved transport state LAST so it wins over any state implied by
    // setPlaybackState in the intent loop above (e.g. CUED beats PAUSED).
    updateDeck(set, deckId, { transportState: r.nextState, cuePoint: r.cuePoint });
  },

  beatJump: (deckId, dir) => {
    const deck = get().decks[deckId];
    if (!deck.bpm || deck.anchor === null) return;
    const grid = { bpm: deck.bpm, anchor: deck.anchor };
    // SHIFT: use the next-larger grid size for this jump only — a one-shot
    // bigger jump. deck.beatJumpSize (the persisted/displayed selector) is
    // never mutated by this.
    let size: number = deck.beatJumpSize;
    if (deck.shift) {
      const idx = BEAT_JUMP_SIZES.indexOf(deck.beatJumpSize as (typeof BEAT_JUMP_SIZES)[number]);
      if (idx >= 0) {
        const next = BEAT_JUMP_SIZES[Math.min(idx + 1, BEAT_JUMP_SIZES.length - 1)];
        if (next !== undefined) size = next;
      }
    }
    const target = gridJumpTarget(grid, deck.currentTime, size, dir, deck.duration);
    getActivePlayer(deckId)?.seekTo(target, true);
  },
}));

/**
 * Convenience selector to get a specific deck's state.
 */
export function useDeck(deckId: 'A' | 'B'): DeckState {
  return useDeckStore((state) => state.decks[deckId]);
}

/**
 * Subscribe to a stable bag of deck ACTIONS without subscribing to any reactive
 * state. Action identities never change, so a component using only this never
 * re-renders from state updates (e.g. currentTime ticks).
 */
export function useDeckActions() {
  return useDeckStore(
    useShallow((s) => ({
      loadTrack: s.loadTrack, clearTrack: s.clearTrack, setPlaybackState: s.setPlaybackState,
      setCurrentTime: s.setCurrentTime, setHotCue: s.setHotCue, clearHotCue: s.clearHotCue,
      setBpm: s.setBpm, setVolume: s.setVolume, setPitchRate: s.setPitchRate,
      setEq: s.setEq, setEqKill: s.setEqKill, setFilterSweep: s.setFilterSweep,
      setGain: s.setGain,
      setQuantize: s.setQuantize, setShift: s.setShift, setPadMode: s.setPadMode, setSliceWindowBeats: s.setSliceWindowBeats,
      setEffectType: s.setEffectType, setEffectEnabled: s.setEffectEnabled, setEffectWetDry: s.setEffectWetDry,
      setEffectBeat: s.setEffectBeat,
      activateLoop: s.activateLoop, activateLoopBeat: s.activateLoopBeat, deactivateLoop: s.deactivateLoop,
      setLoopIn: s.setLoopIn, setLoopOut: s.setLoopOut, reloop: s.reloop,
      setBeatJumpSize: s.setBeatJumpSize, setSlipMode: s.setSlipMode, setSynced: s.setSynced,
      setRollMode: s.setRollMode, startRoll: s.startRoll, endRoll: s.endRoll, startSlice: s.startSlice,
      setGrid: s.setGrid, nudgeGrid: s.nudgeGrid,
      dispatchTransport: s.dispatchTransport, syncToDeck: s.syncToDeck, beatJump: s.beatJump,
    })),
  );
}
