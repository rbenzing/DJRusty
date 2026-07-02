/**
 * useAudioEngine.ts — Web Audio API lifecycle hook for local MP3 playback.
 *
 * Called unconditionally in Deck.tsx. All store subscriptions act directly
 * on the audio engine without sourceType gating (single backend).
 */
import { useRef, useEffect } from 'react';
import { AudioEngineImpl } from '../services/audioEngine';
import { decodeAudioFile } from '../services/audioDecoder';
import { playerRegistry } from '../services/playerRegistry';
import { useDeckStore } from '../store/deckStore';
import { useLibraryStore } from '../store/libraryStore';
import { usePlaylistStore } from '../store/playlistStore';
import { extractWaveformPeaks } from '../utils/extractWaveformPeaks';
import { extractColoredPeaks } from '../utils/extractColoredPeaks';
import { proposeGrid } from '../utils/beatGrid';

const WAVEFORM_PEAKS = 1000;

export function useAudioEngine(deckId: 'A' | 'B'): void {
  const engineRef = useRef<AudioEngineImpl | null>(null);
  const isMountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Prevents autoPlay's setPlaybackState('playing') from triggering a second engine.play()
  const suppressTransportRef = useRef(false);

  /** Start the 100 ms coarse logic poll. Idempotent — clears any existing poll first. */
  function startPoll(): void {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (!engineRef.current || !isMountedRef.current) return;
      const time = engineRef.current.getCurrentTime();
      useDeckStore.getState().setCurrentTime(deckId, time);
      // Loop wrap is handled sample-accurately by the native engine loop points
      // (set via engine.setLoop in Task 2.2/2.3). The poll must not fight that.
      const deck = useDeckStore.getState().decks[deckId];
      if (deck.slipMode && deck.slipStartTime !== null && deck.loopActive) {
        useDeckStore.getState().updateSlipPosition(deckId);
      }
    }, 100);
  }

  // ── 1. Create / Destroy ───────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    const engine = new AudioEngineImpl();
    engineRef.current = engine;
    playerRegistry.register(deckId, engine);

    engine.onEnded(() => {
      if (!isMountedRef.current) return;
      useDeckStore.getState().setPlaybackState(deckId, 'ended');
      const { playlists, currentIndex, skipToNext } = usePlaylistStore.getState();
      if (currentIndex[deckId] < playlists[deckId].length - 1) skipToNext(deckId);
    });

    return () => {
      isMountedRef.current = false;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      playerRegistry.unregister(deckId);
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Track loading (mp3 only) ───────────────────────────────────────────
  useEffect(() => {
    let prevTrackId: string | null = useDeckStore.getState().decks[deckId].trackId;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { trackId, autoPlayOnLoad } = state.decks[deckId];
      if (trackId === prevTrackId) return;
      prevTrackId = trackId;

      if (!trackId) {
        // Track cleared (eject) — stop audio and cancel the poll
        if (engineRef.current) engineRef.current.stop();
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        return;
      }

      if (!engineRef.current) return;

      // Clear previous waveform immediately
      useDeckStore.getState().setWaveformPeaks(deckId, null);

      const { playlists, currentIndex } = usePlaylistStore.getState();
      const entry = playlists[deckId][currentIndex[deckId]];
      if (!entry) return;

      if (entry.file) {
        void loadAudioFile(deckId, trackId, engineRef, entry.file, autoPlayOnLoad, isMountedRef, suppressTransportRef);
      } else if (entry.audioUrl) {
        void loadAudioUrl(deckId, engineRef, entry.audioUrl, autoPlayOnLoad, isMountedRef, suppressTransportRef);
      }
    });

    return unsubscribe;
  }, [deckId]);

  // ── 3. Transport — play / pause ───────────────────────────────────────────
  useEffect(() => {
    let prev = useDeckStore.getState().decks[deckId].playbackState;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { playbackState, playerReady } = state.decks[deckId];
      if (playbackState === prev) return;
      prev = playbackState;
      // Skip if autoPlay in loadAudioFile already called engine.play()
      if (suppressTransportRef.current) { suppressTransportRef.current = false; return; }
      if (!playerReady || !engineRef.current) return;
      const engine = engineRef.current;

      if (playbackState === 'playing') {
        void (async () => {
          await engine.play();
          if (!isMountedRef.current) return;
          startPoll();
        })();
      } else if (playbackState === 'paused') {
        engine.pause();
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      }
    });

    return () => {
      unsubscribe();
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
    // startPoll is a stable local closure — safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // ── 3b. playerReady → start playback if user already clicked play during decode ──
  useEffect(() => {
    let prev = useDeckStore.getState().decks[deckId].playerReady;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { playerReady, playbackState } = state.decks[deckId];
      if (playerReady === prev) return;
      prev = playerReady;
      if (!playerReady || !engineRef.current) return;
      // User may have clicked play while the buffer was still decoding.
      if (playbackState === 'playing') {
        void (async () => {
          await engineRef.current!.play();
          if (!isMountedRef.current) return;
          startPoll();
        })();
      }
    });

    return unsubscribe;
    // startPoll is a stable local closure — safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // ── 5. Volume ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let prev = useDeckStore.getState().decks[deckId].volume;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { volume } = state.decks[deckId];
      if (volume === prev) return;
      prev = volume;
      if (!engineRef.current) return;
      engineRef.current.setVolume(volume);
    });

    return unsubscribe;
  }, [deckId]);

  // ── 5b. Gain (input trim) ─────────────────────────────────────────────────
  useEffect(() => {
    let prev = useDeckStore.getState().decks[deckId].gainDb;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { gainDb } = state.decks[deckId];
      if (gainDb === prev) return;
      prev = gainDb;
      if (!engineRef.current) return;
      engineRef.current.setGain(gainDb);
    });

    return unsubscribe;
  }, [deckId]);

  // ── 6. EQ ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let prevLow = useDeckStore.getState().decks[deckId].eqLow;
    let prevMid = useDeckStore.getState().decks[deckId].eqMid;
    let prevHigh = useDeckStore.getState().decks[deckId].eqHigh;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { eqLow, eqMid, eqHigh } = state.decks[deckId];
      if (eqLow === prevLow && eqMid === prevMid && eqHigh === prevHigh) return;
      if (!engineRef.current) return;
      if (eqLow !== prevLow) { engineRef.current.setEQ('low', eqLow); prevLow = eqLow; }
      if (eqMid !== prevMid) { engineRef.current.setEQ('mid', eqMid); prevMid = eqMid; }
      if (eqHigh !== prevHigh) { engineRef.current.setEQ('high', eqHigh); prevHigh = eqHigh; }
    });

    return unsubscribe;
  }, [deckId]);

  // ── 6b. EQ Kill switches ──────────────────────────────────────────────────
  useEffect(() => {
    let prevKillLow = useDeckStore.getState().decks[deckId].eqKillLow;
    let prevKillMid = useDeckStore.getState().decks[deckId].eqKillMid;
    let prevKillHigh = useDeckStore.getState().decks[deckId].eqKillHigh;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { eqKillLow, eqKillMid, eqKillHigh } = state.decks[deckId];
      if (eqKillLow === prevKillLow && eqKillMid === prevKillMid && eqKillHigh === prevKillHigh) return;
      if (!engineRef.current) return;
      if (eqKillLow !== prevKillLow) { engineRef.current.setEQKill('low', eqKillLow); prevKillLow = eqKillLow; }
      if (eqKillMid !== prevKillMid) { engineRef.current.setEQKill('mid', eqKillMid); prevKillMid = eqKillMid; }
      if (eqKillHigh !== prevKillHigh) { engineRef.current.setEQKill('high', eqKillHigh); prevKillHigh = eqKillHigh; }
    });

    return unsubscribe;
  }, [deckId]);

  // ── 6c. Filter sweep ──────────────────────────────────────────────────────
  useEffect(() => {
    let prev = useDeckStore.getState().decks[deckId].filterSweep;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { filterSweep } = state.decks[deckId];
      if (filterSweep === prev) return;
      prev = filterSweep;
      if (!engineRef.current) return;
      engineRef.current.setFilterSweep(filterSweep);
    });

    return unsubscribe;
  }, [deckId]);

  // ── 6d. Effects ───────────────────────────────────────────────────────────
  useEffect(() => {
    let prevType = useDeckStore.getState().decks[deckId].effectType;
    let prevEnabled = useDeckStore.getState().decks[deckId].effectEnabled;
    let prevWetDry = useDeckStore.getState().decks[deckId].effectWetDry;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { effectType, effectEnabled, effectWetDry, bpm } = state.decks[deckId];
      if (effectType === prevType && effectEnabled === prevEnabled && effectWetDry === prevWetDry) return;
      prevType = effectType; prevEnabled = effectEnabled; prevWetDry = effectWetDry;
      if (!engineRef.current) return;
      const active = effectEnabled ? effectType : 'none';
      engineRef.current.setEffect(active, effectWetDry, bpm ?? 120);
    });

    return unsubscribe;
  }, [deckId]);

  // ── 7. Pitch rate ─────────────────────────────────────────────────────────
  useEffect(() => {
    let prevPitchRate = useDeckStore.getState().decks[deckId].pitchRate;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { pitchRate } = state.decks[deckId];
      if (pitchRate === prevPitchRate) return;
      prevPitchRate = pitchRate;
      if (!engineRef.current) return;
      engineRef.current.setPlaybackRate(pitchRate);
    });

    return unsubscribe;
  }, [deckId]);
}

