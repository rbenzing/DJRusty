/**
 * useKeyboardShortcuts.ts — Global keyboard shortcut bindings for DJ Rusty.
 *
 * Implemented in STORY-DJ-004. Registers a single keydown listener on document
 * that handles play/pause, cue, beat jump, hot cues, and tap tempo for both decks.
 *
 * Design notes:
 * - Uses useDeckStore.getState() inside the handler to read live state at keypress time,
 *   avoiding stale closure issues that Zustand selectors would introduce with empty deps [].
 * - TapTempoCalculator instances are held in useRef so they persist across renders
 *   but are scoped to the component lifecycle (not module-global).
 * - preventDefault is called for Space and Enter to suppress browser scroll / form submit.
 * - Shortcuts are suppressed when focus is on an INPUT or TEXTAREA element.
 */

import { useEffect, useRef } from 'react';
import { useDeckStore } from '../store/deckStore';
import { playerRegistry } from '../services/playerRegistry';
import { TapTempoCalculator } from '../utils/tapTempo';
import { setHotCue as persistSetHotCue } from '../utils/hotCues';
import { calculateJumpSeconds, clampTime } from '../utils/beatJump';

/** Elements that should suppress all keyboard shortcuts (user is typing). */
const FOCUSABLE_TAGS = new Set(['INPUT', 'TEXTAREA']);

/**
 * Registers global keyboard shortcuts for deck transport, cue, beat jump,
 * hot cues, and tap tempo. Mount exactly once at the application root.
 */
export function useKeyboardShortcuts(): void {
  const tapTempoARef = useRef(new TapTempoCalculator());
  const tapTempoBRef = useRef(new TapTempoCalculator());

  useEffect(() => {
    /**
     * Perform a beat jump for the given deck in the given direction.
     * Reads the deck's beatJumpSize and bpm at call time.
     * No-op if bpm is null or no track is loaded.
     */
    function beatJump(deckId: 'A' | 'B', direction: 1 | -1): void {
      const deck = useDeckStore.getState().decks[deckId];
      if (deck.bpm === null || !deck.trackId) return;
      const jumpSeconds = calculateJumpSeconds(deck.beatJumpSize, deck.bpm);
      const newTime = deck.currentTime + direction * jumpSeconds;
      const clamped = clampTime(newTime, deck.duration);
      playerRegistry.get(deckId)?.seekTo(clamped, true);
    }

    function handleKeyDown(e: KeyboardEvent): void {
      // Guard: ignore shortcuts when the user is typing in a text field.
      const target = e.target as Element;
      if (FOCUSABLE_TAGS.has(target.tagName)) return;

      // Read live state snapshot at time of keypress — avoids stale closures.
      const state = useDeckStore.getState();
      const deckA = state.decks.A;
      const deckB = state.decks.B;

      switch (e.key) {
        // -----------------------------------------------------------------------
        // Play / Pause
        // -----------------------------------------------------------------------
        case ' ': {
          e.preventDefault();
          if (deckA.trackId === null) break;
          state.setPlaybackState('A', deckA.playbackState === 'playing' ? 'paused' : 'playing');
          break;
        }

        case 'Enter': {
          e.preventDefault();
          if (deckB.trackId === null) break;
          state.setPlaybackState('B', deckB.playbackState === 'playing' ? 'paused' : 'playing');
          break;
        }

        // -----------------------------------------------------------------------
        // Jump to Cue (hotCues[0])
        // -----------------------------------------------------------------------
        case 'q': {
          const cueA = deckA.hotCues[0];
          if (cueA !== undefined) {
            playerRegistry.get('A')?.seekTo(cueA, true);
          }
          break;
        }

        case 'w': {
          const cueB = deckB.hotCues[0];
          if (cueB !== undefined) {
            playerRegistry.get('B')?.seekTo(cueB, true);
          }
          break;
        }

        // -----------------------------------------------------------------------
        // Set Cue (store currentTime as hotCues[0] + persist to localStorage)
        // -----------------------------------------------------------------------
        case 'a': {
          if (deckA.trackId !== null) {
            state.setHotCue('A', 0, deckA.currentTime);
            persistSetHotCue(deckA.trackId, 0, deckA.currentTime);
          }
          break;
        }

        case 's': {
          if (deckB.trackId !== null) {
            state.setHotCue('B', 0, deckB.currentTime);
            persistSetHotCue(deckB.trackId, 0, deckB.currentTime);
          }
          break;
        }

        // -----------------------------------------------------------------------
        // Beat Jump — Deck A
        // -----------------------------------------------------------------------
        case 'ArrowLeft': {
          e.preventDefault();
          beatJump('A', -1);
          break;
        }

        case 'ArrowRight': {
          e.preventDefault();
          beatJump('A', 1);
          break;
        }

        // -----------------------------------------------------------------------
        // Beat Jump — Deck B
        // -----------------------------------------------------------------------
        case ',': {
          beatJump('B', -1);
          break;
        }

        case '.': {
          beatJump('B', 1);
          break;
        }

        // -----------------------------------------------------------------------
        // Hot Cue Jumps — Deck A (keys 1–4 → indices 0–3)
        // -----------------------------------------------------------------------
        case '1':
        case '2':
        case '3':
        case '4': {
          const indexA = Number(e.key) - 1;
          const timestampA = deckA.hotCues[indexA];
          if (timestampA !== undefined) {
            playerRegistry.get('A')?.seekTo(timestampA, true);
          }
          break;
        }

        // -----------------------------------------------------------------------
        // Hot Cue Jumps — Deck B (keys 5–8 → indices 0–3)
        // -----------------------------------------------------------------------
        case '5':
        case '6':
        case '7':
        case '8': {
          const indexB = Number(e.key) - 5;
          const timestampB = deckB.hotCues[indexB];
          if (timestampB !== undefined) {
            playerRegistry.get('B')?.seekTo(timestampB, true);
          }
          break;
        }

        // -----------------------------------------------------------------------
        // Tap Tempo
        // -----------------------------------------------------------------------
        case 't': {
          const bpmA = tapTempoARef.current.tap();
          if (bpmA !== null) {
            state.setBpm('A', bpmA);
          }
          break;
        }

        case 'y': {
          const bpmB = tapTempoBRef.current.tap();
          if (bpmB !== null) {
            state.setBpm('B', bpmB);
          }
          break;
        }

        default:
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}
