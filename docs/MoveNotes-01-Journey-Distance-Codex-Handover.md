# MoveNotes — Virtual Distance

Codex implementation handover 1 of 2 · Updated 5 November 2026

## Outcome

Implement a shared, versioned activity-contribution engine for collective Community Journeys. Riding, electric riding, running, swimming, strength training, walking and every other supported movement type must contribute to the same virtual journey. Use **Virtual distance** as the user-facing challenge measure, with contributions displayed in **km or miles** according to the existing unit preference, rather than points. The second handover builds the curated map journeys on top of this engine.

The original journal always retains the person's recorded distance, duration and effort. A swim of 1 km remains a swim of 1 km even when it contributes a different number of virtual km. virtual km belong inside the optional challenge experience; do not add a score to the private Journal, Directions, Trends or Companion.

This is a proposed product conversion, not a validated measure of energy expenditure, fitness, training load or equivalent physiological work. Do not describe participants' effort as objectively comparable. The aim is a useful common contribution unit across activities, with simple rules and understandable estimates.

## Grounding and repository discovery

The supplied project descriptions establish that MoveNotes is a private, low-pressure movement journal. Distance, duration and effort are optional. Activities can be manual or imported from Polar; equipment exists; sharing is selective and personal notes remain private. Existing features may have changed since those descriptions were written.

Before implementing, inspect the actual repository, its AGENTS.md, activity schema, effort scale, equipment model, import mappings, auth/RLS policies and any existing community/challenge functionality. Candidate entry points from the descriptions include `src/features/activities/AddActivityForm.tsx`, `src/hooks/useQuickLogForm.tsx`, `src/services/quickLog.service.ts`, `src/pages/CirclePage.tsx` and `supabase/functions/polar-import-activities/index.ts`. These are leads, not verified current paths. Reuse established patterns; do not create a parallel activity system or assume Circles and Communities are already the same concept.

## Product rules

- Challenges are collective: a shared total, destinations and contributors, with no individual ranking.
- Logging movement must stay easy. No mandatory distance, duration, effort, device or new Quick Log step.
- Use a recorded positive duration first. Use distance only to estimate duration when duration is missing. Never add duration-based and distance-based contributions together.
- Explicit perceived effort overrides the default. Electric assistance affects only the default estimate; do not apply a second e-bike discount after explicit effort.
- An activity with neither usable measurement can still contribute participation credit.
- Keep the method discoverable through “How this counted”. Avoid estimated precision such as “6.473 km” in everyday copy.
- Contribution is opt-in for each community journey. Joining must clearly explain which activities will count. Private journal notes, feelings, GPS tracks and personal photos must not be copied into a shared contribution record by default.

## Challenge creation: measure and eligible activity types

Reuse the existing challenge creation dialog and activity-type selector. The measure and activity filter have separate responsibilities: the measure determines how contributions are calculated; the filter determines which activities are eligible.

| Measure | Helper text |
| --- | --- |
| **Recorded distance** | Add up the kilometres or miles recorded in activities. |
| **Virtual distance · All activities count** | Convert walking, cycling, e-biking, swimming, strength training and other movement into shared kilometres or miles. |

The canonical measure label is **Virtual distance**. “All activities count” is supporting copy describing its capability, not a claim that overrides the organiser's activity filter. Where the layout permits, display it as a subtitle. Existing non-distance measures remain available and unchanged. Preserve the existing internal identifier for recorded distance if one exists; use a distinct stable identifier such as `virtual_distance` for the new measure. Never silently convert existing recorded-distance challenges to virtual distance.

After selecting Virtual distance, show:

> Activities contribute based on duration, distance and optional effort. Activities without measurements count too. These are virtual kilometres for your shared adventure.

Localise kilometres to miles when appropriate. Show **Activities that count**, defaulted to **All activity types**, with a **Choose specific types** option that reveals the existing multi-select. Supporting text: “Every included activity is converted into virtual km, so different kinds of movement can contribute together.” Adapt the unit for miles.

| Activity selection | Virtual-distance behaviour |
| --- | --- |
| All activity types | Every supported type can contribute, including strength and activities without measurements. |
| Walking + running | Only walks and runs contribute, using the virtual-distance calculation. |
| Cycling | Only cycling contributes; bike assistance informs the conversion where relevant. |

Keep electric cycling within **Cycling**, not a new e-bike checkbox. If the repository stores imported cycling subtypes separately, map them to the existing Cycling eligibility group without losing bike-assistance metadata. Do not change unrelated activity taxonomy.

