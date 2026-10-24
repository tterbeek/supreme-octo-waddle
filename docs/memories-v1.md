# Memories V1

Memories reads existing activities; it creates no copies of activity content.
The Journal retains its feed, filtering, logging, standalone entries and reflections.
Bottom navigation is Journal, Memories, Circle, Insights, retaining existing Circle
access gating. Calendar and Photos now sit under Memories and keep their existing
URLs and layouts. `/calendar?date=YYYY-MM-DD` also opens a day directly.

## Reader and archive

`/memories` defaults to Timeline. Year/month query parameters preserve archive
selection. Month summaries include counts and at most three real photo paths;
only the selected year's thumbnails are signed. Activities load in 40-item keyset
pages ordered by date, creation timestamp and ID. Month-reader neighbors cover
the whole month, including unloaded pages. Calendar uses its selected-day order
with an ID tie breaker. Photos browses distinct activities in the loaded gallery
context, starting at the selected photo.

The dedicated, read-only reader uses `?memory=ACTIVITY_ID`. A direct URL such as
`/memories?memory=ACTIVITY_ID` works without collection context. Opening adds one
browser-history entry; Earlier/Later replace that entry. Returning keeps the
originating page mounted, preserving its selection, loaded pages and scroll.
A hard refresh opens the activity alone. Private collection state is not kept in
a module-level cache; owner-scoped queries and existing RLS protect direct URLs.

Original photos, full multiline notes, during/after feelings, effort and available
metrics remain authoritative. Sparse records receive no completion prompts.
The existing editor, unsaved-change protection, photo gallery and delete flow are
reused. Photo controls/gestures are separate from the text-region activity swipe.
The current day's assignment also refreshes after local-date rollover.

## Deterministic featured selection

- Minimum age: 90 local calendar days, for suggestions only.
- Date tiers: exact prior-year anniversary; prior-year anniversary within ±14 days;
  other eligible history. Windows cross New Year. February 29 is never labelled an
  exact February 28 anniversary; non-leap years use March 1 for its nearby window
  only, while exact matching always requires the original month/day.
- Permanently exclude hidden suggestions. Exclude activities actually displayed
  in the previous 30 days, except the current day's own assigned activity.
- Within the best tier, rotate with a user/date/activity hash. Every third calendar
  day prefers sparse entries when both sparse and photo/note entries exist; other
  days lightly prefer photos/notes. No metrics, feelings or sentiment affect choice.
- Persist one assignment, including an empty assignment, per user/local day.
  A transaction advisory lock and primary key serialize simultaneous assignments.
  The server derives the day using the browser's local IANA zone (matching existing
  Calendar conventions), with UTC fallback for invalid zones.
- IntersectionObserver records actual visible exposure, never prefetch. Hiding
  empties the section for the rest of the day and leaves browsing unchanged.
  Deletion/inaccessibility hides the selection without replacement. Reason labels
  are recalculated from the current original date.

## Migration and checks

`20261024000000_memories.sql` adds lightweight `memory_days` and
`memory_dismissals` tables, owner policies, indexes and RPCs. It does not change
existing activity records. There are no new secrets, AI calls or Edge Functions.

Apply locally without clearing development data:

```bash
npx supabase migration up --local
npm test
npm run build
npm run supabase:verify-local
```

The last command replays migrations and `supabase/tests/memories.sql` in the
existing **separate disposable verifier stack**, not the normal development DB.
Apply the migration to production before deploying the frontend when ready.
Nothing has been pushed or deployed by this implementation.

Fictional browser checks:

```bash
npm run dev -- --host 127.0.0.1 --port 5182
node scripts/memories-browser-check.cjs
```

Set `CHROME_BIN` when needed. Screenshots: `/tmp/movenotes-memory-previews`.
Fixtures cover multiple years, 45 activities, multiline words, multiple photos,
feelings, sparse Polar data, missing/empty/recent-only history and simulated errors.
SVG photo placeholders are explicitly fictional; all Supabase network is blocked.

The full Supabase verifier could not start here because Docker's socket was
unavailable. The actual new migration and SQL assertions instead passed in a
temporary PGlite PostgreSQL database with minimal auth/activity/owner-policy
fixtures. This verifies SQL execution and the new rules, but does not replace
replaying the complete baseline in Supabase. Run the isolated verifier with Docker
before rollout. Browser tests use fictional auth/storage; real-account storage
authorization, physical phone gestures/keyboard and multi-device concurrency need
an authenticated development smoke test. No production data was accessed.

The optional P1 Journal invitation is not included.

## Implementation inventory and results

- `src/pages/MemoriesPage.tsx`: Timeline, year/month archive, featured visibility,
  dismissal, empty/loading/error states and daily rollover.
- `src/components/MemoryReader.tsx` and `src/hooks/useMemoryReader.tsx`: original
  content reader, URL/history handling, collection navigation, photo gallery,
  editor handoff and safe deletion.
- `src/services/memories.service.ts`, `src/lib/memories.ts`, `src/database.types.ts`:
  authenticated reads, collection/date helpers and typed RPC contracts.
- `src/App.tsx`, `src/components/Layout.tsx`, Calendar/Photos pages: navigation,
  preserved old URLs, Calendar day links and private reader entry points.
- Migration and SQL tests: metadata ownership, date tiers, pagination, cooldown,
  daily stability, sparse rotation, dismissal and recent-history access.
- Service/unit tests and fictional browser fixtures: direct-link ownership checks,
  date boundaries, distinct-photo collections and connected UI regression checks.

Verification: 141 Vitest tests passed; production build and focused ESLint passed.
The new migration and PostgreSQL assertions passed in temporary PGlite as described
above. The browser journey passed 55 assertions across mobile, desktop and enlarged
text, including pagination, Back, Calendar/Photos reader entry, gallery, missing
photo/error recovery, edit-save/cancel, unsaved changes, direct URLs and deletion.
The Docker/Supabase limitation above remains outstanding before rollout.

Representative fictional screenshots:

- [Timeline on mobile](previews/memories/timeline-mobile.png)
- [Reader on mobile](previews/memories/reader-mobile.png)
- [Sparse imported activity](previews/memories/sparse-import-mobile.png)
- [Reader on desktop](previews/memories/reader-desktop.png)
