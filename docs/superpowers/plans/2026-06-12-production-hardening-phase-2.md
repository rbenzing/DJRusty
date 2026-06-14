# Production Hardening Phase 2 — Critical & Important Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining Critical and Important findings from the 2026-06-12 whole-project review: server security holes (path traversal, SSRF, unbounded process spawns), server robustness (timeouts, cleanup, range requests, error handling, WS hygiene), a frontend playback-time re-render storm, a Web Audio unhandled-rejection + node leak, and repo/tooling hygiene.

**Architecture:** Four independent phases. **Phase A (server)** adds a shared `videoId` validation guard + path-confinement helper applied at every route entry, a bounded download worker pool with process timeouts and partial-file cleanup, HTTP range streaming, a global JSON error middleware, and WebSocket heartbeat/backpressure. **Phase B (frontend)** narrows Zustand subscriptions in the control surface, fixes the dropped `play()` promise and the echo-effect node leak. **Phase C (tests)** covers the untested high-risk seams (wsClient, authService, server routes, crossfader→player). **Phase D (tooling)** untracks runtime artifacts, unifies the toolchain, and adds CI. Each phase produces working, independently-mergeable software; phases may be executed in any order, though A → B → C → D is recommended.

**Tech Stack:** Node + Express + better-sqlite3 + `ws` (server, TS 5/Vitest); React 18 + Zustand 4 + Web Audio (frontend, TS 5 strict, Vitest + Testing Library). PowerShell-only run rules: use `npm run …`, no `npx`, no `&&` chaining. Single server test file: `npm run test --prefix server -- <file>`. Single frontend test file: `npm run test -- <file>`.

---

## Background the implementer needs

- **`videoId` is always an 11-char YouTube ID** (`[A-Za-z0-9_-]{11}`). Downloads come from `yt-dlp` against `youtube.com/watch?v=<id>`; the DB `videoId` column stores the same value. WAV/MP3 file-imports never reach these server routes (they stay client-side as blob URLs), so the 11-char rule is safe for every server entry point.
- **Audio is served from `DOWNLOADS_DIR`** = `process.env['DOWNLOADS_DIR'] ?? join(process.cwd(), 'downloads')` (see [server/src/services/downloadService.ts:7](../../../server/src/services/downloadService.ts)). The audio handler builds `join(getDownloadsDir(), \`${videoId}.mp3\`)` with **no validation** ([server/src/routes/library.ts:13-23](../../../server/src/routes/library.ts)).
- **Routes that take `:videoId`:** `library.ts` (`GET /:videoId/audio`, `DELETE /:videoId`), `download.ts` (`POST /:videoId`, `GET /:videoId/status`). All four must validate.
- **The `download_queue` table already exists** in [server/src/db/schema.sql](../../../server/src/db/schema.sql) (priority/attempts/max_retries) but is **never used**. Phase A Task A3 introduces an in-memory bounded pool rather than wiring the table — simpler and sufficient; the table stays unused (note it, do not delete in this plan).
- **Server test style:** Vitest, no DOM. `downloadService.test.ts` drives the real service against a mocked `child_process.spawn` EventEmitter and asserts `broadcast` payloads. Route tests (Task C3) add **`supertest`** (installed in that task).
- **Frontend control components subscribe to the whole deck store.** `setCurrentTime` runs every playback frame ([server tick] → `updateDeck`), changing the `decks` reference, so any component doing bare `useDeckStore()` / `useDeck(deckId)` re-renders every frame. Zustand returns **stable action identities**, so selecting actions individually eliminates the re-render.
- **Do not break the dual-backend registry.** `getActivePlayer(deckId, sourceType)` is the only seek router; Phase 1 already fixed its wiring. None of these tasks touch it.

---

## File Structure

| File | Responsibility | Phase / Action |
|------|----------------|----------------|
| `server/src/utils/validateVideoId.ts` | `isValidVideoId` guard + `isPathInside` confinement | A — Create |
| `server/src/routes/library.ts` | Validate + confine + range streaming | A — Modify |
| `server/src/routes/download.ts` | Validate before enqueue | A — Modify |
| `server/src/services/downloadService.ts` | Bounded pool, timeout, partial cleanup | A — Modify |
| `server/src/index.ts` | Global error middleware; stop double-mounting full router | A — Modify |
| `server/src/ws/broadcast.ts` | Heartbeat + backpressure | A — Modify |
| `server/src/utils/__tests__/validateVideoId.test.ts` | Guard unit tests | A — Create |
| `server/src/routes/__tests__/library.test.ts`, `download.test.ts` | Route tests (supertest) | C — Create |
| `src/store/deckStore.ts` | `useDeckActions` / field selectors | B — Modify |
| `src/components/Deck/*.tsx` | Use narrow selectors | B — Modify |
| `src/services/audioEngine.ts` | Catch `play()` rejection; track echo nodes | B — Modify |
| `src/services/wsClient.ts` (test only) | — | C — add test |
| `src/test/wsClient.test.ts`, `authService.test.ts`, `mixer-volume-routing.test.ts` | New coverage | C — Create |
| `.gitignore`, `package.json`, `server/package.json`, `.github/workflows/ci.yml` | Hygiene + CI | D |

---

# PHASE A — Server security & robustness

## Task A1: videoId validation + path-confinement guard (Critical C3)

