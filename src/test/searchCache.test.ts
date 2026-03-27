/**
 * searchCache.test.ts — Unit tests for the search cache utility.
 *
 * Covers STORY-SEARCH-001 acceptance criteria:
 * - normaliseQuery lowercases and trims
 * - getCached returns null on empty cache
 * - getCached returns results for valid cached entry
 * - getCached is case/trim-insensitive (normalises keys)
 * - getCached returns null for expired entries
 * - getCached returns results for entries within TTL
 * - getCached returns null for corrupted JSON (no throw)
 * - getCached returns null when localStorage throws (no throw)
 * - setCached writes to localStorage
 * - setCached evicts oldest entry when exceeding 20 entries
 * - setCached handles localStorage.setItem throwing (no throw)
 * - clearSearchCache removes only djrusty:search:* prefixed keys
 * - clearSearchCache handles localStorage failure (no throw)
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { normaliseQuery, getCached, setCached, clearSearchCache } from '../utils/searchCache';
import type { TrackSummary } from '../types/search';

const mockResults: TrackSummary[] = [
  {
    sourceType: 'youtube',
    videoId: 'abc123',
    title: 'Test DJ Mix',
    artist: 'Test Channel',
    duration: 3600,
    thumbnailUrl: 'https://i.ytimg.com/vi/abc123/mqdefault.jpg',
  },
  {
    sourceType: 'youtube',
    videoId: 'def456',
    title: 'Another Mix',
    artist: 'Another Channel',
    duration: 1800,
    thumbnailUrl: null,
  },
];

/** Clear all djrusty:search:* keys before each test. */
beforeEach(() => {
  clearSearchCache();
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// normaliseQuery
// ---------------------------------------------------------------------------

describe('normaliseQuery', () => {
  it('lowercases and trims the input', () => {
    expect(normaliseQuery('  House Music DJ Mix  ')).toBe('house music dj mix');
  });

  it('handles empty string', () => {
    expect(normaliseQuery('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// getCached
// ---------------------------------------------------------------------------

describe('getCached', () => {
  it('returns null on empty cache', () => {
    expect(getCached('techno DJ set')).toBeNull();
  });

  it('returns results for a valid cached entry', () => {
    setCached('techno DJ set', mockResults);
    const result = getCached('techno DJ set');
    expect(result).toEqual(mockResults);
  });

  it('is case-insensitive and trim-insensitive', () => {
    setCached('Techno DJ Set', mockResults);
    const result = getCached('  techno dj set  ');
    expect(result).toEqual(mockResults);
  });

  it('returns null for an expired entry (Date.now mocked 61 minutes ahead)', () => {
    setCached('query', mockResults);

    const sixtyOneMinutesMs = 61 * 60 * 1000;
    const originalNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(originalNow + sixtyOneMinutesMs);

    expect(getCached('query')).toBeNull();
  });

  it('returns results for an entry within the 60-minute TTL (59 minutes ahead)', () => {
    setCached('query', mockResults);

    const fiftyNineMinutesMs = 59 * 60 * 1000;
    const originalNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(originalNow + fiftyNineMinutesMs);

    expect(getCached('query')).toEqual(mockResults);
  });

  it('returns null for corrupted JSON without throwing', () => {
    localStorage.setItem('djrusty:search:badquery', '{not valid json');
    expect(() => getCached('badquery')).not.toThrow();
    expect(getCached('badquery')).toBeNull();
  });

  it('returns null when localStorage.getItem throws without throwing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });
    expect(() => getCached('query')).not.toThrow();
    expect(getCached('query')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setCached
// ---------------------------------------------------------------------------

describe('setCached', () => {
  it('writes results and cachedAt to localStorage', () => {
    setCached('my query', mockResults);
    const raw = localStorage.getItem('djrusty:search:my query');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { results: TrackSummary[]; cachedAt: number };
    expect(parsed.results).toEqual(mockResults);
    expect(typeof parsed.cachedAt).toBe('number');
  });

  it('evicts the oldest entry when exceeding 20 entries', () => {
    // Set up Date.now mock starting at a known timestamp so we can control order
    let currentTime = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime);

    // Write 20 entries, each with an incrementing timestamp
    for (let i = 1; i <= 20; i++) {
      currentTime = 1_000_000 + i * 1000;
      setCached(`query-${i}`, mockResults);
    }

    // Verify all 20 entries are present
    expect(localStorage.getItem('djrusty:search:query-1')).not.toBeNull();
    expect(localStorage.getItem('djrusty:search:query-20')).not.toBeNull();

    // Write the 21st entry — this should evict query-1 (lowest cachedAt)
    currentTime = 1_000_000 + 21 * 1000;
    setCached('query-21', mockResults);

    // The oldest entry (query-1) must be evicted
    expect(localStorage.getItem('djrusty:search:query-1')).toBeNull();

    // The newest entry (query-21) must be present
    expect(localStorage.getItem('djrusty:search:query-21')).not.toBeNull();

    // Total cache entries must be exactly 20
    let cacheKeyCount = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('djrusty:search:')) {
        cacheKeyCount++;
      }
    }
    expect(cacheKeyCount).toBe(20);
  });

  it('handles localStorage.setItem throwing without throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => setCached('query', mockResults)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// clearSearchCache
// ---------------------------------------------------------------------------

describe('clearSearchCache', () => {
  it('removes only djrusty:search:* prefixed keys, leaving other keys intact', () => {
    // Set up cache entries and a non-search key
    localStorage.setItem('djrusty:search:q1', JSON.stringify({ results: [], cachedAt: 1 }));
    localStorage.setItem('djrusty:search:q2', JSON.stringify({ results: [], cachedAt: 2 }));
    localStorage.setItem('djrusty_user_info', JSON.stringify({ name: 'DJ Rusty' }));

    clearSearchCache();

    expect(localStorage.getItem('djrusty:search:q1')).toBeNull();
    expect(localStorage.getItem('djrusty:search:q2')).toBeNull();
    expect(localStorage.getItem('djrusty_user_info')).toBe(JSON.stringify({ name: 'DJ Rusty' }));
  });

  it('handles localStorage.removeItem throwing without throwing', () => {
    localStorage.setItem('djrusty:search:q1', JSON.stringify({ results: [], cachedAt: 1 }));

    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('localStorage unavailable');
    });

    expect(() => clearSearchCache()).not.toThrow();
  });
});
