/**
 * YouTubePlayer.tsx — Hidden IFrame API wrapper component.
 *
 * Renders a 1×1 pixel container div that hosts the YouTube IFrame player.
 * The element must remain in the DOM at all times for two reasons:
 *   1. YouTube's Terms of Service require the player to be rendered.
 *   2. display:none prevents the IFrame from loading; opacity/size tricks keep it present.
 *
 * The actual YT.Player instance is managed by the useYouTubePlayer hook, which
 * is owned here. This component acts as the mount point for the player lifecycle.
 */
import { useRef } from 'react';
import { useYouTubePlayer } from '../../hooks/useYouTubePlayer';

interface YouTubePlayerProps {
  /** Which deck this player belongs to. Determines the container id and store slice. */
  deckId: 'A' | 'B';
}

/**
 * Invisible but DOM-present YouTube IFrame player.
 *
 * Position absolute + opacity 0.01 ensures:
 * - Present in the DOM (required by YouTube ToS and IFrame API).
 * - Not visible to the user.
 * - Not interfering with layout (pointerEvents: none).
 * - Not read by assistive technologies (aria-hidden).
 */
export function YouTubePlayer({ deckId }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Hook manages the YT.Player lifecycle. We pass containerRef so the hook
  // can mount the IFrame into the correct DOM node.
  // The playerRef is not consumed here — all controls are driven via deckStore.
  useYouTubePlayer(deckId, containerRef);

  return (
    <div
      ref={containerRef}
      id={`yt-player-${deckId.toLowerCase()}`}
      style={{
        width: 1,
        height: 1,
        position: 'absolute',
        opacity: 0.01,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    />
  );
}

export default YouTubePlayer;
