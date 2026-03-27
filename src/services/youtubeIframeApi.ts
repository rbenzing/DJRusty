/**
 * youtubeIframeApi.ts — YouTube IFrame API singleton loader.
 * Stub for STORY-001. Full implementation in STORY-003.
 *
 * Loads the IFrame API script once and returns a Promise that resolves
 * when YT.Player is available for use.
 */
import { YOUTUBE_IFRAME_API_URL } from '../constants/api';

let apiReadyPromise: Promise<void> | null = null;

/**
 * Loads the YouTube IFrame API script exactly once.
 * Safe to call multiple times — subsequent calls return the same promise.
 *
 * @returns A Promise that resolves when the YT.Player constructor is available.
 */
export function loadYouTubeIframeApi(): Promise<void> {
  if (apiReadyPromise) return apiReadyPromise;

  apiReadyPromise = new Promise((resolve) => {
    // Already loaded (e.g. hot reload)
    if (window.YT?.Player) {
      resolve();
      return;
    }

    // Safe append: preserve any existing onYouTubeIframeAPIReady callback
    const existing = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      existing?.();
      resolve();
    };

    const script = document.createElement('script');
    script.src = YOUTUBE_IFRAME_API_URL;
    script.async = true;
    document.head.appendChild(script);
  });

  return apiReadyPromise;
}

/**
 * Resets the singleton promise — for use in tests only.
 */
export function _resetApiPromise(): void {
  apiReadyPromise = null;
}
