package audioclient

import "testing"

func TestParseGRPCTarget(t *testing.T) {
	cases := []struct {
		addr       string
		wantTarget string
		wantTLS    bool
	}{
		{"localhost:9090", "localhost:9090", false},
		{"https://radio-rpc.tbt.services", "radio-rpc.tbt.services:443", true},
		{"grpcs://radio-rpc.tbt.services:8443", "radio-rpc.tbt.services:8443", true},
		{"http://localhost:9090", "localhost:9090", false},
		{"grpc://localhost", "localhost:80", false},
	}
	for _, c := range cases {
		target, useTLS := parseGRPCTarget(c.addr)
		if target != c.wantTarget || useTLS != c.wantTLS {
			t.Errorf("parseGRPCTarget(%q) = (%q, %v), want (%q, %v)", c.addr, target, useTLS, c.wantTarget, c.wantTLS)
		}
	}
}
