// Command panel runs the goradio-panel admin web server.
package main

import (
	"context"
	"database/sql"
	"flag"
	"log/slog"
	"net/http"
	"os"

	"github.com/tmfksoft/goradio-panel/internal/audioclient"
	"github.com/tmfksoft/goradio-panel/internal/auth"
	"github.com/tmfksoft/goradio-panel/internal/config"
	"github.com/tmfksoft/goradio-panel/internal/db"
	"github.com/tmfksoft/goradio-panel/internal/httpapi"
	"github.com/tmfksoft/goradio-panel/internal/stats"
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

	sdb, err := db.Open(cfg.DB.SQLitePath)
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

	audioClient, err := audioclient.New(ctx, cfg.AudioServer.GRPCAddr, cfg.AudioServer.HTTPBaseURL,
		[]byte(cfg.AudioServer.JWTSecret), cfg.AudioServer.AdminTokenTTL)
	if err != nil {
		log.Error("connect to audio server", "error", err)
		os.Exit(1)
	}
	defer audioClient.Close()

	statsStore := stats.NewStore(sdb)
	collector := stats.NewCollector(audioClient, statsStore, cfg.Stats.StationDiscoveryInterval, cfg.Stats.FallbackSnapshotInterval, log)
	go collector.Run(ctx)

	deps := httpapi.Deps{
		SessionJWTSecret: []byte(cfg.Auth.SessionJWTSecret),
		SessionTTL:       cfg.Auth.SessionTTL,
		SSETokenTTL:      cfg.Auth.SSETokenTTL,
		AudioClient:      audioClient,
		StatsStore:       statsStore,
		StaticDir:        cfg.HTTP.StaticDir,
	}
	mux := httpapi.NewRouter(sdb, deps)

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
