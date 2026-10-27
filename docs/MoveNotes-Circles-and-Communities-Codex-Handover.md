# MoveNotes: Circles and Communities — Codex handover

> **26 October 2026:** The [One conversation per activity addendum](MoveNotes-One-Conversation-Addendum.md)
> supersedes all audience-specific thread, reaction, count, selection and fresh
> conversation-on-re-sharing requirements below. These original sections remain
> historical context. The earlier implementation was dev-only; its conversations
> are retired without merging history or changing Journal/connection/share data.
> **Later on 26 October:** Challenges now include every current Community member
> automatically. This supersedes individual challenge signup/opt-out requirements
> below. Only activities shared into the Community contribute; membership never
> publishes private activities. See [current challenge behavior](circles-communities.md#community-wide-challenges).

Date: 25 October 2026

## Task and first step

Evolve the existing Circle feature into personal Circles plus closed Communities. Keep MoveNotes a private, low-pressure movement journal. Sharing should be optional, predictable, and largely automatic once configured.

**Start by investigating the actual repository and current database model. Do not implement the proposed schema blindly.** This handover describes the intended product and a candidate architecture; no repository or live database was available when it was written. Current implementation facts below come from the two supplied product notes and the user's description.

Existing Circle connections must survive. Existing copied Circle activity posts, reactions, and other social history do not need a full migration. This is permission to simplify that migration, not permission to delete canonical Journal activities or connection records.

## 1. Required investigation before implementation

Read repository instructions, then trace the full existing Circle flow. Produce a short findings note with exact file paths, table names, relationships, relevant policies, and a migration plan before changing the implementation. Continue into implementation once the findings support a safe path; raise only material unresolved product decisions or unexpected destructive consequences.

Inspect:

- Canonical activities, owner IDs, activity types, imports, deletion/undo, photos/storage, notes, reflections, and account deletion.
- Circle connections: whether reciprocal or directional, accepted/pending/blocked states, invitation flow, constraints, and ownership. Preserve their actual semantics unless a change is necessary and explained.
- Existing Circle posts: whether summaries are copies, whether a source activity ID exists, which fields/photos are copied, and how edits/unsharing work.
- Feed queries, RPCs, views, RLS, service-role functions, caches, realtime subscriptions, notifications, comments/reactions if present, and media authorization.
- Every expiry mechanism: timestamps, query cutoffs, triggers, scheduled SQL/cron, edge jobs, storage cleanup, retention copy, and any TTL baked into URLs or client code. Establish whether expiry hides a post, deletes it, deletes media, or touches source data.
- Activity creation/update paths, especially manual logging and Polar import. Determine where one transactional/idempotent sharing engine can cover all paths.
- Existing tests, migrations, indexes, deployed schema differences where access is available, and rollback/deployment constraints.

Known source pointers to verify, not assumed current: `src/pages/CirclePage.tsx`, `src/pages/Home.tsx`, `src/features/activities/AddActivityForm.tsx`, `src/components/PostLogNoteFlow.tsx`, `src/services/quickLog.service.ts`, `supabase/functions/polar-import-activities/index.ts`, `src/pages/IntroPage.tsx`, and `src/pages/AboutPage.tsx`.

The first findings note must answer: what is currently duplicated, how connections can stay intact, what the current “couple of weeks” limit actually does, and which old jobs or policies would conflict with the new model.

## 2. Product decisions

### Circle

Each person has one personal Circle: their accepted 1:1 connections. Alice's Circle and Bob's Circle are different audiences even if they overlap. A Circle is not a group all its members have joined together. Existing accepted connections remain accepted without reinviting people.

Sharing with Alice's Circle makes Alice's activity visible to her eligible connections. Bob and Carol can both see and comment on that activity without needing a connection to each other. They are participating on Alice's shared activity.

### Communities

A Community is one shared group object with multiple members, initially with Owner, Admin, and Member roles. Community membership does not create Circle connections. Members may see activities shared into their Community regardless of personal connections.

Communities are **QR-invite only**, intended for offline encounters. No public directory, search, public community page, or public join flow. Scanning a valid QR opens a minimal join preview, requires authentication, and lets the person explicitly join. It does not grant feed access before membership or automatically share their activities.

Use a secure, unguessable, revocable invite token; store a hash rather than a usable plaintext token where practical. Owners/admins can display and rotate the QR. Rotation invalidates old invites without removing existing members. Repeated joins are idempotent; removal must not be trivially undone using the same invite. Rate-limit token validation/join attempts and avoid leaking member/feed information in previews.

A QR can be photographed or forwarded. This design controls access by possession of a valid invite; it cannot prove physical presence. Do not promise otherwise. Stronger approval or single-use invitations are possible later, not required for this version.

### One activity, multiple audiences

Keep one canonical activity. Sharing grants audience access to an approved summary of that activity. It does not create another activity record containing copied title, distance, duration, or photos.

An activity can be private, shared with its owner's Circle, shared with one or more Communities, or both. No globally public activity audience is requested.

Edits to shared fields appear everywhere the activity is currently shared. Deleting an activity immediately removes social visibility. Unsharing from one audience revokes only that audience's access; another valid share can still authorize access.

## 3. Sharing defaults and low-effort UX

Circle and each Community use the same three sharing modes:

| Mode | Effect |
| --- | --- |
| All activities | Automatically share eligible new activities. |
| Selected activity types | Automatically share eligible new activities of the chosen types. |
| Manual | Share only when the owner explicitly chooses to. |

Ask once when configuring Circle sharing or joining a Community. Until a choice is explicitly saved, use Manual. Preserve accepted connections without enabling automatic sharing for existing users. Never silently preselect All activities.

Keep a visible “Sharing here: Runs and walks · Change” setting in each relevant Circle/Community screen. Normal activity logging remains quick. Avoid a mandatory publishing step or a large audience checklist on every save.

Show a quiet activity status such as “Only you” or “Shared with Circle · Brussels Runners.” Tapping opens one consistent sharing sheet with per-audience choices and an explanation that an override affects this activity only. Allow a private activity to be shared later. Support a one-action “Keep this activity private” override that suppresses all automatic sharing for that activity until explicitly changed.

Recommended rule semantics for the implementation:

- Defaults apply prospectively to activities created after the preference is saved. No historical backfill on join, connection, or preference changes.
- Old workouts imported now must not unexpectedly become social posts. Use the activity occurrence time against the saved automatic-sharing start boundary; old/backfilled workouts stay private unless explicitly shared. Handle invalid/missing dates conservatively.
- Manual overrides win over rules and retries. A manual exclusion remains excluded after edits, imports, preference changes, and background retries.
- For automatically managed shares, an activity-type correction re-evaluates eligibility using the currently effective rule and prospective boundary. Explicit includes remain included while owner membership permits; explicit excludes remain excluded.
- Changing a preference affects future automatic decisions, without silently creating/removing historical shares. Provide separate explicit bulk controls later if needed.
- Imported and manually logged activities use the same eligibility logic. A duplicate import never creates a duplicate share or resets an override.
- When someone leaves or is removed from a Community, revoke their access and remove their activity shares into it. Stop automatic sharing there. Rejoining does not restore old shares or old automatic consent.

Make these rules understandable in UI copy and verify them against actual activity/import semantics during investigation.

## 4. Proposed data model

Adapt names and structure to the existing schema. The invariants matter more than these names.

| Entity | Purpose and suggested fields |
| --- | --- |
| Existing activities | Canonical owner-controlled Journal record. Add one optional `public_note` field for the shareable caption. Keep private fields private. |
| Existing connections | Retain IDs, participants, and relationship states. Reuse for Circle eligibility. |
| Communities | `id`, name, description/rules, owner, timestamps, lifecycle state. |
| Community memberships | Community/user unique pair, role, status, joined timestamp. |
| Community invites | Community, token hash, issuer, created/revoked/expiry timestamps as applicable. Never expose raw tokens in general reads. |
| Sharing preferences | Owner, audience, mode, selected activity types, effective automatic-sharing boundary. |
| Activity audience state | Activity, audience, decision (`automatic`, explicit include, explicit exclude), effective shared/unshared state, timestamps. Preserve exclusions even when no active share exists. |
| Activity comments | Active share/context reference, author, body, timestamps, deletion/moderation state. |
| Activity reactions | Active share/context reference, author, supported reaction, uniqueness constraint. |
| Community challenges | Community, creator, metric/type, activity eligibility, dates/timezone, status, participation rules. |
| Challenge participants/contributions | Explicit participants; contributions reference canonical activity and challenge, with idempotent uniqueness. |

One option is a small `audiences` registry with a constrained kind and exactly one target: Circle owner or Community. Each user has at most one Circle audience; each Community has one Community audience. This is a technical addressing layer, not a claim that Circle and Community are the same domain object. Separate typed relations are also valid. Avoid an unconstrained polymorphic `audience_id` that can point to nonexistent or wrong-kind objects.

Enforce one state per activity/audience, unique preference per user/audience, real foreign keys where possible, valid selected activity types, and ownership/membership checks. Only an activity's owner can create its sharing decisions. Community admins cannot switch members into automatic sharing or publish their private activities.

For a Circle share, the audience must be the **activity owner's** Circle. For a Community share, the activity owner must have active membership. Authorize against current connection/membership state on every read/write; a stale materialized share or feed cache is insufficient authority.

Do not add a column per Community to activities. Do not copy activity metrics into social posts. A feed cache may denormalize for performance, but cannot become an independent record or bypass current authorization/revocation.

### Shareable projection and media

Expose an explicit server-side allowlist: approved activity identity, author display identity, title, type, date, relevant distance/duration, `public_note`, and explicitly shareable photos. Decide photo defaults visibly; existing private attachments must not become social merely because an activity is shared.

Never expose private notes, reflections, feelings, effort, equipment, health information, integration payloads, exact GPS/routes, or other unapproved fields by accident. Additional fields require an explicit product decision. Shared metrics can still be personal information: audience access remains mandatory.

Do not implement a shared endpoint as `select activities.*`. RLS authorizes rows, not a safe subset of columns by itself. Use a safe view/RPC/API projection and appropriate base-table/column privileges so direct database/API access cannot retrieve private fields. Verify view security and function privileges against the actual stack.

Shared photos need protected storage access tied to the current share. Avoid permanent public URLs; short-lived URLs have bounded residual access after revocation, which must be understood and minimized. Apply deletion/undo rules to media safely without deleting files still needed by the owner's Journal.

### Public note

Use **one optional shareable note per activity** in this version, consistent across all audiences. This resolves the earlier discussion's alternatives in favor of simple UX. The UI may label it “Shared note” with help text: “Visible to people you share this activity with.” It is not visible to the whole internet.

Never populate it from a private note or reflection. Explain who can read it while editing. Updating it updates all current shared views. Audience-specific captions can be considered later; do not introduce them now.

## 5. Feed, overlap, and conversation boundaries

The social screen has a combined All feed plus Circle and individual Community filters. All returns each canonical activity once, even if the viewer has access through multiple audiences. Use stable pagination and ordering with deduplication in the query before pagination, not after fetching pages in the client.

Show only provenance the viewer is authorized to know: for example “Circle · Brussels Runners.” Never reveal another private Community's name, membership, caption, comments, or reaction counts. A Circle-filtered feed means activities shared with the viewer through eligible personal connections, not a group owned by the viewer containing everyone's posts.

Conversations are audience-specific:

- **Owner's Circle conversation:** everyone currently authorized through that owner's Circle share can read and participate, even when commenters are not connected to each other. The owner can participate.
- **Community conversation:** only currently eligible members viewing that active Community share, plus the activity owner while eligible, can read and participate.
- Access through Community A never unlocks Circle comments or Community B comments.

Attach comments and reactions to the concrete activity share/context rather than an ambiguous null Community ID. This provides a clear conversation identity and consistent authorization. Unshare hides that context and its conversation immediately. Recommended initial behavior: re-sharing creates a fresh conversation; do not unexpectedly resurrect old comments. Archived/moderated records, if retained internally, remain inaccessible.

From a filtered feed, open that context's conversation. From All, automatically open it when there is one authorized context; if several exist, present clearly labeled context tabs/choices before composing. Show “Commenting in Brussels Runners” above the text field. Counts and reactions must correspond to the selected context; avoid a combined count whose scope is unclear. Never duplicate a comment into other contexts.

Support ordinary free-text comments, lightweight reactions if retained, author deletion, owner moderation on their activity, and Community moderation within its own context. Validate length, render safely as text, and rate-limit writes. Include blocking/reporting behavior consistent with the current app; do not create a new path around existing safety controls. Authorize notification previews and deep links too.

## 6. Revisit the couple-of-weeks lifetime

**Recommended new policy: shares persist until explicitly unshared, the activity is deleted, or the relationship/membership no longer authorizes access. Remove automatic age expiry for new Circle and Community shares.** Canonical Journal activities retain their existing lifecycle.

The old short lifetime may have suited a quiet, temporary stream. With comments, Community history, and longer-running challenges, automatic deletion becomes confusing: discussion disappears and a month's challenge could lose source activities partway through.

Keep the feed calm using presentation: newest first, a recent initial window, pagination, and “Older activities.” A recent feed window is not an access-expiry or deletion policy. Detail links and challenge history may still resolve older authorized shares.

Do not silently extend the lifetime of existing posts that users expected to expire. Because legacy social posts are dispensable, prefer letting them expire under the old policy or removing only those legacy copies at the documented cutover. Do not automatically turn them into permanent shares. Scope the legacy cleanup so it cannot delete new shares, source activities, preserved connections, or Journal media.

Keep retention distinctions explicit:

| Record | Proposed lifetime |
| --- | --- |
| Canonical activity/private notes | Existing owner-controlled Journal retention. |
| New social share and active conversation | No age expiry; current access checks always apply. |
| Old copied Circle post | Legacy expiry or documented retirement; no required history migration. |
| Feed cache | Rebuildable, short-lived, invalidated on changes/revocation. |
| QR invite | Revocable; optional expiry independent of activity retention. |
| Challenge contribution | Recomputed from currently eligible shared activities; no private activity details preserved after revocation. |
| External screenshot/export | A static copy outside app control; no promise of recall. |

Recommended initial social-history semantics: a new accepted connection can see still-shared Circle activities, and a newly joined Community member can see that Community's still-shared history. This includes old comments within those contexts. Make that audience behavior explicit when sharing/joining. It does not backfill the new member's own activities. Disconnecting or leaving removes their access through that route; another valid route can still grant activity-summary access, but never the revoked conversation.

This retention policy and historical-audience access are recommendations introduced by this handover. Confirm them in the investigation findings before implementation if repository promises or existing UX reveal a conflict. Do not preserve the current TTL accidentally as an undocumented limit.

## 7. Community goals and challenges

Allow owners/admins to create dated, optional goals/challenges. Keep participation voluntary and aligned with MoveNotes' low-pressure tone. Start with collective targets and personal completion/participation targets. Do not introduce public rankings or default leaderboards; competitive modes were floated earlier but were not an agreed requirement.

Support eligibility by activity types, date range, and an explicit metric such as distance, duration, activity count, or active days. Define units, challenge timezone, inclusive start/exclusive end, distinct-day counting, and participant eligibility. Metrics must use valid canonical values; do not infer missing distances or count duplicate imports.

Require explicit challenge participation. Eligible activities must also be shared into that Community; joining a challenge must not silently publish private activities. Contributions can update automatically from eligible shares within the challenge period. Provide a short explanation of what counts, progress, end state, and the effect of unsharing.

For version one, keep completed results recomputable/correctable when source activities are edited, deleted, unshared, or membership ends. Do not freeze identifiable private details into immutable snapshots. Explain that totals may change. Historical frozen results require a separate later consent/privacy design.

Recompute contributions idempotently on relevant activity/share/participation events and provide a reconciliation path. One activity counts once per challenge even if it also appears through Circle access; it may count toward different eligible challenges. No contribution may authorize activity access on its own.

## 8. Migration and delivery sequence

1. **Investigate and document.** Inventory schema/policies/TTL and source paths. Record connection counts and state invariants for verification without exposing unnecessary personal data.
2. **Add the foundation.** Introduce the new relations, safe projections, policies, constraints, and sharing engine behind a feature flag. Keep old accepted connections authoritative. Do not auto-enable sharing or publish historic activities.
3. **Move Circle onto canonical activities.** Implement new shares and public notes, connection-based authorization, live edits/deletion, manual/automatic rules, and conversation scope. Legacy posts may remain temporarily under their existing expiry or be retired; preserve connection and Journal data in either case.
4. **Add Communities.** Creation, roles, QR join/rotation, leave/removal, per-member sharing preferences, member feed and moderation. Prevent orphaned ownership; require owner transfer or Community deletion before an owner leaves.
5. **Deliver combined feed and comments.** Deduplicate activities, retain context boundaries, support safe media and deep links. Update all Circle/share controls consistently.
6. **Add goals/challenges.** Reuse canonical activities and authorized Community shares; implement optional participation and contribution reconciliation.
7. **Cut over and retire legacy behavior.** Verify new reads/writes, disable conflicting TTL/copy jobs, retire only obsolete social tables/endpoints after dependency review, and update product explanations. Align Intro/About/help text with public notes, comments/reactions, QR membership, and persistent shares.

Use additive migrations and a reversible UI/read cutover where possible. Snapshot/backup before dropping obsolete tables. A rollback must preserve accepted connections, canonical activities, and new consent decisions; never republish hidden data while reverting. Avoid destructive cleanup until cutover validation is complete. Do not duplicate the entire Journal to make rollback convenient.

## 9. Acceptance checks

Cover these with meaningful integration/RLS tests plus focused UI verification:

- Existing accepted/pending connections and canonical activities survive migration. No old private activity becomes shared and automatic sharing remains off until configured.
- One new or imported activity creates at most one audience state per destination. Editing shared metrics updates all allowed views; source deletion removes visibility everywhere.
- Direct API/database reads, forged audience IDs, storage requests, notifications, and cached/detail URLs do not expose private notes or unauthorized media/contexts.
- Alice shares to Circle and Community X; Bob sees one All-feed card through both. Carol can see and comment via Alice's Circle without being connected to Bob. Community-only Dave sees neither Circle comments nor Circle counts.
- Another Community's existence and name are not leaked. Revoking one route removes its conversation while another permitted route may retain the summary.
- Manual exclusions and “Keep private” survive edit/import/retry/type changes. Rule changes do not backfill or wipe old shares. Old imported workouts remain private.
- A QR scan requires explicit authenticated joining; invalid/rotated tokens fail; joining twice is harmless; removed members cannot immediately rejoin through the old invite. Ordinary members cannot change roles, rotate invites, or share someone else's activity.
- Disconnect, block, unshare, member removal, account deletion, and Community deletion invalidate applicable access. Leaving stops automatic shares; rejoining does not restore history/consent from that member.
- Posts older than the old TTL remain available under the new policy, including comment/detail paths. Legacy cleanup cannot touch new shares or Journal media. Pagination returns no duplicates or missing activities across audience overlap.
- Challenges count only eligible, consented, Community-shared canonical activities once. Edits/deletions/unsharing/membership changes update contributions without leaking source details; timezone boundaries are tested.
- Logging remains quick; sharing settings are discoverable; the composer clearly identifies its audience; forms can close and scroll consistently across mobile and desktop.

## 10. Completion report

Report the actual old/new model, migration steps executed, preservation checks for connections and Journal records, legacy social data treatment, actual expiry-job changes, privacy/security verification, test results, and any deferred work. Distinguish implemented behavior from recommendations. Call out any deployment step still required.

## Source context

Based on the supplied conversation and `Philosophy-of-MoveNotes-app.txt` / `How-stuff-functions-in-MoveNotes.txt`. Those notes describe a private journal, optional invited Circle sharing, private personal notes, canonical editable/deletable activities, and Polar imports becoming normal activities. They are product context, not a verified schema export. The existing short Circle lifetime and separate social data model were reported by the user and must be checked in code.
