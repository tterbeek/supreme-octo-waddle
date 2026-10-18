# Minimal weekly Companion feedback

Implementation of [the handover](MoveNotes-AI-Feedback-Codex-Handover.md).

- Under a ready weekly thought: **Was this useful? Yes / Not really**.
- A rating tap saves immediately and opens an optional comment sheet. The
  comment has a 300-character limit and saves only with **Save feedback**.
  Closing a changed draft uses the shared Keep editing / Discard changes guard;
  discarding loses only the unsaved comment, not the rating or journal content.
- **Feedback saved · Edit** reopens the saved rating/comment. Editing a rating
  saves immediately while preserving the last explicitly saved comment.
  **Remove feedback** deletes the rating and comment. Failures retain the draft
  and allow retry; reflection controls remain independent.

## Minimal persistence and boundaries

`companion_feedback` stores the authenticated owner, post ID, the post's existing
server-written `generated_at` timestamp, content type, rating, optional comment,
and updated timestamp. The owner/post/timestamp key gives one record per exact
output. No generated output, notes, or new version snapshots are copied.

The save RPC derives the owner from `auth.uid()`, checks Premium access and
current consent, locks/validates the exact ready output, and upserts. Clients
cannot write directly, choose another owner, or forge an output timestamp. RLS protects reads/deletes;
account/post deletion cascades. A replacement thought does not inherit the old
thought's feedback. Old feedback on redacted/replaced outputs is excluded from
generation, rather than used to circumvent note-consent changes.

## Timing and generation

Your saved **Companion reflections** also inform future thoughts, but remain
separate from feedback guidance. The authenticated, owner-scoped post query
reads up to three non-empty responses to ready/redacted posts from weeks within
the past 90 days, newest week first and no later than the week being generated.
Deleted/dismissed posts are excluded. Each response is bounded to a 1,000-character
excerpt and included as a labelled `companion_reflection` source in **What it used**.
No earlier AI output is selected. These are the user's own perspectives, not
verified corrections to activity history or instructions to override safeguards.
They do not depend on activity-note permission (like Tiny Tweak reflections);
the existing Companion opt-in covers their use. Included reflections are disclosed
under **What it used**, without extra explanation in Settings or the reflection
sheet. Removing/editing a reflection affects subsequent
generation reads, not already-saved thoughts. No new settings or migration.

Feedback itself adds **no new schedule, extra model call, or automatic regeneration**.
The existing Journal hook requests a weekly thought on entry, on returning to
the visible tab, and after Companion settings changes. The server returns the
existing ready thought rather than generating again.

The completed week is Monday–Sunday in the saved Companion time zone. A new
thought is eligible after local Monday midnight and is prepared on the next
Journal visit/visibility refresh—not by a midnight background job. Feedback
saved before that generation is used then. Feedback saved after generation
normally affects the following week's thought. Existing five-minute failure
backoff and three-attempt limit remain unchanged.

Immediately before the existing provider call, the authenticated
`recent_companion_feedback` reader obtains at most three newest non-empty
comments for this user and content type from the past 90 days. It excludes
rating-only records and inaccessible/redacted/replaced outputs. The provider
boundary caps comments again at 300 characters. No cache means edits/removals
apply on the next request that reads guidance; already-running model calls and
previously saved thoughts are not rewritten.

Comments are a separate JSON `feedback_guidance` section, never factual sources
or journal reflections. Instructions allow only clear wording/tone/length/framing
requests, prefer newer guidance, reject unsupported factual corrections and
ambiguous preference inference, and retain grounding/privacy/system rules.
Original authorized records remain the only movement-history sources. Comments
are plain text in the UI and are not logged or sent to analytics.

## Checks

- Vitest: exact timestamp preservation; explicit-comment vs rating-only API;
  clearing/removal/retry; no generation or reflection calls; provider comment
  count/length bounds, no-feedback/removal behavior, grounding instructions.
- Isolated SQL verifier: rating/upsert/comment persistence; uniqueness; length;
  exact-version and cross-owner rejection; latest-three/type/90-day selection;
  bare-rating exclusion; removal; journal/output immutability; RLS, anonymous
  access and Premium checks; account/content cascade.
- Fictional Chromium fixture: immediate rating; discard unsaved comment;
  read-after-remount; edit/remove; failed save/retry; 300-character native input
  limit; exact output identity; no reflection writes; mobile/desktop/narrow
  enlarged-text layouts. Run Vite on 5182, then
  `FORM_QA_SKIP_MATRIX=1 node scripts/form-browser-check.cjs`.
- No production requests or paid AI calls. Native iOS/Android keyboards and
  actual model adherence to guidance are not verified by these tests.

## Explicit admin rerun and card deletion

`/admin` includes **Run weekly now** only for the confirmed auth account
`me@thijsterbeek.com`. The Edge Function checks the verified account as well as
existing Premium access. The new manual-claim SQL helper is service-role-only
and checks the same confirmed owner. Existing analytics SQL permissions are
unchanged; permitting the confirmed owner onto the admin page in local dev does
not grant other accounts access to analytics.

This one-shot action, with a paid-call confirmation in the shared sheet, reruns
the most recent completed Monday–Sunday in the saved time zone. It does not
generate a partial current week or change the normal schedule. It explicitly
bypasses the normal ready-post/backoff/attempt-cap checks but still prevents
concurrent runs, honors enabled/note consent, and uses the same context and
provider call. Existing thought/feedback remain available while it runs; a
failure releases the claim without hiding the old thought. Successful replacement
keeps the journal response but gets a new generation timestamp, so feedback on
the old output is never silently attached to the replacement. Consent changes in
either direction cancel pending normal and manual results, even when the old
visible thought did not use notes.

The AI card's matching neutral three-dot menu offers **Delete** with a trash
icon. Shared confirmation explains that deleting clears the thought, sources,
your reflection and all feedback on that post. Ownership and exact generation
timestamp are validated server-side. A minimal `dismissed` week tombstone
prevents ordinary visits from regenerating the deleted thought; no output or
reflection text is retained there. Deletion also invalidates in-flight claims.
The next week's thought is unaffected. Only an explicit admin rerun can recreate
that dismissed week.

Additional checks cover confirmed-owner eligibility, explicit/manual versus
ordinary request payloads, deletion retry/version identity/no-generation,
manual claims/concurrency, preserved output/reflection, updated note provenance,
consent revoke/restore, stale deletion, feedback removal and persistent dismissal.
Fictional browser scenarios verify both shared confirmations on mobile/desktop/
enlarged text, cancel without a call, failed-call retry, and owner-only visibility.

If dev applied an earlier draft of the manual/delete migration, run
`npx supabase migration up --local` again. The new
`20261018020000_companion_manual_context_fix.sql` version replaces only the two
affected function definitions, preserving records, grants and migration history.
It is safe when the earlier version already included the final definitions.
Do not reset the database or mark the old migration unapplied.

Apply the feedback, manual/delete and corrective migrations and redeploy `weekly-companion` before releasing the frontend.
No secrets, settings screen, preference manager, or additional function deployment.
