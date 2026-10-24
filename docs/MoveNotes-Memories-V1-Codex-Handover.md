# MoveNotes Memories V1 — Codex handover

## Task

Implement Memories V1 in the existing MoveNotes app. Work through the repository, implement the feature, and run the relevant checks. Follow repository instructions and existing architectural patterns. This is an implementation brief, not a request to create a separate prototype or rebuild the app.

The central promise is **a place to relive your movement moments across time**. Capture once; rediscover over time. Memories presents existing activities in a new way. It is not another object the user creates or maintains.

## Product context and fixed decisions

MoveNotes is a private, low-pressure movement journal. Imports and quick logging reduce recording effort; optional words, feelings and photos preserve personal context. Memories gives that history a reason to be revisited.

The following decisions supersede earlier ideas in the discussion:

- Bottom navigation: **Journal · Memories · Circle · Insights**, in that order.
- Journal keeps its existing chronological feed, logging, standalone entries and reflections. It no longer contains Calendar or Photos view switches. Do not impose a new history cutoff or remove existing scrolling/filtering capabilities.
- Memories contains **Timeline · Calendar · Photos**, with Timeline as the default on a fresh visit. Preserve view and position when returning from an activity.
- Reuse the existing Calendar and Photos functionality under Memories.
- Timeline combines one automatically featured past activity with a visual archive organized by year and month.
- A dedicated **read-only Memory view is essential**, including browsing between individual activities. Journal cards and activity edit forms do not satisfy this requirement.
- No favourites, stars, saved-memory collections, memory creation flow or extra journaling requirement.
- No AI is needed for V1. Do not generate sentimental narratives, emotional interpretations or invented activity titles.

## Repository discovery

Read the current code before deciding on routes, component names or migrations. The supplied reference documents identify these starting points, but they are historical pointers, not verified current code:

| Area | Starting point |
| --- | --- |
| Journal and current view navigation | `src/pages/Home.tsx` |
| Calendar | `src/pages/CalendarPage.tsx` |
| Photos | `src/pages/PhotosPage.tsx` |
| Activity logging | `src/features/activities/AddActivityForm.tsx` |
| Reflection and photo flow | `src/components/PostLogNoteFlow.tsx` |
| Insights | `src/pages/StatsRpcPage.tsx` |
| Circle | `src/pages/CirclePage.tsx` |
| Polar imports | `supabase/functions/polar-import-activities/index.ts` |

Also locate the router, bottom navigation, activity editor, activity/photo models, ownership policies, date conventions, query/cache layer, migrations and shared modal/sheet components. Establish which fields actually exist for feelings during/after, effort, title, notes and photo ordering. Reuse shared queries and services rather than introducing parallel activity fetching logic.

Keep Quick Log, Polar syncing, Circle, Insights, Directions and Tiny Tweaks working as they do now. Do not refactor unrelated features.

## 1. Navigation

Add Memories next to Journal in the bottom navigation. Use the app's existing icon system, spacing and active states, with readable labels at narrow mobile widths.

Inside Memories expose three clearly labelled views: Timeline, Calendar and Photos. Relocate the existing Calendar and Photos entry points rather than maintaining two competing navigation structures. Keep old URLs and deep links working through route aliases or redirects that retain relevant date/filter parameters.

Calendar and Photos should open an activity in the Memory view for browsing. Preserve their existing selection and browsing tools; do not rewrite their layouts as part of this work. Journal card opening/edit behavior can remain unchanged for V1. Circle must not gain access to this private reader through shared activity links.

## 2. Timeline

### A moment to revisit

At the top, show at most one eligible past activity. Include an accurate reason label, original photo when present, saved title, date and optional original note excerpt. Suggested labels: “On this day” for an exact anniversary; “Around this time” for nearby calendar dates; “A moment to revisit” for a general older activity.

Tapping opens the Memory view. Offer a discreet “Hide this suggestion” action that suppresses this activity from automatic suggestions without deleting it or removing it from browsing. Use neutral language; do not imply the user ought to treasure an experience.

If nothing qualifies, omit the featured section. The archive remains available, including for recent history.

### Through the years

Provide a year selector containing only years with activities. Initially select the latest year with recorded activities. Within that year show the months with activity, newest first.

Each month is a visual entry point, using a small collage of the user's actual activity photos where available. Without photos, use the month/date typography and existing activity icons or neutral styling. Never substitute stock or generated scenery. Use factual labels such as “October 2024”; do not invent descriptions such as “Your peaceful autumn”.

