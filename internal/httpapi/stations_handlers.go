package httpapi

import (
	"database/sql"
	"net/http"
	"sort"

	"github.com/goradioserver/goradio-panel/internal/audioclient"
	"github.com/goradioserver/goradio-panel/internal/db"
	"github.com/goradioserver/goradio-panel/internal/stats"
)

// stationListEntry is StationSummary plus the collector's live-monitoring
// view of the station, for the sidebar/dashboard status dots.
type stationListEntry struct {
	audioclient.StationSummary
	// Offline is true when the panel's own event watcher for this
	// station is currently down (reconnecting after a dropped stream,
	// audio server restart, etc) -- distinct from the station itself
	// playing silence. Also true, unconditionally, for a managed station
	// that isn't currently registered at all (crashed before its first
	// successful radio.register(), or stopped) -- there's no live state
	// to report for those, and "offline" is the accurate summary; the
	// station page's Controller section has the actual process state.
	Offline bool `json:"offline"`
	// Silence mirrors the station's is_silence: reachable, but nothing
	// queued/playing right now.
	Silence bool `json:"silence"`
	// NowPlaying is the station's current track, or null when nothing is
	// playing. Comes from the collector's event stream rather than a
	// per-station GetStatus call, so listing stays a single RPC.
	NowPlaying *stats.NowPlaying `json:"now_playing"`
	// Managed is true if this panel created and runs a `radio station`
	// process for this slug (see internal/stationrunner).
	Managed bool `json:"managed"`
}

// stationsHandler lists every station the panel knows about: every
// station currently registered on the audio server (via ListStations),
// plus every panel-managed station that isn't currently registered --
// e.g. one whose process crashed before ever calling radio.register(),
// or one that's been stopped. Without the second half, a managed station
// that never successfully registers would be invisible on the Stations
// page with no way to find it and fix it.
func stationsHandler(sdb *sql.DB) scopedHandler {
	return func(w http.ResponseWriter, r *http.Request, s serverScope) {
		stations, err := s.Client.ListStations(r.Context())
		if err != nil {
			http.Error(w, "failed to list stations", http.StatusBadGateway)
			return
		}

		var live map[string]stats.LiveState
		if s.Collector != nil {
			live = s.Collector.Snapshot()
		}

		managed, err := db.ListManagedStations(r.Context(), sdb, s.ID)
		if err != nil {
			http.Error(w, "failed to list managed stations", http.StatusInternalServerError)
			return
		}
		managedBySlug := make(map[string]db.ManagedStation, len(managed))
		for _, m := range managed {
			managedBySlug[m.Slug] = m
		}

		entries := make([]stationListEntry, 0, len(stations)+len(managed))
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
			if _, ok := managedBySlug[st.Slug]; ok {
				entry.Managed = true
				delete(managedBySlug, st.Slug)
			}
			entries = append(entries, entry)
		}
		// Whatever's left in managedBySlug is a managed station the audio
		// server doesn't currently have registered at all.
		for _, m := range managedBySlug {
			entries = append(entries, stationListEntry{
				StationSummary: audioclient.StationSummary{Slug: m.Slug, Name: m.Name},
				Offline:        true,
				Managed:        true,
			})
		}
		sort.Slice(entries, func(i, j int) bool { return entries[i].Slug < entries[j].Slug })

		writeJSON(w, http.StatusOK, entries)
	}
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
