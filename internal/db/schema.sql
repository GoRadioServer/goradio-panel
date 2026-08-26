CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS listener_stats (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id      TEXT NOT NULL DEFAULT '',
  slug           TEXT NOT NULL,
  ts             TIMESTAMP NOT NULL,
  listener_count INTEGER NOT NULL
);
-- The index on server_id is created in Go, not here: against a database
-- predating the column this file runs BEFORE the ALTER TABLE that adds it,
-- so an index over server_id here would fail on exactly the upgrade path
-- it exists to serve. See migrateListenerStatsServerID.

CREATE TABLE IF NOT EXISTS managed_stations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id       TEXT NOT NULL,
  slug            TEXT NOT NULL,
  name            TEXT NOT NULL,
  desired_running INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMP NOT NULL,
  updated_at      TIMESTAMP NOT NULL,
  UNIQUE (server_id, slug)
);
