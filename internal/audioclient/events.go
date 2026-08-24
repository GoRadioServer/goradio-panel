package audioclient

import (
	"context"

	audioserverv1 "github.com/goradioserver/goradio-panel/gen/go/audioserver/v1"
)

// SubscribeEvents opens the server-streaming SubscribeEvents RPC for slug
// and forwards each event onto the returned channel until ctx is canceled
// or the stream ends, at which point the channel is closed. Callers are
// responsible for reconnecting (with their own backoff policy) if they
// want to keep watching after the channel closes.
func (c *Client) SubscribeEvents(ctx context.Context, slug string) (<-chan *audioserverv1.StationEvent, error) {
	stream, err := c.grpcClient.SubscribeEvents(c.authContext(ctx), &audioserverv1.SubscribeEventsRequest{Slug: slug})
	if err != nil {
		return nil, mapErr(err)
	}

	events := make(chan *audioserverv1.StationEvent)
	go func() {
		defer close(events)
		for {
			evt, err := stream.Recv()
			if err != nil {
				// Stream ended (EOF, canceled, or a server-side error) --
				// the channel close is the signal; caller decides whether
				// and how to reconnect.
				return
			}
			select {
			case events <- evt:
			case <-ctx.Done():
				return
			}
		}
	}()

	return events, nil
}
