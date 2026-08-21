package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// SessionClaims is the panel's own JWT for human logins -- a distinct
// trust boundary from the audioserver's station-scoped tokens (see
// servicetoken.go). Typ pins the claim shape so a session token can never
// be accepted where an SSE token is expected, and vice versa.
type SessionClaims struct {
	jwt.RegisteredClaims
	Username string `json:"username"`
	Typ      string `json:"typ"`
}

const sessionTyp = "session"

// SignSession mints a session JWT for username.
func SignSession(secret []byte, username string, ttl time.Duration) (string, time.Time, error) {
	now := time.Now()
	expiresAt := now.Add(ttl)
	claims := SessionClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   username,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
		Username: username,
		Typ:      sessionTyp,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign session token: %w", err)
	}
	return signed, expiresAt, nil
}

// VerifySession checks a session JWT's signature, expiry, and type.
func VerifySession(secret []byte, tokenString string) (*SessionClaims, error) {
	claims := &SessionClaims{}
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
	if claims.Typ != sessionTyp {
		return nil, errors.New("wrong token type")
	}
	return claims, nil
}
