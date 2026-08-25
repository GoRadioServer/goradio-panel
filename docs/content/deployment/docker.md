# Docker

The published image is a single container with the API and the built SPA
served together on one port — `internal/httpapi`'s static file handler
serves `web/dist` and falls back to `index.html` for client-side routes,
so no separate frontend host or proxy is needed.

Configure entirely via environment variables — see
[Configuration](../getting-started/configuration.md#environment-variable-overrides)
for the full list — rather than building a custom image per deployment.

```sh
docker run -d -p 8081:8081 \
  -e AUDIOSERVER_GRPC_ADDR=my-audio-server:9090 \
  -e AUDIOSERVER_HTTP_BASE_URL=https://radio.example.com \
  -e GORADIO_JWT_SECRET=<matches the audio server's auth.jwt_secret> \
  -e PANEL_SESSION_JWT_SECRET=<a different random secret> \
  -e PANEL_BOOTSTRAP_PASSWORD=<first-run admin password> \
  -v panel-data:/data \
  ghcr.io/goradioserver/goradio-panel
```

`PANEL_STATIC_DIR` is already baked into the image (pointing at the built
UI), so you don't need to set it yourself unless you mount your own
`panel.yaml` over the image's default — in that case, set it explicitly or
`http.static_dir` in your mounted config, or every page request 404s with
the API still working underneath.

## Persistent data

`/data` holds the SQLite database — user accounts and captured listener
stats. Mount a volume there, as above, for it to survive container
restarts. `PANEL_SQLITE_PATH` (default `/data/panel.db` in the image)
overrides where inside the container that file lives, if you need it
somewhere else.

## Health checks

`GET /healthz` is wired up for both Docker's own `HEALTHCHECK` (baked into
the image) and a Kubernetes probe.

## Building the image yourself

```sh
git clone https://github.com/GoRadioServer/goradio-panel
cd goradio-panel
docker build -t goradio-panel .
```

The `Dockerfile` is a three-stage build: the frontend (`node:22-alpine`),
the Go binary (`golang:1.27-alpine`, `CGO_ENABLED=0`), and a minimal
`alpine:3.20` runtime image with just the compiled binary, the built
`web/dist`, and `docker/panel.docker.yaml` baked in as the default config.
