# Tokens

Mint audio-server JWTs for station controllers and observers — the same
tokens
[`radio tokengen`](https://goradioserver.github.io/goradio/cli/tokengen/)
produces, without needing shell access next to the audio server. The panel
never stores a token it mints; it's shown once, on screen.

## Generating a token

- **Scope** — either every station (`*`), or a specific set you pick by
  checkbox from the currently registered stations.
- **Subject** (optional) — a free-text label embedded in the token,
  useful for telling tokens apart later if you're auditing what's been
  issued.
- **TTL** — how long the token is valid, in Go duration format:
  `"30m"`, `"24h"`, `"168h"` (a week).
- **Read-only** — restricts the token to `GetStatus`/`SubscribeEvents`
  only; every write RPC (queueing, skipping, unregistering) is rejected.
  Use this for anything that only needs to observe a station, not control
  it.

Submitting the form calls the audio server directly (through the panel's
own admin token) and shows the result — the signed JWT and its expiry —
in a card below the form, with a copy-to-clipboard button.

## Using a minted token

Paste it into a station controller's config (e.g. a `radio station`
config's `auth.jwt`, or
[goradio-samp](https://goradioserver.github.io/goradio-samp/)'s
`station.yaml`), or present it as an `Authorization: Bearer <token>` header
for a read-only observer hitting the audio server's HTTP API directly.

Once you navigate away from the Tokens page, the token is gone — the panel
doesn't keep a log of tokens it's issued. If you lose one, mint a new one;
there's no way to recover the old one's value (though you can always mint
a fresh one and let the old one simply expire).
