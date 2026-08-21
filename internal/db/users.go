package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrUserNotFound = errors.New("user not found")
	ErrUserExists   = errors.New("username already taken")
)

type User struct {
	ID           int64
	Username     string
	PasswordHash string
	CreatedAt    time.Time
}

func CountUsers(ctx context.Context, sdb *sql.DB) (int, error) {
	var n int
	if err := sdb.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&n); err != nil {
		return 0, fmt.Errorf("count users: %w", err)
	}
	return n, nil
}

func CreateUser(ctx context.Context, sdb *sql.DB, username, passwordHash string) error {
	_, err := sdb.ExecContext(ctx,
		`INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)`,
		username, passwordHash, time.Now().UTC())
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			return ErrUserExists
		}
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

func GetUserByUsername(ctx context.Context, sdb *sql.DB, username string) (*User, error) {
	u := &User{}
	err := sdb.QueryRowContext(ctx, `SELECT id, username, password_hash FROM users WHERE username = ?`, username).
		Scan(&u.ID, &u.Username, &u.PasswordHash)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}
	return u, nil
}

func ListUsers(ctx context.Context, sdb *sql.DB) ([]User, error) {
	rows, err := sdb.QueryContext(ctx, `SELECT id, username, created_at FROM users ORDER BY username`)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	users := []User{}
	for rows.Next() {
		var u User
		var created any
		if err := rows.Scan(&u.ID, &u.Username, &created); err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		u.CreatedAt = parseSQLiteTime(created)
		users = append(users, u)
	}
	return users, rows.Err()
}

func DeleteUser(ctx context.Context, sdb *sql.DB, id int64) (bool, error) {
	res, err := sdb.ExecContext(ctx, `DELETE FROM users WHERE id = ?`, id)
	if err != nil {
		return false, fmt.Errorf("delete user: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("delete user: %w", err)
	}
	return n > 0, nil
}

func SetPassword(ctx context.Context, sdb *sql.DB, id int64, passwordHash string) (bool, error) {
	res, err := sdb.ExecContext(ctx, `UPDATE users SET password_hash = ? WHERE id = ?`, passwordHash, id)
	if err != nil {
		return false, fmt.Errorf("set password: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("set password: %w", err)
	}
	return n > 0, nil
}

// parseSQLiteTime normalises created_at, which can come back as a
// time.Time (rows this Go code inserted) or as text in SQLite's own
// CURRENT_TIMESTAMP format (the bootstrap admin row, inserted by the
// column default before CreateUser passed an explicit timestamp).
func parseSQLiteTime(v any) time.Time {
	switch t := v.(type) {
	case time.Time:
		return t
	case string:
		return parseTimeString(t)
	case []byte:
		return parseTimeString(string(t))
	default:
		return time.Time{}
	}
}

func parseTimeString(s string) time.Time {
	for _, layout := range []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05.999999999-07:00",
		"2006-01-02 15:04:05",
	} {
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	return time.Time{}
}
