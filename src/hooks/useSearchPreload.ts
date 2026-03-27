/**
 * useSearchPreload.ts — Background genre search pre-loader.
 *
 * Pre-loads 5 genre queries into the localStorage search cache immediately
 * after the user signs in. Queries execute sequentially (not in parallel) to
 * avoid bursting 5 simultaneous YouTube API requests.
 *
 * Design decisions:
 *   - hasFiredRef ensures the pre-load fires at most once per component
 *     lifecycle (session), even if signedIn toggles due to token refresh.
 *   - The access token is read fresh inside the loop because it may refresh
 *     mid-sequence on long pre-loads.
 *   - All errors per query are silently swallowed — pre-load failure is non-fatal.
 *   - No store state is updated during pre-load; only the cache utility is written to.
 *
 * Mount this hook once at the app root (App.tsx).
 *
 * STORY-SEARCH-001
 */

import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { searchVideos } from '../services/youtubeDataApi';
import { setCached } from '../utils/searchCache';
import { PRELOAD_QUERIES } from '../constants/api';

/**
 * Pre-loads genre search results into the localStorage cache
 * when the user signs in. Fires at most once per component
 * lifecycle (session). All errors are silently swallowed.
 */
export function useSearchPreload(): void {
  const signedIn = useAuthStore((s) => s.signedIn);
  const hasFiredRef = useRef(false);

  useEffect(() => {
    if (!signedIn || hasFiredRef.current) return;
    hasFiredRef.current = true;

    // Fire-and-forget — async IIFE that never rejects
    void (async () => {
      for (const query of PRELOAD_QUERIES) {
        try {
          const token = useAuthStore.getState().accessToken;
          const { results } = await searchVideos(query, token);
          setCached(query, results);
        } catch {
          // Silently swallow — pre-load failure is non-fatal
        }
      }
    })();
  }, [signedIn]);
}