**Files:**
- Create: `server/src/utils/validateVideoId.ts`
- Test: `server/src/utils/__tests__/validateVideoId.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/utils/__tests__/validateVideoId.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isValidVideoId, isPathInside } from '../validateVideoId.js';

describe('isValidVideoId', () => {
  it('accepts a canonical 11-char YouTube id', () => {
    expect(isValidVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isValidVideoId('-lzHszPWkgM')).toBe(true);
  });
  it('rejects traversal, wrong length, and non-strings', () => {
    expect(isValidVideoId('../../etc/passwd')).toBe(false);
    expect(isValidVideoId('short')).toBe(false);
    expect(isValidVideoId('waytoolongforanid')).toBe(false);
    expect(isValidVideoId('bad/slash..')).toBe(false);
    expect(isValidVideoId(undefined)).toBe(false);
    expect(isValidVideoId(42)).toBe(false);
  });
});

describe('isPathInside', () => {
  it('accepts a child of the parent dir', () => {
    expect(isPathInside('/data/downloads/x.mp3', '/data/downloads')).toBe(true);
  });
  it('rejects an escape via ..', () => {
    expect(isPathInside('/data/downloads/../secret', '/data/downloads')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test --prefix server -- validateVideoId`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the guard**

Create `server/src/utils/validateVideoId.ts`:

```ts
import { resolve, sep } from 'path';

/** Canonical YouTube video id: exactly 11 chars of [A-Za-z0-9_-]. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** True only for a well-formed YouTube video id. Rejects traversal, wrong length, non-strings. */
export function isValidVideoId(id: unknown): id is string {
  return typeof id === 'string' && VIDEO_ID_RE.test(id);
}

/** True when `child` resolves to `parent` itself or a path strictly inside it. */
export function isPathInside(child: string, parent: string): boolean {
  const p = resolve(parent);
  const c = resolve(child);
  return c === p || c.startsWith(p + sep);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test --prefix server -- validateVideoId`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/validateVideoId.ts server/src/utils/__tests__/validateVideoId.test.ts
git commit -m "feat(server): add videoId validation + path-confinement guard"
```

---

## Task A2: Apply validation at every route entry + confine audio path (Critical C3)

**Files:**
- Modify: `server/src/routes/download.ts`
- Modify: `server/src/routes/library.ts:13-28`

- [ ] **Step 1: Guard the download routes**

In `server/src/routes/download.ts`, import the guard and reject early in both handlers:

```ts
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
    title?: string; artist?: string; duration?: number; thumbnailUrl?: string | null;
  };
  void enqueueDownload({ videoId, title, artist, duration, thumbnailUrl });
  res.json({ videoId, status: 'queued' });
});

