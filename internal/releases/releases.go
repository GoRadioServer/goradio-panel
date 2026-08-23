// Package releases checks the audio server's GitHub repository for the
// latest published release, so the panel can tell an operator that the
// server they're running is out of date.
//
// The result is cached and refreshed on an interval rather than fetched
// per request: GitHub's unauthenticated API allows only 60 requests an
// hour per IP, which a busy panel (or several panels behind one NAT)
// would otherwise burn through, and a stale answer is harmless here.
package releases

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Release is the latest published release of the audio server.
type Release struct {
	Version     string    `json:"version"`
	URL         string    `json:"url"`
	PublishedAt time.Time `json:"published_at"`
}

// Checker fetches and caches the latest release for one GitHub repo.
type Checker struct {
	repo     string // "owner/name"
	interval time.Duration
	client   *http.Client

	mu        sync.RWMutex
	latest    *Release
	fetchedAt time.Time
	lastErr   error
}

func NewChecker(repo string, interval time.Duration) *Checker {
	return &Checker{
		repo:     repo,
		interval: interval,
		// A hung call to GitHub must never hold up a panel request, and
		// this runs on a ticker where a missed round is inconsequential.
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// Latest returns the cached release, and whether one has been fetched
// yet. Never blocks on the network.
func (c *Checker) Latest() (*Release, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.latest == nil {
		return nil, false
	}
	r := *c.latest
	return &r, true
}

// Run fetches immediately, then refreshes on the configured interval
// until ctx is canceled.
func (c *Checker) Run(ctx context.Context) {
	c.refresh(ctx)

	ticker := time.NewTicker(c.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.refresh(ctx)
		}
	}
}

func (c *Checker) refresh(ctx context.Context) {
	rel, err := c.fetch(ctx)

	c.mu.Lock()
	defer c.mu.Unlock()
	c.lastErr = err
	if err != nil {
		// Keep serving the previous answer: a transient GitHub outage or
		// a rate-limit shouldn't blank out version info in the UI.
		return
	}
	c.latest = rel
	c.fetchedAt = time.Now()
}

func (c *Checker) fetch(ctx context.Context) (*Release, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", c.repo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "goradio-panel")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch latest release: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch latest release: github returned %s", resp.Status)
	}

	var body struct {
		TagName     string    `json:"tag_name"`
		HTMLURL     string    `json:"html_url"`
		PublishedAt time.Time `json:"published_at"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("decode latest release: %w", err)
	}
	return &Release{
		Version:     body.TagName,
		URL:         body.HTMLURL,
		PublishedAt: body.PublishedAt,
	}, nil
}

// UpdateAvailable reports whether latest is newer than current.
//
// It is deliberately conservative: anything it can't confidently parse as
// a semver-ish tag (notably "dev", the version a locally built server
// reports) returns false, so the UI nags only when there's a real,
// comparable version gap.
func UpdateAvailable(current, latest string) bool {
	cur, ok := parseVersion(current)
	if !ok {
		return false
	}
	lat, ok := parseVersion(latest)
	if !ok {
		return false
	}
	for i := range cur {
		if cur[i] != lat[i] {
			return lat[i] > cur[i]
		}
	}
	return false
}

// parseVersion parses a "v1.2.3"-style tag into major/minor/patch. A
// pre-release or build suffix ("v1.2.3-rc1") is ignored for comparison
// purposes -- close enough for an "update available" hint, and it avoids
// pulling in a semver dependency for one banner.
func parseVersion(v string) ([3]int, bool) {
	var out [3]int
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(v, "v")
	if v == "" {
		return out, false
	}
	if i := strings.IndexAny(v, "-+"); i >= 0 {
		v = v[:i]
	}

	parts := strings.Split(v, ".")
	if len(parts) == 0 || len(parts) > 3 {
		return out, false
	}
	for i, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil || n < 0 {
			return out, false
		}
		out[i] = n
	}
	return out, true
}
