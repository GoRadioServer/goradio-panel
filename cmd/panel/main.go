// Command panel runs the goradio-panel admin web server.
package main

import (
	"context"
	"database/sql"
	"flag"
	"log/slog"
	"net/http"
	"os"

	"github.com/goradioserver/goradio-panel/internal/audioclient"
	"github.com/goradioserver/goradio-panel/internal/auth"
	"github.com/goradioserver/goradio-panel/internal/config"
	"github.com/goradioserver/goradio-panel/internal/db"
	"github.com/goradioserver/goradio-panel/internal/httpapi"
	"github.com/goradioserver/goradio-panel/internal/releases"
	"github.com/goradioserver/goradio-panel/internal/stats"
)

func main() {
	configPath := flag.String("config", "panel.yaml", "path to panel config file")
	flag.Parse()

	log := slog.New(slog.NewTextHandler(os.Stdout, nil))

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Error("load config", "error", err)
		os.Exit(1)
	}

	// The default server owns any listener_stats rows captured before the
	// panel became multi-server, so it has to be known at migration time.
	sdb, err := db.Open(cfg.DB.SQLitePath, cfg.DefaultServerID())
	if err != nil {
		log.Error("open database", "error", err)
		os.Exit(1)
	}
	defer sdb.Close()

	ctx := context.Background()

	if err := bootstrapAdmin(ctx, sdb, cfg, log); err != nil {
		log.Error("bootstrap admin user", "error", err)
		os.Exit(1)
	}

	serverConfigs := make([]audioclient.ServerConfig, 0, len(cfg.AudioServers))
	for _, s := range cfg.AudioServers {
		serverConfigs = append(serverConfigs, audioclient.ServerConfig{
			ID:              s.ID,
			Name:            s.Name,
			GRPCAddr:        s.GRPCAddr,
			HTTPBaseURL:     s.HTTPBaseURL,
			JWTSecret:       []byte(s.JWTSecret),
			TokenTTL:        s.AdminTokenTTL,
			DefaultGrouping: s.DefaultGrouping,
		})
	}
	registry, err := audioclient.NewRegistry(ctx, serverConfigs)
	if err != nil {
		log.Error("connect to audio servers", "error", err)
		os.Exit(1)
	}
	defer registry.Close()

	statsStore := stats.NewStore(sdb)
	collectors := make(map[string]*stats.Collector, len(registry.All()))
	for _, s := range registry.All() {
		c := stats.NewCollector(s.ID, s.Client, statsStore,
			cfg.Stats.StationDiscoveryInterval, cfg.Stats.FallbackSnapshotInterval, log)
		collectors[s.ID] = c
		go c.Run(ctx)
	}

	var releaseChecker *releases.Checker
	if cfg.UpdatesEnabled() {
		releaseChecker = releases.NewChecker(cfg.Updates.GitHubRepo, cfg.Updates.CheckInterval)
		go releaseChecker.Run(ctx)
		log.Info("update checks enabled", "repo", cfg.Updates.GitHubRepo, "interval", cfg.Updates.CheckInterval)
	}

	deps := httpapi.Deps{
		SessionJWTSecret: []byte(cfg.Auth.SessionJWTSecret),
		SessionTTL:       cfg.Auth.SessionTTL,
		SSETokenTTL:      cfg.Auth.SSETokenTTL,
		Servers:          registry,
		Collectors:       collectors,
		StatsStore:       statsStore,
		Releases:         releaseChecker,
		StaticDir:        cfg.HTTP.StaticDir,
	}
	mux := httpapi.NewRouter(sdb, deps)

	for _, s := range registry.All() {
		log.Info("audio server connected", "id", s.ID, "name", s.Name)
	}

	// A missing frontend is otherwise invisible: the router just doesn't
	// register "/" and every page request 404s with nothing in the log to
	// explain why.
	switch {
	case cfg.HTTP.StaticDir == "":
		log.Warn("http.static_dir is not set: the API is served but the web UI is not, " +
			"so requests outside /api will 404 (set http.static_dir or PANEL_STATIC_DIR; " +
			"the container image ships the built UI at /app/web/dist)")
	default:
		if _, err := os.Stat(cfg.HTTP.StaticDir); err != nil {
			log.Warn("http.static_dir does not exist: the web UI will not be served",
				"static_dir", cfg.HTTP.StaticDir, "error", err)
		}
	}

	log.Info("panel listening", "addr", cfg.HTTP.ListenAddr, "static_dir", cfg.HTTP.StaticDir)
	if err := http.ListenAndServe(cfg.HTTP.ListenAddr, mux); err != nil {
		log.Error("serve", "error", err)
		os.Exit(1)
	}
}

// bootstrapAdmin creates the configured admin user if the users table is
// empty. It never overwrites an existing user.
func bootstrapAdmin(ctx context.Context, sdb *sql.DB, cfg *config.Config, log *slog.Logger) error {
	count, err := db.CountUsers(ctx, sdb)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	hash, err := auth.HashPassword(cfg.BootstrapAdmin.Password)
	if err != nil {
		return err
	}
	if err := db.CreateUser(ctx, sdb, cfg.BootstrapAdmin.Username, hash); err != nil {
		return err
	}

	log.Warn("bootstrapped admin user (users table was empty)", "username", cfg.BootstrapAdmin.Username)
	return nil
}
