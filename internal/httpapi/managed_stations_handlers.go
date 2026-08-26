package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"

	"github.com/goradioserver/goradio-panel/internal/db"
	"github.com/goradioserver/goradio-panel/internal/stationrunner"
)

type createStationRequest struct {
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Description string `json:"description"`
	LogoURL     string `json:"logo_url"`
}

type stationProcessResponse struct {
	Slug      string   `json:"slug"`
	Name      string   `json:"name"`
	State     string   `json:"state"`
	StartedAt string   `json:"started_at,omitempty"`
	StoppedAt string   `json:"stopped_at,omitempty"`
	ExitCode  int      `json:"exit_code"`
	ExitError string   `json:"exit_error,omitempty"`
	LogTail   []string `json:"log_tail"`
}

// createStationHandler creates a panel-managed station: writes a starter
// Lua script and station.yaml, records it, mints it a token, and spawns
// `radio station` for it. The fresh script plays silence (see
// stationrunner.ScriptTemplate) until edited via the Controller section
// and restarted.
func createStationHandler(sdb *sql.DB, runner *stationrunner.Runner) scopedHandler {
	return func(w http.ResponseWriter, r *http.Request, s serverScope) {
		var req createStationRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}

		slug := strings.TrimSpace(req.Slug)
		if slug == "" {
			http.Error(w, "slug is required", http.StatusBadRequest)
			return
		}
		name := strings.TrimSpace(req.Name)
		if name == "" {
			name = slug
		}
		description := strings.TrimSpace(req.Description)
		logoURL := strings.TrimSpace(req.LogoURL)

		if _, err := db.CreateManagedStation(r.Context(), sdb, s.ID, slug, name); err != nil {
			if errors.Is(err, db.ErrManagedStationExists) {
				http.Error(w, "a station with this slug is already managed by the panel", http.StatusConflict)
				return
			}
			http.Error(w, "failed to create managed station", http.StatusInternalServerError)
			return
		}

		if err := writeStationFiles(runner, s.ID, slug, name, description, logoURL, s.Client.GRPCAddr); err != nil {
			http.Error(w, "failed to write station files: "+err.Error(), http.StatusInternalServerError)
			return
		}

		if err := startManagedStation(r.Context(), s, runner, slug); err != nil {
			http.Error(w, "station created but failed to start: "+err.Error(), http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, processStatusResponse(runner, s.ID, slug, name))
	}
}

