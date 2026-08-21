// Package config loads the panel's YAML configuration.
package config

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	HTTP struct {
		ListenAddr string `yaml:"listen_addr"`
		// StaticDir, if set and present on disk, serves the built frontend
		// (web/dist) alongside the API on this same listen_addr. The
		// Docker image sets this by default; local dev leaves it unset
		// and runs the frontend separately via `npm run dev`.
		StaticDir string `yaml:"static_dir"`
	} `yaml:"http"`

	AudioServer struct {
		GRPCAddr      string        `yaml:"grpc_addr"`
		HTTPBaseURL   string        `yaml:"http_base_url"`
		JWTSecret     string        `yaml:"jwt_secret"`
		AdminTokenTTL time.Duration `yaml:"admin_token_ttl"`
	} `yaml:"audioserver"`

	Auth struct {
		SessionJWTSecret string        `yaml:"session_jwt_secret"`
		SessionTTL       time.Duration `yaml:"session_ttl"`
		SSETokenTTL      time.Duration `yaml:"sse_token_ttl"`
	} `yaml:"auth"`

	DB struct {
		SQLitePath string `yaml:"sqlite_path"`
	} `yaml:"db"`

	BootstrapAdmin struct {
		Username string `yaml:"username"`
		Password string `yaml:"password"`
	} `yaml:"bootstrap_admin"`

	Stats struct {
		StationDiscoveryInterval time.Duration `yaml:"station_discovery_interval"`
		FallbackSnapshotInterval time.Duration `yaml:"fallback_snapshot_interval"`
	} `yaml:"stats"`

	Logging struct {
		Level string `yaml:"level"`
	} `yaml:"logging"`
}

// Load reads and parses a Config from path, applies defaults, then applies
// environment variable overrides (which take precedence over both the file
// and the defaults).
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config %q: %w", path, err)
	}

	cfg := &Config{}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("parse config %q: %w", path, err)
	}

	cfg.applyDefaults()
	cfg.applyEnvOverrides()

	if cfg.AudioServer.JWTSecret == "" {
		return nil, fmt.Errorf("audioserver.jwt_secret is required")
	}
	if cfg.Auth.SessionJWTSecret == "" {
		return nil, fmt.Errorf("auth.session_jwt_secret is required")
	}
	if cfg.BootstrapAdmin.Password == "" {
		return nil, fmt.Errorf("bootstrap_admin.password is required")
	}

	return cfg, nil
}

func (c *Config) applyDefaults() {
	if c.HTTP.ListenAddr == "" {
		c.HTTP.ListenAddr = "0.0.0.0:8081"
	}
	if c.AudioServer.GRPCAddr == "" {
		c.AudioServer.GRPCAddr = "localhost:9090"
	}
	if c.AudioServer.AdminTokenTTL == 0 {
		c.AudioServer.AdminTokenTTL = time.Hour
	}
	if c.Auth.SessionTTL == 0 {
		c.Auth.SessionTTL = 24 * time.Hour
	}
	if c.Auth.SSETokenTTL == 0 {
		c.Auth.SSETokenTTL = 60 * time.Second
	}
	if c.DB.SQLitePath == "" {
		c.DB.SQLitePath = "./data/panel.db"
	}
	if c.BootstrapAdmin.Username == "" {
		c.BootstrapAdmin.Username = "admin"
	}
	if c.Stats.StationDiscoveryInterval == 0 {
		c.Stats.StationDiscoveryInterval = 30 * time.Second
	}
	if c.Stats.FallbackSnapshotInterval == 0 {
		c.Stats.FallbackSnapshotInterval = 5 * time.Minute
	}
	if c.Logging.Level == "" {
		c.Logging.Level = "info"
	}
}

// applyEnvOverrides lets the whole config be driven by environment
// variables -- the standard way to configure a container in Docker/k8s
// (Secrets and ConfigMaps both project as env vars) without baking a
// deployment-specific panel.yaml into an image.
func (c *Config) applyEnvOverrides() {
	if v := os.Getenv("PANEL_LISTEN_ADDR"); v != "" {
		c.HTTP.ListenAddr = v
	}
	if v := os.Getenv("AUDIOSERVER_GRPC_ADDR"); v != "" {
		c.AudioServer.GRPCAddr = v
	}
	if v := os.Getenv("AUDIOSERVER_HTTP_BASE_URL"); v != "" {
		c.AudioServer.HTTPBaseURL = v
	}
	if v := os.Getenv("GORADIO_JWT_SECRET"); v != "" {
		c.AudioServer.JWTSecret = v
	}
	if v := os.Getenv("PANEL_SESSION_JWT_SECRET"); v != "" {
		c.Auth.SessionJWTSecret = v
	}
	if v := os.Getenv("PANEL_SQLITE_PATH"); v != "" {
		c.DB.SQLitePath = v
	}
	if v := os.Getenv("PANEL_BOOTSTRAP_USERNAME"); v != "" {
		c.BootstrapAdmin.Username = v
	}
	if v := os.Getenv("PANEL_BOOTSTRAP_PASSWORD"); v != "" {
		c.BootstrapAdmin.Password = v
	}
}
