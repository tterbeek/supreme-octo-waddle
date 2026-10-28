# Imported activity preparation

New Polar and Strava workouts are inserted immediately as canonical activities
with `import_status = processing`. The Journal displays a noneditable template
at the top, before dated entries, as soon as the owner receives that discovery.
Owner-filtered Supabase Realtime supplies live updates; polling during sync and
preparation covers missed events, including after navigation or a reload.

The importer prepares the final title and stored route in the background, then
saves both together and marks the same row `ready`. Polar route lookups are
shared per local calendar day. Existing naming, meaningful provider titles,
local-time handling and optional locality fallback remain in effect. A workout
without GPS completes normally with no map. Missing geocoding is optional;
failed provider detail requests are not mistaken for successful no-GPS results.

For a newly completed route with Mapbox configured, the Journal keeps its
template until the static preview image loads. That uses the same URL/cache as
the normal card. It then becomes an editable activity in its chronological
position. No Mapbox configuration means there is no image-loading prerequisite.
Older existing activities and manual activities remain editable as before.
Optional user enrichment/reflection remains separate from import completion.

Interrupted preparation shows **Retry import**. Processing that has not finished
within two minutes also becomes retryable. Retry reuses the owned activity and
external provider ID, claims a new attempt token, and cannot be overwritten by an
older worker. A map-loading error retries the image only; it does not reimport
or duplicate the workout. Retries require the provider connection to remain
valid. The background work uses Edge Runtime `waitUntil`; terminated work is
recoverable through this durable state and Retry, rather than an independent
scheduled worker.

The database rejects authenticated edits while processing/failed and protects
import state from client updates. Automatic Circle/Community sharing waits for
server preparation to finish. Existing owner RLS and safe social projections
remain in effect; private routes and import metadata are not added to social
cards. A failed preview on one device does not undo server preparation or delay
sharing of a fully prepared activity.

## Apply locally

With local Supabase running:

```bash
npx supabase migration up --local
npm run dev
```

The new migration is `20261028010000_activity_import_lifecycle.sql`, following
the private route migration. Restart local functions if already running, so
both provider importers use the new lifecycle. No reset or data deletion is
needed. Strava's existing paused integration stays paused.

For a later authorized production release, apply these migrations before
deploying both `polar-import-activities` and `strava-import-activities`, alongside
the route-map function and frontend described in [activity-route-maps.md](activity-route-maps.md).
No new provider secrets are required. This work does not deploy anything.

## Verification

- Unit checks cover atomic completion, no GPS, errors, stale attempts and retries.
- SQL checks replay all migrations in a disposable local project and verify edit
  protection, owner access, unchanged manual editing, stable IDs, and delayed
  automatic sharing.
- `scripts/import-browser-check.cjs` uses the actual import hook/template/card
  with fictional workouts and intercepted Mapbox images. It checks discovery,
  loading/edit gating, both sources, no GPS, failed/stalled imports, image retry,
  mobile/desktop layout and enlarged text. Screenshots go to
  `/tmp/movenotes-import-previews`.
- A newly recorded real Polar workout should still be checked after applying
  locally. No live provider import, production function or real Mapbox request
  is exercised by the fixture checks.

Verified in this change: 182 unit tests, production build, focused lint, the full
isolated SQL suite, 31 import-browser assertions and 29 existing map-browser
assertions. Neither the normal development database nor production was changed.
