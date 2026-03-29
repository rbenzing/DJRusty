/**
 * downloadService.test.ts — Unit tests for download service.
 *
 * Mocks yt-dlp spawn and filesystem calls to test dedup + state transitions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUpsertTrack = vi.fn().mockReturnValue({ videoId: 'v1', status: 'pending' });
const mockUpdateTrackStatus = vi.fn();
let mockExistsSync = false;
const mockBroadcast = vi.fn();

vi.mock('../libraryService.js', () => ({
  upsertTrack: mockUpsertTrack,
  updateTrackStatus: mockUpdateTrackStatus,
  getTrackByVideoId: vi.fn(),
}));

vi.mock('../../ws/broadcast.js', () => ({
  broadcast: mockBroadcast,
}));

// Control existsSync per-test
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => mockExistsSync),
    statSync: vi.fn(() => ({ size: 1_234_567 })),
  };
});

// Mock spawn to return a controllable EventEmitter
let mockSpawnInstance: EventEmitter & { stdout: EventEmitter; stderr: EventEmitter };

vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    mockSpawnInstance = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
    });
    return mockSpawnInstance;
  }),
}));

const { enqueueDownload } = await import('../downloadService.js');

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync = false;
  // Reset the active set between tests by reimporting is complex — test idempotency instead
});

describe('enqueueDownload — dedup', () => {
  it('marks track ready immediately when file already exists on disk', async () => {
    mockExistsSync = true;
    await enqueueDownload({ videoId: 'existing', title: 'Existing Track' });
    expect(mockUpdateTrackStatus).toHaveBeenCalledWith('existing', 'ready', expect.objectContaining({ fileSize: 1_234_567 }));
    expect(mockBroadcast).toHaveBeenCalledWith(expect.objectContaining({ type: 'download_complete', videoId: 'existing' }));
  });

  it('calls upsertTrack with provided metadata', async () => {
    mockExistsSync = true;
    await enqueueDownload({ videoId: 'v2', title: 'Track 2', artist: 'DJ A', duration: 180 });
    expect(mockUpsertTrack).toHaveBeenCalledWith(expect.objectContaining({ videoId: 'v2', title: 'Track 2', artist: 'DJ A' }));
  });
});

describe('enqueueDownload — status transitions', () => {
  it('broadcasts status_update with downloading when yt-dlp starts', async () => {
    mockExistsSync = false;
    const promise = enqueueDownload({ videoId: 'new1', title: 'New Track' });
    // Let microtasks settle
    await new Promise((r) => setTimeout(r, 0));
    expect(mockBroadcast).toHaveBeenCalledWith({ type: 'status_update', videoId: 'new1', status: 'downloading' });
    // Simulate completion
    mockExistsSync = true;
    mockSpawnInstance.emit('close', 0);
    await promise;
  });

  it('broadcasts download_error when yt-dlp exits with non-zero code', async () => {
    mockExistsSync = false;
    const promise = enqueueDownload({ videoId: 'fail1', title: 'Fail Track' });
    await new Promise((r) => setTimeout(r, 0));
    mockSpawnInstance.emit('close', 1);
    await promise;
    expect(mockBroadcast).toHaveBeenCalledWith(expect.objectContaining({ type: 'download_error', videoId: 'fail1' }));
    expect(mockUpdateTrackStatus).toHaveBeenCalledWith('fail1', 'error', expect.any(Object));
  });

  it('broadcasts download_error on spawn ENOENT error', async () => {
    mockExistsSync = false;
    const promise = enqueueDownload({ videoId: 'nobin', title: 'No Binary' });
    await new Promise((r) => setTimeout(r, 0));
    const err = Object.assign(new Error('not found'), { code: 'ENOENT' });
    mockSpawnInstance.emit('error', err);
    await promise;
    expect(mockBroadcast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'download_error',
      videoId: 'nobin',
      error: expect.stringContaining('yt-dlp not found'),
    }));
  });

  it('parses yt-dlp progress output and broadcasts download_progress', async () => {
    mockExistsSync = false;
    enqueueDownload({ videoId: 'prog1', title: 'Progress Track' });
    await new Promise((r) => setTimeout(r, 0));
    mockSpawnInstance.stdout.emit('data', Buffer.from('[download]  55.3% of ~10.00MiB\n'));
    expect(mockBroadcast).toHaveBeenCalledWith({ type: 'download_progress', videoId: 'prog1', percent: 55.3 });
  });
});
