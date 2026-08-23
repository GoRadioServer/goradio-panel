package httpapi

import (
	"net/http"

	"github.com/tmfksoft/goradio-panel/internal/audioclient"
	"github.com/tmfksoft/goradio-panel/internal/stats"
)

// stationListEntry is StationSummary plus the collector's live-monitoring
// view of the station, for the sidebar/dashboard status dots.
type stationListEntry struct {
	audioclient.StationSummary
	// Offline is true when the panel's own event watcher for this
	// station is currently down (reconnecting after a dropped stream,
	// audio server restart, etc) -- distinct from the station itself
	// playing silence.
	Offline bool `json:"offline"`
	// Silence mirrors the station's is_silence: reachable, but nothing
	// queued/playing right now.
	Silence bool `json:"silence"`
	// NowPlaying is the station's current track, or null when nothing is
	// playing. Comes from the collector's event stream rather than a
	// per-station GetStatus call, so listing stays a single RPC.
	NowPlaying *stats.NowPlaying `json:"now_playing"`
}

func stationsHandler(w http.ResponseWriter, r *http.Request, s serverScope) {
	stations, err := s.Client.ListStations(r.Context())
	if err != nil {
		http.Error(w, "failed to list stations", http.StatusBadGateway)
		return
	}

	var live map[string]stats.LiveState
	if s.Collector != nil {
		live = s.Collector.Snapshot()
	}

	entries := make([]stationListEntry, 0, len(stations))
	for _, st := range stations {
		entry := stationListEntry{StationSummary: st}
		if state, ok := live[st.Slug]; ok {
			entry.Offline = !state.Connected
			entry.Silence = state.Silence
			entry.NowPlaying = state.NowPlaying
		}
		// If the collector hasn't started watching this station yet
		// (just discovered, or collector unset), leave it as
		// online/not-silent rather than flashing red -- ListStations
		// itself just proved the audio server is reachable.
		entries = append(entries, entry)
	}
	writeJSON(w, http.StatusOK, entries)
}

func stationStatusHandler(w http.ResponseWriter, r *http.Request, s serverScope) {
	slug := r.PathValue("slug")

	status, err := s.Client.GetStatus(r.Context(), slug)
	if err != nil {
		writeAudioClientError(w, err)
		return
	}
	writeProtoJSON(w, http.StatusOK, status)
}

func unregisterStationHandler(w http.ResponseWriter, r *http.Request, s serverScope) {
	slug := r.PathValue("slug")

	if err := s.Client.UnregisterStation(r.Context(), slug); err != nil {
		writeAudioClientError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
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
