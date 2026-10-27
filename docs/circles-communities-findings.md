# Circles and Communities: investigation before implementation

**26 October addendum investigation:** The initial thread model was dev-only.
Local counts were two audience-restricted comments and one reaction. The user
authorized a simple retirement, without migrating this history. New activity-keyed
threads supersede those restrictions for newly written content only; the old RPC
is retired and no existing comments are broadened. Share contexts remain placement
identities, not conversation identities. See the
[activity-wide conversation addendum](MoveNotes-One-Conversation-Addendum.md).

25 October 2026. Repository baseline and application paths inspected; hosted schema,
production counts, storage policies and `cron.job` have not been queried.

## Current model and paths

- Canonical `public.activities` owns Journal data. `activity_photos`, equipment and
  private notes/feelings are owner-scoped. Manual creation: `src/services/quickLog.service.ts`;
  updates: `src/services/activity.service.ts` / `src/hooks/useActivityEditForm.tsx`;
  Polar: `supabase/functions/polar-import-activities/index.ts`. They all write the
  same activity table. A database trigger can cover every path transactionally.
- `public.user_connections` stores requester/addressee and pending/accepted/
  declined/removed/blocked states. Invitation acceptance searches both directions;
  accepted connections function reciprocally, although the unique constraint is
  directional. Keep every connection ID, participant and state unchanged. Existing
  UI/service: `src/pages/ConnectionsPage.tsx`, `CircleInvitePage.tsx`,
  `ManageCirclePage.tsx`, `src/services/circle.service.ts`. Direct update policy is
  broader than invitation semantics; tighten it without changing existing rows.
- `activity_shares` is a **copy** of canonical title/type/date/metrics and cover paths,
  linked by unique `activity_id`. `activity_share_photos`/`activity_share_tags` copy
  attachments/tags. `activity_share_recipients` materializes the recipient list;
  `activity_share_reactions` stores one reaction per share/person. There are no
  current free-text social comments, Communities, challenges or notification jobs.
- Old RPCs `share_activity_with_connections`, `refresh_shared_activity`,
  `get_circle_feed`, `can_access_circle_share`, and reaction RPCs live in
  `supabase/migrations/00000000000000_production_baseline.sql`. Client paths are
  `src/hooks/useCircleActivitySharing.ts`, `useCircleFeed.tsx`, `useCircleFeedMedia.ts`,
  `src/components/CircleFeedCard.tsx`, `PostLogNoteFlow.tsx`, and
  `RecentActivityCard.tsx`. The current share copies all activity photos without a
  separate photo consent. New sharing must not retain that default.
- Base activity/photo RLS is owner-only; do **not** grant social users access to
  those rows. `src/services/storage.service.ts` normally signs images for 24 hours
  and caches URLs. That is unsuitable for new audience media. Local owner policies
  are in `supabase/seed.sql`; historical recipient policy is in
  `supabase/migrations-legacy/20260310173000_storage_circle_shared_images_policy_v3.sql`.
  New media needs a separately authorized, bounded-TTL endpoint, not that cache.
- Deleting activities cascades old shares/photos; `DeleteActivityDialog.tsx` deletes
  the database record before owner storage cleanup. Home also has insert-based
  undo (`restoreActivity`); deletion must not silently restore social consent on
  undo. Account deletion is currently a support request in `SettingsPage.tsx`, not
  an application deletion endpoint. New auth-user foreign keys must cascade safely.

## What the two-week limit does

`activity_shares.expires_at` defaults to `now()+14 days`. Feed, reaction, table RLS
and historical storage policies check it. This is **access expiry**, not evidence
of source-activity or Journal-media deletion. `unshare_activity` deletes only the
copied social record. No active repository job purges expired activity shares.
The only Circle cleanup job found is the historical
`cleanup-circle-invites-daily`, calling `cleanup_circle_invite_links()`; it removes
old invite rows, not shares or Journal content. Circle invitation tokens separately
expire after 14 days. Hosted jobs outside this public-schema snapshot remain an
explicit deployment audit, not a verified fact.

About currently promises “No likes” despite existing lightweight reactions, and
does not document a two-week lifetime. Keep reactions as quiet acknowledgements;
update that copy. No product copy requires new shares to expire. The handover's
persistent-share/history policy is safe **only for newly consented shares**; old
copies must never be promoted or have expiry extended.

## Migration / cutover plan

1. Add typed audience, membership, consent/state, context/conversation and challenge
   relations, plus `activities.public_note` and explicit photo opt-in. No backfill,
   no copied canonical fields, no deletion of legacy social or connection records.
2. Put the new UI behind `VITE_SOCIAL_V2_ENABLED` and the automatic engine behind a
   server kill switch initially off. Preserve Manual until a preference is saved.
3. Authorize summaries/conversations against **current** connections/memberships
   and blocks. Expose explicit summary RPCs; keep private activity RLS unchanged.
   Issue shared media only through a JWT-authorized Edge Function, for 60 seconds.
4. Use one internal database engine on canonical insert/type/date updates. Durable
   overrides beat automatic rules. Date-only manual logs use the saved local day;
   imports without a valid start instant are treated conservatively. Preference
   saves and joining never scan/backfill history. Undo must remain private.
5. New contexts have no age expiry; unsharing revokes a context, re-sharing creates
   a fresh one. Leave/removal revokes that member's contexts and deletes their
   automatic consent. Challenges derive current eligible contributions on read,
   making reconciliation idempotent and avoiding stale private snapshots.
6. Keep legacy tables and invite cleanup. While the new server cutover is enabled,
   retire legacy copy writes/reads rather than extending their access. Rollback
   toggles both flags off; it must not backfill legacy copies or erase new consent.
   No destructive cleanup is part of this change.
7. Capture preservation counts in migration checks and verify original connection
   IDs/states, owner activities/private notes, zero initial auto-shares, RLS, overlap,
   revocation, invite rotation/removal and challenges with fictional SQL fixtures.
   Replay the full baseline in the isolated verifier. Deployment still requires
   checking hosted pending migrations/cron/storage policy differences and backup.

No unresolved product decision requires blocking implementation: the handover
authorizes the new policy, while old expectations/data stay isolated and intact.
