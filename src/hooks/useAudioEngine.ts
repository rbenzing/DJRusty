/**
 * useAudioEngine.ts — Web Audio API lifecycle hook for local MP3 playback.
 *
 * Creates an AudioEngineImpl for a single deck, registers it in playerRegistry,
 * and manages the full track-loading lifecycle (decode, load buffer, autoplay,
 * error handling, playlist auto-advance).
 *
 * Called unconditionally in Deck.tsx alongside useYouTubePlayer. All store
 * subscriptions guard on sourceType === 'mp3' before taking action.
 *
 * @param deckId - Which deck this engine belongs to ('A' | 'B').
 */
import { useRef, useEffect } from 'react';
import { AudioEngineImpl } from '../services/audioEngine';
import { decodeAudioFile } from '../services/audioDecoder';
import { playerRegistry } from '../services/playerRegistry';
import { useDeckStore } from '../store/deckStore';
import { usePlaylistStore } from '../store/playlistStore';

/**
 * useAudioEngine — Web Audio API lifecycle hook for local audio playback.
 *
 * @param deckId - Which deck this engine belongs to ('A' | 'B').
 */
export function useAudioEngine(deckId: 'A' | 'B'): void {
  const engineRef = useRef<AudioEngineImpl | null>(null);
  const isMountedRef = useRef(true);

  // --- Creation / Destruction ---
  useEffect(() => {
    isMountedRef.current = true;
    const engine = new AudioEngineImpl();
    engineRef.current = engine;
    playerRegistry.register(deckId, engine);

    // Auto-advance on track end
    engine.onEnded(() => {
      if (!isMountedRef.current) return;

      useDeckStore.getState().setPlaybackState(deckId, 'ended');

      const { playlists, currentIndex, skipToNext } = usePlaylistStore.getState();
      const idx = currentIndex[deckId];
      const playlist = playlists[deckId];
      if (idx >= 0 && idx < playlist.length - 1) {
        skipToNext(deckId);
      }
    });

    return () => {
      isMountedRef.current = false;
      playerRegistry.unregister(deckId);
      engine.destroy();
      engineRef.current = null;
    };
    // deckId is stable for the lifetime of the component — safe to include once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- React to trackId changes (sourceType === 'mp3' only) ---
  useEffect(() => {
    let prevTrackId: string | null = useDeckStore.getState().decks[deckId].trackId;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { trackId, sourceType, autoPlayOnLoad } = state.decks[deckId];

      // Only react when trackId actually changes.
      if (trackId === prevTrackId) return;
      prevTrackId = trackId;

      // Guard: only handle mp3 source type.
      if (!trackId || sourceType !== 'mp3' || !engineRef.current) return;

      // Look up the PlaylistEntry to get the File object.
      const { playlists, currentIndex } = usePlaylistStore.getState();
      const entry = playlists[deckId][currentIndex[deckId]];
      if (!entry?.file) return;

      const engine = engineRef.current;
      const file = entry.file;

      // Kick off async decode.
      void loadAudioFile(deckId, engine, file, autoPlayOnLoad, isMountedRef);
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);
}

/**
 * Decode an audio file and load it into the engine.
 * Handles the full decode lifecycle: setDecoding, loadBuffer, setPlayerReady,
 * autoPlay, and error handling.
 */
async function loadAudioFile(
  deckId: 'A' | 'B',
  engine: AudioEngineImpl,
  file: File,
  autoPlay: boolean,
  isMountedRef: React.MutableRefObject<boolean>,
): Promise<void> {
  const store = useDeckStore.getState();
  store.setDecoding(deckId, true);

  try {
    const buffer = await decodeAudioFile(file);

    if (!isMountedRef.current) return;

    engine.loadBuffer(buffer);
    useDeckStore.getState().setDuration(deckId, buffer.duration);

    useDeckStore.getState().setDecoding(deckId, false);
    useDeckStore.getState().setPlayerReady(deckId, true);
    useDeckStore.getState().setCurrentTime(deckId, 0);

    if (autoPlay) {
      await engine.play();
      if (!isMountedRef.current) return;
      useDeckStore.getState().setPlaybackState(deckId, 'playing');
      useDeckStore.getState().clearAutoPlayOnLoad(deckId);
    }
  } catch (err) {
    if (!isMountedRef.current) return;
    useDeckStore.getState().setDecoding(deckId, false);
    useDeckStore.getState().setError(
      deckId,
      `Failed to decode: ${err instanceof Error ? err.message : 'Unknown error'}`,
    );
  }
}
