package httpapi

import (
	"net/http"

	"github.com/tmfksoft/goradio-panel/internal/audioclient"
)

// configHandler exposes static, session-scoped deployment config the
// frontend needs but can't derive on its own -- currently just the audio
// server's public HTTP base, for building station listen URLs
// (GET {http_base_url}/stream/{slug}). Empty if audioserver.http_base_url
// wasn't configured, in which case the UI hides the player.
func configHandler(client *audioclient.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{
			"http_base_url": client.HTTPBaseURL(),
		})
	}
}
