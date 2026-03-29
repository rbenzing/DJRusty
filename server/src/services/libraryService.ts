import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/connection.js';

export interface Track {
  id: string;
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnailUrl: string | null;
  filePath: string;
  fileSize: number;
  format: string;
  status: 'pending' | 'downloading' | 'transcoding' | 'ready' | 'error';
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToTrack(row: Record<string, unknown>): Track {
  return {
    id: row['id'] as string,
    videoId: row['video_id'] as string,
    title: row['title'] as string,
    artist: (row['artist'] as string) ?? '',
    duration: (row['duration'] as number) ?? 0,
    thumbnailUrl: (row['thumbnail_url'] as string | null) ?? null,
    filePath: (row['file_path'] as string) ?? '',
    fileSize: (row['file_size'] as number) ?? 0,
    format: (row['format'] as string) ?? 'mp3',
    status: (row['status'] as Track['status']) ?? 'pending',
    errorMessage: (row['error_message'] as string | null) ?? null,
    createdAt: row['created_at'] as string,
    updatedAt: row['updated_at'] as string,
  };
}

export function getAllTracks(): Track[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM tracks ORDER BY created_at DESC').all();
  return (rows as Record<string, unknown>[]).map(rowToTrack);
}

export function getTrackByVideoId(videoId: string): Track | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM tracks WHERE video_id = ?').get(videoId);
  return row ? rowToTrack(row as Record<string, unknown>) : null;
}

export function upsertTrack(data: {
  videoId: string;
  title: string;
  artist?: string;
  duration?: number;
  thumbnailUrl?: string | null;
}): Track {
  const db = getDb();
  const existing = getTrackByVideoId(data.videoId);
  if (existing) return existing;

  const id = uuidv4();
  db.prepare(`
    INSERT INTO tracks (id, video_id, title, artist, duration, thumbnail_url, file_path, status)
    VALUES (?, ?, ?, ?, ?, ?, '', 'pending')
  `).run(id, data.videoId, data.title, data.artist ?? '', data.duration ?? 0, data.thumbnailUrl ?? null);

  return getTrackByVideoId(data.videoId)!;
}

export function updateTrackStatus(
  videoId: string,
  status: Track['status'],
  extras: { filePath?: string; fileSize?: number; errorMessage?: string } = {},
): void {
  const db = getDb();
  db.prepare(`
    UPDATE tracks
    SET status = ?, file_path = COALESCE(?, file_path),
        file_size = COALESCE(?, file_size),
        error_message = ?,
        updated_at = datetime('now')
    WHERE video_id = ?
  `).run(status, extras.filePath ?? null, extras.fileSize ?? null, extras.errorMessage ?? null, videoId);
}

export function deleteTrack(videoId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM tracks WHERE video_id = ?').run(videoId);
}
