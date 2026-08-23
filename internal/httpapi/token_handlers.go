package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

type mintTokenRequest struct {
	// Exact slugs or filepath.Match globs (e.g. "*" for every station),
	// matching the audio server's own auth.Claims.Slugs semantics.
	Slugs    []string `json:"slugs"`
	Subject  string   `json:"subject"`
	TTL      string   `json:"ttl"` // Go duration string, e.g. "24h"
	ReadOnly bool     `json:"read_only"`
}

type mintTokenResponse struct {
	Token     string `json:"token"`
	ExpiresAt string `json:"expires_at"`
}

// mintTokenHandler issues audio-server-compatible tokens on demand --
// equivalent to running `radio tokengen` against the audio server's own
// shared secret, without needing shell access to it. Session-authenticated
// like every other panel route; the audio server itself is the one that
// actually enforces what a minted token can do once used.
func mintTokenHandler(w http.ResponseWriter, r *http.Request, s serverScope) {
	var req mintTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	slugs := make([]string, 0, len(req.Slugs))
	for _, s := range req.Slugs {
		if s = strings.TrimSpace(s); s != "" {
			slugs = append(slugs, s)
		}
	}
	if len(slugs) == 0 {
		http.Error(w, "at least one slug (or glob pattern like \"*\") is required", http.StatusBadRequest)
		return
	}

	subject := strings.TrimSpace(req.Subject)
	if subject == "" {
		subject = "goradio-panel"
	}

	ttl := 24 * time.Hour
	if req.TTL != "" {
		parsed, err := time.ParseDuration(req.TTL)
		if err != nil {
			http.Error(w, "invalid ttl: "+err.Error(), http.StatusBadRequest)
			return
		}
		if parsed <= 0 {
			http.Error(w, "ttl must be positive", http.StatusBadRequest)
			return
		}
		ttl = parsed
	}

	token, err := s.Client.MintStationToken(slugs, subject, ttl, req.ReadOnly)
	if err != nil {
		http.Error(w, "failed to mint token", http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, mintTokenResponse{
		Token:     token,
		ExpiresAt: time.Now().Add(ttl).UTC().Format(time.RFC3339),
	})
}
