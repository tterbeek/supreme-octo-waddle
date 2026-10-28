# Activity route maps: first implementation

Journal activity cards without photos show a Mapbox Outdoors static route map.
The route is MoveNotes coral (`#E48A6C`), the card uses the existing rounded border, and Mapbox's logo
and attribution remain visible. Tapping opens a larger static image in the
shared accessible dialog. This version has no interactive pan/zoom. Activities
with photos retain the Journal photo control and offer **View route** separately.
No GPS track means no map preview; manual activities are unchanged.

## Local setup

1. Create a Mapbox public token with the `styles:tiles` scope. Restrict it to
   your app domains, including your development origin while testing.
2. Add to `.env.development.local` alongside the existing Supabase variables:

   ```dotenv
   VITE_MAPBOX_ACCESS_TOKEN=pk.YOUR_PUBLIC_TOKEN
   VITE_MAPBOX_STYLE=mapbox/outdoors-v12
   ```

   The style is optional. A custom Studio style can later be supplied as
   `username/style-id`. A public token is deliberately visible to the browser;
   never use a secret `sk.` token here.
3. With normal local Supabase running, apply:

   ```bash
   npx supabase migration up --local
   ```

4. Restart `npm run dev`. It serves the new `polar-activity-route` function
   with the existing Polar client credentials in `supabase/functions/.env`.
5. Open the Journal. An existing Polar activity's route is fetched when its
   photo-free card approaches the viewport, or when you choose View route on a
   photo card. Existing Strava activities acquire routes on a subsequent sync
   once that integration is re-enabled; it remains paused in this release.

Without a public Mapbox token,
the UI does not show maps or make route/API requests.

## Data and loading

- `20261028000000_private_activity_routes.sql` adds nullable `route_polyline`
  and `route_checked_at` columns to canonical activities. Existing owner RLS is
  unchanged. Circle/Community safe projections do not expose these columns.
  Maps are not shared to social audiences or included in share-image exports.
- The Journal supplements its existing imported-activity status read with these
  fields. It does not put raw routes in every journal RPC response.
- Polar's `features=routes` requests cover one local calendar day at a time.
  The activity's plausible local date is checked first, with at most three
  UTC-adjacent dates checked to handle timezone midnight crossings or edited dates.
  The external session ID is matched before extracting recorded waypoints from its
  exercises (with support for a top-level track). It cannot fetch another owner's
  activity. Tokens refresh using the existing credentials when necessary. The
  endpoint authenticates using `auth.getUser` before any service-role lookup.
- Only a bounded preview (at most 250 sampled points, polyline precision 5) is
  retained. It is a visual summary, not a navigation track, GPX archive or basis
  for recalculating distance/duration. Multisport/gapped tracks are approximate.
- Existing activity metrics, titles, notes, photos and enrichment state are not
  changed. Successful no-GPS results are cached for 24 hours; provider errors are
  not saved as successful no-GPS results. Client route requests are serialized
  and in-flight requests for the same activity are deduplicated.
- New imports wait for naming and route preparation before becoming editable;
  see [activity-import-lifecycle.md](activity-import-lifecycle.md). Existing
  activities retain their current lazy route loading.
- Strava's summary route is retained during import. Sync can fill a missing route
  without overwriting user-enriched fields or an already saved route. Strava's
  paused state and connection UI are unchanged.
- Static images load directly from Mapbox on the user's device, not through
  Supabase. The route coordinates are sent to Mapbox to render the map. The
  image uses a stable URL and browser HTTP caching. The larger image is another
  Static Images API request. Images are not stored or redistributed from a server.
- Previews are lazy-loaded near the viewport. Empty routes do not create a map
  request. Polar/API or image failures provide a retry without blocking logging,
  activity editing or photo viewing.

## Production rollout (not performed)

On explicit production release: apply migrations first, deploy the new
`polar-activity-route` function with `--use-api`, and deploy both updated
`polar-import-activities` and `strava-import-activities` functions. Add
the public token and optional style to Vercel's Production environment before
deploying the frontend. No Mapbox secret is needed in Supabase. The Polar route
function uses the already configured Polar secrets. Its gateway JWT check is
disabled because it validates the JWT explicitly in the handler.

## References and verification limits

- [Mapbox Static Images API](https://docs.mapbox.com/api/maps/static-images/):
  path overlays, Outdoors/custom styles, image sizing, attribution and caching.
- [Polar v4](https://www.polar.com/polar-api-v4/): one-day feature requests and
  recorded exercise route waypoints.

Automated checks use fictional routes. Browser checks intercept every Mapbox
request and return a clearly labelled fictional image; no real Mapbox API usage
or private GPS data is involved. A successful live map render, domain-restricted
token, and a real Polar workout response still need testing with the configured
account. GPX upload, interactive maps, route sharing, privacy trimming and
Memories map previews are outside this first implementation.

Passed: production build, TypeScript, focused lint, 178 unit tests, 28 map browser
assertions, and complete isolated migration replay/database checks. Browser
screenshots are in `/tmp/movenotes-map-previews`. The migration has not been
applied to the normal development stack or production, and nothing was deployed.


## Polar source reconciliation — 28 October 2026

A read-only download of production `polar-import-activities` revealed that its
smart naming changes were missing from the local importer and `polarImport.ts`.
Those two files were reconciled to the deployed implementation. The remaining
shared dependencies (`polar.ts`, `importedActivityTitle.ts`, and
`importedTitleEnrichment.ts`) already matched. The explicit 90-calendar-day
constant/comment is retained locally; its behavior matches production.

Generic Polar titles get a local time-of-day base title immediately. Optional
background locality enrichment uses the recorded route and existing geocoding
configuration, preserving meaningful provider names and user-edited records.
Timezone-aware local dates and UTC start instants are restored. The separate
new route-map endpoint now accounts for those timezone-aware start instants.
No production function was changed or deployed by this reconciliation.
