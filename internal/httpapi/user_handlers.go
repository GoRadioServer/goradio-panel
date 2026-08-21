package httpapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/tmfksoft/goradio-panel/internal/auth"
	"github.com/tmfksoft/goradio-panel/internal/db"
)

// minPasswordLength is deliberately modest -- this panel is an internal
// operator tool, not a public signup.
const minPasswordLength = 8

type userResponse struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	CreatedAt string `json:"created_at"`
	Self      bool   `json:"self"`
}

// Every account is an admin for now: there are no roles, so any signed-in
// user can manage the others. The only guardrails are that you can't
// delete yourself (an easy way to lock the panel out by accident) and
// can't delete the last remaining account.
func listUsersHandler(sdb *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, _ := sessionFromContext(r.Context())

		users, err := db.ListUsers(r.Context(), sdb)
		if err != nil {
			http.Error(w, "failed to list users", http.StatusInternalServerError)
			return
		}

		out := make([]userResponse, 0, len(users))
		for _, u := range users {
			created := ""
			if !u.CreatedAt.IsZero() {
				created = u.CreatedAt.UTC().Format(time.RFC3339)
			}
			out = append(out, userResponse{
				ID:        u.ID,
				Username:  u.Username,
				CreatedAt: created,
				Self:      claims != nil && claims.Username == u.Username,
			})
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func createUserHandler(sdb *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		req.Username = strings.TrimSpace(req.Username)
		if req.Username == "" {
			http.Error(w, "username is required", http.StatusBadRequest)
			return
		}
		if len(req.Password) < minPasswordLength {
			http.Error(w, "password must be at least 8 characters", http.StatusBadRequest)
			return
		}

		hash, err := auth.HashPassword(req.Password)
		if err != nil {
			http.Error(w, "failed to hash password", http.StatusInternalServerError)
			return
		}

		if err := db.CreateUser(r.Context(), sdb, req.Username, hash); err != nil {
			if errors.Is(err, db.ErrUserExists) {
				http.Error(w, "that username is already taken", http.StatusConflict)
				return
			}
			http.Error(w, "failed to create user", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusCreated)
	}
}

func deleteUserHandler(sdb *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			http.Error(w, "invalid user id", http.StatusBadRequest)
			return
		}

		claims, ok := sessionFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthenticated", http.StatusUnauthorized)
			return
		}
		self, err := db.GetUserByUsername(r.Context(), sdb, claims.Username)
		if err == nil && self.ID == id {
			http.Error(w, "you can't delete your own account", http.StatusForbidden)
			return
		}

		count, err := db.CountUsers(r.Context(), sdb)
		if err != nil {
			http.Error(w, "failed to delete user", http.StatusInternalServerError)
			return
		}
		if count <= 1 {
			http.Error(w, "can't delete the last remaining user", http.StatusForbidden)
			return
		}

		deleted, err := db.DeleteUser(r.Context(), sdb, id)
		if err != nil {
			http.Error(w, "failed to delete user", http.StatusInternalServerError)
			return
		}
		if !deleted {
			http.Error(w, "user not found", http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func setPasswordHandler(sdb *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
		if err != nil {
			http.Error(w, "invalid user id", http.StatusBadRequest)
			return
		}

		var req struct {
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if len(req.Password) < minPasswordLength {
			http.Error(w, "password must be at least 8 characters", http.StatusBadRequest)
			return
		}

		hash, err := auth.HashPassword(req.Password)
		if err != nil {
			http.Error(w, "failed to hash password", http.StatusInternalServerError)
			return
		}

		updated, err := db.SetPassword(r.Context(), sdb, id, hash)
		if err != nil {
			http.Error(w, "failed to set password", http.StatusInternalServerError)
			return
		}
		if !updated {
			http.Error(w, "user not found", http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