Opening a month reveals its activities in a compact browseable collection, newest first, with date, title, activity type, optional real thumbnail and original note excerpt. Opening an activity enters the Memory view with that month as its browsing context. Keep year/month navigation explicit: this archive should not simply render a second endless Journal feed.

Every saved activity is browseable regardless of photos, notes, distance, duration or import source. V1's activity reader and featured selection are activity-based; leave standalone Journal entries intact without inventing a new memory format for them.

## 3. Dedicated Memory view — primary deliverable

Create a distinct reader component and navigable view. It should feel like opening a page in a personal movement journal. Do not render the edit form in a disabled state, or enlarge a Journal card and call it complete.

Present existing content in this order, adapting to missing fields:

1. A clear Back/Close control and an unobtrusive menu with “Edit activity”.
2. Original photos when present, with a gallery and optional full-screen viewer using existing infrastructure.
3. Full activity date and saved title, with activity type as a factual fallback when a title is absent.
4. The user's original activity note, preserving text and line breaks. A card may truncate an excerpt; the reader must offer the complete note.
5. Recorded feelings, with during/after distinctions preserved. Effort may appear as supporting context if available.
6. Secondary activity context such as type, distance and duration. Respect units and existing formatting. Hide missing values rather than displaying fabricated zeros.
7. Visible Earlier/Later controls and an optional position indicator within the current collection.

Original photos and words should carry the experience. Sparse activities must still have a considered text-first layout. Do not add completion prompts, empty feeling placeholders, generated summaries, inferred emotions or new reflection questions.

### Browsing and return behavior

- Month entry: browse activities in that month in stable newest-first order; Earlier moves to an older activity, Later to a newer activity.
- Calendar entry: browse activities in the selected day using its existing stable order; preserve Calendar position on return.
- Photos entry: browse distinct activities in the currently loaded gallery/filter context, avoiding duplicate activities with multiple photos; begin at the selected photo where feasible.
- Featured entry: browse the featured activity's month and start at that activity.
- Direct activity URL without collection context: open the activity on its own; do not require a prior Timeline visit.
- Show meaningful disabled/absent boundary controls and do not wrap from the oldest to newest activity unexpectedly.
- Support touch swiping between activities as well as visible controls. Photo swiping must operate the photo gallery, not accidentally change activities. Use separate gesture regions or another clear interaction boundary; vertical scrolling must remain reliable.
- Back returns to the originating view, selected year/month/date, filters and scroll position. Changing between activities must not force the user to press Back through every visited activity.
- Editing is secondary: launch the existing editor, return to the same memory, and refresh saved data. Cancel leaves the reader unchanged. Reuse existing deletion behavior; handle a removed current activity by safely selecting a surviving neighbor or returning to the collection.

Use existing page/sheet conventions. For a sheet, ensure a working explicit close control, supported dismissal, clear background separation and a single predictable scroll region. Browser Back, keyboard focus and the mobile virtual keyboard must work correctly.

## 4. Featured selection: deterministic V1 defaults

The following are implementation defaults to make selection concrete, not claims about which moments are meaningful. Keep them centralized and easy to tune.

1. Consider only the signed-in user's existing, nondeleted activities dated at least 90 calendar days ago. This age limit applies only to automatic suggestions, never to archive access.
2. First consider exact month/day matches in previous years. Then consider activities in previous years within ±14 calendar days of today's anniversary window. If neither yields a candidate, consider other activities meeting the age rule.
3. Exclude dismissed activities and those featured in the previous 30 days. If all candidates are excluded, show no feature rather than repeatedly resurfacing one.
4. Within the best available date tier, rotate candidates deterministically. Use photos/notes as a light preference, while giving activities without either a regular turn; for example reserve every third eligible selection day for sparse entries when both sets exist. Never score speed, distance, duration, effort or inferred sentiment.
5. Persist one selection for each user's local calendar day and reuse it across refreshes and devices. Record exposure when the feature is actually displayed, not merely prefetched. Distinguish the current day's assigned activity from prior exposure exclusions.
6. Hiding a suggestion removes it immediately from automatic resurfacing. Leave that section empty for the rest of the day; do not cycle through replacements. If the selected activity is deleted or becomes inaccessible, hide it safely.

Follow the app's existing timezone and activity-date semantics; use local calendar dates rather than UTC truncation. Handle year boundaries, leap years and February 29 explicitly; do not label February 28 as an exact February 29 anniversary. Changing a saved activity date must invalidate an inaccurate reason label.

