// Package db manages the panel's SQLite storage: user accounts and
// captured listener-count history.
package db

import (
	"database/sql"
	_ "embed"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schema string

// Open opens (creating if necessary) the SQLite database at path and
// applies the schema.
//
// defaultServerID is the audio server that pre-multi-server listener_stats
// rows are attributed to when the server_id column is first added; pass
// the first configured server's ID.
func Open(path, defaultServerID string) (*sql.DB, error) {
	if dir := filepath.Dir(path); dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("create db directory: %w", err)
		}
	}

	sdb, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite %q: %w", path, err)
	}
	sdb.SetMaxOpenConns(1) // modernc.org/sqlite: avoid concurrent-writer lock contention

	if _, err := sdb.Exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;`); err != nil {
		return nil, fmt.Errorf("set pragmas: %w", err)
	}

	if err := migrate(sdb, defaultServerID); err != nil {
		return nil, err
	}

	return sdb, nil
}

func migrate(sdb *sql.DB, defaultServerID string) error {
	if _, err := sdb.Exec(schema); err != nil {
		return fmt.Errorf("apply schema: %w", err)
	}
	return migrateListenerStatsServerID(sdb, defaultServerID)
}

// migrateListenerStatsServerID adds listener_stats.server_id to databases
// created before multi-server support. schema.sql alone can't do this: its
// CREATE TABLE IF NOT EXISTS is a no-op against the existing table, so the
// column has to be added explicitly. Rows predating the column are
// attributed to defaultServerID, which is the server they were in fact
// captured from back when the panel only had one.
func migrateListenerStatsServerID(sdb *sql.DB, defaultServerID string) error {
	hasColumn, err := columnExists(sdb, "listener_stats", "server_id")
	if err != nil {
		return err
	}
	if !hasColumn {
		if _, err := sdb.Exec(
			`ALTER TABLE listener_stats ADD COLUMN server_id TEXT NOT NULL DEFAULT ''`,
		); err != nil {
			return fmt.Errorf("add listener_stats.server_id: %w", err)
		}
	}

	// Unconditional: a fresh database gets server_id from schema.sql and so
	// skips the ALTER above, but still needs the index.
	if _, err := sdb.Exec(
		`CREATE INDEX IF NOT EXISTS idx_listener_stats_server_slug_ts
		   ON listener_stats (server_id, slug, ts)`,
	); err != nil {
		return fmt.Errorf("index listener_stats.server_id: %w", err)
	}
	// Superseded by the composite index above -- every query filters on
	// server_id now, so the old slug-only index is pure write overhead.
	if _, err := sdb.Exec(`DROP INDEX IF EXISTS idx_listener_stats_slug_ts`); err != nil {
		return fmt.Errorf("drop superseded listener_stats index: %w", err)
	}

	if defaultServerID != "" {
		if _, err := sdb.Exec(
			`UPDATE listener_stats SET server_id = ? WHERE server_id = ''`, defaultServerID,
		); err != nil {
			return fmt.Errorf("backfill listener_stats.server_id: %w", err)
		}
	}
	return nil
}

func columnExists(sdb *sql.DB, table, column string) (bool, error) {
	rows, err := sdb.Query(`SELECT name FROM pragma_table_info(?)`, table)
	if err != nil {
		return false, fmt.Errorf("inspect %s columns: %w", table, err)
	}
	defer rows.Close()

	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return false, fmt.Errorf("scan %s column: %w", table, err)
		}
		if name == column {
			return true, nil
		}
	}
	return false, rows.Err()
}
