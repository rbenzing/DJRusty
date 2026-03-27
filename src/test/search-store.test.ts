/**
 * search-store.test.ts — Unit tests for useSearchStore actions.
 *
 * Tests cover:
 *   - Initial state
 *   - setQuery
 *   - setResults (replaces results, clears error)
 *   - appendResults (concatenates, updates nextPageToken)
 *   - setLoading
 *   - setError (sets message, clears loading)
 *   - clearResults
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useSearchStore } from '../store/searchStore';
import type { TrackSummary } from '../types/search';

/** Fixture video summary for use across tests. */
function makeVideo(id: string): TrackSummary {
  return {
    sourceType: 'youtube',
    videoId: id,
    title: `Track ${id}`,
    artist: `Artist ${id}`,
    duration: 180,
    thumbnailUrl: `https://example.com/thumb/${id}.jpg`,
  };
}

/** Reset store to initial state before each test. */
beforeEach(() => {
  useSearchStore.setState({
    query: '',
    results: [],
    nextPageToken: null,
    loading: false,
    error: null,
  });
});

describe('useSearchStore — initial state', () => {
  it('starts with an empty query string', () => {
    expect(useSearchStore.getState().query).toBe('');
  });

  it('starts with an empty results array', () => {
    expect(useSearchStore.getState().results).toEqual([]);
  });

  it('starts with nextPageToken as null', () => {
    expect(useSearchStore.getState().nextPageToken).toBeNull();
  });

  it('starts with loading false', () => {
    expect(useSearchStore.getState().loading).toBe(false);
  });

  it('starts with error as null', () => {
    expect(useSearchStore.getState().error).toBeNull();
  });
});

describe('setQuery', () => {
  it('updates the query string', () => {
    act(() => {
      useSearchStore.getState().setQuery('house music');
    });

    expect(useSearchStore.getState().query).toBe('house music');
  });

  it('can set an empty query', () => {
    act(() => {
      useSearchStore.getState().setQuery('something');
      useSearchStore.getState().setQuery('');
    });

    expect(useSearchStore.getState().query).toBe('');
  });
});

describe('setResults', () => {
  it('replaces results with the provided array', () => {
    const videos = [makeVideo('aaa'), makeVideo('bbb')];

    act(() => {
      useSearchStore.getState().setResults(videos, null);
    });

    const { results } = useSearchStore.getState();
    expect(results).toHaveLength(2);
    const [first, second] = results;
    expect(first?.videoId).toBe('aaa');
    expect(second?.videoId).toBe('bbb');
  });

  it('stores the nextPageToken when provided', () => {
    act(() => {
      useSearchStore.getState().setResults([makeVideo('x')], 'PAGE_TOKEN_1');
    });

    expect(useSearchStore.getState().nextPageToken).toBe('PAGE_TOKEN_1');
  });

  it('sets nextPageToken to null when no more pages', () => {
    act(() => {
      useSearchStore.getState().setResults([makeVideo('x')], 'TOKEN');
      useSearchStore.getState().setResults([makeVideo('y')], null);
    });

    expect(useSearchStore.getState().nextPageToken).toBeNull();
  });

  it('clears any existing error when results arrive', () => {
    act(() => {
      useSearchStore.getState().setError('Previous error');
      useSearchStore.getState().setResults([makeVideo('z')], null);
    });

    expect(useSearchStore.getState().error).toBeNull();
  });

  it('replaces previous results entirely', () => {
    act(() => {
      useSearchStore.getState().setResults([makeVideo('old1'), makeVideo('old2')], null);
      useSearchStore.getState().setResults([makeVideo('new1')], null);
    });

    const { results } = useSearchStore.getState();
    expect(results).toHaveLength(1);
    const [first] = results;
    expect(first?.videoId).toBe('new1');
  });
});

describe('appendResults', () => {
  it('appends results to existing results', () => {
    act(() => {
      useSearchStore.getState().setResults([makeVideo('p1')], 'TOKEN_A');
      useSearchStore.getState().appendResults([makeVideo('p2'), makeVideo('p3')], null);
    });

    const { results } = useSearchStore.getState();
    expect(results).toHaveLength(3);
    const [first, second, third] = results;
    expect(first?.videoId).toBe('p1');
    expect(second?.videoId).toBe('p2');
    expect(third?.videoId).toBe('p3');
  });

  it('updates nextPageToken after appending', () => {
    act(() => {
      useSearchStore.getState().setResults([makeVideo('a')], 'TOKEN_A');
      useSearchStore.getState().appendResults([makeVideo('b')], 'TOKEN_B');
    });

    expect(useSearchStore.getState().nextPageToken).toBe('TOKEN_B');
  });

  it('sets nextPageToken to null when last page appended', () => {
    act(() => {
      useSearchStore.getState().setResults([makeVideo('a')], 'TOKEN_A');
      useSearchStore.getState().appendResults([makeVideo('b')], null);
    });

    expect(useSearchStore.getState().nextPageToken).toBeNull();
  });
});

describe('setLoading', () => {
  it('sets loading to true', () => {
    act(() => {
      useSearchStore.getState().setLoading(true);
    });

    expect(useSearchStore.getState().loading).toBe(true);
  });

  it('sets loading to false', () => {
    act(() => {
      useSearchStore.getState().setLoading(true);
      useSearchStore.getState().setLoading(false);
    });

    expect(useSearchStore.getState().loading).toBe(false);
  });
});

describe('setError', () => {
  it('stores an error message', () => {
    act(() => {
      useSearchStore.getState().setError('YouTube API quota exceeded. Try again tomorrow.');
    });

    expect(useSearchStore.getState().error).toBe(
      'YouTube API quota exceeded. Try again tomorrow.',
    );
  });

  it('clears the loading flag when an error is set', () => {
    act(() => {
      useSearchStore.getState().setLoading(true);
      useSearchStore.getState().setError('Network error');
    });

    expect(useSearchStore.getState().loading).toBe(false);
  });

  it('can clear an error by passing null', () => {
    act(() => {
      useSearchStore.getState().setError('Some error');
      useSearchStore.getState().setError(null);
    });

    expect(useSearchStore.getState().error).toBeNull();
  });

  it('handles quota exceeded error message', () => {
    act(() => {
      useSearchStore.getState().setError('YouTube API quota exceeded. Try again tomorrow.');
    });

    expect(useSearchStore.getState().error).toContain('quota exceeded');
  });
});

describe('clearResults', () => {
  it('empties the results array', () => {
    act(() => {
      useSearchStore.getState().setResults([makeVideo('a'), makeVideo('b')], 'TOKEN');
      useSearchStore.getState().clearResults();
    });

    expect(useSearchStore.getState().results).toHaveLength(0);
  });

  it('clears the nextPageToken', () => {
    act(() => {
      useSearchStore.getState().setResults([makeVideo('a')], 'TOKEN');
      useSearchStore.getState().clearResults();
    });

    expect(useSearchStore.getState().nextPageToken).toBeNull();
  });

  it('clears any existing error', () => {
    act(() => {
      useSearchStore.getState().setError('Something went wrong');
      useSearchStore.getState().clearResults();
    });

    expect(useSearchStore.getState().error).toBeNull();
  });

  it('does not affect the loading flag', () => {
    act(() => {
      useSearchStore.getState().setLoading(true);
      useSearchStore.getState().clearResults();
    });

    // clearResults is about results, not loading — loading remains unchanged.
    expect(useSearchStore.getState().loading).toBe(true);
  });
});
