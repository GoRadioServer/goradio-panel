# Dashboard

The dashboard is the panel's home page — every station currently
registered on the selected audio server, as a grid of cards.

## Stats row

Three numbers at a glance: how many stations are registered, total
listeners across all of them, and how many stations currently have at
least one listener.

## Grouping

If any registered station has metadata set (see GoRadio's `radio.register`
— a station can carry arbitrary key/value metadata, commonly something
like `game` or `type`), a **Group by** control appears, letting you group
the grid by any metadata key that's actually present on at least one
station. Your choice is remembered per audio server. A server whose
stations carry no metadata at all never shows this control — there's
nothing to group by.

An audio server config can also set a `default_grouping` (see
[Configuration](../getting-started/configuration.md#audioservers)) so a
fresh browser lands on a sensible default instead of an ungrouped list.

## Creating a station

The **Create Station** button creates a *panel-managed* station: fill in a
slug, a display name, and optionally a description and logo URL, and the
panel writes a starter Lua script and runs a real `radio station`
controller process for it — the same binary and RPCs a hand-run
controller uses, just started and supervised by the panel instead of a
shell. The starter script registers the station and then plays silence
(an empty playlist, same as GoRadio's own reference example) until it's
edited.

Manage that process from the station's [Controller
section](stations.md#controller): edit the script in the built-in editor,
save, and restart to apply changes, or start/stop it, or delete it
entirely. A real, independently-run controller can still take over the
same slug at any time — re-registering is always non-disruptive — but a
station created here isn't waiting for one; it's running on its own from
the moment it's created.

## Station cards

Each card shows the station's name, artwork (or a fallback), on-air/silence
status, and current listener count. Clicking a card opens its
[station page](stations.md).

## No stations registered

If the audio server has nothing registered yet, the dashboard says so
directly: start a station controller (`radio station`) against it, and
the card grid appears once it registers.
