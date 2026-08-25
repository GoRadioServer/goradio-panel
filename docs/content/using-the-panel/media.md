# Media Browser

A dedicated page for browsing the selected audio server's `audio_root`
directly, without going through a specific station's "Queue track" form
first — useful when you're not sure which folder a file is in, or you want
to queue the same file to more than one station in a row.

## Queueing a file

- **Queue to station** — pick which station's queue the next file you
  click gets added to. Nothing is clickable in the listing below until a
  station is selected.
- **Mode** — append, jump the queue, or interrupt what's currently
  playing, same as the [station page](stations.md)'s queue-track form.

With a station picked, click any file in the listing to queue it
immediately — there's no confirmation step, since the queue can always be
cleared or reordered from the station page afterwards.

## Browsing

Click a folder to open it; the breadcrumb trail at the top jumps back up
to any parent, or "Root" for `audio_root` itself. What you see here is
scoped by the token the panel itself uses to talk to the audio server —
for the panel's own browsing, that's always its unrestricted admin token,
so you see everything under `audio_root` regardless of any
[directory scoping](tokens.md#generating-a-token) applied to tokens you
mint for other consumers.
