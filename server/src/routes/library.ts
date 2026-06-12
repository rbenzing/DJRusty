import { Router } from 'express';
import { createReadStream, existsSync } from 'fs';
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
  if (!isValidVideoId(videoId)) {
    res.status(400).json({ error: 'Invalid videoId' });
    return;
  }
  const dir = getDownloadsDir();
  const mp3Path = join(dir, `${videoId}.mp3`);
  if (!isPathInside(mp3Path, dir) || !existsSync(mp3Path)) {
    res.status(404).json({ error: 'Audio file not found' });
    return;
  }
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Accept-Ranges', 'bytes');
  createReadStream(mp3Path).pipe(res);
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
