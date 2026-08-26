package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

var ErrManagedStationExists = errors.New("station already managed")
var ErrManagedStationNotFound = errors.New("managed station not found")

// ManagedStation is a station the panel creates and runs `radio station`
// for -- server_id/slug identify it, desired_running is the persisted
// intent a panel restart reconciles against. The script and its
// station.yaml live on disk (under station_runner.data_dir), not here.
type ManagedStation struct {
	ID             int64
	ServerID       string
	Slug           string
	Name           string
	DesiredRunning bool
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

func CreateManagedStation(ctx context.Context, sdb *sql.DB, serverID, slug, name string) (*ManagedStation, error) {
	now := time.Now().UTC()
	res, err := sdb.ExecContext(ctx,
		`INSERT INTO managed_stations (server_id, slug, name, desired_running, created_at, updated_at)
		 VALUES (?, ?, ?, 1, ?, ?)`,
		serverID, slug, name, now, now)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return nil, ErrManagedStationExists
		}
		return nil, fmt.Errorf("create managed station: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("create managed station: %w", err)
	}
	return &ManagedStation{
		ID: id, ServerID: serverID, Slug: slug, Name: name,
		DesiredRunning: true, CreatedAt: now, UpdatedAt: now,
	}, nil
}

func GetManagedStation(ctx context.Context, sdb *sql.DB, serverID, slug string) (*ManagedStation, error) {
	m := &ManagedStation{}
	var desiredRunning int
	var created, updated any
	err := sdb.QueryRowContext(ctx,
		`SELECT id, server_id, slug, name, desired_running, created_at, updated_at
		   FROM managed_stations WHERE server_id = ? AND slug = ?`,
		serverID, slug,
	).Scan(&m.ID, &m.ServerID, &m.Slug, &m.Name, &desiredRunning, &created, &updated)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrManagedStationNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get managed station: %w", err)
	}
	m.DesiredRunning = desiredRunning != 0
	m.CreatedAt = parseSQLiteTime(created)
	m.UpdatedAt = parseSQLiteTime(updated)
	return m, nil
}

func ListManagedStations(ctx context.Context, sdb *sql.DB, serverID string) ([]ManagedStation, error) {
	rows, err := sdb.QueryContext(ctx,
		`SELECT id, server_id, slug, name, desired_running, created_at, updated_at
		   FROM managed_stations WHERE server_id = ? ORDER BY slug`,
		serverID)
	if err != nil {
		return nil, fmt.Errorf("list managed stations: %w", err)
	}
	defer rows.Close()

	stations := []ManagedStation{}
	for rows.Next() {
		var m ManagedStation
		var desiredRunning int
		var created, updated any
		if err := rows.Scan(&m.ID, &m.ServerID, &m.Slug, &m.Name, &desiredRunning, &created, &updated); err != nil {
			return nil, fmt.Errorf("scan managed station: %w", err)
		}
		m.DesiredRunning = desiredRunning != 0
		m.CreatedAt = parseSQLiteTime(created)
		m.UpdatedAt = parseSQLiteTime(updated)
		stations = append(stations, m)
	}
	return stations, rows.Err()
}

func SetDesiredRunning(ctx context.Context, sdb *sql.DB, serverID, slug string, running bool) error {
	res, err := sdb.ExecContext(ctx,
		`UPDATE managed_stations SET desired_running = ?, updated_at = ? WHERE server_id = ? AND slug = ?`,
		running, time.Now().UTC(), serverID, slug)
	if err != nil {
		return fmt.Errorf("set desired_running: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("set desired_running: %w", err)
	}
	if n == 0 {
		return ErrManagedStationNotFound
	}
	return nil
}

func DeleteManagedStation(ctx context.Context, sdb *sql.DB, serverID, slug string) error {
	res, err := sdb.ExecContext(ctx,
		`DELETE FROM managed_stations WHERE server_id = ? AND slug = ?`, serverID, slug)
	if err != nil {
		return fmt.Errorf("delete managed station: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("delete managed station: %w", err)
	}
	if n == 0 {
		return ErrManagedStationNotFound
	}
	return nil
}
