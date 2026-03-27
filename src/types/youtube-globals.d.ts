/**
 * youtube-globals.d.ts — Window interface augmentation for YouTube IFrame API globals.
 *
 * The YouTube IFrame API sets `window.onYouTubeIframeAPIReady` as its initialisation
 * callback and `window.YT` as its namespace. The `@types/youtube` package provides
 * the `YT` namespace types but does not augment the Window interface for these globals.
 */

declare interface Window {
  /**
   * Called by the YouTube IFrame API script when it has finished loading.
   * The application sets this before injecting the script tag.
   */
  onYouTubeIframeAPIReady?: () => void;
  /**
   * The YouTube IFrame API namespace — undefined until the API script has loaded.
   */
  YT: typeof YT | undefined;
}
