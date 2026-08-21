package httpapi

import (
	"net/http"
	"os"
	"path/filepath"
)

func healthzHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("ok"))
}

// spaHandler serves the built frontend (web/dist) out of dir: a real file
// on disk is served as-is, anything else (a client-side route like
// /stations/myfm, which has no file behind it) falls back to index.html
// so the SPA's own router can take over on a hard refresh or deep link.
func spaHandler(dir string) http.Handler {
	fileServer := http.FileServer(http.Dir(dir))
	indexPath := filepath.Join(dir, "index.html")

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// filepath.Clean collapses a leading "../.." back to root rather
		// than escaping dir, then Join can't reintroduce ".." since the
		// cleaned path no longer contains any -- the standard safe
		// pattern for this exact lookup.
		path := filepath.Join(dir, filepath.Clean(r.URL.Path))
		if info, err := os.Stat(path); err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, indexPath)
	})
}
