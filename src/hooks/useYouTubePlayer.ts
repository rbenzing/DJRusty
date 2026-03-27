/**
 * useYouTubePlayer.ts — YouTube IFrame API lifecycle hook.
 *
 * Manages a YT.Player instance for a single deck (A or B). The player instance
 * lives in a useRef — never in Zustand state — because YT.Player is an imperative
 * object with methods and internal browser state that cannot be serialised.
 *
 * Responsibilities:
 *  - Creates the player when the IFrame API is ready and the container is mounted.
 *  - Maps YT.PlayerState events to deckStore playbackState strings.
 *  - Polls getCurrentTime() every 250ms while playing; clears poll on pause/end/unmount.
 *  - Applies pitchRate changes via setPlaybackRate().
 *  - Cues a new video via cueVideoById() when videoId changes in the store.
 *  - Sets initial volume on first play so the player matches the deck store value.
 *  - Destroys the player on component unmount to free browser resources.
 */
import { useRef, useEffect, type RefObject, type MutableRefObject } from 'react';
import { useDeckStore } from '../store/deckStore';
import { usePlaylistStore } from '../store/playlistStore';
import { loadYouTubeIframeApi } from '../services/youtubeIframeApi';
import { playerRegistry, YouTubePlayerAdapter } from '../services/playerRegistry';
import { nearestPitchRate } from '../constants/pitchRates';
import type { PlaybackState } from '../types/deck';

/** Interval in ms between getCurrentTime polls while playing. */
const CURRENT_TIME_POLL_INTERVAL_MS = 250;

/** Maps YT.PlayerState numeric constants to our PlaybackState string enum. */
function mapYtStateToDeckState(ytState: number): PlaybackState | null {
  switch (ytState) {
    case YT.PlayerState.PLAYING:
      return 'playing';
    case YT.PlayerState.PAUSED:
      return 'paused';
    case YT.PlayerState.ENDED:
      return 'ended';
    case YT.PlayerState.BUFFERING:
      return 'buffering';
    case YT.PlayerState.UNSTARTED:
    case YT.PlayerState.CUED:
      return 'unstarted';
    default:
      return null;
  }
}

/**
 * Manages a YT.Player instance for a single deck.
 *
 * @param deckId - Which deck this player belongs to ('A' or 'B').
 * @param containerRef - Ref to the DOM element that will host the IFrame.
 * @returns playerRef — a ref to the YT.Player instance (may be null before API ready).
 */
