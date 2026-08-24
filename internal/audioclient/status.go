package audioclient

import (
	"context"

	audioserverv1 "github.com/goradioserver/goradio-panel/gen/go/audioserver/v1"
)

// GetStatus returns the audio server's on-demand snapshot for a station.
func (c *Client) GetStatus(ctx context.Context, slug string) (*audioserverv1.GetStatusResponse, error) {
	resp, err := c.grpcClient.GetStatus(c.authContext(ctx), &audioserverv1.GetStatusRequest{Slug: slug})
	if err != nil {
		return nil, mapErr(err)
	}
	return resp, nil
}
