CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS listener_stats (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  slug           TEXT NOT NULL,
  ts             TIMESTAMP NOT NULL,
  listener_count INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_listener_stats_slug_ts ON listener_stats (slug, ts);
