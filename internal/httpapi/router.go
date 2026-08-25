// Package httpapi implements the panel's REST API: session-authenticated
// routes proxying/wrapping the audio servers' gRPC control planes, plus
// this panel's own login and listener-stats endpoints.
//
// Everything that acts on a station lives under /api/servers/{server}/,
// resolved by Deps.withServer -- the panel can be pointed at several audio
// servers at once and a bare slug is only unique within one of them.
package httpapi

import (
	"database/sql"
	"net/http"
	"os"
	"time"

	"github.com/goradioserver/goradio-panel/internal/audioclient"
	"github.com/goradioserver/goradio-panel/internal/releases"
	"github.com/goradioserver/goradio-panel/internal/stats"
)

// Deps bundles the dependencies handlers need, so router.go stays a plain
// list of routes wired to constructors.
type Deps struct {
	SessionJWTSecret []byte
	SessionTTL       time.Duration
	SSETokenTTL      time.Duration
	// Servers holds every configured audio server's connection.
	Servers *audioclient.Registry
	// Collectors holds each server's stats collector, keyed by server ID.
	Collectors map[string]*stats.Collector
	StatsStore *stats.Store
	// Releases checks GitHub for newer audio server releases. Nil when
	// update checking is disabled.
	Releases *releases.Checker
	// StaticDir, if set and present on disk, serves the built frontend
	// (web/dist) alongside the API on the same port -- the Docker image
	// bakes this in for a single-container deploy. Left empty for local
	// dev, where the frontend runs separately via `npm run dev`.
	StaticDir string
}

func NewRouter(sdb *sql.DB, deps Deps) http.Handler {
	mux := http.NewServeMux()
	auth := func(h http.HandlerFunc) http.HandlerFunc { return requireSession(deps.SessionJWTSecret, h) }
	// Session-authenticated and scoped to one audio server.
	scoped := func(h scopedHandler) http.HandlerFunc { return auth(deps.withServer(h)) }

	mux.HandleFunc("GET /healthz", healthzHandler)

	mux.HandleFunc("POST /api/auth/login", loginHandler(sdb, deps))
	mux.HandleFunc("GET /api/auth/me", auth(meHandler))

	mux.HandleFunc("GET /api/servers", auth(serversHandler(deps.Servers)))

	mux.HandleFunc("GET /api/users", auth(listUsersHandler(sdb)))
	mux.HandleFunc("POST /api/users", auth(createUserHandler(sdb)))
	mux.HandleFunc("DELETE /api/users/{id}", auth(deleteUserHandler(sdb)))
	mux.HandleFunc("POST /api/users/{id}/password", auth(setPasswordHandler(sdb)))

	mux.HandleFunc("GET /api/servers/{server}/config", scoped(configHandler))
	mux.HandleFunc("GET /api/servers/{server}/version", scoped(versionHandler(deps.Releases)))
	mux.HandleFunc("POST /api/servers/{server}/tokens", scoped(mintTokenHandler))
	mux.HandleFunc("GET /api/servers/{server}/browse", scoped(browseHandler))

	mux.HandleFunc("GET /api/servers/{server}/stations", scoped(stationsHandler))
	mux.HandleFunc("GET /api/servers/{server}/stations/{slug}", scoped(stationStatusHandler))
	mux.HandleFunc("POST /api/servers/{server}/stations/{slug}/unregister", scoped(unregisterStationHandler))

	mux.HandleFunc("POST /api/servers/{server}/stations/{slug}/queue", scoped(queueTrackHandler))
	mux.HandleFunc("DELETE /api/servers/{server}/stations/{slug}/queue/{queueId}", scoped(removeFromQueueHandler))
	mux.HandleFunc("POST /api/servers/{server}/stations/{slug}/queue/clear", scoped(clearQueueHandler))
	mux.HandleFunc("POST /api/servers/{server}/stations/{slug}/skip", scoped(skipHandler))
	mux.HandleFunc("POST /api/servers/{server}/stations/{slug}/skip-to/{queueId}", scoped(skipToHandler))
	mux.HandleFunc("POST /api/servers/{server}/stations/{slug}/seek", scoped(seekHandler))

	mux.HandleFunc("GET /api/servers/{server}/stations/{slug}/stats", scoped(statsHandler(deps.StatsStore)))

	mux.HandleFunc("GET /api/servers/{server}/sse-token", scoped(sseTokenHandler(deps.SessionJWTSecret, deps.SSETokenTTL)))
	// Authenticated by its own ?token= rather than a session header, so it
	// takes withServer directly instead of going through scoped.
	mux.HandleFunc("GET /api/servers/{server}/stations/{slug}/events",
		deps.withServer(sseHandler(deps.SessionJWTSecret)))

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
