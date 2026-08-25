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

## Station cards

Each card shows the station's name, artwork (or a fallback), on-air/silence
status, and current listener count. Clicking a card opens its
[station page](stations.md).

## No stations registered

If the audio server has nothing registered yet, the dashboard says so
directly: start a station controller (`radio station`) against it, and
the card grid appears once it registers.