downloadRouter.get('/:videoId/status', (req, res) => {
  if (!isValidVideoId(req.params.videoId)) {
    res.status(400).json({ error: 'Invalid videoId' });
    return;
  }
  const track = getTrackByVideoId(req.params.videoId);
  if (!track) { res.status(404).json({ error: 'Not found' }); return; }
  res.json({ videoId: track.videoId, status: track.status, error: track.errorMessage });
});
```

- [ ] **Step 2: Guard + confine the audio and delete routes**

In `server/src/routes/library.ts`, add the guard import and validate/confine. (Range streaming itself comes in Task A5; this step only adds the guard + confinement around the current `pipe`.)

```ts
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
  if (!isValidVideoId(videoId)) { res.status(400).json({ error: 'Invalid videoId' }); return; }
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
  if (!isValidVideoId(req.params.videoId)) { res.status(400).json({ error: 'Invalid videoId' }); return; }
  deleteTrack(req.params.videoId);
  res.json({ success: true });
});
```

- [ ] **Step 3: Guard the download output template (write-side traversal)**

In `server/src/services/downloadService.ts`, reject an invalid id before building the output template or spawning. At the top of `enqueueDownload`, after destructuring `videoId`:

```ts
import { isValidVideoId } from '../utils/validateVideoId.js';
// ...
export async function enqueueDownload(opts: { /* unchanged */ }): Promise<void> {
  const { videoId } = opts;
  if (!isValidVideoId(videoId)) {
    updateTrackStatus(videoId, 'error', { errorMessage: 'Invalid videoId' });
    return;
  }
  // ...rest unchanged
```

- [ ] **Step 4: Verify build + existing suite still green**

Run: `npm run lint --prefix server`
Expected: PASS (`tsc --noEmit`, no type errors).
Run: `npm run test --prefix server`
Expected: PASS (existing 22 still green; route behavior is covered in Phase C).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/download.ts server/src/routes/library.ts server/src/services/downloadService.ts
git commit -m "fix(server): validate videoId + confine paths at every route entry (closes traversal/SSRF)"
```

---

## Task A3: Bounded download worker pool (Critical C4)

**Files:**
- Modify: `server/src/services/downloadService.ts`
- Test: `server/src/services/__tests__/downloadConcurrency.test.ts` (create)

**Design:** Replace the bare `spawn` with a small in-memory pool. `enqueueDownload` pushes a job; a dispatcher runs at most `MAX_CONCURRENT` (default 2, override via `DOWNLOAD_CONCURRENCY`) jobs at once and drains the queue as jobs finish. The existing `active` Set still dedups identical ids.

- [ ] **Step 1: Write the failing test**

Create `server/src/services/__tests__/downloadConcurrency.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock spawn to return controllable child processes and count concurrent live ones.
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
    // Drain: close each child; freeing a slot must start a queued one.
    while (children.length) {
      const c = children.shift()!;
      live.current--;
      c.emit('close', 0);
      await Promise.resolve();
    }
    expect(live.max).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test --prefix server -- downloadConcurrency`
Expected: FAIL — current code spawns all 5 immediately, `live.max` is 5.

- [ ] **Step 3: Add the pool**

In `server/src/services/downloadService.ts`, extract the spawn logic into `runDownload(opts)` and gate it behind a dispatcher. Replace the body from `if (active.has(videoId)) return;` onward:

```ts
const MAX_CONCURRENT = parseInt(process.env['DOWNLOAD_CONCURRENCY'] ?? '2', 10);
const queue: Array<Parameters<typeof enqueueDownload>[0]> = [];
let running = 0;

function pump(): void {
  while (running < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift()!;
    running++;
    runDownload(job).finally(() => { running--; pump(); });
  }
}
```

Then in `enqueueDownload`, after the dedup/exists checks, replace the direct spawn with:

```ts
  if (active.has(videoId)) return;
  active.add(videoId);
  queue.push(opts);
  pump();
}
```

And move the spawn block into a new `runDownload` that returns a Promise resolving when the child closes/errors:

```ts
function runDownload(opts: Parameters<typeof enqueueDownload>[0]): Promise<void> {
  const { videoId } = opts;
  return new Promise<void>((resolveJob) => {
    updateTrackStatus(videoId, 'downloading');
    broadcast({ type: 'status_update', videoId, status: 'downloading' });

    const mp3Path = join(DOWNLOADS_DIR, `${videoId}.mp3`);
    const outputTemplate = join(DOWNLOADS_DIR, `${videoId}.%(ext)s`);
    const ytdlp = spawn('yt-dlp', [
      '-x', '--audio-format', 'mp3', '--audio-quality', '0',
      '--no-playlist', '--newline',
      '-o', outputTemplate,
      `https://www.youtube.com/watch?v=${videoId}`,
    ]);

    ytdlp.stdout.on('data', (chunk: Buffer) => {
      const match = /\[download\]\s+([\d.]+)%/.exec(chunk.toString());
      if (match?.[1]) broadcast({ type: 'download_progress', videoId, percent: parseFloat(match[1]) });
    });
    ytdlp.stderr.on('data', (chunk: Buffer) => console.error(`[yt-dlp][${videoId}]`, chunk.toString().trim()));

    ytdlp.on('error', (err: NodeJS.ErrnoException) => {
      active.delete(videoId);
      const msg = err.code === 'ENOENT'
        ? 'yt-dlp not found — install with: winget install yt-dlp.yt-dlp'
        : err.message;
      updateTrackStatus(videoId, 'error', { errorMessage: msg });
      broadcast({ type: 'download_error', videoId, error: msg });
      resolveJob();
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
      resolveJob();
    });
  });
}
```

- [ ] **Step 4: Run both the new and existing download tests**

Run: `npm run test --prefix server -- downloadConcurrency downloadService`
Expected: PASS — concurrency capped at 2, and the existing state-machine tests still green (they enqueue a single id, so pool behavior is identical for them).

- [ ] **Step 5: Commit**

```bash
git add server/src/services/downloadService.ts server/src/services/__tests__/downloadConcurrency.test.ts
git commit -m "fix(server): bound concurrent yt-dlp downloads with a worker pool (closes spawn-flood DoS)"
```

---

## Task A4: Process timeout + partial-file cleanup (Important I1, I2)

**Files:**
- Modify: `server/src/services/downloadService.ts` (inside `runDownload`)
- Test: extend `server/src/services/__tests__/downloadConcurrency.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `downloadConcurrency.test.ts`:

```ts
import { readdirSync } from 'fs';

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test --prefix server -- downloadConcurrency`
Expected: FAIL — `kill` never called (no timeout yet).

- [ ] **Step 3: Add timeout + cleanup in `runDownload`**

After `const ytdlp = spawn(...)`, add a kill timer; clear it on close/error; on the failure paths remove stray partials. Add near the top of `runDownload`:

```ts
    const TIMEOUT_MS = parseInt(process.env['DOWNLOAD_TIMEOUT_MS'] ?? '300000', 10);
    const killTimer = setTimeout(() => ytdlp.kill('SIGKILL'), TIMEOUT_MS);
```

In both the `error` and the non-zero `close` branch, before `resolveJob()`, add:

```ts
      clearTimeout(killTimer);
      cleanupPartials(videoId);
```

And in the success branch add `clearTimeout(killTimer);` before `resolveJob()`. Add the helper near the top of the file (after `getDownloadsDir`):

```ts
import { readdirSync, unlinkSync } from 'fs';

function cleanupPartials(videoId: string): void {
  try {
    for (const name of readdirSync(DOWNLOADS_DIR)) {
      // Remove leftovers like `${id}.part`, `${id}.webm`, `${id}.mp3.part` — but not a finished `${id}.mp3`.
      if (name.startsWith(`${videoId}.`) && name !== `${videoId}.mp3`) {
        try { unlinkSync(join(DOWNLOADS_DIR, name)); } catch { /* best effort */ }
      }
    }
  } catch { /* downloads dir missing — nothing to clean */ }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test --prefix server -- downloadConcurrency downloadService`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/downloadService.ts server/src/services/__tests__/downloadConcurrency.test.ts
