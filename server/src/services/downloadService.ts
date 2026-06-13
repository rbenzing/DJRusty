import { spawn } from 'child_process';
import { statSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { broadcast } from '../ws/broadcast.js';
import { updateTrackStatus, upsertTrack } from './libraryService.js';
import { isValidVideoId } from '../utils/validateVideoId.js';

const DOWNLOADS_DIR = process.env['DOWNLOADS_DIR'] ?? join(process.cwd(), 'downloads');

const active = new Set<string>();

export function getDownloadsDir(): string {
  return DOWNLOADS_DIR;
}

function cleanupPartials(videoId: string): void {
  try {
    for (const name of readdirSync(DOWNLOADS_DIR)) {
      // Remove leftovers like `${id}.part`, `${id}.webm`, `${id}.mp3.part` — but keep a finished `${id}.mp3`.
      if (name.startsWith(`${videoId}.`) && name !== `${videoId}.mp3`) {
        try { unlinkSync(join(DOWNLOADS_DIR, name)); } catch { /* best effort */ }
      }
    }
  } catch { /* downloads dir missing — nothing to clean */ }
}

// ── Worker pool ───────────────────────────────────────────────────────────────

type DownloadOpts = Parameters<typeof enqueueDownload>[0];

const queue: DownloadOpts[] = [];
let running = 0;

function pump(): void {
  const max = parseInt(process.env['DOWNLOAD_CONCURRENCY'] ?? '2', 10);
  while (running < max && queue.length > 0) {
    const job = queue.shift()!;
    running++;
    runDownload(job).finally(() => { running--; pump(); });
  }
}

function runDownload(opts: DownloadOpts): Promise<void> {
  const { videoId } = opts;
  const mp3Path = join(DOWNLOADS_DIR, `${videoId}.mp3`);
  const outputTemplate = join(DOWNLOADS_DIR, `${videoId}.%(ext)s`);

  return new Promise<void>((resolveJob) => {
    updateTrackStatus(videoId, 'downloading');
    broadcast({ type: 'status_update', videoId, status: 'downloading' });

    const TIMEOUT_MS = parseInt(process.env['DOWNLOAD_TIMEOUT_MS'] ?? '300000', 10);

    const ytdlp = spawn('yt-dlp', [
      '-x', '--audio-format', 'mp3', '--audio-quality', '0',
      '--no-playlist', '--newline',
      '-o', outputTemplate,
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);

    const killTimer = setTimeout(() => ytdlp.kill('SIGKILL'), TIMEOUT_MS);

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
      clearTimeout(killTimer);
      active.delete(videoId);
      const msg = err.code === 'ENOENT'
        ? 'yt-dlp not found — install with: winget install yt-dlp.yt-dlp'
        : err.message;
      cleanupPartials(videoId);
      updateTrackStatus(videoId, 'error', { errorMessage: msg });
      broadcast({ type: 'download_error', videoId, error: msg });
      resolveJob();
    });

    ytdlp.on('close', (code: number | null) => {
      clearTimeout(killTimer);
      active.delete(videoId);
      if (code === 0 && existsSync(mp3Path)) {
        const size = statSync(mp3Path).size;
        updateTrackStatus(videoId, 'ready', { filePath: mp3Path, fileSize: size });
        broadcast({ type: 'download_complete', videoId, audioUrl: `/api/audio/${videoId}` });
      } else if (code !== 0) {
        const msg = `yt-dlp exited with code ${code}`;
        cleanupPartials(videoId);
        updateTrackStatus(videoId, 'error', { errorMessage: msg });
        broadcast({ type: 'download_error', videoId, error: msg });
      }
      resolveJob();
    });
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function enqueueDownload(opts: {
  videoId: string;
  title: string;
  artist?: string;
  duration?: number;
  thumbnailUrl?: string | null;
}): Promise<void> {
  const { videoId } = opts;

  if (!isValidVideoId(videoId)) {
    // Defence-in-depth: the route layer already 400s. Don't write a DB row
    // for an id that was never (and can never be) inserted.
    return;
  }

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
  queue.push(opts);
  pump();
}
