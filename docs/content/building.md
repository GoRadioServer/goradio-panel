# Building from Source

```sh
make build       # -> bin/panel
make web-build   # -> web/dist (static SPA; serve separately, or via -static_dir)
```

`make build` produces a standalone `bin/panel` binary — run it directly
with `./bin/panel --config panel.yaml` instead of `go run ./cmd/panel`.
`make web-build` produces the built frontend at `web/dist`; point
`http.static_dir` (or `PANEL_STATIC_DIR`) at it to serve the UI from the
same process, the same way the [Docker image](deployment/docker.md) does.

## Other Makefile targets

```sh
make web         # npm install + npm run dev -- the frontend dev server
make test        # go test ./...
make vet         # go vet ./...
make fmt         # gofmt -l . (lists files that need formatting)
make tidy        # go mod tidy
make docker-build # docker build -t goradio-panel .
```

## Regenerating the gRPC client

```sh
make proto
```

This repo has no local `.proto` files — `gen/go/audioserver/v1` is
generated straight from the Buf Schema Registry module
[GoRadio itself](https://goradioserver.github.io/goradio/) publishes
(`proto.prod.wtf/goradioserver/goradio`), not vendored copies. Run this
after the audio server's own schema changes to pick up new RPCs or
message fields.
