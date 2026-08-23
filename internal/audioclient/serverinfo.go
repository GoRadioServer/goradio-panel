package audioclient

import (
	"context"

	audioserverv1 "github.com/tmfksoft/goradio-panel/gen/go/audioserver/v1"
)

// ServerVersion returns the audio server's build version, e.g. "v0.11.1",
// or "dev" for a locally built binary with no version baked in.
func (c *Client) ServerVersion(ctx context.Context) (string, error) {
	resp, err := c.grpcClient.GetServerInfo(c.authContext(ctx), &audioserverv1.GetServerInfoRequest{})
	if err != nil {
		return "", mapErr(err)
	}
	return resp.GetVersion(), nil
}
