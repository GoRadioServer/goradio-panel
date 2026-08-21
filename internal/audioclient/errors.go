package audioclient

import (
	"errors"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var (
	ErrNotFound         = errors.New("not found")
	ErrPermissionDenied = errors.New("permission denied")
)

// mapErr translates the audio server's gRPC status codes into sentinel
// errors the httpapi layer can map to HTTP status codes, without callers
// needing to know about gRPC.
func mapErr(err error) error {
	if err == nil {
		return nil
	}
	st, ok := status.FromError(err)
	if !ok {
		return err
	}
	switch st.Code() {
	case codes.NotFound:
		return ErrNotFound
	case codes.PermissionDenied:
		return ErrPermissionDenied
	default:
		return err
	}
}
