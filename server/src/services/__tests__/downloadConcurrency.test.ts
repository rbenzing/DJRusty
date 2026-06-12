import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

const live = { current: 0, max: 0 };
const children: Array<EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: () => void }> = [];
vi.mock('child_process', () => ({
  spawn: () => {
    const child = Object.assign(new EventEmitter(), {
      stdout: new EventEmitter(), stderr: new EventEmitter(), kill: vi.fn(),
    });
    live.current++; live.max = Math.max(live.max, live.current);
    children.push(child as never);
    return child;
  },
}));
vi.mock('../libraryService.js', () => ({
  upsertTrack: vi.fn(), updateTrackStatus: vi.fn(), getTrackByVideoId: vi.fn(),
}));
vi.mock('../../ws/broadcast.js', () => ({ broadcast: vi.fn() }));
vi.mock('fs', async (orig) => {
  const real = await orig<typeof import('fs')>();
  return { ...real, existsSync: () => false, statSync: () => ({ size: 1 }) as never };
});

import { enqueueDownload } from '../downloadService.js';

describe('download concurrency cap', () => {
  beforeEach(() => { live.current = 0; live.max = 0; children.length = 0; process.env['DOWNLOAD_CONCURRENCY'] = '2'; });

  it('never runs more than DOWNLOAD_CONCURRENCY processes at once', async () => {
    const ids = ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd', 'eeeeeeeeeee'];
    ids.forEach((videoId) => void enqueueDownload({ videoId, title: 't' }));
    await Promise.resolve();
    expect(live.max).toBeLessThanOrEqual(2);
    while (children.length) {
      const c = children.shift()!;
      live.current--;
      c.emit('close', 0);
      await Promise.resolve();
    }
    expect(live.max).toBeLessThanOrEqual(2);
  });
});

describe('download lifecycle hygiene', () => {
  it('kills a hung process after the timeout', async () => {
    vi.useFakeTimers();
    process.env['DOWNLOAD_TIMEOUT_MS'] = '1000';
    children.length = 0;
    void enqueueDownload({ videoId: 'fffffffffff', title: 't' });
    await Promise.resolve();
    const child = children[0]!;
    vi.advanceTimersByTime(1001);
    expect(child.kill).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