// deleteStationHandler stops the process (if running), unregisters the
// station from the audio server, and removes its DB row and script
// directory -- the only way to fully remove a panel-managed station.
func deleteStationHandler(sdb *sql.DB, runner *stationrunner.Runner) scopedHandler {
	return func(w http.ResponseWriter, r *http.Request, s serverScope) {
		slug := r.PathValue("slug")

		_ = runner.Stop(stationrunner.Key(s.ID, slug))
		_ = s.Client.UnregisterStation(r.Context(), slug)

		if err := db.DeleteManagedStation(r.Context(), sdb, s.ID, slug); err != nil {
			if errors.Is(err, db.ErrManagedStationNotFound) {
				http.Error(w, "not a panel-managed station", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to delete managed station", http.StatusInternalServerError)
			return
		}
		_ = os.RemoveAll(runner.ScriptDir(s.ID, slug))

		w.WriteHeader(http.StatusNoContent)
	}
}

type scriptResponse struct {
	Content string `json:"content"`
}

func getScriptHandler(runner *stationrunner.Runner) scopedHandler {
	return func(w http.ResponseWriter, r *http.Request, s serverScope) {
		slug := r.PathValue("slug")
		content, err := os.ReadFile(runner.ScriptPath(s.ID, slug))
		if errors.Is(err, os.ErrNotExist) {
			http.Error(w, "not a panel-managed station", http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, "failed to read script", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, scriptResponse{Content: string(content)})
	}
}

// putScriptHandler saves new script content. It deliberately does not
// restart the process -- the operator does that explicitly once they're
// happy with their edits, via the process/restart route.
func putScriptHandler(sdb *sql.DB, runner *stationrunner.Runner) scopedHandler {
	return func(w http.ResponseWriter, r *http.Request, s serverScope) {
		slug := r.PathValue("slug")

		var req scriptResponse
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(req.Content) == "" {
			http.Error(w, "content must not be empty", http.StatusBadRequest)
			return
		}

		if _, err := db.GetManagedStation(r.Context(), sdb, s.ID, slug); err != nil {
			if errors.Is(err, db.ErrManagedStationNotFound) {
				http.Error(w, "not a panel-managed station", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to look up managed station", http.StatusInternalServerError)
			return
		}

		if err := os.WriteFile(runner.ScriptPath(s.ID, slug), []byte(req.Content), 0o644); err != nil {
			http.Error(w, "failed to write script", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// getProcessHandler reports a managed station's process state and recent
// log output. 404s for a slug the panel doesn't manage -- the frontend
// treats that as "no Controller section to show", not an error.
func getProcessHandler(sdb *sql.DB, runner *stationrunner.Runner) scopedHandler {
	return func(w http.ResponseWriter, r *http.Request, s serverScope) {
		slug := r.PathValue("slug")

		m, err := db.GetManagedStation(r.Context(), sdb, s.ID, slug)
		if errors.Is(err, db.ErrManagedStationNotFound) {
			http.Error(w, "not a panel-managed station", http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, "failed to look up managed station", http.StatusInternalServerError)
			return
		}
		writeJSON(w, http.StatusOK, processStatusResponse(runner, s.ID, slug, m.Name))
	}
}

func startProcessHandler(sdb *sql.DB, runner *stationrunner.Runner) scopedHandler {
	return func(w http.ResponseWriter, r *http.Request, s serverScope) {
		slug := r.PathValue("slug")
		if _, err := db.GetManagedStation(r.Context(), sdb, s.ID, slug); err != nil {
			if errors.Is(err, db.ErrManagedStationNotFound) {
				http.Error(w, "not a panel-managed station", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to look up managed station", http.StatusInternalServerError)
			return
		}
		if err := db.SetDesiredRunning(r.Context(), sdb, s.ID, slug, true); err != nil {
			http.Error(w, "failed to update managed station", http.StatusInternalServerError)
			return
		}
		if err := startManagedStation(r.Context(), s, runner, slug); err != nil {
			http.Error(w, "failed to start: "+err.Error(), http.StatusInternalServerError)
			return
		}
		writeManagedStatus(w, sdb, r, s, runner, slug)
	}
}

func stopProcessHandler(sdb *sql.DB, runner *stationrunner.Runner) scopedHandler {
	return func(w http.ResponseWriter, r *http.Request, s serverScope) {
		slug := r.PathValue("slug")
		if _, err := db.GetManagedStation(r.Context(), sdb, s.ID, slug); err != nil {
			if errors.Is(err, db.ErrManagedStationNotFound) {
				http.Error(w, "not a panel-managed station", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to look up managed station", http.StatusInternalServerError)
			return
		}
		if err := db.SetDesiredRunning(r.Context(), sdb, s.ID, slug, false); err != nil {
			http.Error(w, "failed to update managed station", http.StatusInternalServerError)
			return
		}
		if err := runner.Stop(stationrunner.Key(s.ID, slug)); err != nil {
			http.Error(w, "failed to stop: "+err.Error(), http.StatusInternalServerError)
			return
		}
		writeManagedStatus(w, sdb, r, s, runner, slug)
	}
}

func restartProcessHandler(sdb *sql.DB, runner *stationrunner.Runner) scopedHandler {
	return func(w http.ResponseWriter, r *http.Request, s serverScope) {
		slug := r.PathValue("slug")
		if _, err := db.GetManagedStation(r.Context(), sdb, s.ID, slug); err != nil {
			if errors.Is(err, db.ErrManagedStationNotFound) {
				http.Error(w, "not a panel-managed station", http.StatusNotFound)
				return
			}
			http.Error(w, "failed to look up managed station", http.StatusInternalServerError)
			return
		}
		if err := db.SetDesiredRunning(r.Context(), sdb, s.ID, slug, true); err != nil {
			http.Error(w, "failed to update managed station", http.StatusInternalServerError)
			return
		}

		jwt, err := s.Client.MintStationToken([]string{slug}, nil, "goradio-panel-managed:"+slug, stationrunner.TokenTTL, false)
		if err != nil {
			http.Error(w, "failed to mint token", http.StatusInternalServerError)
			return
		}
		key := stationrunner.Key(s.ID, slug)
		if err := runner.Restart(key, runner.ConfigPath(s.ID, slug), runner.ScriptPath(s.ID, slug), jwt); err != nil {
			http.Error(w, "failed to restart: "+err.Error(), http.StatusInternalServerError)
			return
		}
		writeManagedStatus(w, sdb, r, s, runner, slug)
	}
}

func writeManagedStatus(w http.ResponseWriter, sdb *sql.DB, r *http.Request, s serverScope, runner *stationrunner.Runner, slug string) {
	m, err := db.GetManagedStation(r.Context(), sdb, s.ID, slug)
	name := slug
	if err == nil {
		name = m.Name
	}
	writeJSON(w, http.StatusOK, processStatusResponse(runner, s.ID, slug, name))
}

func processStatusResponse(runner *stationrunner.Runner, serverID, slug, name string) stationProcessResponse {
	resp := stationProcessResponse{Slug: slug, Name: name, State: string(stationrunner.StateStopped), LogTail: []string{}}
	status, ok := runner.Status(stationrunner.Key(serverID, slug))
	if !ok {
		return resp
	}
	resp.State = string(status.State)
	resp.ExitCode = status.ExitCode
	resp.ExitError = status.ExitError
	if !status.StartedAt.IsZero() {
		resp.StartedAt = status.StartedAt.UTC().Format(timeFormat)
	}
	if !status.StoppedAt.IsZero() {
		resp.StoppedAt = status.StoppedAt.UTC().Format(timeFormat)
	}
	if lines := runner.Logs(stationrunner.Key(serverID, slug)); lines != nil {
		resp.LogTail = lines
	}
	return resp
}

// startManagedStation mints a fresh token and starts the process for
// slug. Errors if it's already running -- restartProcessHandler is the
// route for that case.
func startManagedStation(ctx context.Context, s serverScope, runner *stationrunner.Runner, slug string) error {
	jwt, err := s.Client.MintStationToken([]string{slug}, nil, "goradio-panel-managed:"+slug, stationrunner.TokenTTL, false)
	if err != nil {
		return err
	}
	key := stationrunner.Key(s.ID, slug)
	return runner.Start(key, runner.ConfigPath(s.ID, slug), runner.ScriptPath(s.ID, slug), jwt)
}

func writeStationFiles(runner *stationrunner.Runner, serverID, slug, name, description, logoURL, grpcAddr string) error {
	dir := runner.ScriptDir(serverID, slug)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(runner.ConfigPath(serverID, slug), []byte(stationrunner.ConfigTemplate(grpcAddr)), 0o644); err != nil {
		return err
	}
	return os.WriteFile(runner.ScriptPath(serverID, slug), []byte(stationrunner.ScriptTemplate(slug, name, description, logoURL)), 0o644)
}