git commit -m "fix(server): add yt-dlp timeout + partial-file cleanup on failure"
```

---

## Task A5: HTTP range streaming for downloaded audio (Important I3)

**Files:**
- Modify: `server/src/routes/library.ts` (`GET /:videoId/audio`)

- [ ] **Step 1: Replace the unconditional pipe with range-aware streaming**

Swap the body of the audio handler (keep the guard/confinement from Task A2):

```ts
import { createReadStream, existsSync, statSync } from 'fs';
// ...
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
      res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
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
```

- [ ] **Step 2: Verify build + suite**

Run: `npm run lint --prefix server`
Expected: PASS.
Run: `npm run test --prefix server`
Expected: PASS. (Behavioral coverage added in Task C3.)

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/library.ts
git commit -m "fix(server): serve downloaded audio with HTTP range support + stream error handling"
```

---

## Task A6: Global error middleware + stop double-mounting full router (Important I5)

**Files:**
- Modify: `server/src/index.ts`
- Create: `server/src/routes/audio.ts` (minimal audio-only router for the legacy `/api/audio` mount)

- [ ] **Step 1: Extract a minimal audio router**

Create `server/src/routes/audio.ts` exporting only the range-streaming audio handler (move the `GET /:videoId/audio` logic here as `GET /:videoId`, since the legacy mount is `/api/audio/:videoId`). Keep `library.ts` for `/api/library` CRUD.

```ts
import { Router } from 'express';
import { createReadStream, existsSync, statSync } from 'fs';
import { join } from 'path';
import { getDownloadsDir } from '../services/downloadService.js';
import { isValidVideoId, isPathInside } from '../utils/validateVideoId.js';

export const audioRouter = Router();

audioRouter.get('/:videoId', (req, res) => {
  const { videoId } = req.params;
  if (!isValidVideoId(videoId)) { res.status(400).json({ error: 'Invalid videoId' }); return; }
  const dir = getDownloadsDir();
  const mp3Path = join(dir, `${videoId}.mp3`);
  if (!isPathInside(mp3Path, dir) || !existsSync(mp3Path)) {
    res.status(404).json({ error: 'Audio file not found' });
    return;
  }
  // (identical range-streaming body as Task A5)
  const size = statSync(mp3Path).size;
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Accept-Ranges', 'bytes');
  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    const start = m && m[1] ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= size) {
      res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
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
```

> The duplicated body is acceptable here (one small handler, two mount paths with different param shapes: `/api/audio/:videoId` vs `/api/library/:videoId/audio`). If preferred, extract a `streamAudio(req,res,mp3Path,size)` helper into `validateVideoId.ts`'s neighbor — optional, not required.

- [ ] **Step 2: Rewire mounts + add error middleware in `index.ts`**

```ts
import { audioRouter } from './routes/audio.js';
// ...
app.use('/api/audio', audioRouter);        // minimal: GET /:videoId only
app.use('/api/library', libraryRouter);    // full CRUD
app.use('/api/download', downloadRouter);
app.use('/api/videos', videosRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Global JSON error handler — must be registered AFTER routes, with 4 args.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal server error' });
});
```

- [ ] **Step 3: Verify build + suite**

Run: `npm run lint --prefix server`
Expected: PASS.
Run: `npm run test --prefix server`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/audio.ts server/src/index.ts
git commit -m "fix(server): minimal audio router + global JSON error middleware (no stack leakage)"
```

---

## Task A7: WebSocket heartbeat + backpressure (Important I6)

**Files:**
- Modify: `server/src/ws/broadcast.ts`

- [ ] **Step 1: Add liveness ping + skip slow clients**

Replace `createWss`/`broadcast` in `server/src/ws/broadcast.ts`:

```ts
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';

let wss: WebSocketServer | null = null;
let heartbeat: NodeJS.Timeout | null = null;

/** Per-socket liveness flag (ws has no typed slot, so use a WeakMap). */
const alive = new WeakMap<WebSocket, boolean>();
const MAX_BUFFERED = 1 << 20; // 1 MiB — drop sends to a backed-up client

export type WsMessage =
  | { type: 'download_progress'; videoId: string; percent: number }
  | { type: 'download_complete'; videoId: string; audioUrl: string }
  | { type: 'download_error'; videoId: string; error: string }
  | { type: 'status_update'; videoId: string; status: string };

export function createWss(server: import('http').Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    ws.on('error', (err) => console.error('[ws] client error:', err.message));
  });

  heartbeat = setInterval(() => {
    wss?.clients.forEach((ws) => {
      if (alive.get(ws) === false) { ws.terminate(); return; }
      alive.set(ws, false);
      ws.ping();
    });
  }, 30000);
  wss.on('close', () => { if (heartbeat) clearInterval(heartbeat); });
  return wss;
}

