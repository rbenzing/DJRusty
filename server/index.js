import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOWNLOADS_DIR = join(__dirname, 'downloads');
const MANIFEST_PATH = join(DOWNLOADS_DIR, 'manifest.json');

if (!existsSync(DOWNLOADS_DIR)) mkdirSync(DOWNLOADS_DIR, { recursive: true });

function readManifest() {
  if (!existsSync(MANIFEST_PATH)) return [];
  try { return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')); } catch { return []; }
}

function writeManifest(tracks) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(tracks, null, 2));
}

const app = express();
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }));
app.use(express.json());

app.get('/api/tracks', (_req, res) => res.json(readManifest()));

app.post('/api/download', (req, res) => {
  const { videoId, title, channelTitle, duration, thumbnailUrl } = req.body;
  if (!videoId) return res.status(400).json({ error: 'videoId required' });

  const manifest = readManifest();
  const existing = manifest.find(t => t.videoId === videoId);
  if (existing && existing.status === 'ready') return res.json(existing);

  const track = {
    videoId, title: title || '', channelTitle: channelTitle || '',
    duration: duration || 0, thumbnailUrl: thumbnailUrl || null,
    audioUrl: `/api/audio/${videoId}`,
    downloadedAt: Date.now(), status: 'downloading',
  };

  const updated = manifest.filter(t => t.videoId !== videoId);
  updated.push(track);
  writeManifest(updated);
  res.json(track);

  const outputTemplate = join(DOWNLOADS_DIR, `${videoId}.%(ext)s`);
  let ytdlp;
  try {
    ytdlp = spawn('yt-dlp', [
      '-x', '--audio-format', 'mp3', '--audio-quality', '0',
      '--no-playlist', '-o', outputTemplate,
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);
  } catch (spawnErr) {
    const m = readManifest();
    const idx = m.findIndex(t => t.videoId === videoId);
    if (idx >= 0) { m[idx].status = 'error'; m[idx].error = 'yt-dlp not found — install it first'; writeManifest(m); }
    return;
  }

  ytdlp.on('error', (err) => {
    console.error('[yt-dlp] spawn error:', err.message);
    const m = readManifest();
    const idx = m.findIndex(t => t.videoId === videoId);
    if (idx >= 0) {
      m[idx].status = 'error';
      m[idx].error = err.code === 'ENOENT'
        ? 'yt-dlp not found — install it with: winget install yt-dlp.yt-dlp'
        : err.message;
      writeManifest(m);
    }
  });

  ytdlp.on('close', (code) => {
    const m = readManifest();
    const idx = m.findIndex(t => t.videoId === videoId);
    if (idx >= 0) {
      m[idx].status = code === 0 ? 'ready' : 'error';
      if (code !== 0) m[idx].error = `yt-dlp exited with code ${code}`;
      writeManifest(m);
    }
  });
});

app.get('/api/tracks/:videoId/status', (req, res) => {
  const track = readManifest().find(t => t.videoId === req.params.videoId);
  if (!track) return res.status(404).json({ error: 'Not found' });
  res.json({ status: track.status, error: track.error });
});

app.get('/api/audio/:videoId', (req, res) => {
  const mp3Path = join(DOWNLOADS_DIR, `${req.params.videoId}.mp3`);
  if (!existsSync(mp3Path)) return res.status(404).json({ error: 'Audio file not found' });
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Accept-Ranges', 'bytes');
  createReadStream(mp3Path).pipe(res);
});

app.delete('/api/tracks/:videoId', (req, res) => {
  const { videoId } = req.params;
  writeManifest(readManifest().filter(t => t.videoId !== videoId));
  const mp3Path = join(DOWNLOADS_DIR, `${videoId}.mp3`);
  try { if (existsSync(mp3Path)) unlinkSync(mp3Path); } catch {}
  res.json({ success: true });
});

app.listen(3001, () => console.log('DJ Rusty download server on http://localhost:3001'));
