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
the chosen collection across the whole month, including unloaded pages. Calendar uses its selected-day order
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
Earlier/Later lives in the reader's fixed safe-area footer, including while loading;
only the content scrolls, so navigation stays in place with portrait/landscape
photos, long notes, and photo-free activities.
The current day's assignment also refreshes after local-date rollover.

## Selected moments and All activities

Timeline defaults to **Selected moments**, with **All activities** one tap away.
The choice is a URL view parameter, not a new preference setting. Every month is
retained. Months with photos/notes show at most three chronological previews and
**Show N more activities**, which opens that month's full history. Months without
photos/notes stay compact and open their complete history directly.

Selection is a read-time rule over authoritative activities:

- Every activity with a photo or nonblank personal note is included. A one-character
  note qualifies; note length and photo count never increase an activity's weight.
- At most one feelings/equipment-only activity and one data-only activity per month
  join the selection. A deterministic user/month/activity hash picks these samples;
  their chronology is preserved. This compresses sparse stretches without hiding
  the full record or treating them as less meaningful.
- Titles (including user/generated titles), provider sport descriptions, distance,
  duration, and effort are not selection signals. Effort has a database default,
  so its presence alone cannot demonstrate that someone deliberately recorded it.
- The notes field is currently written by MoveNotes user flows; current Polar and
  Strava importers do not fill it with integration descriptions. Future adapters
  must preserve that separation. Historical notes have no text-origin marker; V1
  does not guess provenance from wording or rewrite original text.

Reader Earlier/Later follows the selected or complete month collection. Its visible
**All activities** action broadens the sequence while retaining the current memory;
Back returns to the originating view. Calendar and Photos keep their original full
contexts. The featured activity uses its separate daily policy: when opened from
Selected moments, it joins that month's selected sequence even if it wasn't one of
the month's sparse samples. It does not pull every sparse activity into the reader.

## Deterministic featured selection

- Minimum age: 90 local calendar days, for suggestions only.
- Date tiers: exact prior-year anniversary; prior-year anniversary within ±30 days;
  other eligible history. Windows cross New Year. February 29 is never labelled an
  exact February 28 anniversary; non-leap years use March 1 for its nearby window
  only, while exact matching always requires the original month/day.
- Permanently exclude hidden suggestions. Exclude activities actually displayed
  in the previous 30 days, except the current day's own assigned activity.
- Within the best tier, rotate with a user/date/activity hash. Every third calendar
  day prefers data-only entries, then recorded details; other days prefer photos
  first, then personal notes and details. Photo activities take priority even on
  the sparse rotation day; that rotation applies when the date pool has no photos. Among otherwise equal material,
  prefer a different activity type from the last actual exposure when available.
  Exact anniversaries always remain first. When the nearby
  window has no photos and there is no exact anniversary, one day in each three-day
  cycle can instead feature an eligible photo from anywhere in the older archive,
  labelled “A moment to revisit.” It retains the 90-day minimum age and all hide/
  exposure exclusions. No metrics, feelings or sentiment affect choice.
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

`20261024010000_memory_highlight_photos.sql` updates the date window and selection
functions. It preserves existing daily assignments, dismissals and exposure
history; broader selection takes effect for the next unassigned day. The highlight
now includes a native swipe/scroll photo gallery with keyboard/arrow controls and
a counter. Opening a photo enters the existing Memory reader at that photo.
Photos keep their original aspect ratio within the highlight frame.

`20261024020000_memory_selected_moments.sql` adds owner-scoped read helpers and v2
archive/page/neighbor RPCs, and updates the independent featured picker. Existing
RPCs remain available for old clients. It adds no tables, preference system, AI
calls, or copies of activity content, and preserves existing daily assignments.
Deploy this migration before the updated frontend.

Apply locally without clearing development data:

```bash
npx supabase migration up --local
npm test
npm run build
npm run supabase:verify-local
```

The last command replays migrations and all `supabase/tests/memories*.sql` suites in the
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

The full isolated Supabase verifier passed on 24 October 2026: it replayed the
production baseline and all migrations, then ran all database behavior tests,
including the Memories suites. This resolves the earlier V1 Docker limitation.
The two Memories migrations and SQL assertions also passed in temporary PGlite
PostgreSQL. The normal development database was not reset. Browser tests use
fictional auth/storage; real-account storage authorization, physical phone
gestures/keyboard and multi-device concurrency still need an authenticated
development smoke test. No production data was accessed.

The optional P1 Journal invitation is not included.

## Implementation inventory and results

- `src/pages/MemoriesPage.tsx`: Timeline, year/month archive, featured visibility,
  dismissal, empty/loading/error states and daily rollover.
- `src/components/MemoryReader.tsx` and `src/hooks/useMemoryReader.tsx`: original
  content reader, URL/history handling, collection navigation, photo gallery,
  editor handoff and safe deletion.
- `MemoryMonthCard.tsx` / `MemoryActivityPreview.tsx`: bounded chronological
  previews, compact sparse months, and links to the complete activity history.
- `src/services/memories.service.ts`, `src/lib/memories.ts`, `src/database.types.ts`:
  authenticated reads, collection/date helpers and typed RPC contracts.
- `src/App.tsx`, `src/components/Layout.tsx`, Calendar/Photos pages: navigation,
  preserved old URLs, Calendar day links and private reader entry points.
- Migration and SQL tests: metadata ownership, date tiers, pagination, cooldown,
  daily stability, sparse rotation, dismissal and recent-history access.
- Service/unit tests and fictional browser fixtures: direct-link ownership checks,
  date boundaries, distinct-photo collections and connected UI regression checks.

Verification: 143 Vitest tests passed; production build and focused ESLint passed.
Full isolated Supabase schema verification and the additional PGlite assertions
passed. The browser journey passed 73 assertions across mobile, desktop and enlarged
text, including pagination, Back, Calendar/Photos reader entry, gallery, missing
photo/error recovery, highlight photo navigation and selected-photo reader entry,
edit-save/cancel, unsaved changes, direct URLs and deletion.

Representative fictional screenshots:

- [Timeline on mobile](previews/memories/timeline-mobile.png)
- [Reader on mobile](previews/memories/reader-mobile.png)
- [Sparse imported activity](previews/memories/sparse-import-mobile.png)
- [Reader on desktop](previews/memories/reader-desktop.png)
- [Selected month previews](previews/memories/selected-month-mobile.png)
- [Selected reader with All activities](previews/memories/selected-reader-mobile.png)

Photo priority: apply `20261027000000_memory_photo_priority.sql`. Within the
selected date pool, photo activities now outrank note-only and sparse activities.
Existing daily highlights stay assigned; the new priority applies to unassigned days.