Apply the activity filter on the server **before conversion and before daily participation allocation**. Excluded activities receive no measured contribution and no participation credit. Editing an activity's type must re-evaluate eligibility, withdraw or create its contribution, and reallocate affected daily buckets atomically. Unmeasured excluded activities must never consume the daily allowance.

Persist the selection explicitly, e.g. `activity_scope: 'all' | 'selected'` and stable `eligible_activity_type_ids` for selected scope. “All” includes subsequently added supported activity types; selected scope matches only the chosen IDs through the canonical eligibility mapping. Require at least one selected type in selected scope; an empty list must not silently mean all. Keep the scope visible in the review screen and challenge details. Freeze the measure and activity scope when the challenge becomes active; if the existing product permits active rule edits, implement explicit confirmation and consistent full reconciliation rather than silently changing totals.

For Recorded distance, retain the same activity filter, with helper text: “Only activities with a recorded distance can contribute.” Count usable recorded distance only: no virtual conversion, duration estimate or participation credit. A cycling-only recorded-distance challenge counts conventional and electric cycling kilometres equally when both fall within the selected Cycling group; assistance adjustments belong to Virtual distance only.

New virtual-distance challenges start with All activity types. Do not reset an organiser's explicit selection when toggling measures within the same draft; retain it and update the helper text. When all types are selected, “All activities count” is also suitable as the challenge summary; for a restricted challenge show the actual selected types.

### Units and presentation

Calculate and store virtual distance canonically in kilometres, keeping the existing `journey_km`, `rawJourneyKm` and `journey-distance-v1` identifiers if useful. Internal names are not interface copy. Convert for display and target input using **1 mile = 1.609344 km**; convert once at the boundary, keep full precision, and never change contribution amounts or route positions when a user switches units. The daily participation allowance is 1 virtual km (approximately 0.62 virtual miles), not 1 mile for imperial users.

Use **Virtual distance** in the measure selector, help and challenge details. Progress can show “842 / 1,650 km” under that clearly labelled measure. Individual contributions say “Your swim added 5 virtual km” or the converted value in virtual miles. Provide “How activities become virtual distance” and the existing “How this counted” explanation. Do not expose “Journey distance” or “Journey km” as an alternative user-facing measure name. Community Journey remains the name of the shared map experience.

## Concrete v1 scoring policy

Use policy ID `journey-distance-v1`. These values are implementation defaults for this release, not scientific constants. Put them in one versioned configuration and document them in product help. Changing them creates a new policy version for future journeys.

**12 moderate-equivalent minutes = 1 virtual km.** Thus 60 recorded minutes at moderate effort contribute 5 virtual km, regardless of sport. Duration removes the direct distance advantage of cycling over swimming.

```text
if recorded_duration_minutes > 0:
    minutes = recorded_duration_minutes
    basis = recorded_duration
else if recorded_distance_km > 0 and activity_has_distance_reference:
    minutes = recorded_distance_km / reference_speed_kmh * 60
    basis = estimated_duration
else:
    basis = participation

if basis != participation:
    factor = explicit_effort_factor OR activity_default_factor
    journey_km = minutes * factor / 12
else:
    journey_km = participation_credit_allocated_for_that_day
```

`OR` above means “use the explicit mapped rating if present”, not a truthiness check. Do not treat zero, missing, invalid and a valid low rating as interchangeable.

### Explicit effort and missing effort

| Canonical effort | Factor |
| --- | ---: |
| Light | 0.50 |
| Moderate | 1.00 |
| Hard | 1.25 |
| Very hard | 1.50 |

Map the existing app's real effort values into this table centrally. If the app has a different scale, create an explicit documented mapping rather than changing the logging UI or guessing from free text. Feelings during/after, notes, pace and imported heart-rate data are not perceived-effort ratings. Unmapped ratings are treated as missing with a diagnostic, never guessed.

The default factor is **1.00 for all activity types**, except **0.50 for explicitly identified electric cycling**. Missing effort is a challenge assumption, not a stored “moderate” rating on the activity. This intentionally simple first version avoids pretending the app knows intensity from a sport name. Heart rate, calories, body weight and MET calculations are outside v1.

### Distance-only reference speeds

| Scoring category | Reference km/h | Default effort factor |
| --- | ---: | ---: |
| Conventional cycling | 18 | 1.00 |
| Electric cycling | 22 | 0.50 |
| Running / jogging | 8 | 1.00 |
| Walking | 4.5 | 1.00 |
| Swimming | 2 | 1.00 |
| Strength / resistance training | No distance conversion | 1.00 |
| Other supported activities | Duration, otherwise participation | 1.00 |

