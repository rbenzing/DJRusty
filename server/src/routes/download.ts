import { Router } from 'express';
import { getTrackByVideoId } from '../services/libraryService.js';
import { enqueueDownload } from '../services/downloadService.js';
import { isValidVideoId } from '../utils/validateVideoId.js';

export const downloadRouter = Router();

downloadRouter.post('/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!isValidVideoId(videoId)) {
    res.status(400).json({ error: 'Invalid videoId' });
    return;
  }
  const { title = '', artist = '', duration = 0, thumbnailUrl = null } = req.body as {
    title?: string;
    artist?: string;
    duration?: number;
    thumbnailUrl?: string | null;
  };

  void enqueueDownload({ videoId, title, artist, duration, thumbnailUrl });
  res.json({ videoId, status: 'queued' });
});

downloadRouter.get('/:videoId/status', (req, res) => {
  const { videoId } = req.params;
  if (!isValidVideoId(videoId)) {
    res.status(400).json({ error: 'Invalid videoId' });
    return;
  }
  const track = getTrackByVideoId(videoId);
  if (!track) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json({ videoId: track.videoId, status: track.status, error: track.errorMessage });
});
