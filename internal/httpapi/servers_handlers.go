package httpapi

import (
	"net/http"

	"github.com/goradioserver/goradio-panel/internal/audioclient"
)

type serverEntry struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	// HTTPBaseURL is this server's public HTTP base, for building station
	// listen URLs. Empty when unconfigured, in which case the UI hides the
	// player for that server's stations.
	HTTPBaseURL string `json:"http_base_url"`
	// Default marks the server a bare, un-scoped link resolves to.
	Default bool `json:"default"`
	// DefaultGrouping is the station metadata key the UI groups by on
	// first load; empty for no grouping.
	DefaultGrouping string `json:"default_grouping"`
}

// serversHandler lists the configured audio servers for the sidebar's
// switcher, in configured order.
func serversHandler(reg *audioclient.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		all := reg.All()
		defaultID := reg.DefaultID()

		entries := make([]serverEntry, 0, len(all))
		for _, s := range all {
			entries = append(entries, serverEntry{
				ID:              s.ID,
				Name:            s.Name,
				HTTPBaseURL:     s.Client.HTTPBaseURL(),
				Default:         s.ID == defaultID,
				DefaultGrouping: s.DefaultGrouping,
			})
		}
		writeJSON(w, http.StatusOK, entries)
	}
}
