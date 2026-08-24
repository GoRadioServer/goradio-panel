package audioclient

import (
	"context"

	audioserverv1 "github.com/goradioserver/goradio-panel/gen/go/audioserver/v1"
)

func (c *Client) QueueTrack(ctx context.Context, req *audioserverv1.QueueTrackRequest) (*audioserverv1.QueueTrackResponse, error) {
	resp, err := c.grpcClient.QueueTrack(c.authContext(ctx), req)
	if err != nil {
		return nil, mapErr(err)
	}
	return resp, nil
}

func (c *Client) RemoveFromQueue(ctx context.Context, slug, queueID string) (*audioserverv1.RemoveFromQueueResponse, error) {
	resp, err := c.grpcClient.RemoveFromQueue(c.authContext(ctx), &audioserverv1.RemoveFromQueueRequest{Slug: slug, QueueId: queueID})
	if err != nil {
		return nil, mapErr(err)
	}
	return resp, nil
}

func (c *Client) ClearQueue(ctx context.Context, slug string, stopCurrent bool) (*audioserverv1.ClearQueueResponse, error) {
	resp, err := c.grpcClient.ClearQueue(c.authContext(ctx), &audioserverv1.ClearQueueRequest{Slug: slug, StopCurrent: stopCurrent})
	if err != nil {
		return nil, mapErr(err)
	}
	return resp, nil
}

func (c *Client) Skip(ctx context.Context, slug string) (*audioserverv1.SkipResponse, error) {
	resp, err := c.grpcClient.Skip(c.authContext(ctx), &audioserverv1.SkipRequest{Slug: slug})
	if err != nil {
		return nil, mapErr(err)
	}
	return resp, nil
}

func (c *Client) SkipTo(ctx context.Context, slug, queueID string) (*audioserverv1.SkipToResponse, error) {
	resp, err := c.grpcClient.SkipTo(c.authContext(ctx), &audioserverv1.SkipToRequest{Slug: slug, QueueId: queueID})
	if err != nil {
		return nil, mapErr(err)
	}
	return resp, nil
}

func (c *Client) UnregisterStation(ctx context.Context, slug string) error {
	_, err := c.grpcClient.UnregisterStation(c.authContext(ctx), &audioserverv1.UnregisterStationRequest{Slug: slug})
	return mapErr(err)
}

// Seek jumps the current track to an absolute position, clamped to
// [0, duration] by the audio server. A no-op (not an error) if nothing is
// playing or the current track is a live relay -- see SeekResponse.Seeked.
func (c *Client) Seek(ctx context.Context, slug string, positionSeconds int64) (*audioserverv1.SeekResponse, error) {
	resp, err := c.grpcClient.Seek(c.authContext(ctx), &audioserverv1.SeekRequest{Slug: slug, PositionSeconds: positionSeconds})
	if err != nil {
		return nil, mapErr(err)
	}
	return resp, nil
}