export function useYouTubePlayer(
  deckId: 'A' | 'B',
  containerRef: RefObject<HTMLDivElement>,
): { playerRef: MutableRefObject<YT.Player | null> } {
  const playerRef = useRef<YT.Player | null>(null);
  const pollRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // Track whether the player has ever been played (for initial volume-set on first play).
  const hasPlayedRef = useRef(false);

  // Track whether the player's onReady event has fired.
  // cueVideoById must not be called before onReady — the call silently fails.
  const isReadyRef = useRef(false);

  // --- Poll management helpers -----------------------------------------------

  /** Starts polling getCurrentTime at 250ms intervals. No-op if already running. */
  const startCurrentTimePoll = useRef(() => {
    if (pollRef.current !== null) return;
    pollRef.current = window.setInterval(() => {
      if (!isMountedRef.current) return;
      const currentTime = playerRef.current?.getCurrentTime() ?? 0;
      useDeckStore.getState().setCurrentTime(deckId, currentTime);

      // Loop boundary enforcement: when a loop is active and the playhead
      // reaches or passes loopEnd, seek back to loopStart immediately.
      const { loopActive, loopEnd, loopStart, slipMode, slipStartTime } =
        useDeckStore.getState().decks[deckId];
      if (
        loopActive &&
        loopEnd !== null &&
        loopStart !== null &&
        currentTime >= loopEnd
      ) {
        playerRef.current?.seekTo(loopStart, true);
      }

      // Slip position tracking: advance the shadow playhead while a loop is active.
      if (slipMode && slipStartTime !== null && loopActive) {
        useDeckStore.getState().updateSlipPosition(deckId);
      }
    }, CURRENT_TIME_POLL_INTERVAL_MS);
  }).current;

  /** Stops the currentTime poll. No-op if not running. */
  const stopCurrentTimePoll = useRef(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }).current;

  // --- YT.Player event handlers (stable refs so they survive re-renders) ------

  const handleReady = useRef(function onPlayerReady(event: YT.PlayerEvent) {
    if (!isMountedRef.current) return;

    // In React StrictMode, effects run twice (mount → cleanup → remount).
    // The first player may fire onReady *after* cleanup replaced playerRef.current
    // with the second player. Guard against this by verifying the player that
    // fired onReady is our current player, not a stale one.
    // Use event.target throughout — it is the player that is actually ready;
    // playerRef.current might be a different (newer) player at this point.
    const player = event.target;
    if (player !== playerRef.current) return;

    isReadyRef.current = true;
    useDeckStore.getState().setPlayerReady(deckId, true);
    console.debug(`[YTPlayer ${deckId}] onReady fired`);

    // Check whether the loaded video supports variable playback rates.
    // Some videos are restricted to 1× only. When that is the case we lock
    // the pitch slider so the user is not presented with a non-functional control.
    const availableRates = player.getAvailablePlaybackRates() ?? [];
    const rateLocked = availableRates.length === 1 && availableRates[0] === 1;
    useDeckStore.getState().setPitchRateLocked(deckId, rateLocked);

    // If a track was loaded into the store before the player finished initialising,
    // the trackId subscription would have skipped cueVideoById (because isReadyRef
    // was false). Cue (or load) it now that the player is ready.
    // Only act when the loaded track is a YouTube track (sourceType === 'youtube').
    const { trackId: pendingTrackId, sourceType: pendingSourceType, playbackState, volume, autoPlayOnLoad: pendingAutoPlay } =
      useDeckStore.getState().decks[deckId];
    if (pendingTrackId && pendingSourceType === 'youtube') {
      if (pendingAutoPlay) {
        player.loadVideoById(pendingTrackId);
        useDeckStore.getState().clearAutoPlayOnLoad(deckId);
      } else {
        player.cueVideoById(pendingTrackId);
      }
      hasPlayedRef.current = false;
    }

    // Race condition: if the user clicked play before onReady fired, the
    // playbackState subscription would have bailed (isReadyRef was false).
    // Resume the play command now.
    if (playbackState === 'playing') {
      console.debug(`[YTPlayer ${deckId}] resuming pending play command`);
      if (!hasPlayedRef.current) {
        hasPlayedRef.current = true;
        player.setVolume(volume);
      }
      player.unMute();
      player.playVideo();
      startCurrentTimePoll();
    }
  }).current;

  const handlePlaybackRateChange = useRef(function onPlaybackRateChange(
    event: YT.OnPlaybackRateChangeEvent,
  ) {
    if (!isMountedRef.current) return;
    // The YouTube player confirms the rate that was actually applied (which may
    // differ from what was requested if the video doesn't support that rate).
    // Snap to the nearest discrete PITCH_RATES value and update the store.
    const confirmedRate = nearestPitchRate(event.data);
    useDeckStore.getState().setPitchRate(deckId, confirmedRate);
  }).current;

  const handleStateChange = useRef(function onPlayerStateChange(
    event: YT.OnStateChangeEvent,
  ) {
    if (!isMountedRef.current) return;

    const mappedState = mapYtStateToDeckState(event.data);
    if (mappedState === null) return;

    // Update the store first, then manage the poll.
    useDeckStore.getState().setPlaybackState(deckId, mappedState);

    if (mappedState === 'playing') {
      startCurrentTimePoll();
    } else if (mappedState === 'paused' || mappedState === 'ended' || mappedState === 'unstarted') {
      // Do NOT stop the poll on 'buffering' — a mid-playback rebuffer should
      // not freeze the time display. The poll reads getCurrentTime() which
      // returns the last buffered position during a rebuffer, so it stays
      // accurate. Only stop on definitive non-playing states.
      stopCurrentTimePoll();

      // Auto-advance the playlist when a track ends naturally.
      if (mappedState === 'ended') {
        const { playlists, currentIndex, skipToNext } = usePlaylistStore.getState();
        const playlist = playlists[deckId];
        const idx = currentIndex[deckId];
        if (idx >= 0 && idx < playlist.length - 1) {
          skipToNext(deckId);
        }
      }
    }
  }).current;

  const handleError = useRef(function onPlayerError(event: YT.OnErrorEvent) {
    if (!isMountedRef.current) return;

    // Error codes 101 and 150: video owner has disallowed embedding.
    if (event.data === 101 || event.data === 150) {
      useDeckStore.getState().setError(deckId, 'Video cannot be embedded');
      useDeckStore.getState().setPlaybackState(deckId, 'unstarted');
    } else {
      // Other error codes (2, 5, 100) logged but not surfaced as deck errors.
      console.warn(`[useYouTubePlayer] Deck ${deckId} player error code: ${event.data}`);
    }
  }).current;

  // --- Player creation effect -------------------------------------------------

  useEffect(() => {
    isMountedRef.current = true;

    loadYouTubeIframeApi().then(() => {
      if (!isMountedRef.current || !containerRef.current) return;
      console.debug(`[YTPlayer ${deckId}] IFrame API ready, creating player`);

      // YouTube replaces the target element with an <iframe>, removing it from
      // the DOM. In React StrictMode effects run twice (mount→cleanup→remount):
      // cleanup calls destroy() which removes the iframe, but the original div
      // was already replaced — so on the second effect containerRef.current
      // would be an orphaned node with no parentNode and YouTube silently fails.
      //
      // Fix: create a fresh inner div for each player instance. YouTube replaces
      // the inner div (not the React-managed outer container), so the outer div
      // always stays in the DOM and subsequent effect runs work correctly.
      const mountTarget = document.createElement('div');
      containerRef.current.appendChild(mountTarget);

      playerRef.current = new YT.Player(mountTarget, {
        width: '1',
        height: '1',
        playerVars: {
          autoplay: 0 as YT.AutoPlay,
          controls: 0 as YT.Controls,
          disablekb: 1 as YT.KeyboardControls,
          origin: window.location.origin,
        },
        events: {
          onReady: handleReady,
          onStateChange: handleStateChange,
          onError: handleError,
          onPlaybackRateChange: handlePlaybackRateChange,
        },
      });

      // Register a YouTubePlayerAdapter in the module-level registry so that
      // components outside this hook (e.g. HotCues) can issue imperative seek
      // commands via the DeckPlayer interface, independent of the underlying backend.
      playerRegistry.register(deckId, new YouTubePlayerAdapter(playerRef.current));
    });

    return () => {
      isMountedRef.current = false;
      isReadyRef.current = false;
      stopCurrentTimePoll();
      playerRegistry.unregister(deckId);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // handleReady/handleStateChange/handleError/startCurrentTimePoll/stopCurrentTimePoll
    // are all stable refs — safe to omit from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- React to trackId changes -----------------------------------------------
  // When the store's trackId for this deck changes AND sourceType is 'youtube',
  // cue the new video via the IFrame API.
  // Track the previous value to avoid calling cueVideoById on every unrelated update.

  useEffect(() => {
    let prevTrackId: string | null = useDeckStore.getState().decks[deckId].trackId;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { trackId, sourceType, autoPlayOnLoad } = state.decks[deckId];
      if (trackId === prevTrackId) return;
      prevTrackId = trackId;

      // Guard: do not call cueVideoById before onReady has fired — the call
      // silently fails. handleReady will cue the pending trackId instead.
      // Also only act for YouTube tracks — MP3 tracks are handled by the
      // AudioEngine hook (mp3-002).
      if (!playerRef.current || !isReadyRef.current || !trackId) return;
      if (sourceType !== 'youtube') return;

      if (autoPlayOnLoad) {
        // Playlist auto-advance / skip: load and play immediately.
        // loadVideoById should auto-play, but we also set playbackState to
        // 'playing' explicitly so the playbackState subscription calls
        // playVideo() — this ensures playback even if the YouTube player
        // doesn't fire a PLAYING state event reliably.
        playerRef.current.loadVideoById(trackId);
        useDeckStore.getState().clearAutoPlayOnLoad(deckId);
        useDeckStore.getState().setPlaybackState(deckId, 'playing');
      } else {
        playerRef.current.cueVideoById(trackId);
      }
      // Reset play-once flag so initial volume-set applies to the new video.
      hasPlayedRef.current = false;
    });

    return unsubscribe;
  }, [deckId]);

  // --- React to pitchRate changes ---------------------------------------------
  // Apply the new playback rate whenever pitchRate changes in the store.

  useEffect(() => {
    let prevPitchRate = useDeckStore.getState().decks[deckId].pitchRate;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const pitchRate = state.decks[deckId].pitchRate;
      if (pitchRate === prevPitchRate) return;
      prevPitchRate = pitchRate;

      if (!playerRef.current || !isReadyRef.current) return;
      playerRef.current.setPlaybackRate(pitchRate);
    });

    return unsubscribe;
  }, [deckId]);

  // --- React to volume changes ------------------------------------------------
  // Apply the new volume whenever the deck volume changes in the store.

  useEffect(() => {
    let prevVolume = useDeckStore.getState().decks[deckId].volume;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const volume = state.decks[deckId].volume;
      if (volume === prevVolume) return;
      prevVolume = volume;

      if (!playerRef.current || !isReadyRef.current) return;
      playerRef.current.setVolume(volume);
    });

    return unsubscribe;
  }, [deckId]);

  // --- React to playbackState commands from the store -------------------------
  // This allows other parts of the app (e.g. keyboard shortcuts, deck controls)
  // to issue play/pause commands by updating the store directly.
  // The onStateChange event from the player will update the store back when
  // the command is acknowledged by YouTube — preventing loops because we only
  // react to changes where the value actually differs from the previous value.

  useEffect(() => {
    let prevPlaybackState = useDeckStore.getState().decks[deckId].playbackState;

    const unsubscribe = useDeckStore.subscribe((state) => {
      const { playbackState, volume } = state.decks[deckId];
      if (playbackState === prevPlaybackState) return;
      prevPlaybackState = playbackState;

      if (!playerRef.current) {
        console.warn(`[YTPlayer ${deckId}] playbackState→${playbackState}: playerRef is null`);
        return;
      }
      if (!isReadyRef.current) {
        console.warn(`[YTPlayer ${deckId}] playbackState→${playbackState}: player not ready yet`);
        return;
      }
      console.debug(`[YTPlayer ${deckId}] playbackState→${playbackState}`);

      if (playbackState === 'playing') {
        // On first play, ensure the player volume matches the deck store value.
        // Subsequent volume changes are handled by the volume subscription.
        if (!hasPlayedRef.current) {
          hasPlayedRef.current = true;
          playerRef.current.setVolume(volume);
        }
        // Always unmute before playing. The browser autoplay policy and YouTube's
        // own internal state can both leave the player muted — without this call
        // playVideo() runs but no audio is produced.
        playerRef.current.unMute();
        playerRef.current.playVideo();
        // Start the poll immediately so the time display begins incrementing
        // without waiting for YouTube's async PLAYING state-change event.
        startCurrentTimePoll();
      } else if (playbackState === 'paused') {
        playerRef.current.pauseVideo();
        stopCurrentTimePoll();
      }
    });

    return unsubscribe;
  }, [deckId]);

  return { playerRef };
}
