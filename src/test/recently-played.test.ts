/**
 * recently-played.test.ts — Unit tests for the recentlyPlayed localStorage utility.
 *
 * Covers: addRecentTrack, getRecentTracks, clearRecentTracks.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  addRecentTrack,
  getRecentTracks,
  clearRecentTracks,
  type RecentTrack,
} from '../utils/recentlyPlayed';

const STORAGE_KEY = 'dj-rusty-recently-played';

/** Factory for a minimal valid RecentTrack. */
function makeTrack(videoId: string, overrides: Partial<RecentTrack> = {}): RecentTrack {
  return {
    videoId,
    title: `Track ${videoId}`,
    channelTitle: 'Test Channel',
    duration: 180,
    thumbnailUrl: `https://example.com/${videoId}.jpg`,
    loadedAt: 1_700_000_000_000 + parseInt(videoId.replace(/\D/g, '') || '0', 10),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// getRecentTracks
// ---------------------------------------------------------------------------

describe('getRecentTracks', () => {
  it('returns an empty array when localStorage has no entry', () => {
    expect(getRecentTracks()).toEqual([]);
  });

  it('returns stored tracks in order', () => {
    const tracks = [makeTrack('vid1'), makeTrack('vid2')];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
    expect(getRecentTracks()).toEqual(tracks);
  });

  it('returns an empty array when localStorage contains malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json{{');
    expect(getRecentTracks()).toEqual([]);
  });

  it('returns an empty array when the stored value is an empty JSON array', () => {
    localStorage.setItem(STORAGE_KEY, '[]');
    expect(getRecentTracks()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// addRecentTrack
// ---------------------------------------------------------------------------

describe('addRecentTrack', () => {
  it('adds a track to an empty list', () => {
    const track = makeTrack('abc');
    addRecentTrack(track);
    expect(getRecentTracks()).toEqual([track]);
  });

  it('prepends a new track to the front of the list', () => {
    const first = makeTrack('first');
    const second = makeTrack('second');
    addRecentTrack(first);
    addRecentTrack(second);
    const result = getRecentTracks();
    expect(result[0]!.videoId).toBe('second');
    expect(result[1]!.videoId).toBe('first');
  });

  it('deduplicates: moves an existing track to the front instead of creating a duplicate', () => {
    addRecentTrack(makeTrack('a'));
    addRecentTrack(makeTrack('b'));
    addRecentTrack(makeTrack('a')); // 'a' already in list — should move to front
    const result = getRecentTracks();
    expect(result.length).toBe(2);
    expect(result[0]!.videoId).toBe('a');
    expect(result[1]!.videoId).toBe('b');
  });

  it('updates the loadedAt timestamp when a duplicate is added', () => {
    const original = makeTrack('x', { loadedAt: 1000 });
    const updated = makeTrack('x', { loadedAt: 9999 });
    addRecentTrack(original);
    addRecentTrack(updated);
    const result = getRecentTracks();
    expect(result[0]!.loadedAt).toBe(9999);
  });

  it('caps the list at 10 entries', () => {
    for (let i = 0; i < 12; i++) {
      addRecentTrack(makeTrack(`vid${i}`));
    }
    expect(getRecentTracks().length).toBe(10);
  });

  it('retains the most recently added tracks when the cap is reached', () => {
    for (let i = 0; i < 12; i++) {
      addRecentTrack(makeTrack(`vid${i}`));
    }
    const result = getRecentTracks();
    // The last two added (vid10 and vid11) should be at the front.
    expect(result[0]!.videoId).toBe('vid11');
    expect(result[1]!.videoId).toBe('vid10');
    // vid0 and vid1 (the oldest) should be dropped.
    const ids = result.map((t) => t.videoId);
    expect(ids).not.toContain('vid0');
    expect(ids).not.toContain('vid1');
  });

  it('does not throw when localStorage.setItem throws (quota exceeded)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => addRecentTrack(makeTrack('quota'))).not.toThrow();
  });

  it('stores all required fields on the track', () => {
    const track = makeTrack('complete', {
      title: 'My Song',
      channelTitle: 'My Channel',
      duration: 240,
      thumbnailUrl: 'https://img.example.com/thumb.jpg',
      loadedAt: 1234567890,
    });
    addRecentTrack(track);
    const stored = getRecentTracks()[0]!;
    expect(stored.title).toBe('My Song');
    expect(stored.channelTitle).toBe('My Channel');
    expect(stored.duration).toBe(240);
    expect(stored.thumbnailUrl).toBe('https://img.example.com/thumb.jpg');
    expect(stored.loadedAt).toBe(1234567890);
  });
});

// ---------------------------------------------------------------------------
// clearRecentTracks
// ---------------------------------------------------------------------------

describe('clearRecentTracks', () => {
  it('clears all stored tracks', () => {
    addRecentTrack(makeTrack('a'));
    addRecentTrack(makeTrack('b'));
    clearRecentTracks();
    expect(getRecentTracks()).toEqual([]);
  });

  it('does not throw when the list is already empty', () => {
    expect(() => clearRecentTracks()).not.toThrow();
  });

  it('does not throw when localStorage.removeItem throws', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
      throw new Error('SecurityError');
    });
    expect(() => clearRecentTracks()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Integration: round-trip behaviour
// ---------------------------------------------------------------------------

describe('recentlyPlayed integration', () => {
  it('round-trips multiple add → get → clear correctly', () => {
    addRecentTrack(makeTrack('t1'));
    addRecentTrack(makeTrack('t2'));
    addRecentTrack(makeTrack('t3'));

    let result = getRecentTracks();
    expect(result.map((t) => t.videoId)).toEqual(['t3', 't2', 't1']);

    // Re-adding 't1' moves it to the front.
    addRecentTrack(makeTrack('t1', { loadedAt: 9000 }));
    result = getRecentTracks();
    expect(result.map((t) => t.videoId)).toEqual(['t1', 't3', 't2']);

    clearRecentTracks();
    expect(getRecentTracks()).toEqual([]);
  });
});