export function broadcast(msg: WsMessage): void {
  if (!wss) return;
  const data = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.bufferedAmount < MAX_BUFFERED) {
      client.send(data);
    }
  });
}
```

- [ ] **Step 2: Verify build + existing broadcast tests**

Run: `npm run test --prefix server -- broadcast`
Expected: PASS — existing OPEN/CLOSED filtering tests still green (new clients start with `bufferedAmount` 0, so the added guard doesn't change their behavior).

- [ ] **Step 3: Commit**

```bash
git add server/src/ws/broadcast.ts
git commit -m "fix(server): WebSocket heartbeat + backpressure guard"
```

---

# PHASE B — Frontend performance & architecture

## Task B1: Narrow Zustand subscriptions in the control surface (Critical C6)

**Files:**
- Modify: `src/store/deckStore.ts` (add a stable action selector hook)
- Modify: `src/components/Deck/DeckControls.tsx`, `HotCues.tsx`, `BeatJump.tsx`, `PitchSlider.tsx`, `SyncButton.tsx`, `LoopControls.tsx`, `TapTempo.tsx`, `EQPanel.tsx`, `EffectsPanel.tsx`
- Test: `src/test/deck-rerender.test.tsx` (create)

**Principle:** Components that only dispatch actions must not subscribe to reactive deck fields. Replace bare `useDeckStore()` / whole-`deck` destructuring with (a) individual action selectors `useDeckStore((s) => s.someAction)` and (b) field selectors `useDeckStore((s) => s.decks[deckId].someField)` for the specific fields a component renders.

- [ ] **Step 1: Write the failing render-count test**

Create `src/test/deck-rerender.test.tsx`. It mounts a control component **inside a React `Profiler`** (whose `onRender` fires on every commit that re-renders anything in the subtree — the correct way to detect a component's own re-renders, since React re-renders a subscribing component in isolation, not its parent). Load a track, then tick `setCurrentTime` repeatedly and assert no additional commit:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { Profiler } from 'react';
import { render, act } from '@testing-library/react';
import { useDeckStore } from '../store/deckStore';
import { DeckControls } from '../components/Deck/DeckControls';

describe('DeckControls does not re-render on currentTime ticks', () => {
  beforeEach(() => { useDeckStore.getState().clearTrack('A'); });

  it('stays put across 10 playhead ticks', () => {
    const store = useDeckStore.getState();
    store.loadTrack('A', 'vid12345678', { sourceType: 'youtube', title: 't', artist: 'a', duration: 180, thumbnailUrl: null });
    let commits = 0;
    render(
      <Profiler id="deck-controls" onRender={() => { commits++; }}>
        <DeckControls deckId="A" />
      </Profiler>,
    );
    const baseline = commits; // 1+ from initial mount
    act(() => { for (let i = 1; i <= 10; i++) store.setCurrentTime('A', i); });
    expect(commits).toBe(baseline); // zero extra commits from time ticks
  });
});
```

> If `DeckControls` legitimately renders `currentTime` (a time display), it SHOULD re-render on ticks — in that case pick a control component that does NOT display time for this assertion (e.g. `SyncButton` or `BeatJump`), and note the substitution. The point is that pure-action / non-time-field components must not re-render on the playhead tick.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- src/test/deck-rerender.test.tsx`
Expected: FAIL — `DeckControls` currently subscribes to the whole store and re-renders on each tick.

- [ ] **Step 3: Add a stable action-selector helper to `deckStore.ts`**

At the bottom of `src/store/deckStore.ts`, add:

```ts
import { useShallow } from 'zustand/react/shallow';

/**
 * Subscribe to a stable bag of deck ACTIONS without subscribing to any reactive
 * state. Actions never change identity, so a component using only this never
 * re-renders from state updates (e.g. currentTime ticks).
 */
