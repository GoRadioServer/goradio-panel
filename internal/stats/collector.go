package stats

import (
	"context"
	"log/slog"
	"sync/atomic"
	"time"

	audioserverv1 "github.com/tmfksoft/goradio-panel/gen/go/audioserver/v1"
	"github.com/tmfksoft/goradio-panel/internal/audioclient"
)

type Collector struct {
	client            *audioclient.Client
	store             *Store
	discoveryInterval time.Duration
	fallbackInterval  time.Duration
	log               *slog.Logger

	watched map[string]*watch
}

type watch struct {
	cancel    context.CancelFunc
	lastCount atomic.Int64
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
			for _, w := range c.watched {
				w.cancel()
			}
			return
		case <-discoveryTicker.C:
			c.discover(ctx)
		case <-fallbackTicker.C:
			c.snapshotFallback(ctx)
		}
	}
}

// discover is the sole owner of c.watched -- only ever called from Run's
// loop, so it needs no locking.
func (c *Collector) discover(ctx context.Context) {
	stations, err := c.client.ListStations(ctx)
	if err != nil {
		c.log.Warn("stats: list stations failed", "error", err)
		return
	}

	live := make(map[string]bool, len(stations))
	for _, st := range stations {
		live[st.Slug] = true
		if _, ok := c.watched[st.Slug]; !ok {
			c.startWatch(ctx, st.Slug, int64(st.ListenerCount))
		}
	}

	for slug, w := range c.watched {
		if !live[slug] {
			w.cancel()
			delete(c.watched, slug)
			c.log.Info("stats: stopped watching station", "slug", slug)
		}
	}
}

func (c *Collector) startWatch(ctx context.Context, slug string, initialCount int64) {
	watchCtx, cancel := context.WithCancel(ctx)
	w := &watch{cancel: cancel}
	w.lastCount.Store(initialCount)
	c.watched[slug] = w

	c.log.Info("stats: watching station", "slug", slug)
	go c.watchEvents(watchCtx, slug, w)
}

// watchEvents subscribes to slug's event stream, recording a listener_stats
// row on every LISTENER_COUNT_CHANGED event, reconnecting with backoff if
// the stream drops, until ctx is canceled (station unregistered/removed).
func (c *Collector) watchEvents(ctx context.Context, slug string, w *watch) {
	backoff := time.Second
	const maxBackoff = 30 * time.Second

	for ctx.Err() == nil {
		events, err := c.client.SubscribeEvents(ctx, slug)
		if err != nil {
			c.log.Warn("stats: subscribe events failed, retrying", "slug", slug, "error", err, "backoff", backoff)
			if !sleepOrDone(ctx, backoff) {
				return
			}
			backoff = min(backoff*2, maxBackoff)
			continue
		}
		backoff = time.Second

		for evt := range events {
			if evt.GetType() != audioserverv1.EventType_EVENT_TYPE_LISTENER_COUNT_CHANGED {
				continue
			}
			count := evt.GetListenerCountChanged().GetListenerCount()
			w.lastCount.Store(count)
			if err := c.store.Insert(ctx, slug, time.Now(), count); err != nil {
				c.log.Warn("stats: insert listener stat failed", "slug", slug, "error", err)
			}
		}
		// events channel closed: stream ended, loop around to reconnect
		// (unless ctx was canceled, in which case the loop condition exits).
	}
}

func (c *Collector) snapshotFallback(ctx context.Context) {
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
