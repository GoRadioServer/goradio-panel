# Stations

Clicking a station card opens its station page — everything the panel
knows about that one station, and the actions to manage it.

## Header

The station's artwork, name, on-air/silence badge, and (if the audio
server lost track of it — the controller disconnected without a clean
unregister) an "Unregistered" badge. Below that, chips for the station's
slug and any metadata it carries.

Three actions live here:

- **Queue track** — opens a form to queue a track by location (a path
  under the audio server's `audio_root`, or a URL for a live relay), with
  optional title/artist overrides and a queue mode (append, or jump the
  queue). Under "Advanced: queue a local file path", a **Browse…** button
  opens a file browser over the audio server's `audio_root` — navigate
  into a folder and click a file to fill in its path (and pre-fill the
  title) instead of typing one from memory. See GoRadio's own docs on
  [queue modes](https://goradioserver.github.io/goradio/developer-api/protocol-reference/)
  for what each mode does.
- **Skip track** — ends the current track early and advances the queue,
  the same as the audio server's `Skip` RPC.
- **Unregister** — removes the station from the audio server's registry.
  A confirmation dialog warns that a live controller may just re-register
  it immediately; this is for clearing out a station whose controller has
  actually stopped, not a way to silence a running one.

## Stats row

Current listener count, items pending in the queue, and uptime since the
station registered.

## Now playing

The current track (if any), with a progress bar when the audio server
reports a fixed duration, or an indeterminate one for a live relay with no
fixed length.

## Listener history

A chart of listener count over the last 24 hours, built from the panel's
own background collector — the audio server itself keeps no history, only
the instantaneous count (see [what the panel is for](../index.md#what-its-for)).

## Queue and recently played

Two lists side by side:

- **Queue** — everything pending, in play order. A **Clear** button empties
  it; the **also stop current** checkbox next to it additionally skips
  whatever's currently playing, rather than just dropping what's queued
  behind it.
- **Recently played** — a history of what already played on this station.

## What the panel doesn't do here

The station page is a control surface for a station a controller has
already registered — it can't create a station from nothing (that's a
station controller's job — see GoRadio's
[Lua Scripting API](https://goradioserver.github.io/goradio/lua-api/) or a
platform integration like
[goradio-samp](https://goradioserver.github.io/goradio-samp/)), and it
can't edit a station's own logic (jingles, ad rotation, scheduling) — that
lives in whatever script is driving it.
