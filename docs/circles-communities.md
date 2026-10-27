# Circle and Communities

Implementation: 25 October 2026. Investigation:
[model and expiry findings](circles-communities-findings.md).

Updated 26 October: [one activity-wide conversation addendum](MoveNotes-One-Conversation-Addendum.md).

## What changed

The old Circle flow copies activity summaries, photos and tags into
`activity_shares`, distributes recipient rows and hides copies after 14 days.
The new flow retains one canonical `activities` row, with audience decisions in
`social_activity_state` and revocable placement identities in `social_contexts`.
Comments and reactions use the canonical activity ID as their identity.
No activity metrics, private notes or photos are copied into social posts.

Existing `user_connections` IDs, participants and states remain authoritative and
are not rewritten. Connections are reciprocal for access, even though their
database rows retain requester/addressee direction. A person's Circle is their
own accepted connections, not a shared membership group. Two people in that
Circle can discuss the owner's shared activity without being connected to one
another. A block in either direction prevents access through both social routes.

Communities are separate closed groups. Owners/admins manage names/rules, QR
invitations and member removal. Only owners manage admin roles, transfer ownership
or delete the Community. An owner must transfer or delete before leaving.
Deleting an owner account deletes its Communities rather than orphaning them;
Community deletion never deletes members' Journal activities.

Invites use random 64-character tokens, store only SHA-256 hashes, expire after
30 days and can be rotated. Rotation invalidates old tokens, not membership.
Removed members cannot reuse their old generation; a freshly rotated invite can
permit explicit rejoining, with Manual sharing again. Anyone holding a QR can
forward it; possession is not proof of physical presence. Anonymous preview exposes
only validity, name and rules. Authentication and an explicit Join are required.

## Sharing and history

Shared cards use an author/avatar/date header with activity options, centered
activity details and an italic shared note, then uncropped photos. A divider
separates subtle sharing provenance from the three most recent comments and an
inline reply field. **View more comments** reveals five more inline each time and
disappears once all comments are shown. Tapping the Comments heading opens the full
thread and moderation controls. The owner's three-dot menu offers **Modify sharing**,
opening the existing activity sharing dialog. The card reads/writes through the same authorized RPCs.
Appreciation uses a directly tappable outline heart, filled green when selected.
A second outline heart to its right indicates appreciation from someone else,
excluding your own. Appreciation counts are not displayed on cards or threads.
No schema or function change is needed for this presentation. Comment previews
load near the viewport and refresh while visible. Failed replies retain text and
unsaved replies use the existing form navigation safeguards.
Tapping a comment in either the card or full thread opens its actions. Everyone
can report it; Delete appears only for its author or the activity owner. The same
server authorization remains authoritative. Report drafts use the shared dismissal guard.

People without a display name who have accepted Circle connections or Community
membership see a quiet profile reminder on the social feed. It links to the
Settings → Profile and asks for a name and, if missing, a photo.
It disappears once a name is set; it never blocks reading or sharing.

Shared activity cards display the author's current Circle profile thumbnail beside
their name, with an initial when unavailable. `20261026000000_social_profile_photos.sql`
extends the existing authorized media resolver for profile pictures. It uses the
same 60-second endpoint and current context access; it does not grant profile-table
or storage access to recipients. Apply this migration as well as the foundation.

- Every audience defaults to **Manual**. Configure **All activities** or
  **Selected activity types** via **⋮ → Configure → Sharing here → Change**. Joining asks for a
  choice; dismissing leaves Manual. No mandatory publishing step was added to logging.
- Quiet Journal status opens the same **Activity sharing** sheet as
  **Activity actions → Share → Choose Circle / Communities**.
- Rules are prospective: both insertion and occurrence must satisfy the saved
  boundary. Manual date-only entries use the boundary's local calendar day.
  Imported entries without a start instant require a strictly later local day;
  old imports never become automatic posts merely because they arrived today.
- Explicit includes/excludes survive type corrections and retries. Rule changes
  neither scan nor rewrite historical activities. Automatic type corrections use
  the current rule. **Keep this activity private** suppresses every audience until
  explicitly changed. Insert-based delete/undo restores the activity privately.
- The optional **Shared note** is separate from private notes/reflections and is
  never populated from them. It is the same across audiences. Photos start
  unselected; new/replaced images require explicit consent. Sharing without photos
  remains useful.
- Shared summaries expose only identity/display name, title, type, date,
  distance/duration, the shared note, selected photo IDs and authorized audience
  labels. Private notes, feelings, effort, equipment, routes and integration
  payloads remain inaccessible through direct activity/photo table reads.
