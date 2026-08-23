package httpapi

import (
	"net/http"
	"time"

	"github.com/tmfksoft/goradio-panel/internal/stats"
)

func statsHandler(store *stats.Store) scopedHandler {
	return func(w http.ResponseWriter, r *http.Request, s serverScope) {
		slug := r.PathValue("slug")

		to := time.Now()
		from := to.Add(-24 * time.Hour)
		if v := r.URL.Query().Get("from"); v != "" {
			if t, err := time.Parse(time.RFC3339, v); err == nil {
				from = t
			}
		}
		if v := r.URL.Query().Get("to"); v != "" {
			if t, err := time.Parse(time.RFC3339, v); err == nil {
				to = t
			}
		}

		points, err := store.Query(r.Context(), s.ID, slug, from, to)
		if err != nil {
			http.Error(w, "failed to query listener stats", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, points)
	}
}
