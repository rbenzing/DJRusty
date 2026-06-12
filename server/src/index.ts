import { createServer } from 'http';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { createWss } from './ws/broadcast.js';
import { audioRouter } from './routes/audio.js';
import { libraryRouter } from './routes/library.js';
import { downloadRouter } from './routes/download.js';
import { videosRouter } from './routes/videos.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const DOWNLOADS_DIR = process.env['DOWNLOADS_DIR'] ?? join(__dirname, '../downloads');
const DATA_DIR = process.env['DB_PATH']
  ? dirname(process.env['DB_PATH'])
  : join(__dirname, '../data');

// Ensure directories exist
[DOWNLOADS_DIR, DATA_DIR].forEach((dir) => {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
});

const app = express();
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }));
app.use(express.json());

// Legacy: serve audio directly by videoId (backwards-compat with old frontend code)
app.use('/api/audio', audioRouter);

// Versioned routes
app.use('/api/library', libraryRouter);
app.use('/api/download', downloadRouter);
app.use('/api/videos', videosRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Global error handler — must have exactly 4 params to be recognized by Express
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});

const server = createServer(app);
createWss(server);

server.listen(PORT, () => {
  console.log(`DJ Rusty server on http://localhost:${PORT}`);
});
