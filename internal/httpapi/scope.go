package httpapi

import (
	"net/http"

	"github.com/tmfksoft/goradio-panel/internal/audioclient"
	"github.com/tmfksoft/goradio-panel/internal/stats"
)

// serverScope is one request's resolved audio server: which server the
// route addressed, the client for it, and its stats collector.
type serverScope struct {
	ID        string
	Client    *audioclient.Client
	Collector *stats.Collector
}

// scopedHandler is a handler for a route under /api/servers/{server}/.
type scopedHandler func(w http.ResponseWriter, r *http.Request, s serverScope)

// withServer resolves {server} from the path and hands the handler its
// client and collector, 404ing when the ID isn't a configured server.
// Every station-facing route goes through this, so no handler ever has to
// think about which server it's acting on.
func (deps Deps) withServer(h scopedHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("server")
		srv, ok := deps.Servers.Get(id)
		if !ok {
			http.Error(w, "unknown audio server", http.StatusNotFound)
			return
		}
		h(w, r, serverScope{ID: id, Client: srv.Client, Collector: deps.Collectors[id]})
	}
}
