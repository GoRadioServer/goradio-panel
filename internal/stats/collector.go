package stats

import (
	"context"
	"log/slog"
	"sync"
	"sync/atomic"
	"time"

	audioserverv1 "github.com/tmfksoft/goradio-panel/gen/go/audioserver/v1"
	"github.com/tmfksoft/goradio-panel/internal/audioclient"
)

// LiveState is a station's connectivity/playback snapshot as last
// observed by the collector -- cheap to read from the HTTP layer,
// unlike calling GetStatus per station on every dashboard/sidebar
// request.
type LiveState struct {
	// Connected is false while the collector's own SubscribeEvents
	// stream for this station is down and retrying (backoff after a
	// dropped connection, audio server restart, etc) -- "offline" from
	// the panel's point of view, distinct from the station itself
	// merely playing silence.
	Connected bool
	// Silence mirrors the station's own is_silence: registered and
	// reachable, but nothing queued/playing right now.
	Silence bool
}

type Collector struct {
	client            *audioclient.Client
	store             *Store
	discoveryInterval time.Duration
	fallbackInterval  time.Duration
	log               *slog.Logger

	mu      sync.RWMutex // guards watched (map access only -- entries' own fields are atomics)
	watched map[string]*watch
}

type watch struct {
	cancel    context.CancelFunc
	lastCount atomic.Int64
	connected atomic.Bool
	silence   atomic.Bool
}

func NewCollector(client *audioclient.Client, store *Store, discoveryInterval, fallbackInterval time.Duration, log *slog.Logger) *Collector {
	return &Collector{
		client:            client,
		store:             store,
		discoveryInterval: discoveryInterval,
		fallbackInterval:  fallbackInterval,
		log:               log,
		watched:           make(map[string]*watch),
	}
}

// Snapshot returns the last-known live state for every currently-watched
// station, safe to call from any goroutine (the HTTP handlers, in
// particular, which run on a different goroutine than Run's loop).
func (c *Collector) Snapshot() map[string]LiveState {
	c.mu.RLock()
	defer c.mu.RUnlock()

	out := make(map[string]LiveState, len(c.watched))
	for slug, w := range c.watched {
		out[slug] = LiveState{
			Connected: w.connected.Load(),
			Silence:   w.silence.Load(),
		}
	}
	return out
}

// Run discovers registered stations on a ticker, starting/stopping a
// per-station SubscribeEvents watcher as stations appear/disappear, and
// separately snapshots every watched station's last-known listener count
// on a fallback ticker so idle periods still produce chartable points.
// Blocks until ctx is canceled.
func (c *Collector) Run(ctx context.Context) {
	c.discover(ctx)

	discoveryTicker := time.NewTicker(c.discoveryInterval)
	defer discoveryTicker.Stop()
	fallbackTicker := time.NewTicker(c.fallbackInterval)
	defer fallbackTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			c.mu.Lock()
			for _, w := range c.watched {
				w.cancel()
			}
			c.mu.Unlock()
			return
		case <-discoveryTicker.C:
			c.discover(ctx)
		case <-fallbackTicker.C:
			c.snapshotFallback(ctx)
		}
	}
}

// discover is the sole writer of c.watched -- only ever called from Run's
// loop, so mutations don't race each other; the mutex here is purely to
// keep concurrent Snapshot() reads from other goroutines safe.
func (c *Collector) discover(ctx context.Context) {
	stations, err := c.client.ListStations(ctx)
	if err != nil {
		c.log.Warn("stats: list stations failed", "error", err)
		return
	}

	live := make(map[string]bool, len(stations))
	var newSlugs []string
	c.mu.Lock()
	for _, st := range stations {
		live[st.Slug] = true
		if _, ok := c.watched[st.Slug]; !ok {
			w := &watch{}
			c.watched[st.Slug] = w
			newSlugs = append(newSlugs, st.Slug)
		}
	}
	for slug, w := range c.watched {
		if !live[slug] {
			w.cancel()
			delete(c.watched, slug)
			c.log.Info("stats: stopped watching station", "slug", slug)
		}
	}
	c.mu.Unlock()

	for _, slug := range newSlugs {
		c.startWatch(ctx, slug)
	}
}

func (c *Collector) startWatch(ctx context.Context, slug string) {
	c.mu.RLock()
	w, ok := c.watched[slug]
	c.mu.RUnlock()
	if !ok {
		return // raced with a discover() that already dropped it
	}

	watchCtx, cancel := context.WithCancel(ctx)
	w.cancel = cancel

	// Best-effort initial snapshot so listener/silence state is accurate
	// from the moment a station is first seen, rather than sitting at
	// its zero value until the first relevant event arrives.
	if status, err := c.client.GetStatus(ctx, slug); err == nil {
		w.lastCount.Store(status.GetListenerCount())
		w.silence.Store(status.GetIsSilence())
	}

	c.log.Info("stats: watching station", "slug", slug)
	go c.watchEvents(watchCtx, slug, w)
}

// watchEvents subscribes to slug's event stream, recording a listener_stats
// row on every LISTENER_COUNT_CHANGED event and tracking silence state from
// SILENCE_STARTED/SILENCE_ENDED, reconnecting with backoff if the stream
// drops, until ctx is canceled (station unregistered/removed). connected
// reflects whether that stream is currently up -- down means the panel
// itself has lost touch with this station, not necessarily that the
// station is unhealthy.
func (c *Collector) watchEvents(ctx context.Context, slug string, w *watch) {
	backoff := time.Second
	const maxBackoff = 30 * time.Second

	for ctx.Err() == nil {
		events, err := c.client.SubscribeEvents(ctx, slug)
		if err != nil {
			w.connected.Store(false)
			c.log.Warn("stats: subscribe events failed, retrying", "slug", slug, "error", err, "backoff", backoff)
			if !sleepOrDone(ctx, backoff) {
				return
			}
			backoff = min(backoff*2, maxBackoff)
			continue
		}
		backoff = time.Second
		w.connected.Store(true)

		for evt := range events {
			switch evt.GetType() {
			case audioserverv1.EventType_EVENT_TYPE_LISTENER_COUNT_CHANGED:
				count := evt.GetListenerCountChanged().GetListenerCount()
				w.lastCount.Store(count)
				if err := c.store.Insert(ctx, slug, time.Now(), count); err != nil {
					c.log.Warn("stats: insert listener stat failed", "slug", slug, "error", err)
				}
			case audioserverv1.EventType_EVENT_TYPE_SILENCE_STARTED:
				w.silence.Store(true)
			case audioserverv1.EventType_EVENT_TYPE_SILENCE_ENDED:
				w.silence.Store(false)
			}
		}
		// events channel closed: stream ended, loop around to reconnect
		// (unless ctx was canceled, in which case the loop condition exits).
		w.connected.Store(false)
	}
}

func (c *Collector) snapshotFallback(ctx context.Context) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	for slug, w := range c.watched {
		if err := c.store.Insert(ctx, slug, time.Now(), w.lastCount.Load()); err != nil {
			c.log.Warn("stats: fallback snapshot insert failed", "slug", slug, "error", err)
		}
	}
}

func sleepOrDone(ctx context.Context, d time.Duration) bool {
	select {
	case <-ctx.Done():
		return false
	case <-time.After(d):
		return true
	}
}
