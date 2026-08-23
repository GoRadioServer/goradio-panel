package audioclient

import (
	"context"
	"fmt"
	"time"
)

// Server is one connected audio server: its identity for the UI plus the
// client used to talk to it.
type Server struct {
	ID     string
	Name   string
	Client *Client
}

// ServerConfig is the subset of a configured audio server the registry
// needs to dial it. It mirrors config.AudioServer without importing it,
// keeping the dependency pointing one way (cmd -> audioclient).
type ServerConfig struct {
	ID          string
	Name        string
	GRPCAddr    string
	HTTPBaseURL string
	JWTSecret   []byte
	TokenTTL    time.Duration
}

// Registry holds the panel's audio-server connections, keyed by ID and
// kept in configured order (the order the sidebar switcher shows, and
// whose first entry is the default server).
type Registry struct {
	order []Server
	byID  map[string]*Server
}

// NewRegistry dials every configured server, in order. If any one fails to
// dial, the already-connected ones are closed before returning, so a
// partial startup never leaks connections.
func NewRegistry(ctx context.Context, servers []ServerConfig) (*Registry, error) {
	r := &Registry{byID: make(map[string]*Server, len(servers))}

	for _, sc := range servers {
		client, err := New(ctx, sc.GRPCAddr, sc.HTTPBaseURL, sc.JWTSecret, sc.TokenTTL)
		if err != nil {
			r.Close()
			return nil, fmt.Errorf("audio server %q: %w", sc.ID, err)
		}
		r.order = append(r.order, Server{ID: sc.ID, Name: sc.Name, Client: client})
	}
	// Indexed only after the slice has stopped growing -- taking &r.order[i]
	// while still appending would leave the map pointing at a stale array.
	for i := range r.order {
		r.byID[r.order[i].ID] = &r.order[i]
	}
	return r, nil
}

// Get returns the server with the given ID, or false if it isn't configured.
func (r *Registry) Get(id string) (*Server, bool) {
	s, ok := r.byID[id]
	return s, ok
}

// Client returns just the client for id.
func (r *Registry) Client(id string) (*Client, bool) {
	s, ok := r.byID[id]
	if !ok {
		return nil, false
	}
	return s.Client, true
}

// All returns every server in configured order.
func (r *Registry) All() []Server {
	return r.order
}

// DefaultID is the first configured server's ID, or "" if there are none.
func (r *Registry) DefaultID() string {
	if len(r.order) == 0 {
		return ""
	}
	return r.order[0].ID
}

func (r *Registry) Close() {
	for _, s := range r.order {
		if s.Client != nil {
			s.Client.Close()
		}
	}
}
