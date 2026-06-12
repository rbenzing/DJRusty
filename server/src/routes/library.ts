import { Router } from 'express';
import { createReadStream, existsSync, statSync } from 'fs';
import { join } from 'path';
import { getAllTracks, deleteTrack } from '../services/libraryService.js';
import { getDownloadsDir } from '../services/downloadService.js';
import { isValidVideoId, isPathInside } from '../utils/validateVideoId.js';

export const libraryRouter = Router();

libraryRouter.get('/', (_req, res) => {
  res.json(getAllTracks());
});

libraryRouter.get('/:videoId/audio', (req, res) => {
  const { videoId } = req.params;
  if (!isValidVideoId(videoId)) { res.status(400).json({ error: 'Invalid videoId' }); return; }
  const dir = getDownloadsDir();
  const mp3Path = join(dir, `${videoId}.mp3`);
  if (!isPathInside(mp3Path, dir) || !existsSync(mp3Path)) {
    res.status(404).json({ error: 'Audio file not found' });
    return;
  }

  const size = statSync(mp3Path).size;
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Accept-Ranges', 'bytes');

  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= size) {
      res.status(416);
      res.setHeader('Content-Range', `bytes */${size}`);
      res.end();
      return;
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
    res.setHeader('Content-Length', String(end - start + 1));
    const stream = createReadStream(mp3Path, { start, end });
    stream.on('error', () => { if (!res.headersSent) res.status(500).end(); else res.destroy(); });
    stream.pipe(res);
    return;
  }

  res.setHeader('Content-Length', String(size));
  const stream = createReadStream(mp3Path);
  stream.on('error', () => { if (!res.headersSent) res.status(500).end(); else res.destroy(); });
  stream.pipe(res);
});

libraryRouter.delete('/:videoId', (req, res) => {
  const { videoId } = req.params;
  if (!isValidVideoId(videoId)) {
    res.status(400).json({ error: 'Invalid videoId' });
    return;
  }
  deleteTrack(videoId);
  res.json({ success: true });
});
