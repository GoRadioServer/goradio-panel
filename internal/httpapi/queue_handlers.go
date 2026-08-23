package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"

	audioserverv1 "github.com/tmfksoft/goradio-panel/gen/go/audioserver/v1"
)

type queueTrackRequest struct {
	Source struct {
		Type          string `json:"type"`
		Location      string `json:"location"`
		DisplayTitle  string `json:"display_title"`
		DisplayArtist string `json:"display_artist"`
		CoverArtURL   string `json:"cover_art_url"`
	} `json:"source"`
	Mode string `json:"mode"`
}

func queueTrackHandler(w http.ResponseWriter, r *http.Request, s serverScope) {
	slug := r.PathValue("slug")

	var req queueTrackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.Source.Location == "" {
		http.Error(w, "source.location is required", http.StatusBadRequest)
		return
	}

	sourceType, err := parseTrackSourceType(req.Source.Type)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	mode, err := parseQueueMode(req.Mode)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	resp, err := s.Client.QueueTrack(r.Context(), &audioserverv1.QueueTrackRequest{
		Slug: slug,
		Source: &audioserverv1.TrackSource{
			Type:          sourceType,
			Location:      req.Source.Location,
			DisplayTitle:  req.Source.DisplayTitle,
			DisplayArtist: req.Source.DisplayArtist,
			CoverArtUrl:   req.Source.CoverArtURL,
		},
		Mode: mode,
	})
	if err != nil {
		writeAudioClientError(w, err)
		return
	}
	writeProtoJSON(w, http.StatusOK, resp)
}

func removeFromQueueHandler(w http.ResponseWriter, r *http.Request, s serverScope) {
	slug := r.PathValue("slug")
	queueID := r.PathValue("queueId")

	resp, err := s.Client.RemoveFromQueue(r.Context(), slug, queueID)
	if err != nil {
		writeAudioClientError(w, err)
		return
	}
	writeProtoJSON(w, http.StatusOK, resp)
}

func clearQueueHandler(w http.ResponseWriter, r *http.Request, s serverScope) {
	slug := r.PathValue("slug")

	var req struct {
		StopCurrent bool `json:"stop_current"`
	}
	// A body is optional here (stop_current defaults to false); ignore
	// a missing/empty body rather than rejecting the request.
	_ = json.NewDecoder(r.Body).Decode(&req)

	resp, err := s.Client.ClearQueue(r.Context(), slug, req.StopCurrent)
	if err != nil {
		writeAudioClientError(w, err)
		return
	}
	writeProtoJSON(w, http.StatusOK, resp)
}

func skipHandler(w http.ResponseWriter, r *http.Request, s serverScope) {
	slug := r.PathValue("slug")

	resp, err := s.Client.Skip(r.Context(), slug)
	if err != nil {
		writeAudioClientError(w, err)
		return
	}
	writeProtoJSON(w, http.StatusOK, resp)
}

func skipToHandler(w http.ResponseWriter, r *http.Request, s serverScope) {
	slug := r.PathValue("slug")
	queueID := r.PathValue("queueId")

	resp, err := s.Client.SkipTo(r.Context(), slug, queueID)
	if err != nil {
		writeAudioClientError(w, err)
		return
	}
	writeProtoJSON(w, http.StatusOK, resp)
}

func seekHandler(w http.ResponseWriter, r *http.Request, s serverScope) {
	slug := r.PathValue("slug")

	var req struct {
		PositionSeconds int64 `json:"position_seconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.PositionSeconds < 0 {
		http.Error(w, "position_seconds must be >= 0", http.StatusBadRequest)
		return
	}

	resp, err := s.Client.Seek(r.Context(), slug, req.PositionSeconds)
	if err != nil {
		writeAudioClientError(w, err)
		return
	}
	writeProtoJSON(w, http.StatusOK, resp)
}

// parseTrackSourceType accepts both the short form ("HTTP_URL",
// "LOCAL_FILE") and the full proto enum name
// ("TRACK_SOURCE_TYPE_HTTP_URL"), defaulting to HTTP_URL when omitted
// since that's the panel's primary queueing path (see QueueTrackForm).
func parseTrackSourceType(s string) (audioserverv1.TrackSourceType, error) {
	if s == "" {
		return audioserverv1.TrackSourceType_TRACK_SOURCE_TYPE_HTTP_URL, nil
	}
	if v, ok := audioserverv1.TrackSourceType_value[s]; ok {
		return audioserverv1.TrackSourceType(v), nil
	}
	if v, ok := audioserverv1.TrackSourceType_value["TRACK_SOURCE_TYPE_"+s]; ok {
		return audioserverv1.TrackSourceType(v), nil
	}
	return 0, fmt.Errorf("unknown source.type %q (want HTTP_URL or LOCAL_FILE)", s)
}

// parseQueueMode accepts both the short form ("APPEND", "PLAY_NEXT",
// "PLAY_NOW_INTERRUPT") and the full proto enum name, defaulting to
// APPEND when omitted.
func parseQueueMode(s string) (audioserverv1.QueueMode, error) {
	if s == "" {
		return audioserverv1.QueueMode_QUEUE_MODE_APPEND, nil
	}
	if v, ok := audioserverv1.QueueMode_value[s]; ok {
		return audioserverv1.QueueMode(v), nil
	}
	if v, ok := audioserverv1.QueueMode_value["QUEUE_MODE_"+s]; ok {
		return audioserverv1.QueueMode(v), nil
	}
	return 0, fmt.Errorf("unknown mode %q (want APPEND, PLAY_NEXT, or PLAY_NOW_INTERRUPT)", s)
}
