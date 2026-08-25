# Installation

There are two ways to run goradio-panel: as a prebuilt container (the
fastest path to a working panel — see [Deployment](../deployment/docker.md)),
or from source, which this page covers. Building from source is the right
choice if you want to develop the panel itself or run it without Docker.

## Prerequisites

- Go 1.27+
- Node.js 22+ (for the web frontend)
- A running [GoRadio](https://goradioserver.github.io/goradio/) audio
  server (`radio serve`) to point the panel at — the panel has nothing to
  manage without one.

## Get the source

```sh
git clone https://github.com/GoRadioServer/goradio-panel
cd goradio-panel
```

## Configure

```sh
cp panel.example.yaml panel.yaml
```

At minimum, fill in one audio server under `audioservers` — its
`grpc_addr` and `jwt_secret` (matching that server's own `auth.jwt_secret`)
— and `auth.session_jwt_secret` and `bootstrap_admin.password`. See
[Configuration](configuration.md) for every field.

## Run it

The API server and the frontend dev server run separately in local
development — the frontend proxies API calls to the backend, so you need
both:

```sh
go run ./cmd/panel --config panel.yaml   # API on http.listen_addr (default :8081)
```

```sh
cd web
npm install
npm run dev                              # SPA on :5173, proxies /api -> :8081
```

Open `http://localhost:5173` and sign in with the `bootstrap_admin`
username/password from `panel.yaml` — that account is only created once,
the first time the panel starts with an empty `users` table.

## Testing against a real audio server

If you don't already have one running, follow GoRadio's own
[Quickstart](https://goradioserver.github.io/goradio/getting-started/quickstart/)
(`radio serve`, `radio tokengen`, `radio station`), then point `panel.yaml`
at it with the matching `jwt_secret`.

## Next steps

- [Configuration](configuration.md) for the full settings reference.
- [Using the Panel](../using-the-panel/dashboard.md) for a tour of the UI.
- [Building from Source](../building.md) to produce a standalone binary
  instead of running via `go run`.
