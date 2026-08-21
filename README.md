# goradio-panel

A web admin panel for [gta-radio-golang](https://github.com/tmfksoft/goradio) (GoRadio):
list stations, watch their live status and queue, manually queue tracks,
skip/clear the queue, and see listener-count history over time -- none of
which the audio server exposes a UI for itself.

The panel has its own username/password accounts (separate from the audio
server's station-scoped JWTs) and talks to the audio server purely over its
existing `audioserver.v1.AudioServerService` gRPC control plane -- no code
or module dependency on that repo.

## Architecture

- `cmd/panel` -- the Go backend: REST API (`internal/httpapi`), SQLite
  storage for user accounts and captured listener stats
  (`internal/db`, `internal/stats`), and a gRPC client
  (`internal/audioclient`) that mints its own admin service token
  (`slugs: ["*"]`, read-write) against the audio server's shared
  `auth.jwt_secret`.
- `web/` -- a React + TypeScript + Vite single-page app.
- `gen/go/audioserver/v1` -- gRPC client stubs generated from the Buf
  Schema Registry (`buf generate proto.prod.wtf/tmfksoft/goradio`), not
  vendored `.proto` files.

Since the audio server keeps no history of its own (listener counts are
instantaneous only), the panel builds its own time series: a background
collector polls `ListStations` to discover registered stations, subscribes
to each one's `SubscribeEvents` stream for `LISTENER_COUNT_CHANGED`, and
also takes a periodic fallback snapshot so idle periods still produce
chartable points.

## Configuration

Copy `panel.example.yaml` to `panel.yaml` and fill in:

- `audioserver.grpc_addr` -- where the audio server's gRPC control plane
  is reachable.
- `audioserver.http_base_url` -- the audio server's public HTTP base (its
  own `http.public_base_url`), used only to build station listen URLs for
  the UI (`GET {http_base_url}/stream/{slug}`, a fixed path the audio
  server always serves a station's stream at). Optional -- leave unset to
  hide the player. Include any path prefix a reverse proxy in front of the
  audio server needs.
- `audioserver.jwt_secret` -- **must match** the audio server's own
  `auth.jwt_secret` (or set `GORADIO_JWT_SECRET` in the environment, the
  same variable name gta-radio-golang itself uses).
- `auth.session_jwt_secret` -- a separate secret for the panel's own
  session JWTs (human logins). Never reuse `audioserver.jwt_secret` here.
- `bootstrap_admin.username` / `.password` -- created once, only if the
  `users` table is empty at startup.

## Running locally

```sh
go run ./cmd/panel --config panel.yaml   # API on http.listen_addr (default :8081)
cd web && npm install && npm run dev      # SPA on :5173, proxies /api -> :8081
```

To test against a real audio server, follow gta-radio-golang's own
quickstart (`radio serve`, `radio tokengen`, `radio station`), then point
`panel.yaml` at it with the matching `jwt_secret`.

## Building

```sh
make build       # -> bin/panel
make web-build   # -> web/dist (static SPA; serve separately, proxying /api)
make proto       # regenerate gen/go/audioserver/v1 from the BSR
```

## Deploying

### Docker

The `Dockerfile` builds a single container with the API and the built SPA
served together on one port (`internal/httpapi`'s static handler serves
`web/dist` and falls back to `index.html` for client-side routes, so no
separate frontend host/proxy is needed). Configure entirely via
environment variables -- see `docker/panel.docker.yaml`, the default
config baked into the image, and `internal/config`'s `applyEnvOverrides`
for the full list:

```sh
docker build -t goradio-panel .

docker run -d -p 8081:8081 \
  -e AUDIOSERVER_GRPC_ADDR=my-audio-server:9090 \
  -e AUDIOSERVER_HTTP_BASE_URL=https://radio.example.com \
  -e GORADIO_JWT_SECRET=<matches the audio server's auth.jwt_secret> \
  -e PANEL_SESSION_JWT_SECRET=<a different random secret> \
  -e PANEL_BOOTSTRAP_PASSWORD=<first-run admin password> \
  -v panel-data:/data \
  goradio-panel
```

`/data` holds the SQLite database (user accounts + captured listener
stats) -- mount a volume there for it to survive container restarts.
`GET /healthz` is wired up for both Docker's own `HEALTHCHECK` and a k8s
probe.

### Kubernetes

Example manifests live in `k8s/` (Namespace, ConfigMap, Secret template,
PVC, Deployment, Service, Ingress), tied together with a
`kustomization.yaml`:

```sh
cp k8s/secret.example.yaml k8s/secret.yaml   # fill in real values -- gitignored, never commit it
kubectl apply -f k8s/secret.yaml
kubectl apply -k k8s/
```

**Read `k8s/deployment.yaml`'s top comment before touching replica count.**
The panel's SQLite-backed storage means it must stay at `replicas: 1`
with `strategy: Recreate` -- scaling out needs swapping SQLite for a real
database server first, not just raising the replica count.

`k8s/ingress.yaml` is written against ingress-nginx + cert-manager as a
worked example; adjust it (or replace it entirely) to match your
cluster's actual ingress controller. Its `proxy-buffering`/
`proxy-read-timeout` annotations matter if you keep ingress-nginx --
without them the live station-events SSE stream gets buffered/killed by
nginx's defaults.