export function useDeckActions() {
  return useDeckStore(
    useShallow((s) => ({
      loadTrack: s.loadTrack, clearTrack: s.clearTrack, setPlaybackState: s.setPlaybackState,
      setCurrentTime: s.setCurrentTime, setHotCue: s.setHotCue, clearHotCue: s.clearHotCue,
      setBpm: s.setBpm, setVolume: s.setVolume, setPitchRate: s.setPitchRate,
      setEq: s.setEq, setEqKill: s.setEqKill,
      setEffectType: s.setEffectType, setEffectEnabled: s.setEffectEnabled, setEffectWetDry: s.setEffectWetDry,
      activateLoop: s.activateLoop, deactivateLoop: s.deactivateLoop,
      setBeatJumpSize: s.setBeatJumpSize, setSlipMode: s.setSlipMode,
      setRollMode: s.setRollMode, startRoll: s.startRoll, endRoll: s.endRoll,
    })),
  );
}
```

These names are verified against the `DeckStore` interface in `deckStore.ts` (lines 66–195, 284–301). Include precisely the actions used by the nine listed components — trim any this bag lists that a component doesn't dispatch.

- [ ] **Step 4: Migrate each component**

For each component in the Files list: replace `const store = useDeckStore();` (or whole-deck destructuring used only for actions) with `const actions = useDeckActions();` and, where the component renders specific deck fields, add explicit field selectors, e.g. in `EQPanel.tsx`:

```ts
const eqLow = useDeckStore((s) => s.decks[deckId].eqLow);
const eqMid = useDeckStore((s) => s.decks[deckId].eqMid);
const eqHigh = useDeckStore((s) => s.decks[deckId].eqHigh);
const sourceType = useDeckStore((s) => s.decks[deckId].sourceType);
```

Components that genuinely render `currentTime` (waveforms) are out of scope — leave them. Fix the `handleKillToggle` `useCallback` in `EQPanel.tsx` to read current kill state via `useDeckStore.getState().decks[deckId]` inside the handler so its deps are `[deckId, setEqKill]`, not `[deck]`.

- [ ] **Step 5: Run the render test + full suite**

Run: `npm run test -- src/test/deck-rerender.test.tsx`
Expected: PASS.
Run: `npm run test`
Expected: PASS (all existing tests green — selectors don't change behavior, only subscription scope).
Run: `npm run lint`
Expected: PASS (watch `react-hooks/exhaustive-deps` on the changed callbacks).

- [ ] **Step 6: Commit**

```bash
git add src/store/deckStore.ts src/components/Deck/*.tsx src/test/deck-rerender.test.tsx
git commit -m "perf: narrow Zustand subscriptions in deck controls (kill playback re-render storm)"
```

---

## Task B2: Fix dropped play() promise in AudioEngine.seekTo (Important)

**Files:**
- Modify: `src/services/audioEngine.ts` (the `seekTo` playing-branch, ~line 212)

- [ ] **Step 1: Write the failing test**

In `src/test/audioEngine.test.ts` (existing), add a test that a rejecting `play()` during seek does not produce an unhandled rejection and is swallowed:

```ts
it('seekTo while playing does not throw if the restarted play() rejects', async () => {
  const engine = new AudioEngineImpl();
  await engine.loadBuffer(makeFakeBuffer()); // existing helper in this file
  engine.play(0);
  // Force the internal play() to reject on the seek-triggered restart.
  vi.spyOn(engine as unknown as { play: () => Promise<void> }, 'play')
    .mockRejectedValueOnce(new Error('ctx suspended'));
  expect(() => engine.seekTo(10)).not.toThrow();
  await Promise.resolve();
});
```

> Match `makeFakeBuffer`/setup to the helpers already in `audioEngine.test.ts`; adjust names if they differ.

- [ ] **Step 2: Run to verify it fails (unhandled rejection / throw)**

Run: `npm run test -- src/test/audioEngine.test.ts`
Expected: FAIL or an unhandled-rejection warning.

- [ ] **Step 3: Catch the rejection**

In `seekTo`, change the playing-branch call from `this.play(clampedSeconds);` to:

```ts
void this.play(clampedSeconds).catch((err) => {
  console.error('[audioEngine] seek-restart play() failed:', err);
});
```

- [ ] **Step 4: Run to verify pass**

Run: `npm run test -- src/test/audioEngine.test.ts`
Expected: PASS, no unhandled-rejection warning.

- [ ] **Step 5: Commit**

```bash
git add src/services/audioEngine.ts src/test/audioEngine.test.ts
git commit -m "fix: handle rejected play() during seek in AudioEngine"
```

---

## Task B3: Fix echo-effect node leak (Important)

**Files:**
- Modify: `src/services/audioEngine.ts` (`setEffect`, ~line 309-321; `destroy`)

- [ ] **Step 1: Write the failing test**

Add to `src/test/audioEngine.test.ts` a test that switching from echo to another effect disconnects the feedback node (assert via the Web Audio mock's `disconnect` spy on the created gain):

```ts
it('switching away from echo disconnects the feedback gain node', () => {
  const engine = new AudioEngineImpl();
  engine.setEffect('echo', 0.5, 120);
  const disconnectSpies = getCreatedGainDisconnectSpies(); // helper over the mock
  engine.setEffect('none', 0, 120);
  expect(disconnectSpies.some((s) => s.mock.calls.length > 0)).toBe(true);
});
```

> Implement `getCreatedGainDisconnectSpies` against the existing Web Audio mock in the test file (it already tracks created nodes). If the mock doesn't expose feedback gains, extend it minimally.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- src/test/audioEngine.test.ts`
Expected: FAIL — feedback gain is never disconnected.

- [ ] **Step 3: Track all per-effect nodes**

In `audioEngine.ts`, replace the single `this.effectNode` storage with an array `this.effectNodes: AudioNode[] = []`. In `setEffect`, push every node created for the effect (delay **and** `feedbackGain`). At the top of `setEffect` (and in `destroy`), disconnect and clear all:

```ts
for (const node of this.effectNodes) { try { node.disconnect(); } catch { /* already gone */ } }
this.effectNodes = [];
```

- [ ] **Step 4: Run to verify pass + full audio suite**

Run: `npm run test -- src/test/audioEngine.test.ts`
Expected: PASS (including the existing signal-chain tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/audioEngine.ts src/test/audioEngine.test.ts
git commit -m "fix: disconnect all echo effect nodes to stop Web Audio node leak"
```

---

# PHASE C — Test coverage for untested high-risk seams

## Task C1: wsClient tests (Important)

**Files:**
- Test: `src/test/wsClient.test.ts` (create)

- [ ] **Step 1: Write tests against a mock WebSocket**

Create `src/test/wsClient.test.ts` covering: connect dispatches messages to handlers, an unsubscribe stops delivery, and a close schedules a reconnect (fake timers). Use a minimal global `WebSocket` mock:

```ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

class MockWS {
  static instances: MockWS[] = [];
  onopen?: () => void; onmessage?: (e: { data: string }) => void;
  onclose?: () => void; onerror?: () => void;
  readyState = 0;
  constructor(public url: string) { MockWS.instances.push(this); }
  send = vi.fn();
  close = vi.fn(() => { this.readyState = 3; this.onclose?.(); });
  open() { this.readyState = 1; this.onopen?.(); }
  message(obj: unknown) { this.onmessage?.({ data: JSON.stringify(obj) }); }
}

beforeEach(() => { MockWS.instances = []; vi.stubGlobal('WebSocket', MockWS as unknown as typeof WebSocket); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('wsClient', () => {
  it('delivers parsed messages to subscribed handlers', async () => {
    const { wsClient } = await import('../services/wsClient');
    const handler = vi.fn();
    const off = wsClient.addHandler(handler);
    wsClient.connect();
    MockWS.instances[0]!.open();
    MockWS.instances[0]!.message({ type: 'download_progress', videoId: 'x', percent: 12 });
    expect(handler).toHaveBeenCalledWith({ type: 'download_progress', videoId: 'x', percent: 12 });
    off();
    MockWS.instances[0]!.message({ type: 'download_progress', videoId: 'x', percent: 30 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('schedules a reconnect after the socket closes', async () => {
    vi.useFakeTimers();
    const { wsClient } = await import('../services/wsClient');
    wsClient.connect();
    const first = MockWS.instances[0]!;
    first.open();
    first.close();
    vi.advanceTimersByTime(5000); // past the backoff
    expect(MockWS.instances.length).toBeGreaterThan(1);
  });
});
```

