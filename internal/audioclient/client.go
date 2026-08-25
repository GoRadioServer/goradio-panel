// Package audioclient wraps the audio server's gRPC control plane
// (audioserver.v1.AudioServerService) into a client the panel's httpapi
// and stats packages call directly, attaching a self-refreshing admin
// service token to every RPC.
package audioclient

import (
	"context"
	"crypto/tls"
	"fmt"
	"strings"
	"sync/atomic"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/keepalive"
	"google.golang.org/grpc/metadata"

	audioserverv1 "github.com/goradioserver/goradio-panel/gen/go/audioserver/v1"
	"github.com/goradioserver/goradio-panel/internal/auth"
)

type Client struct {
	grpcClient  audioserverv1.AudioServerServiceClient
	conn        *grpc.ClientConn
	httpBaseURL string

	jwtSecret []byte
	tokenTTL  time.Duration
	token     atomic.Value // string
}

// New dials the audio server's gRPC address and starts the background
// admin-token refresher.
//
// grpcAddr accepts a bare "host:port" (dialed in plaintext, e.g.
// "localhost:9090") or a URL-shaped address with an "https://"/"grpcs://"
// scheme (dialed with TLS, for a server sitting behind a TLS-terminating
// reverse proxy) or "http://"/"grpc://" (plaintext) -- see
// parseGRPCTarget.
//
// httpBaseURL is the audio server's public HTTP base (its own
// http.public_base_url) -- a separate endpoint from grpcAddr, used only to
// build listen URLs (HTTPBaseURL) for the panel's UI. May be empty, in
// which case HTTPBaseURL returns "" and the UI hides the player.
func New(ctx context.Context, grpcAddr, httpBaseURL string, jwtSecret []byte, tokenTTL time.Duration) (*Client, error) {
	target, useTLS := parseGRPCTarget(grpcAddr)

	var creds credentials.TransportCredentials = insecure.NewCredentials()
	if useTLS {
		creds = credentials.NewTLS(&tls.Config{})
	}

	conn, err := grpc.NewClient(
		target,
		grpc.WithTransportCredentials(creds),
		// Without this, a silently-dead connection (NAT/LB idle timeout, a
		// network partition -- anything that doesn't cleanly FIN/RST both
		// ends) is never detected: the per-station SubscribeEvents streams
		// the stats collector holds open would just block forever instead
		// of erroring out and letting the collector reconnect. The audio
		// server's own gRPC server sets a matching KeepaliveEnforcementPolicy
		// (PermitWithoutStream, MinTime <= 20s) so these pings aren't
		// mistaken for abuse and the connection torn down for the opposite
		// reason.
		grpc.WithKeepaliveParams(keepalive.ClientParameters{
			Time:                20 * time.Second,
			Timeout:             10 * time.Second,
			PermitWithoutStream: true,
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("dial audio server %q: %w", grpcAddr, err)
	}

	c := &Client{
		grpcClient:  audioserverv1.NewAudioServerServiceClient(conn),
		conn:        conn,
		httpBaseURL: strings.TrimRight(httpBaseURL, "/"),
		jwtSecret:   jwtSecret,
		tokenTTL:    tokenTTL,
	}

	if err := c.refreshToken(); err != nil {
		conn.Close()
		return nil, fmt.Errorf("mint initial admin token: %w", err)
	}

	if err := c.verifyToken(ctx); err != nil {
		conn.Close()
		return nil, err
	}

	go c.refreshLoop(ctx)

	return c, nil
}

// verifyToken confirms the admin token is actually accepted by the audio
// server, so a misconfigured audioserver.jwt_secret fails loudly at
// startup instead of silently 502ing every request later. ListStations
// takes no arguments and every token can call it, so any error here can
// only mean the token itself was rejected (bad signature, expired, etc).
func (c *Client) verifyToken(ctx context.Context) error {
	probeCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	_, err := c.grpcClient.ListStations(c.authContext(probeCtx), &audioserverv1.ListStationsRequest{})
	if err != nil {
		return fmt.Errorf("verify admin token against audio server (check audioserver.jwt_secret matches the audio server's own auth.jwt_secret): %w", err)
	}
	return nil
}

func (c *Client) Close() error {
	return c.conn.Close()
}

// HTTPBaseURL returns the audio server's public HTTP base for building
// listen URLs (GET {HTTPBaseURL()}/stream/{slug}), or "" if none was
// configured.
func (c *Client) HTTPBaseURL() string {
	return c.httpBaseURL
}

// MintStationToken signs an audio-server-compatible token using the same
// shared secret this client uses for its own admin token -- lets the
// panel issue tokens for controllers/observers (equivalent to
// `radio tokengen`) without exposing that secret outside this package.
// dirs is nil/empty for an unrestricted token, same as omitting -dirs.
func (c *Client) MintStationToken(slugs []string, dirs []string, subject string, ttl time.Duration, readOnly bool) (string, error) {
	return auth.MintStationToken(c.jwtSecret, slugs, dirs, subject, ttl, readOnly)
}

func (c *Client) refreshToken() error {
	token, err := auth.MintAdminToken(c.jwtSecret, c.tokenTTL)
	if err != nil {
		return err
	}
	c.token.Store(token)
	return nil
}

func (c *Client) refreshLoop(ctx context.Context) {
	// Refresh well before expiry so an in-flight call never races a stale token.
	interval := c.tokenTTL / 2
	if interval <= 0 {
		interval = time.Minute
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := c.refreshToken(); err != nil {
				// Keep serving with the last-known-good token; it'll retry
				// on the next tick. The token itself won't have expired
				// yet since we refresh at half its TTL.
				continue
			}
		}
	}
}

// authContext attaches the current admin bearer token to ctx as outgoing
// gRPC metadata.
func (c *Client) authContext(ctx context.Context) context.Context {
	token, _ := c.token.Load().(string)
	return metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+token)
}
