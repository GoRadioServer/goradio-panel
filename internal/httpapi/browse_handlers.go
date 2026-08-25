package httpapi

import "net/http"

// browseHandler lists one directory under the audio server's audio_root --
// not station-scoped (unlike /stations/{slug}/queue), since it's about
// the audio server's filesystem, not any one station. The panel's own
// admin token is unrestricted, so this always sees a directory's full
// contents regardless of what a controller's own minted token might be
// scoped to (see mintTokenHandler's dirs field).
func browseHandler(w http.ResponseWriter, r *http.Request, s serverScope) {
	path := r.URL.Query().Get("path")

	entries, err := s.Client.ListDirectory(r.Context(), path)
	if err != nil {
		writeAudioClientError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, entries)
}