- New shares have **no age expiry**. Eligible new connections/members can read
  still-shared history and its existing activity-wide conversations. This does not share their
  own historical activities. Leaving/removal removes that member's shares/rules
  and participation; rejoining does not resurrect them.
- All deduplicates canonical activities before 30-item keyset pagination. Circle
  and Community filters show only currently authorized routes. Each activity has
  one thread and reaction state across all routes. Removing one route preserves
  the thread for remaining viewers; removing all shares leaves owner access only.
  Re-sharing restores the same thread. Older comments have stable 100-comment pages.
- Authors can delete their own comments even after losing activity access, through
  **Configure → Your comments**, which shows no inaccessible activity details.
  Only activity owners globally moderate comments and review reports. Community
  admins can remove a placement in their own Community, preserving other shares
  and the whole thread. Blocking hides mutual
  activities/comments across both routes. Comment/report lengths and writes are
  validated and rate limited. No outbound notifications or realtime subscription
  was added: screens refresh on mutations and every 30 seconds while open.

## Media

`social-media` verifies the JWT, invokes the authorization RPC with the viewer's
credentials, then uses the service role only to sign that approved owner's path.
It issues a fixed **60-second** URL with `Cache-Control: no-store`, without using
the app's 24-hour owner image cache. The client refreshes visible media at 45
seconds. No recipient storage SELECT policy is added for new shares, so recipients
cannot request their own longer-lived signed URLs. Both historical bucket spellings
are supported. Original Journal files are retained.

An already issued URL has residual access until expiry; fetched images,
screenshots and exports cannot be recalled. Old clients may already hold legacy
24-hour URLs; the migration cannot shorten those issued URLs. Audit actual hosted
bucket privacy/policies before cutover: a separate public bucket or broad policy
would invalidate these guarantees.

## Community-wide challenges

Owners/admins can create collective or personal targets for distance (km),
duration (minutes), activity count, or distinct active calendar dates, optionally
restricted by activity type. Dates use the chosen challenge timezone, inclusive
start and exclusive end. Collective active dates count a date once for the entire
Community. There is no ranking or per-member leaderboard.

All current members are automatically included, including in existing challenges.
New Community members are included automatically; there are no per-challenge join
or leave controls. Membership does not publish activities: only current eligible
canonical activities explicitly shared into that Community contribute.
Missing/invalid metrics are not inferred. Contributions are derived on each read:
that is the idempotent reconciliation path, with no stale contribution copies or
background job. Completed totals remain correctable after edits, unsharing,
deletion or membership changes. Blocking can make a viewer's authorized total
differ; no hidden blocked person's source details are disclosed.

`20261026020000_community_wide_challenges.sql` replaces the participation-filtered
calculations with current Community membership. Existing enrollment rows are unused;
no Journal, sharing preferences or activity visibility is changed. Owners/admins
still create and cancel challenges. The join preview explains automatic inclusion.

Community owners/admins use each challenge's **⋮ → Update challenge** action to
open the existing form prefilled for editing. Save updates the same record and
recalculates progress using the changed definition; its original timezone is
preserved. **Cancel challenge** is a secondary action inside that dialog and asks
for confirmation. Ordinary members cannot edit or cancel via either UI or RPC.
This requires `20261026030000_update_community_challenges.sql`, applied locally.

### Challenge card and cover images

The responsive **Our challenges** section uses cover banners, prominent titles,
inclusive display dates, a computed goal-reached badge, progress panel/bar,
selected activity types and a **Challenge details** dialog. There are no invented
taglines, subtitles or motivational paragraphs; the details dialog retains the
existing sharing/progress explanation. End dates remain exclusive in storage and
editing, while the card displays the final included calendar day.

Owners/admins can choose a cover in Create/Update challenge, change it directly
from the card, or remove it in Update challenge. Uploads reuse the existing JPEG
compression and private image bucket in a dedicated `challenge-cover-…` namespace.
`20261026040000_challenge_covers.sql` adds cover metadata and authorized resolvers;
the existing `social-media` function also serves these covers with its fixed
60-second lifetime. Current Community members can view covers without a Circle
connection. Only owners/admins can set an existing upload of their own in that
namespace; private Journal attachments and forged uploader paths are rejected.

