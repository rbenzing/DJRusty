/**
 * useAudioEngine.ts — Web Audio API lifecycle hook for local MP3 playback.
 *
 * Called unconditionally in Deck.tsx alongside useYouTubePlayer (ADR-001).
 * All store subscriptions guard on sourceType === 'mp3' before acting.
 */
import { useRef, useEffect } from 'react';
import { AudioEngineImpl } from '../services/audioEngine';
import { decodeAudioFile } from '../services/audioDecoder';
import { playerRegistry } from '../services/playerRegistry';
import { useDeckStore } from '../store/deckStore';
import { usePlaylistStore } from '../store/playlistStore';
import { extractWaveformPeaks } from '../utils/extractWaveformPeaks';
import { extractColoredPeaks } from '../utils/extractColoredPeaks';

const WAVEFORM_PEAKS = 1000;

export function useAudioEngine(deckId: 'A' | 'B'): void {
  const engineRef = useRef<AudioEngineImpl | null>(null);
  const isMountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Prevents the poll's own setCurrentTime call from re-triggering the seek subscription
  const skipSeekRef = useRef(false);
  // Prevents autoPlay's setPlaybackState('playing') from triggering a second engine.play()
  const suppressTransportRef = useRef(false);

  /** Start the 250 ms currentTime poll. Idempotent — clears any existing poll first. */
  function startPoll(): void {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (!engineRef.current || !isMountedRef.current) return;
      const time = engineRef.current.getCurrentTime();
      skipSeekRef.current = true;
      useDeckStore.getState().setCurrentTime(deckId, time);
      const deck = useDeckStore.getState().decks[deckId];
      if (deck.loopActive && deck.loopEnd !== null && time >= deck.loopEnd) {
        engineRef.current.seekTo(deck.loopStart ?? 0);
      }
      if (deck.slipMode && deck.slipStartTime !== null && deck.loopActive) {
        useDeckStore.getState().updateSlipPosition(deckId);
      }
    }, 250);
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
      const { trackId, sourceType, autoPlayOnLoad } = state.decks[deckId];
      if (trackId === prevTrackId) return;
      prevTrackId = trackId;

      if (!trackId) {
        // Track cleared (eject) — stop audio and cancel the poll
        if (engineRef.current) engineRef.current.stop();
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        return;
      }

      if (sourceType !== 'mp3' || !engineRef.current) return;

      // Clear previous waveform immediately
      useDeckStore.getState().setWaveformPeaks(deckId, null);

      const { playlists, currentIndex } = usePlaylistStore.getState();
      const entry = playlists[deckId][currentIndex[deckId]];
      if (!entry) return;

      if (entry.file) {
        void loadAudioFile(deckId, engineRef, entry.file, autoPlayOnLoad, isMountedRef, suppressTransportRef);
      } else if (entry.audioUrl) {
        void loadAudioUrl(deckId, engineRef, entry.audioUrl, autoPlayOnLoad, isMountedRef, suppressTransportRef);
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // ── 3. Transport — play / pause ───────────────────────────────────────────
  useEffect(() => {
    let prev = useDeckStore.getState().decks[deckId].playbackState;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { playbackState, sourceType, playerReady } = state.decks[deckId];
      if (playbackState === prev) return;
      prev = playbackState;
      // Skip if autoPlay in loadAudioFile already called engine.play()
      if (suppressTransportRef.current) { suppressTransportRef.current = false; return; }
      if (sourceType !== 'mp3' || !playerReady || !engineRef.current) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // ── 3b. playerReady → start playback if user already clicked play during decode ──
  useEffect(() => {
    let prev = useDeckStore.getState().decks[deckId].playerReady;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { playerReady, playbackState, sourceType } = state.decks[deckId];
      if (playerReady === prev) return;
      prev = playerReady;
      if (!playerReady || sourceType !== 'mp3' || !engineRef.current) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // ── 4. Seek (external setCurrentTime → engine.seekTo) ────────────────────
  useEffect(() => {
    let prevTime = useDeckStore.getState().decks[deckId].currentTime;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { currentTime, sourceType, playerReady, duration } = state.decks[deckId];
      if (currentTime === prevTime) return;
      prevTime = currentTime;
      // Skip updates that originated from the poll itself
      if (skipSeekRef.current) { skipSeekRef.current = false; return; }
      if (sourceType !== 'mp3' || !playerReady || !engineRef.current) return;
      engineRef.current.seekTo(Math.max(0, Math.min(currentTime, duration)));
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // ── 5. Volume ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let prev = useDeckStore.getState().decks[deckId].volume;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { volume, sourceType } = state.decks[deckId];
      if (volume === prev) return;
      prev = volume;
      if (sourceType !== 'mp3' || !engineRef.current) return;
      engineRef.current.setVolume(volume);
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // ── 6. EQ ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let prevLow = useDeckStore.getState().decks[deckId].eqLow;
    let prevMid = useDeckStore.getState().decks[deckId].eqMid;
    let prevHigh = useDeckStore.getState().decks[deckId].eqHigh;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { eqLow, eqMid, eqHigh, sourceType } = state.decks[deckId];
      if (eqLow === prevLow && eqMid === prevMid && eqHigh === prevHigh) return;
      if (sourceType !== 'mp3' || !engineRef.current) return;
      if (eqLow !== prevLow) { engineRef.current.setEQ('low', eqLow); prevLow = eqLow; }
      if (eqMid !== prevMid) { engineRef.current.setEQ('mid', eqMid); prevMid = eqMid; }
      if (eqHigh !== prevHigh) { engineRef.current.setEQ('high', eqHigh); prevHigh = eqHigh; }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // ── 6b. EQ Kill switches ──────────────────────────────────────────────────
  useEffect(() => {
    let prevKillLow = useDeckStore.getState().decks[deckId].eqKillLow;
    let prevKillMid = useDeckStore.getState().decks[deckId].eqKillMid;
    let prevKillHigh = useDeckStore.getState().decks[deckId].eqKillHigh;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { eqKillLow, eqKillMid, eqKillHigh, sourceType } = state.decks[deckId];
      if (eqKillLow === prevKillLow && eqKillMid === prevKillMid && eqKillHigh === prevKillHigh) return;
      if (sourceType !== 'mp3' || !engineRef.current) return;
      if (eqKillLow !== prevKillLow) { engineRef.current.setEQKill('low', eqKillLow); prevKillLow = eqKillLow; }
      if (eqKillMid !== prevKillMid) { engineRef.current.setEQKill('mid', eqKillMid); prevKillMid = eqKillMid; }
      if (eqKillHigh !== prevKillHigh) { engineRef.current.setEQKill('high', eqKillHigh); prevKillHigh = eqKillHigh; }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // ── 6c. Filter sweep ──────────────────────────────────────────────────────
  useEffect(() => {
    let prev = useDeckStore.getState().decks[deckId].filterSweep;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { filterSweep, sourceType } = state.decks[deckId];
      if (filterSweep === prev) return;
      prev = filterSweep;
      if (sourceType !== 'mp3' || !engineRef.current) return;
      engineRef.current.setFilterSweep(filterSweep);
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // ── 6d. Effects ───────────────────────────────────────────────────────────
  useEffect(() => {
    let prevType = useDeckStore.getState().decks[deckId].effectType;
    let prevEnabled = useDeckStore.getState().decks[deckId].effectEnabled;
    let prevWetDry = useDeckStore.getState().decks[deckId].effectWetDry;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { effectType, effectEnabled, effectWetDry, sourceType, bpm } = state.decks[deckId];
      if (effectType === prevType && effectEnabled === prevEnabled && effectWetDry === prevWetDry) return;
      prevType = effectType; prevEnabled = prevEnabled; prevWetDry = effectWetDry;
      if (sourceType !== 'mp3' || !engineRef.current) return;
      const active = effectEnabled ? effectType : 'none';
      engineRef.current.setEffect(active, effectWetDry, bpm ?? 120);
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  // ── 7. Pitch rate ─────────────────────────────────────────────────────────
  useEffect(() => {
    let prevPitchRate = useDeckStore.getState().decks[deckId].pitchRate;
    let prevSourceType = useDeckStore.getState().decks[deckId].sourceType;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { pitchRate, sourceType } = state.decks[deckId];
      const sourceJustBecameMp3 = sourceType === 'mp3' && prevSourceType !== 'mp3';
      const pitchChanged = pitchRate !== prevPitchRate;
      prevPitchRate = pitchRate;
      prevSourceType = sourceType;
      if (sourceType !== 'mp3' || !engineRef.current) return;
      if (pitchChanged || sourceJustBecameMp3) {
        engineRef.current.setPlaybackRate(pitchRate);
      }
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);
}

// ─────────────────────────────────────────────────────────────────────────────

async function loadAudioFile(
  deckId: 'A' | 'B',
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
    useDeckStore.getState().setDuration(deckId, buffer.duration);
    useDeckStore.getState().setDecoding(deckId, false);
    useDeckStore.getState().setPlayerReady(deckId, true);
    useDeckStore.getState().setCurrentTime(deckId, 0);
    useDeckStore.getState().setPitchRateLocked(deckId, false);

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
    useDeckStore.getState().setDuration(deckId, buffer.duration);
    useDeckStore.getState().setDecoding(deckId, false);
    useDeckStore.getState().setPlayerReady(deckId, true);
    useDeckStore.getState().setCurrentTime(deckId, 0);
    useDeckStore.getState().setPitchRateLocked(deckId, false);

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
    useDeckStore.getState().setBpm(deckId, e.data.bpm);
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
