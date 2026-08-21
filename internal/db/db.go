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
func Open(path string) (*sql.DB, error) {
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

	if err := migrate(sdb); err != nil {
		return nil, err
	}

	return sdb, nil
}

func migrate(sdb *sql.DB) error {
	if _, err := sdb.Exec(schema); err != nil {
		return fmt.Errorf("apply schema: %w", err)
	}
	return nil
}