The `wsClient` singleton API is verified (`src/services/wsClient.ts:56-62`): `connect()`, `addHandler(fn) → unsubscribe`, `disconnect()`. Adjust the reconnect-backoff delay in the second test to match the implementation's first-retry interval. Because `wsClient` is a module singleton, use dynamic `import()` so each test run starts fresh (or call `disconnect()` in `afterEach`).

- [ ] **Step 2: Run**

Run: `npm run test -- src/test/wsClient.test.ts`
Expected: PASS (after aligning the API names).

- [ ] **Step 3: Commit**

```bash
git add src/test/wsClient.test.ts
git commit -m "test: cover wsClient message dispatch + reconnect"
```

---

## Task C2: authService session/expiry tests (Important)

**Files:**
- Test: `src/test/authService.test.ts` (create)

- [ ] **Step 1: Write tests for token expiry + silent-refresh boundaries**

Create `src/test/authService.test.ts`. Mock Google Identity Services (`window.google.accounts.oauth2`) and `localStorage`; assert: a profile within the 7-day window is restored on init; an expired session is cleared; the silent-refresh path requests a new token before expiry. Structure mirrors the existing `auth.test.ts` store tests but targets `authService.ts` logic.

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
// Mock the GIS global and localStorage, then import authService.
// Drive initFromStorage() / ensureFreshToken() and assert clearAuth vs restore.
```

> Read `src/services/authService.ts` first and write assertions against its real exported functions (e.g. `initFromStorage`, `signIn`, `getAccessToken`, expiry constants). Use fake timers to cross the expiry boundary.

- [ ] **Step 2: Run**

Run: `npm run test -- src/test/authService.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/test/authService.test.ts
git commit -m "test: cover authService session restore + expiry/refresh"
```

---

## Task C3: Server route tests (Important)

**Files:**
- Test: `server/src/routes/__tests__/library.test.ts`, `server/src/routes/__tests__/download.test.ts` (create)
- Modify: `server/package.json` (add `supertest` + `@types/supertest` devDeps)

- [ ] **Step 1: Install supertest**

Run: `npm install -D supertest @types/supertest --prefix server`
Expected: added to `server/package.json` devDependencies.

- [ ] **Step 2: Write route tests**

Create `server/src/routes/__tests__/download.test.ts` mounting the router on a bare express app and asserting validation + status codes:

```ts
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../services/downloadService.js', () => ({ enqueueDownload: vi.fn() }));
vi.mock('../../services/libraryService.js', () => ({ getTrackByVideoId: vi.fn(() => null) }));

import { downloadRouter } from '../download.js';

function app() { const a = express(); a.use(express.json()); a.use('/api/download', downloadRouter); return a; }

describe('download routes', () => {
  it('rejects an invalid videoId with 400', async () => {
    const res = await request(app()).post('/api/download/..%2f..%2fetc').send({});
    expect(res.status).toBe(400);
  });
  it('queues a valid videoId', async () => {
    const res = await request(app()).post('/api/download/dQw4w9WgXcQ').send({ title: 't' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ videoId: 'dQw4w9WgXcQ', status: 'queued' });
  });
  it('returns 404 for unknown status', async () => {
    const res = await request(app()).get('/api/download/dQw4w9WgXcQ/status');
    expect(res.status).toBe(404);
  });
});
```

Create `server/src/routes/__tests__/library.test.ts` covering the audio router: 400 on invalid id, 404 on missing file (mock `existsSync` false), and a 206 partial when a Range header is sent against a mocked file (`existsSync` true, `statSync` size, `createReadStream` returns a tiny readable).

- [ ] **Step 3: Run**

Run: `npm run test --prefix server -- routes`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/__tests__/ server/package.json server/package-lock.json
git commit -m "test(server): cover route validation, 404s, and range streaming"
```

---

## Task C4: Crossfader → player volume routing seam (Important)

**Files:**
- Test: `src/test/mixer-volume-routing.test.ts` (create)

- [ ] **Step 1: Write the integration test**

Create `src/test/mixer-volume-routing.test.ts`. Register a mock backend for each deck via the per-backend registry, load matching-source tracks, then assert that `setCrossfaderPosition` drives `getActivePlayer(deck, sourceType)?.setVolume(...)` (or the deck `volume` that the engine subscription consumes) with the equal-power curve value for both decks.

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useMixerStore } from '../store/mixerStore';
import { useDeckStore } from '../store/deckStore';
import { useSettingsStore } from '../store/settingsStore';

