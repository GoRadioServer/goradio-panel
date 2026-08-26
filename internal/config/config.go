// Package config loads the panel's YAML configuration.
package config

import (
	"fmt"
	"os"
	"time"

	"gopkg.in/yaml.v3"
)

// AudioServer is one audio server the panel talks to.
type AudioServer struct {
	// ID is the stable key used in URLs (/api/servers/{id}/...) and as the
	// server_id recorded against captured listener stats, so renaming a
	// server is safe but changing its ID orphans its history.
	ID string `yaml:"id"`
	// Name is the human label shown in the sidebar switcher; defaults to ID.
	Name          string        `yaml:"name"`
	GRPCAddr      string        `yaml:"grpc_addr"`
	HTTPBaseURL   string        `yaml:"http_base_url"`
	JWTSecret     string        `yaml:"jwt_secret"`
	AdminTokenTTL time.Duration `yaml:"admin_token_ttl"`
	// DefaultGrouping is a station metadata key ("game", "type", ...) that
	// the sidebar and station list group by on first load. Empty means no
	// grouping. It only sets the initial choice -- the operator can change
	// it in the UI, and that choice holds until they switch server.
	DefaultGrouping string `yaml:"default_grouping"`
}

type Config struct {
	HTTP struct {
		ListenAddr string `yaml:"listen_addr"`
		// StaticDir, if set and present on disk, serves the built frontend
		// (web/dist) alongside the API on this same listen_addr. The
		// Docker image sets this by default; local dev leaves it unset
		// and runs the frontend separately via `npm run dev`.
		StaticDir string `yaml:"static_dir"`
	} `yaml:"http"`

	// AudioServers is the set of audio servers the panel manages, shown in
	// the sidebar's server switcher in the order given here. The first
	// entry is the default -- what a bare /stations/... link resolves to.
	AudioServers []AudioServer `yaml:"audioservers"`

	// AudioServer is the pre-multi-server single-server block. Kept so
	// existing panel.yaml files (and the AUDIOSERVER_* env vars) keep
	// working: when audioservers is empty this is folded into it as the
	// sole entry. Prefer audioservers for new configs.
	AudioServer AudioServer `yaml:"audioserver"`

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

	Updates struct {
		// Enabled controls whether the panel reaches out to GitHub at all.
		// Turn it off for an air-gapped deployment, or one that shouldn't
		// make outbound calls -- the panel then just shows each server's
		// reported version with nothing to compare it against.
		//
		// A pointer so an absent key can default to true while an explicit
		// `enabled: false` is still honoured; read it via UpdatesEnabled.
		Enabled *bool `yaml:"enabled"`
		// GitHubRepo is the "owner/name" whose releases are the audio
		// server's upstream.
		GitHubRepo string `yaml:"github_repo"`
		// CheckInterval is how often the latest release is re-fetched.
		// GitHub allows 60 unauthenticated requests an hour per IP, so
		// this stays well clear of that.
		CheckInterval time.Duration `yaml:"check_interval"`
	} `yaml:"updates"`

	Logging struct {
		Level string `yaml:"level"`
	} `yaml:"logging"`

	StationRunner struct {
		// BinaryPath is what the panel execs to run a managed station's
		// controller -- "radio station --config ... --script ...". Defaults
		// to "radio", resolved via PATH (the Docker image bundles one at
		// /usr/local/bin/radio, alongside the panel binary itself).
		BinaryPath string `yaml:"binary_path"`
		// DataDir holds each managed station's generated station.yaml and
		// station.lua, under <data_dir>/<server_id>/<slug>/. Should live on
		// the same persistent volume as db.sqlite_path.
		DataDir string `yaml:"data_dir"`
	} `yaml:"station_runner"`
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

	if err := cfg.validate(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func (c *Config) validate() error {
	if len(c.AudioServers) == 0 {
		return fmt.Errorf("no audio servers configured: set audioservers (or the legacy audioserver block)")
	}
	seen := make(map[string]bool, len(c.AudioServers))
	for i, s := range c.AudioServers {
		if s.ID == "" {
			return fmt.Errorf("audioservers[%d]: id is required", i)
		}
		if seen[s.ID] {
			return fmt.Errorf("audioservers[%d]: duplicate id %q", i, s.ID)
		}
		seen[s.ID] = true
		if s.JWTSecret == "" {
			return fmt.Errorf("audioservers[%d] (%s): jwt_secret is required", i, s.ID)
		}
	}
	if c.Auth.SessionJWTSecret == "" {
		return fmt.Errorf("auth.session_jwt_secret is required")
	}
	if c.BootstrapAdmin.Password == "" {
		return fmt.Errorf("bootstrap_admin.password is required")
	}
	return nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// UpdatesEnabled reports whether the panel should check GitHub for audio
// server releases. Defaults to true when the key is absent.
func (c *Config) UpdatesEnabled() bool {
	return c.Updates.Enabled == nil || *c.Updates.Enabled
}

// DefaultServerID is the server a bare, un-scoped request resolves to --
// the first configured one.
func (c *Config) DefaultServerID() string {
	if len(c.AudioServers) == 0 {
		return ""
	}
	return c.AudioServers[0].ID
}

func (c *Config) applyDefaults() {
	if c.HTTP.ListenAddr == "" {
		c.HTTP.ListenAddr = "0.0.0.0:8081"
	}

	// Fold the legacy single-server block into the list so everything
	// downstream only has to deal with AudioServers. Done before the env
	// overrides, which then target AudioServers[0] either way.
	if len(c.AudioServers) == 0 && c.AudioServer != (AudioServer{}) {
		legacy := c.AudioServer
		if legacy.ID == "" {
			legacy.ID = "default"
		}
		c.AudioServers = []AudioServer{legacy}
	}

	for i := range c.AudioServers {
		s := &c.AudioServers[i]
		if s.GRPCAddr == "" {
			s.GRPCAddr = "localhost:9090"
		}
		if s.AdminTokenTTL == 0 {
			s.AdminTokenTTL = time.Hour
		}
		if s.Name == "" {
			s.Name = s.ID
		}
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
	if c.Updates.GitHubRepo == "" {
		c.Updates.GitHubRepo = "goradioserver/goradio"
	}
	if c.Updates.CheckInterval == 0 {
		c.Updates.CheckInterval = 6 * time.Hour
	}
	if c.Logging.Level == "" {
		c.Logging.Level = "info"
	}
	if c.StationRunner.BinaryPath == "" {
		c.StationRunner.BinaryPath = "radio"
	}
	if c.StationRunner.DataDir == "" {
		c.StationRunner.DataDir = "./data/stations"
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
	if v := os.Getenv("PANEL_STATIC_DIR"); v != "" {
		c.HTTP.StaticDir = v
	}
	// The AUDIOSERVER_*/GORADIO_JWT_SECRET vars predate multi-server
	// support and address a single server, so they apply to the first
	// entry -- enough to drive a one-server deployment entirely from the
	// environment, as the Docker/k8s manifests do. A multi-server
	// deployment needs them declared in the config file instead.
	if len(c.AudioServers) > 0 {
		s := &c.AudioServers[0]
		if v := os.Getenv("AUDIOSERVER_GRPC_ADDR"); v != "" {
			s.GRPCAddr = v
		}
		if v := os.Getenv("AUDIOSERVER_HTTP_BASE_URL"); v != "" {
			s.HTTPBaseURL = v
		}
		if v := os.Getenv("GORADIO_JWT_SECRET"); v != "" {
			s.JWTSecret = v
		}
	} else if v := os.Getenv("GORADIO_JWT_SECRET"); v != "" {
		// Nothing in the file at all: let the env alone define one server.
		c.AudioServers = []AudioServer{{
			ID:            "default",
			Name:          "default",
			GRPCAddr:      envOr("AUDIOSERVER_GRPC_ADDR", "localhost:9090"),
			HTTPBaseURL:   os.Getenv("AUDIOSERVER_HTTP_BASE_URL"),
			JWTSecret:     v,
			AdminTokenTTL: time.Hour,
		}}
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
	if v := os.Getenv("PANEL_STATION_RUNNER_BINARY_PATH"); v != "" {
		c.StationRunner.BinaryPath = v
	}
	if v := os.Getenv("PANEL_STATION_RUNNER_DATA_DIR"); v != "" {
		c.StationRunner.DataDir = v
	}
}
