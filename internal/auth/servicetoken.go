package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// audioServerClaims reproduces the exact claim shape gta-radio-golang's own
// internal/auth.Claims expects ({sub, iat, exp, slugs, dirs, read_only}) so
// a token we mint here verifies against its HS256 auth.jwt_secret. This is
// deliberately duplicated rather than imported -- goradio-panel has no
// module dependency on github.com/goradioserver/goradio, only a shared network
// contract. Keep this in sync with that repo's internal/auth.Claims --
// dirs was added there to let a token be scoped to specific directories
// under audio_root (recursively: an entry of "GTASA/KROSE" also covers
// everything under it), independent of which station slugs it covers.
type audioServerClaims struct {
	jwt.RegisteredClaims
	Slugs    []string `json:"slugs"`
	Dirs     []string `json:"dirs,omitempty"`
	ReadOnly bool     `json:"read_only,omitempty"`
}

// MintAdminToken signs a token authorizing every station slug ("*") and
// every directory (nil Dirs, same as omitting it -- unrestricted), for the
// panel's own gRPC calls against the audio server, including browsing.
func MintAdminToken(secret []byte, ttl time.Duration) (string, error) {
	return MintStationToken(secret, []string{"*"}, nil, "goradio-panel", ttl, false)
}

// MintStationToken signs an audio-server-compatible token for the given
// slugs (exact slugs or filepath.Match globs, e.g. "*" for every station)
// and, optionally, directories (nil/empty means unrestricted), equivalent
// to `radio tokengen -secret ... [-subject ...] [-ttl ...] [-readonly]
// [-dirs ...] <slug...>` -- lets an operator mint a token for a
// controller/observer without needing shell access to the audio server
// itself.
func MintStationToken(secret []byte, slugs []string, dirs []string, subject string, ttl time.Duration, readOnly bool) (string, error) {
	now := time.Now()
	claims := audioServerClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   subject,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
		Slugs:    slugs,
		Dirs:     dirs,
		ReadOnly: readOnly,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(secret)
	if err != nil {
		return "", fmt.Errorf("sign station token: %w", err)
	}
	return signed, nil
}
