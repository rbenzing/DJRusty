import { spawn } from 'child_process';
import { statSync, existsSync } from 'fs';
import { join } from 'path';
import { broadcast } from '../ws/broadcast.js';
import { updateTrackStatus, upsertTrack } from './libraryService.js';

const DOWNLOADS_DIR = process.env['DOWNLOADS_DIR'] ?? join(process.cwd(), 'downloads');

const active = new Set<string>();

export function getDownloadsDir(): string {
  return DOWNLOADS_DIR;
}

export async function enqueueDownload(opts: {
  videoId: string;
  title: string;
  artist?: string;
  duration?: number;
  thumbnailUrl?: string | null;
}): Promise<void> {
  const { videoId } = opts;

  // Dedup — if already ready, skip
  upsertTrack(opts);
  const mp3Path = join(DOWNLOADS_DIR, `${videoId}.mp3`);
  if (existsSync(mp3Path)) {
    const size = statSync(mp3Path).size;
    updateTrackStatus(videoId, 'ready', { filePath: mp3Path, fileSize: size });
    broadcast({ type: 'download_complete', videoId, audioUrl: `/api/audio/${videoId}` });
    return;
  }

  if (active.has(videoId)) return;
  active.add(videoId);

  updateTrackStatus(videoId, 'downloading');
  broadcast({ type: 'status_update', videoId, status: 'downloading' });

  const outputTemplate = join(DOWNLOADS_DIR, `${videoId}.%(ext)s`);
  const ytdlp = spawn('yt-dlp', [
    '-x', '--audio-format', 'mp3', '--audio-quality', '0',
    '--no-playlist', '--newline',
    '-o', outputTemplate,
    `https://www.youtube.com/watch?v=${videoId}`,
  ]);

  ytdlp.stdout.on('data', (chunk: Buffer) => {
    const line = chunk.toString();
    // Parse progress lines: "[download]  42.3% ..."
    const match = /\[download\]\s+([\d.]+)%/.exec(line);
    if (match?.[1]) {
      broadcast({ type: 'download_progress', videoId, percent: parseFloat(match[1]) });
    }
  });

  ytdlp.stderr.on('data', (chunk: Buffer) => {
    console.error(`[yt-dlp][${videoId}]`, chunk.toString().trim());
  });

  ytdlp.on('error', (err: NodeJS.ErrnoException) => {
    active.delete(videoId);
    const msg = err.code === 'ENOENT'
      ? 'yt-dlp not found — install with: winget install yt-dlp.yt-dlp'
      : err.message;
    updateTrackStatus(videoId, 'error', { errorMessage: msg });
    broadcast({ type: 'download_error', videoId, error: msg });
  });

  ytdlp.on('close', (code: number | null) => {
    active.delete(videoId);
    if (code === 0 && existsSync(mp3Path)) {
      const size = statSync(mp3Path).size;
      updateTrackStatus(videoId, 'ready', { filePath: mp3Path, fileSize: size });
      broadcast({ type: 'download_complete', videoId, audioUrl: `/api/audio/${videoId}` });
    } else if (code !== 0) {
      const msg = `yt-dlp exited with code ${code}`;
      updateTrackStatus(videoId, 'error', { errorMessage: msg });
      broadcast({ type: 'download_error', videoId, error: msg });
    }
  });
}
