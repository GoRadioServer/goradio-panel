# Single-container image: the Go API server plus the built React SPA,
# served together on one port (internal/httpapi's static file handler
# serves web/dist and falls back to index.html for client-side routes).
#
# Configure via environment variables (see docker/panel.docker.yaml, the
# default config baked into this image, and internal/config's
# applyEnvOverrides) -- no custom build needed per deployment:
#
#   docker run -p 8081:8081 \
#     -e AUDIOSERVER_GRPC_ADDR=my-audio-server:9090 \
#     -e AUDIOSERVER_HTTP_BASE_URL=https://radio.example.com \
#     -e GORADIO_JWT_SECRET=<shared with the audio server> \
#     -e PANEL_SESSION_JWT_SECRET=<a different random secret> \
#     -e PANEL_BOOTSTRAP_PASSWORD=<first-run admin password> \
#     # (the baked config already serves the UI from /app/web/dist; only
#     #  set PANEL_STATIC_DIR if you mount your own panel.yaml over it)
#     -v panel-data:/data \
#     ghcr.io/tmfksoft/goradio-panel

FROM node:22-alpine AS web-build
WORKDIR /src/web

COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./
RUN npm run build

FROM golang:1.27-alpine AS go-build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /out/panel ./cmd/panel

FROM alpine:3.20
RUN apk add --no-cache ca-certificates && \
    addgroup -g 1000 -S panel && adduser -u 1000 -S panel -G panel

COPY --from=go-build /out/panel /usr/local/bin/panel
COPY --from=web-build /src/web/dist /app/web/dist
COPY docker/panel.docker.yaml /app/panel.yaml

# db.sqlite_path (default /data/panel.db, see docker/panel.docker.yaml)
# should point under here -- mount a volume for the SQLite database (user
# accounts + captured listener stats) to persist across restarts.
RUN mkdir -p /data && chown panel:panel /data
VOLUME ["/data"]

WORKDIR /app
USER panel

EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8081/healthz || exit 1

ENTRYPOINT ["panel"]
CMD ["--config", "/app/panel.yaml"]