These are fixed game assumptions. They will not reflect every person's speed, environment or effort. Do not imply that recording more fields always increases credit: switching from estimated duration to actual duration can increase or decrease the result.

Maintain a canonical mapping from every existing activity type to a scoring category. Unknown/custom types must work through duration or participation, without silently becoming running or walking. Add additional distance references only as an explicit later policy change. Strength training contributes through time or participation; kilograms lifted, repetitions and sets are not distance.

### No measurements: daily participation credit

Award **at most 1 virtual km per person, per journey, per local activity day** across all eligible activities that have neither usable duration nor a supported distance conversion. Effort alone does not increase this credit. A distance-only strength entry or unknown sport with no time also follows this path, with an explanation that this type has no distance conversion.

This daily allowance is separate from measured contributions: an eligible unmeasured activity can contribute up to 1 km even if the person also logs measured movement that day. State this openly. It is an inclusion mechanism, not a fraud-proof system. Do not introduce a cap on legitimate measured movement in this release.

Implement participation as a daily bucket or deterministically allocate the credit to the earliest eligible activity, ordered by activity time then stable ID. Other entries show “Included in today's participation contribution”. If the credited activity is edited, unshared or deleted, reallocate the bucket atomically. Never give 1 km to every activity or let request order determine the outcome.

## Extend existing equipment tags with equipment categories and bike types

This handover includes extending the current equipment functionality. Do not assume equipment already has structured categories. Inspect how the current named equipment tags are stored, created, edited and linked to activities, then extend those same records and management forms. Do not create a separate bike registry or require users to recreate their equipment.

Separate the equipment's user-defined name from its category and bike type:

| Property | Example for an existing equipment tag | Purpose |
| --- | --- | --- |
| Equipment name | Specialized Vado | Existing label displayed on activities; preserve it. |
| Equipment category | Bike | Identifies what kind of equipment the tag represents. |
| Bike type | Electric | Identifies assistance for cycling conversion. |

The user must be able to edit their existing **Specialized Vado** tag, choose **Equipment category: Bike**, then **Bike type: Electric**, and save without changing the tag's identity or losing its activity links. Bike type offers **Conventional**, **Electric**, and **Not specified**. Show this field only when category is Bike. Category and bike type remain optional, including during equipment creation and Quick Log.

Add an optional equipment category to the existing equipment entity. Reuse an existing category taxonomy if present; otherwise introduce a small one with **Bike**, **Shoes**, **Other equipment**, and **Not specified**/unset. Keep this extensible without requiring a comprehensive equipment taxonomy in v1. Shoes covers running shoes, walking shoes and boots; it has no extra settings and does not affect virtual-distance conversion. Non-bike equipment needs no scoring subtype: swimsuits, rackets, weights and yoga mats can remain unspecified or Other equipment and do not affect conversion. Existing shoe tags can be explicitly categorised as Shoes without changing their names, IDs or activity links; do not infer this category from tag names.

For Bike equipment only, store an explicit optional `electric_assist` value: `none` (Conventional), `electric` (Electric), or `unknown`/unset (Not specified). Adapt field names to established repository conventions. Validate on the server that a non-bike record cannot retain an active bike-assistance value. Changing category away from Bike clears this value; switching back must not silently restore an old electric classification.

Migrate existing equipment with category and assistance unset. Preserve all equipment IDs, names, ownership, activity associations and import defaults. Never infer category or electric assistance from the text “Specialized Vado”, other brands, or equipment names. The example describes an explicit user classification, not automatic recognition. Extend equipment create/edit forms with the optional fields, preserve existing selection/tag behaviour, and show a small “Electric bike” descriptor where it helps distinguish bikes with similar names. Imported cycling activities linked to this equipment use its structured metadata through the existing equipment association flow.

Classifying an existing tag does not remove or rewrite past activity links, change the activity's sport, or automatically recalculate historical contribution snapshots. New calculations use the stored classification; correcting a previous activity follows the explicit recalculation rules below.

Support an optional cycling-activity override with three meaningful choices: use selected bike/import default, conventional cycling, electric cycling. “Use default” must remain distinct from explicit unknown.

Resolve mode in this order:

1. Explicit activity override.
2. Explicit bicycle metadata on the selected bike, when unambiguous.
3. Explicit electric/conventional sport subtype supplied by the integration.
4. Unknown cycling mode: use conventional reference values as a declared v1 fallback, and expose “Bike type unspecified” in the explanation. Do not store this fallback as a verified conventional bike.

