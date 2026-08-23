package httpapi

import (
	"net/http"

	"github.com/tmfksoft/goradio-panel/internal/releases"
)

type versionResponse struct {
	// Version is what this audio server reports running, e.g. "v0.11.1",
	// or "dev" for a locally built binary. Empty if the server couldn't be
	// reached or predates the GetServerInfo RPC.
	Version string `json:"version"`
	// Latest is the newest published release upstream, or null when update
	// checking is disabled or GitHub hasn't answered yet.
	Latest *releases.Release `json:"latest"`
	// UpdateAvailable is true only when both versions parsed and latest is
	// genuinely newer -- never for a "dev" build or an unreachable server.
	UpdateAvailable bool `json:"update_available"`
}

// versionHandler reports the audio server's version alongside the latest
// upstream release. The server version comes from a live RPC; the release
// side is served from the checker's cache, so this never blocks on GitHub.
func versionHandler(checker *releases.Checker) scopedHandler {
	return func(w http.ResponseWriter, r *http.Request, s serverScope) {
		out := versionResponse{}

		// A server too old to implement GetServerInfo (or momentarily
		// unreachable) shouldn't fail the request -- the panel just can't
		// say what it's running, which the empty version conveys.
		if version, err := s.Client.ServerVersion(r.Context()); err == nil {
			out.Version = version
		}

		if checker != nil {
			if latest, ok := checker.Latest(); ok {
				out.Latest = latest
				out.UpdateAvailable = releases.UpdateAvailable(out.Version, latest.Version)
			}
		}
		writeJSON(w, http.StatusOK, out)
	}
}