An admin's chosen cover remains a Community asset after they leave; their removed
membership cannot retrieve it through the Community API. Deleting the uploader
account clears the signing owner, leaving no signable orphan. Cover removal or
replacement immediately changes the authorized reference; older issued URLs can
remain usable until their 60-second expiry. Superseded files remain private;
there is no automatic storage purge in this change. Failed attachment saves try
to remove only the new upload and never delete the preceding cover or Journal files.

The migration is applied locally. A later rollout needs that migration and a
redeploy of **social-media**, with no new secrets or functions. No hosted change
or deployment was performed.

## Files and migration

- `supabase/migrations/20261025000000_circles_communities.sql`: additive foundation,
  safe RPCs, canonical triggers, current-access checks and legacy cutover guards.
- `supabase/migrations/20261026010000_activity_conversations.sql`: new activity-wide
  threads, counts, owner moderation, author deletion and Community placement moderation.
  The earlier dev-only restricted comments/reactions are retired, without merging.
- `supabase/functions/social-media/index.ts` and `_shared/socialMedia.ts`:
  authenticated short-lived media delivery.
- `src/pages/SocialPage.tsx`, `CommunityJoinPage.tsx`, `src/components/social/`:
  feeds, conversations, sharing and membership/challenge forms using existing shells.
- `src/services/social.service.ts`, `src/config/social.ts`: typed client and flag.
- `src/pages/CirclePage.tsx`, `RecentActivityCard.tsx`, `PostLogNoteFlow.tsx`,
  `src/services/circle.service.ts`: existing-flow adapters. Manual/import logging
  stays on the same canonical table and sharing triggers cover both.
- `supabase/tests/social*.sql`, `_shared/socialMedia.test.ts`,
  `scripts/social-browser-check.cjs`: focused regression coverage.

No legacy social table, canonical record, connection or Journal file is dropped.
Legacy copies retain their original expiry and are never promoted into permanent
shares. While enabled, legacy copy/feed/media RPC paths are gated off. The old
invitation cleanup is unrelated and retained. No active repository share-expiry
job was found or removed. Hosted `cron.job` remains to be inspected.

## Local setup (no database reset)

From the repository root, with the normal local Supabase stack available:

```bash
npx supabase migration up --local
npx supabase functions serve social-media --env-file supabase/functions/.env
```

Keep the function server running while testing shared images. To serve all local
integrations together, omit `social-media` from that command. If Docker reports
permission denied reading the function entrypoint on an SELinux host, label only
the function source folder with `chcon -R -t container_file_t supabase/functions`.
No global SELinux or Docker security switch needs to be disabled. Local Edge URLs
signed against internal Kong are rewritten by the client to the configured
`VITE_SUPABASE_URL`; their signed path, token and 60-second lifetime are unchanged.

Use the existing local function environment file; no new third-party secret is
needed. Supabase supplies its own local URL, anonymous key and service-role key.
In local Studio SQL Editor, enable this environment's server switch:

```sql
update public.social_config set enabled=true where singleton;
```

Add `VITE_SOCIAL_V2_ENABLED=true` to `.env.development.local` and restart Vite.
Keep all existing local Supabase URL/key values. Existing local activities are not
reset or auto-published. Use at least two fictional local accounts for permission
checks and QR joining.

## Deployment and rollback (not executed)

1. Back up the hosted database. Record grouped connection counts/state and
   canonical activity counts, plus table/storage policy and `cron.job` inventories.
   Compare installed migration versions with the repository. Check no hosted
   custom job deletes source activities/files or bypasses the new authorization.
2. Run `npm test`, `npm run build`, `npm run supabase:verify-local`.
3. Review `npx supabase db push --linked --dry-run` and apply only reviewed pending
   migrations with `npx supabase db push --linked`. The new server flag starts off.
4. Deploy `npx supabase functions deploy social-media --project-ref YOUR_PROJECT_REF --use-api`.
   The config disables gateway JWT verification because the handler explicitly
   validates with `auth.getUser()`; do not remove that validation.
5. Set `VITE_SOCIAL_V2_ENABLED=true` in the intended frontend environment and
   publish it; enable `social_config` in that same database at cutover. During
   rollout, old clients receive a refresh message rather than creating copies.
   Verify preserved IDs/counts, no initial contexts and Manual defaults.
6. Smoke-test two real consenting accounts: explicit share, safe note/photo,
   QR join, overlap, one shared thread through each route, revoke, delete/undo and challenge correction.
   Test recipient storage URL requests and media revocation over the live HTTP API.