Multiple selected bikes with conflicting properties must resolve as unknown unless an override exists. Never infer assistance from the equipment name, brand, photo, speed or GPS track. Optional assistance levels are outside v1.

Snapshot the resolved bike mode and its source for each activity's challenge calculation. Editing a bike's settings changes the default for future activities; it must not silently rewrite historical contributions. An explicit activity correction can resolve the new setting and recalculate that activity. An imported workout becoming associated with a bike should update its open-journey contribution through the same activity edit path.

Even when effort is explicit, distance-only e-bike activities use the e-bike reference speed to estimate time. Once time and effort are both recorded, there is no remaining bike adjustment.

## Worked acceptance examples

| Activity | Calculation | virtual km before display rounding |
| --- | --- | ---: |
| Ride, run, swim, strength or walk: 60 min, moderate | 60 × 1 / 12 | 5 |
| Conventional ride: 18 km, no time/effort | 60 estimated min × 1 / 12 | 5 |
| Electric ride: 22 km, no time/effort | 60 estimated min × 0.5 / 12 | 2.5 |
| Run: 8 km, no time/effort | 60 estimated min × 1 / 12 | 5 |
| Swim: 2 km, no time/effort | 60 estimated min × 1 / 12 | 5 |
| Walk: 4.5 km, no time/effort | 60 estimated min × 1 / 12 | 5 |
| Electric ride: 60 min, hard | 60 × 1.25 / 12 | 6.25 |
| Electric ride: 60 min, effort absent | 60 × 0.5 / 12 | 2.5 |
| Any sport: 60 min, 30 km, moderate | Time takes precedence | 5 |
| Strength: no time or distance, hard | Daily participation allowance; no effort bonus | Up to 1 |
| Three unmeasured entries on one local day | One shared daily allowance | 1 total |
| Unknown type: 24 min, effort absent | 24 × 1 / 12 | 2 |

Keep full calculation precision in fixed decimal or integer subunits; round only at display boundaries, e.g. one decimal for activity contributions. Sum authoritative unrounded values. Do not accumulate rounding drift across many activities.

## Eligibility, time and sharing

Reuse community membership and access rules. A v1 contribution must belong to an authenticated participant who has opted into that journey, occur inside its time window and at/after joining, and be explicitly eligible for sharing with that community. Joining alone must not publish historical private activities. Backfilling earlier activity is outside v1 unless the existing product already provides explicit scoped consent.

Record the journey's IANA timezone at creation. Use it consistently for participation-day buckets and date-only activity interpretation; device timezone changes must not change credited days. Use the existing activity's occurrence timestamp rather than import time. Define windows as start-inclusive/end-exclusive. Do not credit future-dated activities before their occurrence; validate timestamps server-side.

The same activity may contribute once to each separate journey the person explicitly joins. Within one journey, credit it once. Enforce that rule and the participation-day rule in the database, not only in React.

When a participant leaves, remove their contributions from the live total and withdraw shared activity details. Rejoining can restore still-eligible, explicitly shared activities according to the current membership interval; it must not mint duplicates. Define account deletion and community removal through the same withdrawal path. Reuse existing sharing permissions rather than broadening Circle visibility implicitly.

## Suggested implementation contract

Names below describe responsibilities; adapt to the existing schema.

`calculateJourneyContribution(activitySnapshot, policy)` is a pure deterministic function returning:

```ts
type ContributionCalculation = {
  basis: 'recorded_duration' | 'estimated_duration' | 'participation';
  rawJourneyKm: string; // exact decimal; participation assigned transactionally
  policyVersion: string;
  category: string;
  resolvedBikeMode: 'conventional' | 'electric' | 'unknown' | 'not_applicable';
  bikeModeSource: string | null;
  durationMinutesUsed: string | null;
  referenceSpeedKmh: string | null;
  effortSource: 'recorded' | 'default';
  effortFactor: string | null;
  explanationCode: string;
};
```

Store journey ID, activity ID, owner ID, activity revision, occurrence time, participation-day key where relevant, policy version, normalized calculation inputs, resolved bike snapshot, exact contribution, active/withdrawn state and update time. Keep sensitive calculation inputs server-side; shared responses need only the allowed summary and explanation. Use a unique `(journey_id, activity_id)` projection and a unique daily participation allocation/bucket. Persist the policy version on the journey instance so one journey never mixes formulas.

