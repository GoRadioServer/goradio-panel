# Users

Accounts that can sign in to this panel. These are entirely separate from
audio-server JWTs (see [Tokens](tokens.md)) — a panel user is a person, not
a station controller or observer.

Every panel account has full admin access; there's no role or permission
system to configure per user. If you need to give someone read-only access
to a station's status without panel access at all, mint them a read-only
[token](tokens.md) instead and point them at the audio server's own HTTP
API.

## Adding a user

Fill in a username and a password (at least 8 characters) and submit.
There's no invitation flow or email verification — anyone who can sign in
to the panel as an existing admin can create more accounts directly.

## Changing a password

Each row has a **Change password** button that reveals an inline form —
no need to know the old password, since this is an admin action performed
by someone already signed in.

## Deleting a user

The **delete** button on each row is disabled for your own account — you
can't delete yourself out of the panel. Confirm the dialog to remove
anyone else.

## The first account

`bootstrap_admin` in `panel.yaml` (or `PANEL_BOOTSTRAP_USERNAME`/
`PANEL_BOOTSTRAP_PASSWORD`, see
[Configuration](../getting-started/configuration.md#bootstrap_admin)) is
only ever applied once, the first time the panel starts with an empty
`users` table. Once at least one account exists, changing those config
values does nothing — manage accounts from this page instead.