Use factual reason labels from date matching. No “You loved this”, “Your best run” or similar interpretations. Explain the implemented selection rules in the final developer summary.

## 5. Data, privacy and performance

The original activity is the single source of truth. Read its current notes, photos, feelings and context. Edits must propagate into all Memories presentations; deletion must remove the activity and its photo references from suggestions, archive and reader.

Do not create a separate table containing copies of activity content. Add only lightweight per-user selection, exposure and dismissal metadata if needed. Do not add a favourite field. Use existing patterns for migrations, indexes and policies; constrain metadata access to the owner and use idempotent writes for simultaneous tabs/devices. Clear account-scoped caches on sign-out/account switching.

Memories is private. Scope collection and activity queries to the owner and enforce this server-side. Existing Circle sharing must not expose personal activity notes or authorize access to the private reader. Preserve current photo authorization rules.

Avoid loading the complete photo archive or all full activity records to render the landing view. Use efficient year/month summaries, bounded thumbnails and paginated month activities. Browsing must work across page boundaries, not stop at whichever records happened to be loaded. Load full details on demand, optionally prefetching neighbors. Use stable ordering with a unique-ID tie-breaker for activities sharing a timestamp. Do not silently truncate the archive to a query's default row limit.

## 6. States and accessibility

| Situation | Expected behavior |
| --- | --- |
| No activities | Calm explanation of Memories, with an optional link to existing logging; no fake example memories |
| Recent history only | Archive works immediately; no anniversary claim or unlock threshold |
| No photos or notes | Polished date/title/type presentation; no request to complete the activity |
| Imported Polar activity | Same eligibility and reader behavior as manual records |
| Broken/missing photo | Graceful fallback; remaining content remains usable |
| One activity in context | Reader works with no misleading navigation |
| Missing/unauthorized activity | Neutral unavailable state and a way back; no private data leak |
| Fetch failure | Retry path distinct from an empty archive |

Provide accessible names for tabs, arrows and icon controls, keyboard operation, visible focus, appropriate focus restoration and screen-reader announcements when changing activities. Do not rely on gestures alone. Respect reduced motion and maintain readable contrast. Verify mobile safe areas and bottom-nav spacing.

## 7. Scope and delivery order

Deliver all P0 work as one coherent V1:

1. Inspect current models, permissions, navigation and reusable components.
2. Build the read-only Memory view and collection navigation, including editing and return behavior.
3. Add Memories navigation and relocate Calendar/Photos entry points while preserving URLs.
4. Implement the year/month archive and efficient data loading.
5. Implement featured selection, daily stability, exposure and dismissal handling.
6. Complete responsive/accessibility states and focused validation.

**P1, after P0:** a small occasional Journal invitation opening the same featured activity. It must share selection/dismissal state, appear at most once per local calendar week, and add no push notifications. Record actual display rather than every Journal render. Omit the invitation if no eligible activity exists. Keep this separately scoped if including it would delay P0.

**Out of scope:** favourites, manual memory creation, AI narratives, thematic collections, location clustering, route matching, trip grouping, yearly reels, new memory-sharing flows, push notifications, analytics dashboards, historical import expansion and changes to Companion/Tiny Tweaks/Directions. Do not add these to fill gaps in sparse data.

## 8. Acceptance and verification

Use the repository's existing test tools and required lint/type/build checks. Add focused coverage where behavior carries risk:

- Date tiers, year boundaries, leap day and local midnight; daily stable selection, cooldown, dismissal and sparse-entry eligibility.
- Ownership enforcement for metadata and activity access, including direct reader URLs.
- Month browsing and earlier/later across pagination, equal timestamps, deletion and missing records.
- Route compatibility, Calendar/Photos relocation and return-state restoration.

Manually verify on a narrow mobile viewport and desktop using realistic fixtures: photos with multiline notes, multiple photos, feelings only, bare imported activity, no history, recent-only history and multiple years. Check photo/activity gesture separation, Back behavior, edit-save/cancel return and loading/error states.

V1 is complete when a user can open **Memories → Timeline → year/month → activity**, spend time with original photos/words in a dedicated reader, browse neighboring activities and return to the same archive position. Calendar and Photos must be reachable under Memories and open that reader. A featured activity must be stable for the day and dismissible. None of this may require favouriting, creating a memory or adding a note.

Finish with a concise implementation summary: what changed, migrations/configuration required, actual checks run and results, any remaining limitations, and whether the optional Journal invitation shipped. Do not describe unrun tests as passing.
