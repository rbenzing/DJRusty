import { create } from 'zustand';
import type { DeckState, PlaybackState } from '../types/deck';
import type { TrackSourceType } from '../types/playlist';
import { DEFAULT_PITCH_RATE, type PitchRate } from '../constants/pitchRates';
import { getHotCues } from '../utils/hotCues';
import { DEFAULT_BEAT_JUMP_SIZE } from '../utils/beatJump';
import { playerRegistry } from '../services/playerRegistry';

/**
 * Initial state for a single deck.
 */
function createInitialDeckState(deckId: 'A' | 'B'): DeckState {
  return {
    deckId,
    trackId: null,
    sourceType: null,
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
    beatJumpSize: DEFAULT_BEAT_JUMP_SIZE,
    playerReady: false,
    hotCues: {},
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    eqKillLow: false,
    eqKillMid: false,
    eqKillHigh: false,
    filterSweep: 0,
    effectType: 'none',
    effectEnabled: false,
    effectWetDry: 0.5,
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

/**
 * Actions available on the deck store.
 */
interface DeckStoreActions {
  /** Load a track into the specified deck. */
  loadTrack: (
    deckId: 'A' | 'B',
    /**
     * Source-agnostic track identifier.
     * For YouTube entries: the YouTube video ID.
     * For MP3 entries: the PlaylistEntry.id.
     */
    trackId: string,
    metadata: {
      sourceType: TrackSourceType;
      title: string;
      artist: string;
      duration: number;
      thumbnailUrl: string | null;
    },
    /** When true, the player will call loadVideoById (auto-plays) instead of cueVideoById. */
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

  /** Clear the autoPlayOnLoad flag after the player has issued the load command. */
  clearAutoPlayOnLoad: (deckId: 'A' | 'B') => void;

  /** Set the player ready flag for the specified deck. */
  setPlayerReady: (deckId: 'A' | 'B', ready: boolean) => void;

  /** Update the playback state for the specified deck. */
  setPlaybackState: (deckId: 'A' | 'B', state: PlaybackState) => void;

  /** Update the current playback time (polled from IFrame API). */
  setCurrentTime: (deckId: 'A' | 'B', time: number) => void;

  /** Set the pitch rate for the specified deck. */
  setPitchRate: (deckId: 'A' | 'B', rate: PitchRate) => void;

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

  /** Set a hot cue timestamp for the specified deck and cue index. */
  setHotCue: (deckId: 'A' | 'B', index: number, timestamp: number) => void;

  /** Clear a hot cue for the specified deck and cue index. */
  clearHotCue: (deckId: 'A' | 'B', index: number) => void;

  /** Load hot cues from localStorage into the specified deck's state. */
  loadHotCues: (deckId: 'A' | 'B', hotCues: Record<number, number>) => void;

  /** Set EQ values for the specified deck. */
  setEq: (deckId: 'A' | 'B', band: 'eqLow' | 'eqMid' | 'eqHigh', value: number) => void;

  /** Set the track duration (seconds) — used by useAudioEngine after buffer decode. */
  setDuration: (deckId: 'A' | 'B', duration: number) => void;

  /** Set an error state for the specified deck. */
  setError: (deckId: 'A' | 'B', error: string | null) => void;

  /**
   * Lock or unlock the pitch slider for the specified deck.
   * Locked when the loaded video only supports playback at 1× speed.
   */
  setPitchRateLocked: (deckId: 'A' | 'B', locked: boolean) => void;

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

  loadTrack: (deckId, trackId, { sourceType, title, artist, duration, thumbnailUrl }, autoPlay = false) => {
    updateDeck(set, deckId, {
      trackId,
      sourceType,
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
      bpm: null,
      // Hot cues are keyed by trackId — for YouTube entries trackId IS the videoId,
      // so existing persisted hot cues load correctly without migration.
      hotCues: getHotCues(trackId),
      error: null,
      waveformPeaks: null,
      waveformColoredPeaks: null,
      decoding: false,
      bpmDetecting: false,
      // Reset pitch lock — will be re-evaluated by the player's onReady / onPlaybackRateChange.
      pitchRateLocked: false,
      synced: false,
      slipMode: false,
      slipPosition: null,
      slipStartTime: null,
      slipStartPosition: null,
      rollMode: false,
      rollStartWallClock: null,
      rollStartPosition: null,
      autoPlayOnLoad: autoPlay,
    });
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

  clearAutoPlayOnLoad: (deckId) => {
    updateDeck(set, deckId, { autoPlayOnLoad: false });
  },

  setPlayerReady: (deckId, ready) => {
    updateDeck(set, deckId, { playerReady: ready });
  },

  setPlaybackState: (deckId, state) => {
    updateDeck(set, deckId, { playbackState: state });
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
    if (!deck.bpm) return; // loop buttons are disabled when BPM is not set
    const loopLengthSeconds = (beatCount / deck.bpm) * 60;
    const loopStart = deck.currentTime;
    // Clamp loopEnd to the track duration so the 250ms poll can always trigger.
    // When duration is unknown (0), no clamping — the track may still be loading.
    const rawLoopEnd = loopStart + loopLengthSeconds;
    const loopEnd = deck.duration > 0 ? Math.min(rawLoopEnd, deck.duration) : rawLoopEnd;
    updateDeck(set, deckId, {
      loopActive: true,
      loopStart,
      loopEnd,
      loopBeatCount: beatCount,
    });
  },

  deactivateLoop: (deckId) => {
    const deck = get().decks[deckId];
    // Slip-aware exit: if slip mode is on and a shadow position is tracked,
    // seek to the shadow position before deactivating the loop.
    if (deck.slipMode && deck.slipPosition !== null) {
      playerRegistry.get(deckId)?.seekTo(deck.slipPosition, true);
    }
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

  setDuration: (deckId, duration) => {
    updateDeck(set, deckId, { duration });
  },

  setError: (deckId, error) => {
    updateDeck(set, deckId, { error });
  },

  setPitchRateLocked: (deckId, locked) => {
    updateDeck(set, deckId, { pitchRateLocked: locked });
  },

  setBeatJumpSize: (deckId, size) => {
    updateDeck(set, deckId, { beatJumpSize: size });
  },

  clearTrack: (deckId) => {
    updateDeck(set, deckId, {
      trackId: null,
      sourceType: null,
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
      bpm: null,
      beatJumpSize: DEFAULT_BEAT_JUMP_SIZE,
      hotCues: {},
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
    const loopLengthSeconds = (beatCount / deck.bpm) * 60;
    const loopStart = deck.currentTime;
    const rawLoopEnd = loopStart + loopLengthSeconds;
    const loopEnd = deck.duration > 0 ? Math.min(rawLoopEnd, deck.duration) : rawLoopEnd;
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
    playerRegistry.get(deckId)?.seekTo(seekTarget, true);
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
}));

/**
 * Convenience selector to get a specific deck's state.
 */
export function useDeck(deckId: 'A' | 'B'): DeckState {
  return useDeckStore((state) => state.decks[deckId]);
}
