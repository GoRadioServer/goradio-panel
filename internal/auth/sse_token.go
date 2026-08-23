package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// SSEClaims authorizes a single short-lived EventSource connection to one
// station's event stream. Kept structurally distinct from SessionClaims
// (different Typ) so a leaked SSE token -- which travels in a URL query
// string and so is more exposure-prone (browser history, proxy/access
// logs) -- can't be replayed against any other route, and is only ever
// valid for a few seconds to begin with.
type SSEClaims struct {
	jwt.RegisteredClaims
	Username string `json:"username"`
	// ServerID scopes the token to one audio server: slugs are only
	// unique within a server, so without this a token minted for
	// "k-dst" on one server would authorize "k-dst" on every other.
	ServerID string `json:"server_id"`
	Slug     string `json:"slug"`
	Typ      string `json:"typ"`
}

const sseTyp = "sse"

// SignSSEToken mints a token authorizing username to open an EventSource
// connection to slug's event stream on serverID.
func SignSSEToken(secret []byte, username, serverID, slug string, ttl time.Duration) (string, time.Time, error) {
	now := time.Now()
	expiresAt := now.Add(ttl)
	claims := SSEClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   username,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
		Username: username,
		ServerID: serverID,
		Slug:     slug,
		Typ:      sseTyp,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign sse token: %w", err)
	}
	return signed, expiresAt, nil
}

// VerifySSEToken checks an SSE token's signature, expiry, type, and that
// it authorizes the given station on the given server.
func VerifySSEToken(secret []byte, tokenString, serverID, slug string) (*SSEClaims, error) {
	claims := &SSEClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return secret, nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid token")
	}
	if claims.Typ != sseTyp {
		return nil, errors.New("wrong token type")
	}
	if claims.ServerID != serverID || claims.Slug != slug {
		return nil, errors.New("token not authorized for this station")
	}
	return claims, nil
}
