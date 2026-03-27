/**
 * searchCache.ts — localStorage-backed search result cache.
 *
 * Keys are stored under the prefix `djrusty:search:` with the normalised
 * (lowercased, trimmed) query as the suffix.
 *
 * Features:
 *   - 60-minute TTL per entry
 *   - LRU eviction when the cache exceeds 20 entries (oldest cachedAt removed)
 *   - Silent degradation: all localStorage access is wrapped in try/catch
 *   - Corrupt or expired entries are treated as cache misses
 *
 * STORY-SEARCH-001
 */

import type { TrackSummary } from '../types/search';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_MAX_ENTRIES = 20;
const CACHE_KEY_PREFIX = 'djrusty:search:';

interface SearchCacheEntry {
  results: TrackSummary[];
  cachedAt: number;
}

/**
 * Normalise a search query for use as a cache key.
 * Lowercases and trims whitespace.
 */
export function normaliseQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * Retrieve cached search results for the given query.
 * Returns null on cache miss, expired entry, parse error, or localStorage failure.
 */
export function getCached(query: string): TrackSummary[] | null {
  try {
    const key = CACHE_KEY_PREFIX + normaliseQuery(query);
    const raw = localStorage.getItem(key);
    if (raw === null) return null;

    const entry = JSON.parse(raw) as SearchCacheEntry;

    // Validate shape
    if (typeof entry.cachedAt !== 'number' || !Array.isArray(entry.results)) {
      return null;
    }

    // Check TTL
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      return null;
    }

    return entry.results;
  } catch {
    return null;
  }
}

/**
 * Write search results to the cache for the given query.
 * Evicts the oldest entry (by cachedAt) if the cache exceeds CACHE_MAX_ENTRIES.
 * Silently no-ops on localStorage failure.
 */
export function setCached(query: string, results: TrackSummary[]): void {
  try {
    const key = CACHE_KEY_PREFIX + normaliseQuery(query);
    const entry: SearchCacheEntry = { results, cachedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
    evictIfOverLimit();
  } catch {
    // localStorage unavailable or quota exceeded — silently no-op
  }
}

/**
 * Remove all localStorage keys that start with the CACHE_KEY_PREFIX.
 * Silently no-ops on localStorage failure.
 */
export function clearSearchCache(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // localStorage unavailable — silently no-op
  }
}

/**
 * Evict the oldest cache entry if the number of entries exceeds CACHE_MAX_ENTRIES.
 * Corrupt entries (unparseable) are treated as having the lowest cachedAt (evicted first).
 */
function evictIfOverLimit(): void {
  try {
    const cacheKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_KEY_PREFIX)) {
        cacheKeys.push(key);
      }
    }

    if (cacheKeys.length <= CACHE_MAX_ENTRIES) return;

    // Find the key with the lowest cachedAt (oldest), or a corrupt entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const key of cacheKeys) {
      const time = getCachedAt(key);
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      localStorage.removeItem(oldestKey);
    }
  } catch {
    // localStorage unavailable — silently no-op
  }
}

/**
 * Read the cachedAt timestamp for a given localStorage key.
 * Returns 0 (treat as oldest) if the entry is missing or corrupt.
 */
function getCachedAt(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return 0;
    const entry = JSON.parse(raw) as SearchCacheEntry;
    return typeof entry.cachedAt === 'number' ? entry.cachedAt : 0;
  } catch {
    return 0;
  }
}