// ─────────────────────────────────────────────────────────────────────────────

async function loadAudioFile(
  deckId: 'A' | 'B',
  trackId: string,
  engineRef: React.MutableRefObject<AudioEngineImpl | null>,
  file: File,
  autoPlay: boolean,
  isMountedRef: React.MutableRefObject<boolean>,
  suppressTransportRef: React.MutableRefObject<boolean>,
): Promise<void> {
  const store = useDeckStore.getState();
  store.setDecoding(deckId, true);
  store.setBpmDetecting(deckId, true);

  try {
    const buffer = await decodeAudioFile(file);
    if (!isMountedRef.current || !engineRef.current) return;

    const engine = engineRef.current;
    engine.loadBuffer(buffer);
    // Sync engine volume to current mixer-computed deck volume immediately
    engine.setVolume(useDeckStore.getState().decks[deckId].volume);
    engine.setGain(useDeckStore.getState().decks[deckId].gainDb);
    useDeckStore.getState().setDuration(deckId, buffer.duration);
    useDeckStore.getState().setDecoding(deckId, false);
    useDeckStore.getState().setPlayerReady(deckId, true);
    useDeckStore.getState().setCurrentTime(deckId, 0);

    // Waveform peaks (synchronous — runs on decoded buffer)
    const peaks = extractWaveformPeaks(buffer, WAVEFORM_PEAKS);
    if (isMountedRef.current) useDeckStore.getState().setWaveformPeaks(deckId, peaks);

    // Frequency-colored peaks for CenterWaveform display
    const coloredPeaks = extractColoredPeaks(buffer, WAVEFORM_PEAKS);
    if (isMountedRef.current) useDeckStore.getState().setWaveformColoredPeaks(deckId, coloredPeaks);

    // BPM detection in a worker
    launchBpmWorker(deckId, buffer, isMountedRef);

    if (autoPlay) {
      await engine.play();
      if (!isMountedRef.current) return;
      suppressTransportRef.current = true; // prevent double-play from transport subscription
      useDeckStore.getState().setPlaybackState(deckId, 'playing');
      useDeckStore.getState().clearAutoPlayOnLoad(deckId);
    }
  } catch (err) {
    if (!isMountedRef.current) return;
    useDeckStore.getState().setDecoding(deckId, false);
    useDeckStore.getState().setBpmDetecting(deckId, false);
    useDeckStore.getState().setError(
      deckId,
      `Failed to decode: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
    useLibraryStore.getState().setDecodeError(
      trackId,
      "Couldn't decode — this format may be unsupported in your browser",
    );
  }
}

async function loadAudioUrl(
  deckId: 'A' | 'B',
  engineRef: React.MutableRefObject<AudioEngineImpl | null>,
  audioUrl: string,
  autoPlay: boolean,
  isMountedRef: React.MutableRefObject<boolean>,
  suppressTransportRef: React.MutableRefObject<boolean>,
): Promise<void> {
  const store = useDeckStore.getState();
  store.setDecoding(deckId, true);
  store.setBpmDetecting(deckId, true);
  try {
    const resp = await fetch(audioUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const arrayBuffer = await resp.arrayBuffer();
    if (!isMountedRef.current || !engineRef.current) return;

    const audioCtx = new AudioContext();
    const buffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioCtx.close();

    const engine = engineRef.current;
    engine.loadBuffer(buffer);
    engine.setVolume(useDeckStore.getState().decks[deckId].volume);
    engine.setGain(useDeckStore.getState().decks[deckId].gainDb);
    useDeckStore.getState().setDuration(deckId, buffer.duration);
    useDeckStore.getState().setDecoding(deckId, false);
    useDeckStore.getState().setPlayerReady(deckId, true);
    useDeckStore.getState().setCurrentTime(deckId, 0);

    const peaks = extractWaveformPeaks(buffer, WAVEFORM_PEAKS);
    if (isMountedRef.current) useDeckStore.getState().setWaveformPeaks(deckId, peaks);

    const coloredPeaks = extractColoredPeaks(buffer, WAVEFORM_PEAKS);
    if (isMountedRef.current) useDeckStore.getState().setWaveformColoredPeaks(deckId, coloredPeaks);

    launchBpmWorker(deckId, buffer, isMountedRef);

    if (autoPlay) {
      await engine.play();
      if (!isMountedRef.current) return;
      suppressTransportRef.current = true;
      useDeckStore.getState().setPlaybackState(deckId, 'playing');
      useDeckStore.getState().clearAutoPlayOnLoad(deckId);
    }
  } catch (err) {
    if (!isMountedRef.current) return;
    useDeckStore.getState().setDecoding(deckId, false);
    useDeckStore.getState().setBpmDetecting(deckId, false);
    useDeckStore.getState().setError(
      deckId,
      `Failed to load: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
  }
}

function launchBpmWorker(
  deckId: 'A' | 'B',
  buffer: AudioBuffer,
  isMountedRef: React.MutableRefObject<boolean>,
): void {
  if (typeof Worker === 'undefined') {
    useDeckStore.getState().setBpmDetecting(deckId, false);
    return;
  }

  let worker: Worker;
  try {
    worker = new Worker(new URL('../workers/bpmDetector.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    useDeckStore.getState().setBpmDetecting(deckId, false);
    return;
  }

  worker.onmessage = (e: MessageEvent<{ bpm: number }>) => {
    worker.terminate();
    if (!isMountedRef.current) return;
    if (useDeckStore.getState().decks[deckId].gridConfirmed) {
      useDeckStore.getState().setBpmDetecting(deckId, false);
      return;
    }
    const { bpm: dbpm, anchor } = proposeGrid(e.data.bpm);
    useDeckStore.getState().setBpm(deckId, dbpm);
    useDeckStore.setState((s) => ({
      decks: { ...s.decks, [deckId]: { ...s.decks[deckId], anchor, gridConfirmed: false } },
    }));
    useDeckStore.getState().setBpmDetecting(deckId, false);
  };

  worker.onerror = () => {
    worker.terminate();
    if (!isMountedRef.current) return;
    useDeckStore.getState().setBpmDetecting(deckId, false);
  };

  const channelData = buffer.getChannelData(0);
  worker.postMessage({ channelData, sampleRate: buffer.sampleRate });
}