Calculate and authorize on the server. Clients cannot submit trusted contribution amounts or edit someone else's calculations. Apply RLS/authorization to instances, memberships, contributions and events. Reuse the existing activity importer identity and deduplication mechanisms.

Activity create/import/edit/delete/undo, membership changes and share/unshare must trigger idempotent recalculation. Handle old and new day buckets when an activity date changes. Use a transaction, locking or a durable serialized job so concurrent imports cannot allocate participation twice or lose updates to totals. Revision checks must stop stale jobs from restoring deleted or unshared activities. A retryable reconciliation job should rebuild projections from authoritative activity and membership state.

Do not calculate the authoritative total by summing a paginated client feed. Provide a scoped summary endpoint/RPC with exact total, unique contributing-member count, participant's contribution and the policy ID. Publish only the fields the caller can access.

## Lifecycle and corrections

Use `draft`, `active`, `closed`, `cancelled` for the journey lifecycle; “destination reached” is a derived threshold, not an irreversible write triggered by the first total above target. Reaching the destination does not automatically stop contributions: members can still correct records, and the organizer can close the journey explicitly.

An optional target date is aspirational and generates no automatic failure status. Explicit closure sets the contribution cutoff. Later imports/edits/withdrawals concerning activities before that cutoff still reconcile under the pinned policy; later activities do not qualify. Formula changes never retroactively rescore a closed journey. Retain its route/policy versions and completion history, but respect deletion and privacy withdrawal. If corrections take the total below target, update displayed progress and derive “destination reached” consistently; do not keep an inaccurate permanent completion badge. Milestone events should be idempotent and reversible in the display, without sending repeat celebrations after every edit.

## Interface and language

Use “Virtual distance” for the measure and “virtual km” or “virtual miles” wherever confusion with recorded distance is possible. All examples below use kilometres; imperial displays must convert the values. Example: “Your swim added 5 virtual km.” Explanation: “Based on 60 recorded minutes and moderate effort.” Missing effort: “Based on recorded time and the journey's default effort.” Distance-only: “Estimated from 2 km swimming using the journey's reference pace.” Participation: “Movement without measurements adds up to 1 virtual km per day.”

Show the collective total and unique contributing members. A person's own contribution can be available privately. Shared recent contributions may use existing sharing rules, without sorting members by contribution. Do not label unmeasured entries as incomplete or request more data to unlock acceptance.

## Validation and delivery

Verify migration preserves existing equipment IDs, names, activity links and import defaults with classification initially unset. Verify an existing Specialized Vado tag can be edited to Bike → Electric, saved and reopened; a newly logged cycling activity using it resolves electric assistance. Verify Shoes is available in equipment create/edit forms and persists after saving, preserves existing activity links, has no bike-type control, and leaves conversion unchanged. Check that non-bike equipment hides bike type, clearing the category clears assistance, equipment permissions remain enforced, and classifying an existing tag preserves historical contribution snapshots.

Verify the creation dialog defaults to Virtual distance with All activity types when starting a Community Journey; other existing challenge flows retain their own defaults. Check selecting specific types, retaining selections while toggling measures, rejecting an empty selected scope, and showing the final scope in the review/details screens. Test that excluded measured and unmeasured activities contribute nothing, excluded activities do not consume participation credit, type edits reconcile eligibility, and both electric and conventional cycling pass the Cycling filter. Verify Recorded distance never invokes virtual conversion or participation credit. Verify km/miles display conversion and target round-trips preserve canonical totals and map progress, including the 1 km participation allowance. Check that user-facing labels no longer say Journey distance or Journey km; internal identifiers may remain unchanged.

Cover the worked examples with unit tests. Add meaningful integration tests for duplicate imports, repeated jobs, two concurrent unmeasured activities, date changes, edit from measured to participation and back, equipment snapshot behavior, unknown types, conflicting bikes, missing effort, deleted/unshared activity retries, undo, membership removal, timezones/DST, window boundaries and cross-user access denial. Invalid negative, non-finite or impossible-to-parse values must not produce negative/NaN credits; distinguish missing input from invalid input and use existing validation/error paths. Do not silently convert invalid measurements into extra participation credits.

Deliver equipment schema migration and create/edit form extensions, shared policy/types, server calculation/reconciliation, sharing and membership integration, explanation UI, tests and concise operator documentation. Keep this independently testable without Mapbox. Report the exact existing effort mapping, eligibility behavior and any repository constraint that required an adaptation. Do not replace the agreed virtual-distance model with raw kilometers, calories or a leaderboard.
