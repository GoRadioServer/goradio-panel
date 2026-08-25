package audioclient

import (
	"context"
	"sort"

	audioserverv1 "github.com/goradioserver/goradio-panel/gen/go/audioserver/v1"
)

// DirectoryEntry is one file or subdirectory under the audio server's
// audio_root, scoped to whatever the calling token's directory claim
// authorizes (see ListDirectory) -- the panel's own admin token is
// unrestricted, so a browse initiated from the panel itself always sees a
// directory's full contents.
type DirectoryEntry struct {
	Name      string `json:"name"`
	IsDir     bool   `json:"is_dir"`
	Path      string `json:"path"`
	SizeBytes int64  `json:"size_bytes"`
}

// ListDirectory lists one directory under audio_root via the ListDirectory
// RPC, sorted directories-first then by name -- the audio server's own
// response order isn't guaranteed (os.ReadDir happens to sort by name, but
// nothing about the RPC contract promises that), and a stable order avoids
// a browse UI's listing reshuffling between requests.
func (c *Client) ListDirectory(ctx context.Context, path string) ([]DirectoryEntry, error) {
	resp, err := c.grpcClient.ListDirectory(c.authContext(ctx), &audioserverv1.ListDirectoryRequest{Path: path})
	if err != nil {
		return nil, mapErr(err)
	}

	entries := make([]DirectoryEntry, 0, len(resp.GetEntries()))
	for _, e := range resp.GetEntries() {
		entries = append(entries, DirectoryEntry{
			Name:      e.GetName(),
			IsDir:     e.GetIsDir(),
			Path:      e.GetPath(),
			SizeBytes: e.GetSizeBytes(),
		})
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir != entries[j].IsDir {
			return entries[i].IsDir // directories first
		}
		return entries[i].Name < entries[j].Name
	})
	return entries, nil
}
