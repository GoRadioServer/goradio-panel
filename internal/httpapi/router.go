// Package httpapi implements the panel's REST API: session-authenticated
// routes proxying/wrapping the audio server's gRPC control plane, plus
// this panel's own login and listener-stats endpoints.
package httpapi

import (
	"database/sql"
	"net/http"
	"os"
	"time"

	"github.com/tmfksoft/goradio-panel/internal/audioclient"
	"github.com/tmfksoft/goradio-panel/internal/stats"
)

// Deps bundles the dependencies handlers need, so router.go stays a plain
// list of routes wired to constructors.
type Deps struct {
	SessionJWTSecret []byte
	SessionTTL       time.Duration
	SSETokenTTL      time.Duration
	AudioClient      *audioclient.Client
	StatsStore       *stats.Store
	// StaticDir, if set and present on disk, serves the built frontend
	// (web/dist) alongside the API on the same port -- the Docker image
	// bakes this in for a single-container deploy. Left empty for local
	// dev, where the frontend runs separately via `npm run dev`.
	StaticDir string
}

func NewRouter(sdb *sql.DB, deps Deps) http.Handler {
	mux := http.NewServeMux()
	auth := func(h http.HandlerFunc) http.HandlerFunc { return requireSession(deps.SessionJWTSecret, h) }

	mux.HandleFunc("GET /healthz", healthzHandler)

	mux.HandleFunc("POST /api/auth/login", loginHandler(sdb, deps))
	mux.HandleFunc("GET /api/auth/me", auth(meHandler))
	mux.HandleFunc("GET /api/config", auth(configHandler(deps.AudioClient)))

	mux.HandleFunc("GET /api/users", auth(listUsersHandler(sdb)))
	mux.HandleFunc("POST /api/users", auth(createUserHandler(sdb)))
	mux.HandleFunc("DELETE /api/users/{id}", auth(deleteUserHandler(sdb)))
	mux.HandleFunc("POST /api/users/{id}/password", auth(setPasswordHandler(sdb)))

	mux.HandleFunc("GET /api/stations", auth(stationsHandler(deps.AudioClient)))
	mux.HandleFunc("GET /api/stations/{slug}", auth(stationStatusHandler(deps.AudioClient)))
	mux.HandleFunc("POST /api/stations/{slug}/unregister", auth(unregisterStationHandler(deps.AudioClient)))

	mux.HandleFunc("POST /api/stations/{slug}/queue", auth(queueTrackHandler(deps.AudioClient)))
	mux.HandleFunc("DELETE /api/stations/{slug}/queue/{queueId}", auth(removeFromQueueHandler(deps.AudioClient)))
	mux.HandleFunc("POST /api/stations/{slug}/queue/clear", auth(clearQueueHandler(deps.AudioClient)))
	mux.HandleFunc("POST /api/stations/{slug}/skip", auth(skipHandler(deps.AudioClient)))
	mux.HandleFunc("POST /api/stations/{slug}/skip-to/{queueId}", auth(skipToHandler(deps.AudioClient)))
	mux.HandleFunc("POST /api/stations/{slug}/seek", auth(seekHandler(deps.AudioClient)))

	mux.HandleFunc("GET /api/stations/{slug}/stats", auth(statsHandler(deps.StatsStore)))

	mux.HandleFunc("GET /api/sse-token", auth(sseTokenHandler(deps.SessionJWTSecret, deps.SSETokenTTL)))
	mux.HandleFunc("GET /api/stations/{slug}/events", sseHandler(deps.AudioClient, deps.SessionJWTSecret))

	if deps.StaticDir != "" {
		if _, err := os.Stat(deps.StaticDir); err == nil {
			// Catch-all: Go's ServeMux matches by pattern specificity, not
			// registration order, so "/" here doesn't shadow the "/api/..."
			// routes above regardless of where it's registered.
			mux.Handle("/", spaHandler(deps.StaticDir))
		}
	}

	return mux
}
