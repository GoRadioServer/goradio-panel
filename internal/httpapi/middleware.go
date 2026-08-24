package httpapi

import (
	"context"
	"net/http"
	"strings"

	"github.com/goradioserver/goradio-panel/internal/auth"
)

type sessionContextKey struct{}

// requireSession wraps a handler, rejecting the request with 401 unless it
// carries a valid session bearer token, and attaching its claims to the
// request context for the handler to read via sessionFromContext.
func requireSession(secret []byte, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		h := r.Header.Get("Authorization")
		const prefix = "Bearer "
		if !strings.HasPrefix(h, prefix) {
			http.Error(w, "missing bearer token", http.StatusUnauthorized)
			return
		}
		token := strings.TrimPrefix(h, prefix)

		claims, err := auth.VerifySession(secret, token)
		if err != nil {
			http.Error(w, "invalid session token", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), sessionContextKey{}, claims)
		next(w, r.WithContext(ctx))
	}
}

func sessionFromContext(ctx context.Context) (*auth.SessionClaims, bool) {
	claims, ok := ctx.Value(sessionContextKey{}).(*auth.SessionClaims)
	return claims, ok
}
