// Package stats captures the audio server's listener-count history (which
// it does not persist itself) into the panel's own SQLite database, via a
// discovery loop, per-station SubscribeEvents fan-in, and a periodic
// fallback snapshot.
package stats

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

type Point struct {
	Timestamp     time.Time `json:"ts"`
	ListenerCount int64     `json:"listener_count"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func (s *Store) Insert(ctx context.Context, slug string, ts time.Time, listenerCount int64) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO listener_stats (slug, ts, listener_count) VALUES (?, ?, ?)`,
		slug, ts.UTC(), listenerCount)
	if err != nil {
		return fmt.Errorf("insert listener stat: %w", err)
	}
	return nil
}

func (s *Store) Query(ctx context.Context, slug string, from, to time.Time) ([]Point, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT ts, listener_count FROM listener_stats WHERE slug = ? AND ts >= ? AND ts <= ? ORDER BY ts`,
		slug, from.UTC(), to.UTC())
	if err != nil {
		return nil, fmt.Errorf("query listener stats: %w", err)
	}
	defer rows.Close()

	points := []Point{}
	for rows.Next() {
		var p Point
		if err := rows.Scan(&p.Timestamp, &p.ListenerCount); err != nil {
			return nil, fmt.Errorf("scan listener stat: %w", err)
		}
		points = append(points, p)
	}
	return points, rows.Err()
}
