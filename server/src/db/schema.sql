CREATE TABLE IF NOT EXISTS tracks (
  id            TEXT PRIMARY KEY,
  video_id      TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  artist        TEXT NOT NULL DEFAULT '',
  duration      REAL NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  file_path     TEXT NOT NULL DEFAULT '',
  file_size     INTEGER NOT NULL DEFAULT 0,
  format        TEXT NOT NULL DEFAULT 'mp3',
  status        TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tracks_video_id ON tracks(video_id);
CREATE INDEX IF NOT EXISTS idx_tracks_status   ON tracks(status);

CREATE TABLE IF NOT EXISTS download_queue (
  id          TEXT PRIMARY KEY,
  video_id    TEXT NOT NULL,
  priority    INTEGER NOT NULL DEFAULT 0,
  attempts    INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  status      TEXT NOT NULL DEFAULT 'queued',
  error       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (video_id) REFERENCES tracks(video_id)
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON download_queue(status);
