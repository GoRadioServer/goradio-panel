package httpapi

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/goradioserver/goradio-panel/internal/auth"
	"github.com/goradioserver/goradio-panel/internal/db"
)

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token     string `json:"token"`
	ExpiresAt string `json:"expires_at"`
	Username  string `json:"username"`
}

func loginHandler(sdb *sql.DB, deps Deps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req loginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		user, err := db.GetUserByUsername(r.Context(), sdb, req.Username)
		if err != nil {
			http.Error(w, "invalid username or password", http.StatusUnauthorized)
			return
		}
		if !auth.CheckPassword(user.PasswordHash, req.Password) {
			http.Error(w, "invalid username or password", http.StatusUnauthorized)
			return
		}

		token, expiresAt, err := auth.SignSession(deps.SessionJWTSecret, user.Username, deps.SessionTTL)
		if err != nil {
			http.Error(w, "failed to sign session token", http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, loginResponse{
			Token:     token,
			ExpiresAt: expiresAt.Format(timeFormat),
			Username:  user.Username,
		})
	}
}

func meHandler(w http.ResponseWriter, r *http.Request) {
	claims, ok := sessionFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthenticated", http.StatusUnauthorized)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"username": claims.Username})
}
