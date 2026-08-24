package audioclient

import (
	"context"
	"sort"

	audioserverv1 "github.com/goradioserver/goradio-panel/gen/go/audioserver/v1"
)

// StationSummary is the per-station listing entry, scoped to whatever the
// panel's admin token authorizes (see ListStations).
type StationSummary struct {
	Slug          string            `json:"slug"`
	Name          string            `json:"name"`
	ListenerCount int64             `json:"listener_count"`
	LogoURL       string            `json:"logo_url"`
	Metadata      map[string]string `json:"metadata"`
}

// ListStations discovers the currently-registered stations via the
// ListStations RPC, sorted by slug.
//
// The audio server builds its response by ranging over a map, so its
// order is randomised per call -- without sorting here, every poll
// reshuffles the panel's station list and sidebar under the user.
func (c *Client) ListStations(ctx context.Context) ([]StationSummary, error) {
	resp, err := c.grpcClient.ListStations(c.authContext(ctx), &audioserverv1.ListStationsRequest{})
	if err != nil {
		return nil, mapErr(err)
	}

	stations := make([]StationSummary, 0, len(resp.GetStations()))
	for _, s := range resp.GetStations() {
		stations = append(stations, StationSummary{
			Slug:          s.GetSlug(),
			Name:          s.GetName(),
			ListenerCount: s.GetListenerCount(),
			LogoURL:       s.GetLogoUrl(),
			Metadata:      s.GetMetadata(),
		})
	}
	sort.Slice(stations, func(i, j int) bool { return stations[i].Slug < stations[j].Slug })
	return stations, nil
}
