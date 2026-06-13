import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock ONLY the two imports download.ts actually uses from these modules.
// libraryService exports many functions; provide all that downloadService.ts
// (which is also transitively imported) might pull in — but since we mock the
// whole module, the factory only needs what download.ts itself calls.
vi.mock('../../services/downloadService.js', () => ({
  enqueueDownload: vi.fn(),
  getDownloadsDir: vi.fn(() => '/downloads'),
}));

vi.mock('../../services/libraryService.js', () => ({
  getTrackByVideoId: vi.fn(() => null),
  getAllTracks: vi.fn(() => []),
  upsertTrack: vi.fn(),
  updateTrackStatus: vi.fn(),
  deleteTrack: vi.fn(),
}));

// Import after mocks are registered
import { downloadRouter } from '../download.js';

function makeApp() {
  const a = express();
  a.use(express.json());
  a.use('/api/download', downloadRouter);
  return a;
}

describe('download routes', () => {
  it('POST /:videoId rejects an invalid videoId with 400', async () => {
    const res = await request(makeApp()).post('/api/download/..%2f..%2fetc').send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it('POST /:videoId rejects a short id with 400', async () => {
    const res = await request(makeApp()).post('/api/download/bad').send({});
    expect(res.status).toBe(400);
  });

  it('POST /:videoId queues a valid videoId and returns 200', async () => {
    const res = await request(makeApp())
      .post('/api/download/dQw4w9WgXcQ')
      .send({ title: 'Never Gonna Give You Up' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ videoId: 'dQw4w9WgXcQ', status: 'queued' });
  });

  it('GET /:videoId/status rejects invalid videoId with 400', async () => {
    const res = await request(makeApp()).get('/api/download/bad/status');
    expect(res.status).toBe(400);
  });

  it('GET /:videoId/status returns 404 for unknown videoId', async () => {
    // Mock returns null by default (set up above)
    const res = await request(makeApp()).get('/api/download/dQw4w9WgXcQ/status');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it('GET /:videoId/status returns track data when found', async () => {
    const { getTrackByVideoId } = await import('../../services/libraryService.js');
    (getTrackByVideoId as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      videoId: 'dQw4w9WgXcQ',
      status: 'ready',
      errorMessage: null,
    });
    const res = await request(makeApp()).get('/api/download/dQw4w9WgXcQ/status');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ videoId: 'dQw4w9WgXcQ', status: 'ready' });
  });
});
