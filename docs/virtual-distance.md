# Virtual distance

Virtual distance is a new collective Community challenge measure. Existing challenges retain their recorded-distance/count/duration/date measures. Every Community member participates automatically, as requested; the opt-in statements remaining in the source handover do not apply. Only eligible activities currently shared with that Community count. This does not automatically share private activities.

## Calculation and units

The current dev policy is `journey-distance-v1`, configured in `supabase/functions/_shared/journey-distance-v1.json` and seeded identically into the database. The unreleased dev policy was revised directly at the user's request.

Cycling is the baseline. Positive recorded distance takes precedence for normal cycling (×1), electric cycling (×0.5), running (×2.25), walking (×4), and swimming (×9). A 5 km run contributes 11.25 virtual km whether it takes 20 or 42 minutes. If supported distance is missing, logged time contributes 18 virtual km per hour, or 9 for electric cycling. Strength and other types use time or participation. Effort ratings do not change the amount. Electric cycling retains a 50% discount. Original recorded measurements and ratings are retained.
Eligible unmeasured activities share one virtual kilometre per person/challenge/local day, independently of measured contributions. Allocation is deterministic by occurrence time and activity ID. Excluded types never consume that allowance. Invalid/negative/nonfinite measurements receive zero with a diagnostic. Contributions store 12 decimal places; displayed amounts are rounded only for presentation. Targets and display use exactly 1 mile = 1.609344 km; changing units does not change stored contributions.

This is a shared-adventure convention, not a fitness or physiological comparison. No rankings or Journal scores are added. Private notes, feelings, photos, GPS and heart rate are not conversion inputs. Members can see the shared total and contributor count; detailed contribution explanations expose only their own entries.

## Equipment and history

Equipment uses one optional row of selectable tag pills: Shoes, Bike, Electric bike or Other. Bike maps to conventional assistance; Electric bike maps to electric assistance. Existing category/assistance columns remain the storage representation, so this UI simplification needs no migration. Existing tags remain uncategorised, with unchanged IDs, names and links. No equipment names are interpreted. Leaving Bike clears assistance, and returning does not restore it.

The activity forms have no bike-type control. The Electric bike tag, explicit imported electric subtype or existing override determines the 50% electric-cycling discount. Conventional and unspecified cycling use the normal baseline. Existing bike snapshots retain their historical classification until explicitly refreshed or equipment associations change.

## Lifecycle, privacy and reconciliation

Virtual challenges support draft, active, closed and cancelled. Starting freezes measure, eligible types, start date, timezone and policy. The optional target date is aspirational; it does not stop contributions. Explicit closure uses an exclusive timestamp cutoff. Corrections and late imports from before closure remain eligible. Reached status is derived and reversible; transition events are idempotent.

Current Community membership, current shares, ready imports and non-deleted/non-private activities are required. Existing scoped explicit-sharing rules allow consciously re-shared history; automatic inclusion does not backfill movement from before joining. Date-only activities use the challenge timezone, with conservative same-day membership/closure checks because no precise workout time exists. Undoing deletion preserves the app's existing rule: the activity returns private and must be explicitly shared again before it contributes.

Activity, equipment association, membership, sharing and challenge changes queue reconciliation. A transactional advisory lock protects contribution replacement and daily allocations; canonical activity IDs prevent duplicates. Reads reconcile before publishing summaries. A minute cron retries pending jobs and makes future-dated movement eligible when its time arrives. There is no client-authoritative summation and no new Edge Function.

Operators can inspect pending jobs privately:

```sql
select challenge_id, requested_at, attempts, last_error
from public.journey_reconcile_queue;
select public.journey_reconcile_pending();
```

## Local verification and release

Run `npm test`, `npm run build`, and `npm run supabase:verify-local`. Schema verification rebuilds a disposable project, executes SQL regression checks and runs `scripts/check-journey-concurrency.py`; it does not reset the normal development database. Browser fixtures use fictional data and `scripts/virtual-distance-browser-check.cjs` (Vite on 5182 with social V2 enabled).

Apply `20261105000000_virtual_distance.sql` before deploying its frontend. Existing Supabase schema is extended; challenge RPCs are updated and original recorded-measure calculation is retained. This migration also changes activity-equipment replacement to an authenticated RPC, so deploy database changes before the UI. No new secrets, real AI calls, external services or Edge Function deployments are required for this feature. Production deployment remains a separate explicit action.

Curated route maps and destinations are implemented separately; see [curated map challenges](curated-map-challenges.md). They consume this calculation without changing it.

## Verification for this implementation

- 282 unit tests passed, including numeric examples, bike-resolution precedence, invalid measurements, precise target conversion and equality of the SQL policy seed with the versioned JSON.
- Production build passed; Vite reports its existing large-chunk advisory.
- Full disposable migration replay and SQL regression suite passed, including membership/share withdrawal, deletion/private undo, late corrections, closure, policy immutability, filtered daily allocation and access controls.
- Real concurrent database transactions passed: repeated imports/jobs produce one daily allowance, stable activity allocation, correct date movement and complete withdrawal after unsharing.
- Chromium fictional UI checks passed: 29 Virtual distance assertions and 16 existing equipment/import assertions, at mobile and desktop sizes. Screenshots are in `/tmp/movenotes-virtual-previews` and `/tmp/movenotes-equipment-previews` (temporary local artifacts).
- The normal local development migration was applied without a reset. No hosted database or deployed frontend was changed.

Browser checks use emulation and fictional fixtures; physical mobile keyboards and live Polar/Strava webhook deliveries were not exercised. Existing importers feed the same authoritative activity/sharing model through database triggers.

### Close every challenge

Migration `20261105010000_close_all_challenges.sql` adds explicit closure to recorded distance, duration, activity count and active-date challenges as well. Closing retains eligible progress and excludes later movement, using a fixed timestamp cutoff alongside the existing date window. Earlier corrections still apply. Closed challenges cannot be reopened. The interface calls every measure a challenge and uses one Create challenge entry point; Virtual distance is selected in its Measure field.

### Archive closed challenges in the Community feed

Migration `20261105020000_challenge_archive.sql` returns `closed_at` for existing recorded measures as well as Virtual distance. Explicit Close is available for active, upcoming and date-completed challenges; only already closed/cancelled challenges cannot be closed. Passing the end date alone does not archive a challenge.

Closed challenges leave the Community's pinned challenge section and enter its activity feed at their closure timestamp, keeping progress and details. Later shared activities appear above them. Archive entries older than unloaded activity pages wait until those pages are loaded, so pagination does not place them ahead of newer content. All-page challenge indicators continue to show active/upcoming challenges only. No challenge is automatically closed by this migration.

### Cycling-baseline dev revision

The duration/effort-first calculation was replaced directly in the unreleased dev implementation, without introducing another policy version or migration history. Both server and shared calculation now use distance first. Existing local Virtual distance challenges are recalculated in place without changing activities, targets, shares or closure dates. Help and contribution explanations show the distance multiplier or time fallback; electric cycling retains half the normal cycling contribution.
