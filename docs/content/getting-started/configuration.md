# Configuration

Default filename `panel.yaml`, overridden with `panel --config <path>`.
Every field can also be set from the environment — see
[Environment variable overrides](#environment-variable-overrides) below,
which is how the [Docker](../deployment/docker.md) and
[Kubernetes](../deployment/kubernetes.md) deployments are configured
without baking a deployment-specific file into the image.

## `http`

```yaml
http:
  listen_addr: "0.0.0.0:8081"
  # static_dir: "/app/web/dist"
```

- `listen_addr` — where the panel's HTTP server listens.
- `static_dir` — path to the *built* frontend (`web/dist`). Set it to
  serve the web UI from this same port; leave it unset for local
  development, where `npm run dev` serves the UI separately. The container
  image bakes the built UI at `/app/web/dist` and sets this via the
  `PANEL_STATIC_DIR` environment variable — if you mount your own config
  over the image's default and omit this, you get the API only and every
  page request 404s.

## `audioservers`

Every audio server the panel manages. The sidebar's server switcher lists
them in this order, and the first is the default — the one a bare link
without a server resolves to, and the one that owns listener history
captured before the panel supported multiple servers.

```yaml
audioservers:
  - id: "main"
    name: "Main"
    grpc_addr: "localhost:9090"
    http_base_url: "http://localhost:8080"
    jwt_secret: "CHANGE_ME"
    admin_token_ttl: "1h"
    # default_grouping: "game"

  # - id: "backup"
  #   name: "Backup"
  #   grpc_addr: "radio-2.internal:9090"
  #   http_base_url: "https://radio-2.example.com"
  #   jwt_secret: "CHANGE_ME_TOO"
  #   default_grouping: "type"
```

- `id` — a stable key used in URLs (`/servers/{id}/stations/...`) and
  recorded against captured listener stats. Renaming is safe; changing the
  `id` orphans that server's stats history.
- `name` — the human label shown in the switcher. Defaults to `id`.
- `grpc_addr` — a bare `host:port` (plaintext, e.g. `localhost:9090`) or a
  URL with an `https://`/`grpcs://` scheme (TLS — for a server sitting
  behind a TLS-terminating reverse proxy) or `http://`/`grpc://`
  (plaintext).
- `http_base_url` — the audio server's own public HTTP base (its
  `http.public_base_url`), a separate endpoint from `grpc_addr` used only
  to build "listen" URLs for the UI (`GET {http_base_url}/stream/{slug}` —
  the fixed path the audio server always serves a station's stream at).
  Include any path prefix a reverse proxy in front of it needs. Leave
  unset to hide the player.
- `jwt_secret` — must match this audio server's own `auth.jwt_secret`.
- `admin_token_ttl` — how often the panel re-mints its own admin service
  token (`slugs: ["*"]`, read-write) used for every gRPC call it makes.
- `default_grouping` — a station metadata key to group the sidebar and
  station list by on first load, e.g. `"game"` or `"type"`. Omit for no
  grouping. This only seeds the control — whoever is using the panel can
  change it, and their choice sticks until they switch server.

The pre-multi-server single-server form is still accepted: if
`audioservers` is absent, an `audioserver:` block (no `s`) is used as the
sole server, with `id: "default"`. Prefer `audioservers` for new configs.

## `auth`

```yaml
auth:
  session_jwt_secret: "CHANGE_ME"
  session_ttl: "24h"
  sse_token_ttl: "60s"
```

`session_jwt_secret` signs the panel's *own* session JWTs (human logins) —
deliberately separate from any `audioservers[].jwt_secret`, since it's a
different trust boundary. Never reuse an audio server's secret here.

## `db`

```yaml
db:
  sqlite_path: "./data/panel.db"
```

Where the panel stores user accounts and captured listener stats.

## `station_runner`

```yaml
station_runner:
  binary_path: "radio"
  data_dir: "./data/stations"
```

Controls how the panel runs `radio station` for [panel-managed
stations](../using-the-panel/dashboard.md#creating-a-station).

- `binary_path` — the `radio` executable to exec. Defaults to `"radio"`,
  resolved via `PATH` — the Docker image bundles one at
  `/usr/local/bin/radio` (see [Docker](../deployment/docker.md)).
- `data_dir` — where each managed station's generated `station.yaml`/
  `station.lua` live, under `<data_dir>/<server_id>/<slug>/`. Should sit
  on the same persistent volume as `db.sqlite_path`.

## `bootstrap_admin`

```yaml
bootstrap_admin:
  username: "admin"
  password: "CHANGE_ME"
```

Created only if the `users` table is empty at startup — safe to leave in a
config that's redeployed repeatedly.

## `stats`

```yaml
stats:
  station_discovery_interval: "30s"
  fallback_snapshot_interval: "5m"
```

- `station_discovery_interval` — how often the background collector
  re-polls `ListStations` to notice newly registered stations.
- `fallback_snapshot_interval` — how often it takes a listener-count
  snapshot even if no `LISTENER_COUNT_CHANGED` event fired, so an idle
  station's chart still has points rather than one long gap.

## `logging`

```yaml
logging:
  level: "info" # debug|info|warn|error
```

## Environment variable overrides

Applied after the config file is read, so an env var always wins.
`AUDIOSERVER_*`/`GORADIO_JWT_SECRET` predate multi-server support and
address a single server, so they apply to the *first* entry in
`audioservers` — enough to drive a one-server deployment entirely from the
environment, which is what the Docker and Kubernetes examples do. A
multi-server deployment needs the rest declared in the config file.

| Variable | Overrides |
|---|---|
| `PANEL_LISTEN_ADDR` | `http.listen_addr` |
| `PANEL_STATIC_DIR` | `http.static_dir` |
| `AUDIOSERVER_GRPC_ADDR` | `audioservers[0].grpc_addr` |
| `AUDIOSERVER_HTTP_BASE_URL` | `audioservers[0].http_base_url` |
| `GORADIO_JWT_SECRET` | `audioservers[0].jwt_secret` |
| `PANEL_SESSION_JWT_SECRET` | `auth.session_jwt_secret` |
| `PANEL_SQLITE_PATH` | `db.sqlite_path` |
| `PANEL_STATION_RUNNER_BINARY_PATH` | `station_runner.binary_path` |
| `PANEL_STATION_RUNNER_DATA_DIR` | `station_runner.data_dir` |
| `PANEL_BOOTSTRAP_USERNAME` | `bootstrap_admin.username` |
| `PANEL_BOOTSTRAP_PASSWORD` | `bootstrap_admin.password` |

`GORADIO_JWT_SECRET` is the same variable name the audio server itself
uses for the identical value — if `audioservers` is entirely absent from
the config file, setting just this one variable is enough to define a
single server (`grpc_addr` defaults to `localhost:9090`, further
overridable by `AUDIOSERVER_GRPC_ADDR`).
