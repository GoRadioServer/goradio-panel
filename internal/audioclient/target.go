package audioclient

import (
	"net"
	"strings"
)

// parseGRPCTarget turns a configured grpc_addr into a grpc.NewClient
// target plus whether to dial with TLS. grpc's own target parsing treats
// "scheme://" as one of its resolver schemes (dns, passthrough, unix,
// ...) -- "https"/"http" aren't among them, so a URL-shaped address like
// "https://host.example.com" (the natural way to point at a server
// sitting behind a TLS-terminating reverse proxy) would otherwise fail to
// resolve at all. A bare "host:port" with no scheme is passed through
// unchanged and dialed in plaintext, preserving the existing default
// ("localhost:9090").
//
// Reproduces gta-radio-golang's own internal/luastation/engine.go (its
// station controller accepts the exact same grpc_addr forms) -- no
// module dependency on that repo, just the same parsing rule so this
// panel accepts whatever a user copies from a station.yaml.
func parseGRPCTarget(addr string) (target string, useTLS bool) {
	scheme, rest, hasScheme := strings.Cut(addr, "://")
	if !hasScheme {
		return addr, false
	}

	defaultPort := "80"
	switch scheme {
	case "https", "grpcs":
		useTLS = true
		defaultPort = "443"
	case "http", "grpc":
		useTLS = false
	default:
		// Unrecognized scheme -- pass the original string through
		// unchanged and let grpc's own target parsing surface an error
		// rather than guessing.
		return addr, false
	}

	if _, _, err := net.SplitHostPort(rest); err != nil {
		rest = net.JoinHostPort(rest, defaultPort)
	}
	return rest, useTLS
}
