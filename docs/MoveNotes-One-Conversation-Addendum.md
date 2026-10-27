# Addendum — One conversation per activity

26 October 2026. This supersedes the earlier Circle/Community conversation model
in [the original handover](MoveNotes-Circles-and-Communities-Codex-Handover.md).
The original sections remain historical context. Canonical Journal records,
existing connections, QR-only Communities, privacy and sharing consent remain
unchanged. This updates the data model and feed/conversation release gate; it does
not introduce an additional delivery phase. Challenges remain the final phase.

## Current decision

One canonical activity has one thread and one reaction per participant. Circle and
Community placements grant access, not separate conversation identities. Everyone
currently authorized through any active route can read and participate, without
being connected to fellow commenters. Counts apply the same blocking rules in
every feed. No hidden Community provenance is exposed by the thread.

The composer says: **Comments are visible to everyone this activity is shared
with.** Sharing choices explain that additional and future eligible audiences can
read existing comments/reactions. Commenters' display names, avatars and text are
intentionally visible within that audience, without exposing private profiles,
other activities or memberships.

Removing a sharing route does not delete earlier participants' words/reactions.
Removing every route leaves only owner access. Re-sharing restores the same
thread. Activity deletion follows the existing cascade/undo lifecycle; undo does
not republish an activity or restore deleted social records.

Only the activity owner globally moderates and reviews reports. Authors can delete
their own comments, including after losing activity access, through **Configure →
Your comments**, which exposes only their own words. Community owners/admins can
remove a placement in their Community; that action cannot delete the Journal,
other placements, comments or reactions. Reporting and blocking remain enforced.

## Development-only cutover

The user confirmed the earlier implementation was development-only and asked for
a simple cutover. Investigation found two local restricted comments and one local
restricted reaction. These are not migrated, merged or broadened. The previous
conversation RPC is retired; the tables remain internal dev history. There is no
legacy history compatibility UI or production migration operation.

`20261026010000_activity_conversations.sql` adds activity-keyed comments, reactions
and reports plus authorized RPCs. Existing share decisions, memberships, Journal
records and connection IDs are unchanged. Apply that migration, update the
frontend and redeploy the existing `social-media` function (now also resolves
authorized commenter avatars) when later releasing to another environment. No new
external secret or function is needed. This work was applied only to local Supabase.

## Release checks

`supabase/tests/activity_conversations.sql` covers shared thread/counts across
routes, Circle-only and Community-only participants, later audiences, safe
provenance, commenter avatar access, no direct private-profile access, admin
placement-only moderation, post-access author deletion, all-shares removal,
owner-only management, re-sharing, reaction idempotency, blocking and deletion.
Restricted dev history stays outside the broader thread. Existing social tests
retain sharing/rule/QR/challenge coverage with the new thread semantics.
