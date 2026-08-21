package httpapi

import (
	"fmt"
	"net/http"
	"time"

	"github.com/tmfksoft/goradio-panel/internal/audioclient"
	"github.com/tmfksoft/goradio-panel/internal/auth"
)

func sseTokenHandler(secret []byte, ttl time.Duration) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := sessionFromContext(r.Context())
		if !ok {
			http.Error(w, "unauthenticated", http.StatusUnauthorized)
			return
		}
		slug := r.URL.Query().Get("slug")
		if slug == "" {
			http.Error(w, "slug query parameter is required", http.StatusBadRequest)
			return
		}

		token, expiresAt, err := auth.SignSSEToken(secret, claims.Username, slug, ttl)
		if err != nil {
			http.Error(w, "failed to sign sse token", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{
			"token":      token,
			"expires_at": expiresAt.Format(timeFormat),
		})
	}
}

// sseHandler streams a station's events as Server-Sent Events. It is
// authenticated via a ?token= query param (a short-lived SSE token minted
// by sseTokenHandler) rather than requireSession's Authorization header,
// since browser EventSource cannot send custom headers -- see the SSE
// auth design note in the plan.
func sseHandler(client *audioclient.Client, secret []byte) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := r.PathValue("slug")

		if _, err := auth.VerifySSEToken(secret, r.URL.Query().Get("token"), slug); err != nil {
			http.Error(w, "invalid or expired sse token", http.StatusUnauthorized)
			return
		}

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming unsupported", http.StatusInternalServerError)
			return
		}

		events, err := client.SubscribeEvents(r.Context(), slug)
		if err != nil {
			http.Error(w, "failed to subscribe to station events", http.StatusBadGateway)
			return
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.WriteHeader(http.StatusOK)
		flusher.Flush()

		for {
			select {
			case <-r.Context().Done():
				return
			case evt, ok := <-events:
				if !ok {
					// Upstream stream ended (server restart, station
					// unregistered, etc). The frontend's EventSource
					// reconnects automatically and re-mints a token.
					return
				}
				body, err := protoMarshaler.Marshal(evt)
				if err != nil {
					continue
				}
				fmt.Fprintf(w, "event: message\ndata: %s\n\n", body)
				flusher.Flush()
			}
		}
	}
}
