/**
 * hot-cues.test.ts — Unit tests for hotCues localStorage utilities.
 *
 * Tests cover: getHotCues, setHotCue, clearHotCue.
 * Each test starts with a clean localStorage state via beforeEach.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getHotCues, setHotCue, clearHotCue } from '../utils/hotCues';

const STORAGE_KEY = 'dj-rusty-hot-cues';

// Use a simple in-memory store for localStorage in the test environment.
beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// getHotCues
// ---------------------------------------------------------------------------

describe('getHotCues', () => {
  it('returns an empty object when localStorage has no data', () => {
    const result = getHotCues('abc123');
    expect(result).toEqual({});
  });

  it('returns an empty object when the videoId has no cues stored', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ other_video: { 0: 12.5 } }));
    const result = getHotCues('abc123');
    expect(result).toEqual({});
  });

  it('returns stored cues for the requested videoId', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ abc123: { 0: 10, 1: 25.5 } }),
    );
    const result = getHotCues('abc123');
    expect(result).toEqual({ 0: 10, 1: 25.5 });
  });

  it('returns only cues for the requested videoId, not others', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        abc123: { 0: 10 },
        xyz789: { 0: 99 },
      }),
    );
    expect(getHotCues('abc123')).toEqual({ 0: 10 });
    expect(getHotCues('xyz789')).toEqual({ 0: 99 });
  });

  it('returns an empty object when localStorage contains malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json');
    expect(getHotCues('abc123')).toEqual({});
  });

  it('returns cues with multiple indices', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ vid: { 0: 0, 1: 30.75, 2: 61.0, 3: 120.5 } }),
    );
    expect(getHotCues('vid')).toEqual({ 0: 0, 1: 30.75, 2: 61.0, 3: 120.5 });
  });
});

// ---------------------------------------------------------------------------
// setHotCue
// ---------------------------------------------------------------------------

describe('setHotCue', () => {
  it('stores a cue for a videoId not previously in localStorage', () => {
    setHotCue('abc123', 0, 15.0);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Record<number, number>>;
    expect(stored['abc123']?.[0]).toBe(15.0);
  });

  it('stores multiple cues for the same videoId', () => {
    setHotCue('abc123', 0, 10.0);
    setHotCue('abc123', 1, 20.0);
    setHotCue('abc123', 2, 30.0);
    const result = getHotCues('abc123');
    expect(result).toEqual({ 0: 10.0, 1: 20.0, 2: 30.0 });
  });

  it('overwrites an existing cue at the same index', () => {
    setHotCue('abc123', 0, 10.0);
    setHotCue('abc123', 0, 99.5);
    const result = getHotCues('abc123');
    expect(result[0]).toBe(99.5);
  });

  it('does not affect cues for other videoIds', () => {
    setHotCue('vid1', 0, 5.0);
    setHotCue('vid2', 0, 50.0);
    expect(getHotCues('vid1')[0]).toBe(5.0);
    expect(getHotCues('vid2')[0]).toBe(50.0);
  });

  it('preserves existing cues when adding a new one', () => {
    setHotCue('abc123', 0, 10.0);
    setHotCue('abc123', 1, 20.0);
    // Only index 2 added — 0 and 1 should still be present.
    setHotCue('abc123', 2, 30.0);
    const result = getHotCues('abc123');
    expect(result[0]).toBe(10.0);
    expect(result[1]).toBe(20.0);
    expect(result[2]).toBe(30.0);
  });

  it('stores a cue with a timestamp of 0', () => {
    setHotCue('abc123', 0, 0);
    expect(getHotCues('abc123')[0]).toBe(0);
  });

  it('handles localStorage setItem throwing (quota exceeded)', () => {
    const originalSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    // Should not throw
    expect(() => setHotCue('abc123', 0, 10.0)).not.toThrow();
    // Restore
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(originalSetItem);
  });
});

// ---------------------------------------------------------------------------
// clearHotCue
// ---------------------------------------------------------------------------

describe('clearHotCue', () => {
  it('removes a specific cue index for a videoId', () => {
    setHotCue('abc123', 0, 10.0);
    setHotCue('abc123', 1, 20.0);
    clearHotCue('abc123', 0);
    const result = getHotCues('abc123');
    expect(result[0]).toBeUndefined();
    expect(result[1]).toBe(20.0);
  });

  it('does nothing when the videoId has no cues', () => {
    // No cues set for 'abc123' — should not throw
    expect(() => clearHotCue('abc123', 0)).not.toThrow();
    expect(getHotCues('abc123')).toEqual({});
  });

  it('does nothing when localStorage is empty', () => {
    expect(() => clearHotCue('abc123', 0)).not.toThrow();
  });

  it('does not affect cues at other indices for the same videoId', () => {
    setHotCue('vid', 0, 5.0);
    setHotCue('vid', 1, 10.0);
    setHotCue('vid', 2, 15.0);
    clearHotCue('vid', 1);
    const result = getHotCues('vid');
    expect(result[0]).toBe(5.0);
    expect(result[1]).toBeUndefined();
    expect(result[2]).toBe(15.0);
  });

  it('does not affect cues for other videoIds', () => {
    setHotCue('vid1', 0, 10.0);
    setHotCue('vid2', 0, 20.0);
    clearHotCue('vid1', 0);
    expect(getHotCues('vid1')[0]).toBeUndefined();
    expect(getHotCues('vid2')[0]).toBe(20.0);
  });

  it('handles a cue index that was never set', () => {
    setHotCue('abc123', 0, 10.0);
    // Index 3 was never set — should not throw or corrupt data
    expect(() => clearHotCue('abc123', 3)).not.toThrow();
    expect(getHotCues('abc123')[0]).toBe(10.0);
  });

  it('leaves an empty object for the videoId after clearing the last cue', () => {
    setHotCue('abc123', 0, 10.0);
    clearHotCue('abc123', 0);
    const result = getHotCues('abc123');
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Integration: getHotCues reflects setHotCue + clearHotCue sequence
// ---------------------------------------------------------------------------

describe('hotCues integration', () => {
  it('round-trips set → get → clear → get correctly', () => {
    setHotCue('track1', 0, 12.5);
    setHotCue('track1', 1, 25.0);

    expect(getHotCues('track1')).toEqual({ 0: 12.5, 1: 25.0 });

    clearHotCue('track1', 0);
    expect(getHotCues('track1')).toEqual({ 1: 25.0 });

    clearHotCue('track1', 1);
    expect(getHotCues('track1')).toEqual({});
  });

  it('multiple videoIds coexist correctly in localStorage', () => {
    setHotCue('track1', 0, 1.0);
    setHotCue('track2', 0, 2.0);
    setHotCue('track3', 0, 3.0);

    clearHotCue('track2', 0);

    expect(getHotCues('track1')[0]).toBe(1.0);
    expect(getHotCues('track2')).toEqual({});
    expect(getHotCues('track3')[0]).toBe(3.0);
  });
});
