# goradio-panel

A web admin panel for [GoRadio](https://goradioserver.github.io/goradio/):
list stations, watch their live status and queue, manually queue tracks,
skip or clear a queue, and see listener-count history over time — none of
which the audio server exposes a UI for itself.

The panel has its own username/password accounts, separate from the audio
server's station-scoped JWTs, and talks to the audio server purely over its
existing `audioserver.v1.AudioServerService` gRPC control plane — there's no
code or module dependency between the two repos.

## What it's for

`radio serve` is an API-first audio server: everything it can do is
reachable over gRPC/Connect and a small HTTP surface, but nothing about
running it produces a UI. goradio-panel is that UI — point it at one or
more running audio servers and it gives you:

- A **dashboard** of every registered station, grouped however you like,
  with live on-air/silence status at a glance.
- A **station page** per station: now playing, a listener-history chart,
  the pending queue, recently played tracks, and the actions to manage
  them (queue a track, skip, clear the queue, unregister).
- A **tokens** page to mint scoped JWTs for station controllers and
  read-only observers — the same tokens `radio tokengen` produces, without
  needing a shell open next to the audio server.
- A **media browser** to explore the audio server's `audio_root` and queue
  a file straight to a station, without knowing its path in advance.
- **User accounts** for the panel itself, independent of any station's
  audio-server token.

## How it's built

- `cmd/panel` — the Go backend: a REST API (`internal/httpapi`), SQLite
  storage for user accounts and captured listener stats (`internal/db`,
  `internal/stats`), and a gRPC client (`internal/audioclient`) that mints
  its own admin service token (`slugs: ["*"]`, read-write) against each
  configured audio server's shared `auth.jwt_secret`.
- `web/` — a React + TypeScript + Vite single-page app, served by the same
  binary once built (see [Deployment](deployment/docker.md)).

Since the audio server keeps no history of its own — listener counts are
instantaneous only — the panel builds its own time series: a background
collector polls `ListStations` to discover registered stations, subscribes
to each one's `SubscribeEvents` stream for `LISTENER_COUNT_CHANGED`, and
also takes a periodic fallback snapshot so idle periods still produce
chartable points.

## Where to start

- [Installation](getting-started/installation.md) — run it locally against
  a real audio server.
- [Configuration](getting-started/configuration.md) — every setting, and
  which environment variable overrides it.
- [Using the Panel](using-the-panel/dashboard.md) — a tour of each page.
- [Deployment](deployment/docker.md) — Docker and Kubernetes.
