package httpapi

import (
	"encoding/json"
	"net/http"
)

const timeFormat = "2006-01-02T15:04:05Z07:00"

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