Rollback: turn the database switch off, then publish the frontend with its flag
off. Leave all additive tables/columns in place. New consent/exclusions remain;
new shares are hidden, not converted back into old copies. Legacy unshare also
records the new Circle exclusion so re-enabling cannot resurrect that share.
Old legacy copies, if still unexpired, resume only under their original recipient,
current connection/block and expiry checks. Rollback does not restore legacy posts
that never existed. Do not drop tables or reset migration history to roll back.

## Verification performed

- All 159 Vitest tests passed (25 files), including authenticated media denial,
  fixed TTL, owner-path validation and bucket fallback.
- Production build and focused ESLint passed; Edge entrypoint bundled with esbuild.
- A real authenticated local `social-media` request and the uploaded profile JPEG
  both returned HTTP 200 after restoring the runtime, fixing its SELinux source
  label and translating the Docker-internal signed URL. An unauthenticated request
  returned 401. No signed URLs, tokens or credentials were printed.
- On 26 October, `npm run supabase:verify-local` passed against a separate Docker
  Supabase stack, replaying every migration and all twelve SQL test files. The normal
  development database was not reset. The profile-photo migration was also applied
  to normal local Supabase without resetting data.
- Replayed every repository migration and all twelve SQL test files in PGlite's
  PostgreSQL engine, with minimal Auth/storage schemas and actual role/RLS checks.
  Cross-audience tests cover deduplication/cursors, private projection/base-table
  denial, explicit media, persistent activity-wide threads, overrides/import boundaries, preserved
  connections, QR privileges/rotation/removal, blocks, account deletion, transfer,
  rollback exclusions, >14-day access and correctable timezone-aware challenges.
  A pre/post-upgrade fixture snapshot also verified an existing connection row
  unchanged, its canonical private note intact and zero initial social contexts.
- Fictional browser journey: 155 assertions across mobile 390px, desktop 1280px and 320px
  enlarged-text layout. Tested one thread across All/Circle/Community, unsaved edits, explicit
  sharing/private override, rule save, automatic Community challenge inclusion, QR generation and
  rotation, removal confirmation, Community creation, authenticated/anonymous join,
  default Manual, error/retry, and layout overflow. Supabase network calls blocked.
  Card checks include three-comment previews, inline sending and retries, opening
  the same full thread, unsaved reply protection, portrait/landscape photos and the
  existing lightbox. Reference-style previews are `shared-card-desktop.png`,
  `shared-card-mobile.png`, `shared-card-portrait.png` and `shared-card-enlarged.png`.
  The feed header leads with filters and content; its plus pill creates a Community.
  Sharing choices, connection management and Community settings are on the separate
  Configure screen, reached through the title's three-dot menu.
  Screenshots: `/tmp/movenotes-social-previews/` (local QA fixtures).
- Challenge-specific checks cover responsive reached-goal cards, details,
  image compression/upload/replacement/removal, unsaved cover edits and enlarged
  text. Previews: `challenge-desktop.png`, `challenge-mobile.png`, and
  `challenge-enlarged.png` in that screenshot folder.
- Real local HTTP verification used disposable fictional users, a private Community,
  a challenge and two JPEG uploads. Authenticated uploads and authorized image
  downloads returned 200; outsider/removed-member/removed-cover requests returned
  403. Replacement resolved to the new file with TTL 60 seconds. All temporary
  users, Community/challenge records and uploaded files were cleaned up. No
  credentials, signed URLs or image content were printed.

Limits: Docker was unavailable during the first implementation pass; the full
isolated schema check subsequently passed on 26 October. Neither it nor PGlite
is proof of hosted Auth/PostgREST/storage HTTP behavior.
No real QR device scan, mobile keyboard/device test, hosted Edge runtime test,
hosted policy/cron audit, production counts or deployment was performed. Complete
those local-stack/live HTTP checks before enabling the production flags. No legacy
destructive cleanup or new notification system is part of this change.

## Persistent community invitations

`20261027010000_persistent_community_invites.sql` retains new invite tokens in
private `community_invites` storage. Only current community owners/admins can
retrieve the active token through `social_invite('get')`; ordinary members and
anonymous viewers cannot retrieve it or read the table. Reopening settings
restores the same QR/link and expiry without rotating it. Expired or revoked
invites are not returned. Older hash-only invites need one explicit rotation
before they can be redisplayed. Rotation still invalidates previous invites.
The visible link and Copy link action use the same token as the QR.

Checked with rollback-only SQL tests for persistence, rotation, expiry and
unauthorized reads, plus TypeScript compilation. No production changes applied.
