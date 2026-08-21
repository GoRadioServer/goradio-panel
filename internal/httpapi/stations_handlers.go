package httpapi

import (
	"net/http"

	"github.com/tmfksoft/goradio-panel/internal/audioclient"
)

func stationsHandler(client *audioclient.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		stations, err := client.ListStations(r.Context())
		if err != nil {
			http.Error(w, "failed to list stations", http.StatusBadGateway)
			return
		}
		writeJSON(w, http.StatusOK, stations)
	}
}

func stationStatusHandler(client *audioclient.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := r.PathValue("slug")

		status, err := client.GetStatus(r.Context(), slug)
		if err != nil {
			writeAudioClientError(w, err)
			return
		}
		writeProtoJSON(w, http.StatusOK, status)
	}
}

func unregisterStationHandler(client *audioclient.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		slug := r.PathValue("slug")

		if err := client.UnregisterStation(r.Context(), slug); err != nil {
			writeAudioClientError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// writeAudioClientError maps audioclient's sentinel errors (translated
// from the audio server's gRPC status codes) to HTTP status codes.
func writeAudioClientError(w http.ResponseWriter, err error) {
	switch {
	case err == audioclient.ErrNotFound:
		http.Error(w, "station not found", http.StatusNotFound)
	case err == audioclient.ErrPermissionDenied:
		http.Error(w, "permission denied", http.StatusForbidden)
	default:
		http.Error(w, "audio server request failed", http.StatusBadGateway)
	}
}
