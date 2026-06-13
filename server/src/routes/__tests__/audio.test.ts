import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Readable } from 'stream';

// Mock downloadService before importing the router
vi.mock('../../services/downloadService.js', () => ({
  enqueueDownload: vi.fn(),
  getDownloadsDir: vi.fn(() => '/downloads'),
}));

// FILE_SIZE must match statSync mock so Content-Length headers are consistent.
const FILE_SIZE = 1000;

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    statSync: vi.fn(() => ({ size: FILE_SIZE })),
    // createReadStream receives optional {start, end} for range requests.
    // Return a buffer sized to exactly (end - start + 1) so the body matches
    // Content-Length and supertest doesn't abort the connection.
    createReadStream: vi.fn((_path: string, opts?: { start?: number; end?: number }) => {
      const start = opts?.start ?? 0;
      const end = opts?.end ?? FILE_SIZE - 1;
      const len = end - start + 1;
      return Readable.from([Buffer.alloc(len, 0x00)]);
    }),
  };
});

// Also mock libraryService to prevent DB init in transitive imports
vi.mock('../../services/libraryService.js', () => ({
  getTrackByVideoId: vi.fn(() => null),
  getAllTracks: vi.fn(() => []),
  upsertTrack: vi.fn(),
  updateTrackStatus: vi.fn(),
  deleteTrack: vi.fn(),
}));

// Import the router after mocks are set up
import { audioRouter } from '../audio.js';
import * as fs from 'fs';

function makeApp() {
  const a = express();
  a.use('/api/audio', audioRouter);
  return a;
}

beforeEach(() => {
  // Reset to defaults (file present) before each test.
  // existsSync and statSync use simple return values; createReadStream keeps its
  // smart implementation from the factory (size-aware for range requests).
  (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
  (fs.statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: FILE_SIZE });
  (fs.createReadStream as ReturnType<typeof vi.fn>).mockImplementation(
    (_path: string, opts?: { start?: number; end?: number }) => {
      const start = opts?.start ?? 0;
      const end = opts?.end ?? FILE_SIZE - 1;
      const len = end - start + 1;
      return Readable.from([Buffer.alloc(len, 0x00)]);
    },
  );
});

describe('audio route', () => {
  it('400 on invalid videoId (too short)', async () => {
    const res = await request(makeApp()).get('/api/audio/bad');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it('400 on invalid videoId (path traversal)', async () => {
    const res = await request(makeApp()).get('/api/audio/..%2f..%2fetc%2fpasswd');
    expect(res.status).toBe(400);
  });

  it('404 when file does not exist', async () => {
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    const res = await request(makeApp()).get('/api/audio/dQw4w9WgXcQ');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it('200 full file with Accept-Ranges and Content-Length when no Range header', async () => {
    const res = await request(makeApp()).get('/api/audio/dQw4w9WgXcQ');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/audio\/mpeg/);
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['content-length']).toBe(String(FILE_SIZE));
  });

  it('206 partial content with correct Content-Range on Range request', async () => {
    const res = await request(makeApp())
      .get('/api/audio/dQw4w9WgXcQ')
      .set('Range', 'bytes=0-499');
    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 0-499/1000');
    expect(res.headers['content-length']).toBe('500');
    expect(res.headers['accept-ranges']).toBe('bytes');
  });

  it('206 partial content for a non-zero start range', async () => {
    const res = await request(makeApp())
      .get('/api/audio/dQw4w9WgXcQ')
      .set('Range', 'bytes=100-199');
    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 100-199/1000');
    expect(res.headers['content-length']).toBe('100');
  });

  it('416 range not satisfiable when start exceeds file size', async () => {
    const res = await request(makeApp())
      .get('/api/audio/dQw4w9WgXcQ')
      .set('Range', 'bytes=1000-1999');
    expect(res.status).toBe(416);
    expect(res.headers['content-range']).toBe('bytes */1000');
  });
});