describe('crossfader → deck volume routing', () => {
  beforeEach(() => {
    useSettingsStore.setState({ masterVolume: 100 });
    useMixerStore.setState({ channelFaderA: 100, channelFaderB: 100, crossfaderPosition: 0.5 });
  });
  it('hard-A (0.0) yields A.volume > B.volume; hard-B (1.0) the reverse', () => {
    useMixerStore.getState().setCrossfaderPosition(0);
    let { A, B } = useDeckStore.getState().decks;
    expect(A.volume).toBeGreaterThan(B.volume);
    useMixerStore.getState().setCrossfaderPosition(1);
    ({ A, B } = useDeckStore.getState().decks);
    expect(B.volume).toBeGreaterThan(A.volume);
  });
});
```

> This locks in the `applyVolumesToDecks` wiring. If a `DeckPlayer.setVolume` exists and the engine subscription forwards `deck.volume` to it, extend the test to register a mock backend and assert `setVolume` was called — confirm the `DeckPlayer` interface has `setVolume` before asserting on it.

- [ ] **Step 2: Run**

Run: `npm run test -- src/test/mixer-volume-routing.test.ts`
Expected: PASS (wiring already correct; this is a regression lock).

- [ ] **Step 3: Commit**

```bash
git add src/test/mixer-volume-routing.test.ts
git commit -m "test: lock crossfader → deck volume routing"
```

---

# PHASE D — Tooling & repo hygiene

## Task D1: Untrack runtime DB artifacts + fix .gitignore (Important)

**Files:**
- Modify: `.gitignore`
- Untrack: `server/data/djrusty.db`, `*.db-shm`, `*.db-wal`

- [ ] **Step 1: Append ignore rules**

Add to `.gitignore`:

```gitignore
# Runtime data & downloads (recreated from schema.sql on first run)
server/data/*.db
server/data/*.db-shm
server/data/*.db-wal
server/downloads/
# Local agent/session config
.claude/
```

- [ ] **Step 2: Stop tracking the DB files (keep them on disk)**

Run: `git rm --cached server/data/djrusty.db server/data/djrusty.db-shm server/data/djrusty.db-wal`
Expected: files removed from the index, still present locally.

- [ ] **Step 3: Confirm clean status**

Run: `git status --short`
Expected: the `.db*` files no longer show as tracked/modified; `.claude/` no longer shows as untracked.

- [ ] **Step 4: Commit**

```bash
git add .gitignore
git commit -m "chore: stop tracking runtime DB artifacts; ignore .claude and downloads"
```

---

## Task D2: Unify the toolchain across root + server (Important)

**Files:**
- Modify: `server/package.json` (align TypeScript + Vitest majors with root)

- [ ] **Step 1: Inspect current versions**

Run: `npm ls typescript vitest --prefix server`
Run: `npm ls typescript vitest`
Expected: server on TS 6 / Vitest 4, root on TS 5.5 / Vitest 2 (the documented drift).

- [ ] **Step 2: Pin both to the root majors**

Edit `server/package.json` devDependencies to `"typescript": "^5.5.3"` and `"vitest": "^2.0.3"` (match root), then:

Run: `npm install --prefix server`
Expected: lockfile updated.

- [ ] **Step 3: Verify server build + tests under the aligned toolchain**

Run: `npm run lint --prefix server`
Expected: PASS (`tsc --noEmit` clean under TS 5.5 — fix any TS6-only syntax if it surfaces).
Run: `npm run test --prefix server`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/package.json server/package-lock.json
git commit -m "build: align server TypeScript + Vitest majors with the frontend"
```

---

## Task D3: CI workflow (Important)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Add a CI workflow that runs the real gates**

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request: { branches: [main] }
jobs:
  build-test-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm test
      - name: Server install
        run: npm ci --prefix server
      - run: npm run lint --prefix server
      - run: npm run test --prefix server
```

- [ ] **Step 2: Verify the same commands pass locally**

Run: `npm run lint`
Run: `npm run build`
Run: `npm run test`
Run: `npm run lint --prefix server`
Run: `npm run test --prefix server`
Expected: all PASS — CI mirrors local.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: build + lint + test for frontend and server on push/PR"
```

---

## Final verification gate (all phases)

- [ ] Run: `npm run lint` → PASS, zero warnings
- [ ] Run: `npm run build` → PASS
- [ ] Run: `npm run test` → PASS
- [ ] Run: `npm run lint --prefix server` → PASS
- [ ] Run: `npm run test --prefix server` → PASS
- [ ] Manual smoke (`npm run dev`): download a track (confirm progress over WS, capped concurrency), play a downloaded MP3 and **scrub** it (confirm 206 range seeking works), play a YouTube track and CUE (confirm seek), and confirm the control surface is smooth during playback (no jank from the re-render fix).

---

## Out of scope (deferred — tracked for a later pass)

These review findings are intentionally **not** in this plan (lower severity or larger refactors); listed so they aren't lost:

- **Registry clean-cut:** delete the legacy `get()`/2-arg `playerRegistry` API and migrate `story-011-hot-cues.test.ts` to `peek`/3-arg (the dual-API is unused by production code now but remains a footgun).
- **deckStore decomposition:** derive `clearTrack` from `createInitialDeckState`; extract slip/roll math to a pure `src/utils/transport.ts`.
- **useAudioEngine boilerplate:** collapse the 7 manual `subscribe`+prev-ref effects via `subscribeWithSelector`.
- **SearchPanel decomposition + remove the `window` CustomEvent bus** in favor of a store action; **Deck.tsx drop dup → shared `useFileImport`**.
- **Modal focus restore** (`SettingsModal`), **source-aware videoId handling** (remove `!` assertions; fix the Now-Playing badge for MP3), **disabled custom sliders** a11y consistency.
- **videos.ts open API-key proxy** (rate-limit / auth gate), **`loadAudioUrl` throwaway AudioContext** → shared `decodeAudioFile`.
- **Centralize the hardcoded `http://localhost:3001`** base URL; **`vite-env.d.ts` `ImportMetaEnv`** to drop the `as unknown as` casts.
- **Comment corruption** ("claudeations" in `src/types/youtube.ts`); **CLAUDE.md staleness** (README is now current).
```
