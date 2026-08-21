package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// audioServerClaims reproduces the exact claim shape gta-radio-golang's own
// internal/auth.Claims expects ({sub, iat, exp, slugs, read_only}) so a
// token we mint here verifies against its HS256 auth.jwt_secret. This is
// deliberately duplicated rather than imported -- goradio-panel has no
// module dependency on github.com/tmfksoft/goradio, only a shared network
// contract.
type audioServerClaims struct {
	jwt.RegisteredClaims
	Slugs    []string `json:"slugs"`
	ReadOnly bool     `json:"read_only,omitempty"`
}

// MintAdminToken signs a token authorizing every station slug ("*"),
// read-write, for the panel's own gRPC calls against the audio server.
func MintAdminToken(secret []byte, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := audioServerClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "goradio-panel",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
		Slugs:    []string{"*"},
		ReadOnly: false,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(secret)
	if err != nil {
		return "", fmt.Errorf("sign admin token: %w", err)
	}
	return signed, nil
}
