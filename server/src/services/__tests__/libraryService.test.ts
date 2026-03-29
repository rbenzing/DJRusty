/**
 * libraryService.test.ts — Unit tests for SQLite-backed library service.
 *
 * Uses an in-memory SQLite database to avoid touching the filesystem.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock better-sqlite3 with in-memory instance ───────────────────────────────

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let mockDb: Database.Database;

vi.mock('../../db/connection.js', () => ({
  getDb: () => mockDb,
}));

// ── Import SUT after mocks ────────────────────────────────────────────────────

const { getAllTracks, getTrackByVideoId, upsertTrack, updateTrackStatus, deleteTrack } =
  await import('../libraryService.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function createFreshDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schema = readFileSync(join(__dirname, '../../db/schema.sql'), 'utf-8');
  db.exec(schema);
  return db;
}

beforeEach(() => {
  mockDb = createFreshDb();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getAllTracks', () => {
  it('returns empty array when no tracks exist', () => {
    expect(getAllTracks()).toEqual([]);
  });

  it('returns all inserted tracks', () => {
    upsertTrack({ videoId: 'abc', title: 'Track A' });
    upsertTrack({ videoId: 'def', title: 'Track B' });
    expect(getAllTracks()).toHaveLength(2);
  });
});

describe('getTrackByVideoId', () => {
  it('returns null for unknown videoId', () => {
    expect(getTrackByVideoId('unknown')).toBeNull();
  });

  it('returns the track after upsert', () => {
    upsertTrack({ videoId: 'vid1', title: 'My Song', artist: 'DJ Test' });
    const track = getTrackByVideoId('vid1');
    expect(track).not.toBeNull();
    expect(track!.title).toBe('My Song');
    expect(track!.artist).toBe('DJ Test');
    expect(track!.status).toBe('pending');
  });
});

describe('upsertTrack', () => {
  it('creates a new track with pending status', () => {
    const track = upsertTrack({ videoId: 'v1', title: 'T1' });
    expect(track.status).toBe('pending');
    expect(track.videoId).toBe('v1');
  });

  it('returns the existing track without duplicating on second call', () => {
    upsertTrack({ videoId: 'v2', title: 'Original' });
    const second = upsertTrack({ videoId: 'v2', title: 'Duplicate' });
    expect(second.title).toBe('Original');
    expect(getAllTracks().filter((t) => t.videoId === 'v2')).toHaveLength(1);
  });

  it('stores duration and thumbnailUrl', () => {
    upsertTrack({ videoId: 'v3', title: 'T3', duration: 180, thumbnailUrl: 'https://example.com/thumb.jpg' });
    const track = getTrackByVideoId('v3');
    expect(track!.duration).toBe(180);
    expect(track!.thumbnailUrl).toBe('https://example.com/thumb.jpg');
  });
});

describe('updateTrackStatus', () => {
  it('updates status to downloading', () => {
    upsertTrack({ videoId: 'v4', title: 'T4' });
    updateTrackStatus('v4', 'downloading');
    expect(getTrackByVideoId('v4')!.status).toBe('downloading');
  });

  it('updates status to ready with filePath and fileSize', () => {
    upsertTrack({ videoId: 'v5', title: 'T5' });
    updateTrackStatus('v5', 'ready', { filePath: '/downloads/v5.mp3', fileSize: 5_000_000 });
    const track = getTrackByVideoId('v5')!;
    expect(track.status).toBe('ready');
    expect(track.filePath).toBe('/downloads/v5.mp3');
    expect(track.fileSize).toBe(5_000_000);
  });

  it('stores errorMessage on error status', () => {
    upsertTrack({ videoId: 'v6', title: 'T6' });
    updateTrackStatus('v6', 'error', { errorMessage: 'yt-dlp not found' });
    const track = getTrackByVideoId('v6')!;
    expect(track.status).toBe('error');
    expect(track.errorMessage).toBe('yt-dlp not found');
  });
});

describe('deleteTrack', () => {
  it('removes the track from the database', () => {
    upsertTrack({ videoId: 'v7', title: 'T7' });
    deleteTrack('v7');
    expect(getTrackByVideoId('v7')).toBeNull();
  });

  it('does not throw when videoId does not exist', () => {
    expect(() => deleteTrack('nonexistent')).not.toThrow();
  });
});
