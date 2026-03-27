/**
 * playlist-store.test.ts — Unit tests for playlistStore.
 *
 * Tests cover:
 *   addTrack:
 *     - First track added cues into deck (loadTrack called with autoPlay=false)
 *     - Subsequent tracks queued, currentIndex unchanged
 *     - currentIndex set to 0 on first add
 *   removeTrack:
 *     - Removes by id
 *     - currentIndex decrements when removing a track before current
 *     - currentIndex stays same (clamped) when removing at current
 *     - currentIndex unchanged when removing after current
 *     - currentIndex becomes -1 when last track removed
 *   clearPlaylist:
 *     - Empties list and resets currentIndex to -1
 *   skipToNext:
 *     - Increments currentIndex and calls loadTrack with autoPlay=true
 *     - No-op at end of playlist
 *     - No-op when playlist empty
 *   skipToPrev:
 *     - Decrements currentIndex and calls loadTrack with autoPlay=true
 *     - No-op at start of playlist
 *   jumpToTrack:
 *     - Sets currentIndex to target and calls loadTrack with autoPlay=true
 *     - No-op when index out of range
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePlaylistStore } from '../store/playlistStore';

// ── Mock deckStore.loadTrack so we can verify calls without a real YT player ──

const mockLoadTrack = vi.fn();
const mockClearAutoPlayOnLoad = vi.fn();

vi.mock('../store/deckStore', () => ({
  useDeckStore: {
    getState: () => ({
      loadTrack: mockLoadTrack,
      clearAutoPlayOnLoad: mockClearAutoPlayOnLoad,
    }),
  },
}));

function makeEntry(videoId: string) {
  return {
    videoId,
    sourceType: 'youtube' as const,
    title: `Track ${videoId}`,
    artist: 'Test Channel',
    duration: 180,
    thumbnailUrl: null,
  };
}

function resetStore() {
  usePlaylistStore.setState({
    playlists: { A: [], B: [] },
    currentIndex: { A: -1, B: -1 },
  });
  vi.clearAllMocks();
}

describe('playlistStore — addTrack', () => {
  beforeEach(resetStore);

  it('first track sets currentIndex=0 and cues into deck (autoPlay=false)', () => {
    const loadTrack = mockLoadTrack;
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));

    const { playlists, currentIndex } = usePlaylistStore.getState();
    expect(playlists.A).toHaveLength(1);
    expect(currentIndex.A).toBe(0);
    expect(loadTrack).toHaveBeenCalledTimes(1);
    expect(loadTrack.mock.calls[0]![3]).toBe(false); // autoPlay=false
    expect(loadTrack.mock.calls[0]![1]).toBe('v1');  // videoId
  });

  it('second track queues without changing currentIndex', () => {
    const loadTrack = mockLoadTrack;
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    usePlaylistStore.getState().addTrack('A', makeEntry('v2'));

    const { playlists, currentIndex } = usePlaylistStore.getState();
    expect(playlists.A).toHaveLength(2);
    expect(currentIndex.A).toBe(0); // still points to first track
    expect(loadTrack).toHaveBeenCalledTimes(1); // only called for first track
  });

  it('deck B playlist is independent from deck A', () => {
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    usePlaylistStore.getState().addTrack('B', makeEntry('v2'));

    const { playlists, currentIndex } = usePlaylistStore.getState();
    expect(playlists.A).toHaveLength(1);
    expect(playlists.B).toHaveLength(1);
    expect(currentIndex.A).toBe(0);
    expect(currentIndex.B).toBe(0);
  });

  it('each entry gets a unique id', () => {
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    usePlaylistStore.getState().addTrack('A', makeEntry('v1')); // same video, different id
    const { playlists } = usePlaylistStore.getState();
    const [entry1, entry2] = playlists.A;
    expect(entry1!.id).not.toBe(entry2!.id);
  });
});

describe('playlistStore — removeTrack', () => {
  beforeEach(resetStore);

  it('removes the entry by id', () => {
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    usePlaylistStore.getState().addTrack('A', makeEntry('v2'));
    const id1 = usePlaylistStore.getState().playlists.A[0]!.id;
    usePlaylistStore.getState().removeTrack('A', id1);
    expect(usePlaylistStore.getState().playlists.A).toHaveLength(1);
    expect(usePlaylistStore.getState().playlists.A[0]!.videoId).toBe('v2');
  });

  it('decrements currentIndex when removing a track before current', () => {
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    usePlaylistStore.getState().addTrack('A', makeEntry('v2'));
    usePlaylistStore.getState().addTrack('A', makeEntry('v3'));
    // Manually set currentIndex to 2
    usePlaylistStore.setState((s) => ({ currentIndex: { ...s.currentIndex, A: 2 } }));

    const id1 = usePlaylistStore.getState().playlists.A[0]!.id; // remove before current
    usePlaylistStore.getState().removeTrack('A', id1);
    expect(usePlaylistStore.getState().currentIndex.A).toBe(1); // shifted left
  });

  it('clamps currentIndex to valid range when removing current track', () => {
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    usePlaylistStore.getState().addTrack('A', makeEntry('v2'));
    // currentIndex=0
    const id1 = usePlaylistStore.getState().playlists.A[0]!.id;
    usePlaylistStore.getState().removeTrack('A', id1);
    // v2 is now at index 0 — currentIndex should be 0 (clamped to min(0, 0))
    expect(usePlaylistStore.getState().currentIndex.A).toBe(0);
  });

  it('sets currentIndex to -1 when last track removed', () => {
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    const id1 = usePlaylistStore.getState().playlists.A[0]!.id;
    usePlaylistStore.getState().removeTrack('A', id1);
    expect(usePlaylistStore.getState().currentIndex.A).toBe(-1);
    expect(usePlaylistStore.getState().playlists.A).toHaveLength(0);
  });

  it('leaves currentIndex unchanged when removing a track after current', () => {
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    usePlaylistStore.getState().addTrack('A', makeEntry('v2'));
    // currentIndex=0, remove index 1
    const id2 = usePlaylistStore.getState().playlists.A[1]!.id;
    usePlaylistStore.getState().removeTrack('A', id2);
    expect(usePlaylistStore.getState().currentIndex.A).toBe(0);
    expect(usePlaylistStore.getState().playlists.A).toHaveLength(1);
  });

  it('no-op for unknown id', () => {
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    usePlaylistStore.getState().removeTrack('A', 'nonexistent-id');
    expect(usePlaylistStore.getState().playlists.A).toHaveLength(1);
  });
});

describe('playlistStore — clearPlaylist', () => {
  beforeEach(resetStore);

  it('empties the playlist and resets currentIndex to -1', () => {
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    usePlaylistStore.getState().addTrack('A', makeEntry('v2'));
    usePlaylistStore.getState().clearPlaylist('A');
    expect(usePlaylistStore.getState().playlists.A).toHaveLength(0);
    expect(usePlaylistStore.getState().currentIndex.A).toBe(-1);
  });

  it('does not affect the other deck', () => {
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    usePlaylistStore.getState().addTrack('B', makeEntry('v2'));
    usePlaylistStore.getState().clearPlaylist('A');
    expect(usePlaylistStore.getState().playlists.B).toHaveLength(1);
    expect(usePlaylistStore.getState().currentIndex.B).toBe(0);
  });
});

describe('playlistStore — skipToNext', () => {
  beforeEach(resetStore);

  it('advances currentIndex and calls loadTrack with autoPlay=true', () => {
    const loadTrack = mockLoadTrack;
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    usePlaylistStore.getState().addTrack('A', makeEntry('v2'));
    vi.clearAllMocks(); // reset the cue call from addTrack

    usePlaylistStore.getState().skipToNext('A');

    expect(usePlaylistStore.getState().currentIndex.A).toBe(1);
    expect(loadTrack).toHaveBeenCalledTimes(1);
    expect(loadTrack.mock.calls[0]![1]).toBe('v2');
    expect(loadTrack.mock.calls[0]![3]).toBe(true); // autoPlay=true
  });

  it('no-op when at end of playlist', () => {
    const loadTrack = mockLoadTrack;
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    vi.clearAllMocks();

    usePlaylistStore.getState().skipToNext('A');
    expect(usePlaylistStore.getState().currentIndex.A).toBe(0); // unchanged
    expect(loadTrack).not.toHaveBeenCalled();
  });

  it('no-op when playlist is empty (currentIndex=-1)', () => {
    const loadTrack = mockLoadTrack;
    usePlaylistStore.getState().skipToNext('A');
    expect(loadTrack).not.toHaveBeenCalled();
  });
});

describe('playlistStore — skipToPrev', () => {
  beforeEach(resetStore);

  it('decrements currentIndex and calls loadTrack with autoPlay=true', () => {
    const loadTrack = mockLoadTrack;
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    usePlaylistStore.getState().addTrack('A', makeEntry('v2'));
    usePlaylistStore.setState((s) => ({ currentIndex: { ...s.currentIndex, A: 1 } }));
    vi.clearAllMocks();

    usePlaylistStore.getState().skipToPrev('A');

    expect(usePlaylistStore.getState().currentIndex.A).toBe(0);
    expect(loadTrack).toHaveBeenCalledTimes(1);
    expect(loadTrack.mock.calls[0]![1]).toBe('v1');
    expect(loadTrack.mock.calls[0]![3]).toBe(true);
  });

  it('no-op when at start of playlist (index=0)', () => {
    const loadTrack = mockLoadTrack;
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    vi.clearAllMocks();

    usePlaylistStore.getState().skipToPrev('A');
    expect(usePlaylistStore.getState().currentIndex.A).toBe(0); // unchanged
    expect(loadTrack).not.toHaveBeenCalled();
  });
});

describe('playlistStore — jumpToTrack', () => {
  beforeEach(resetStore);

  it('sets currentIndex and calls loadTrack with autoPlay=true', () => {
    const loadTrack = mockLoadTrack;
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    usePlaylistStore.getState().addTrack('A', makeEntry('v2'));
    usePlaylistStore.getState().addTrack('A', makeEntry('v3'));
    vi.clearAllMocks();

    usePlaylistStore.getState().jumpToTrack('A', 2);

    expect(usePlaylistStore.getState().currentIndex.A).toBe(2);
    expect(loadTrack.mock.calls[0]![1]).toBe('v3');
    expect(loadTrack.mock.calls[0]![3]).toBe(true);
  });

  it('no-op when index is out of range (negative)', () => {
    const loadTrack = mockLoadTrack;
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    vi.clearAllMocks();

    usePlaylistStore.getState().jumpToTrack('A', -1);
    expect(loadTrack).not.toHaveBeenCalled();
  });

  it('no-op when index exceeds playlist length', () => {
    const loadTrack = mockLoadTrack;
    usePlaylistStore.getState().addTrack('A', makeEntry('v1'));
    vi.clearAllMocks();

    usePlaylistStore.getState().jumpToTrack('A', 5);
    expect(loadTrack).not.toHaveBeenCalled();
  });
});
