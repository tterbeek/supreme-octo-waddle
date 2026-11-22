# Curated map challenges

The second handover is implemented as an optional map route on an existing collective Virtual distance challenge. The current implementation of Virtual distance and equipment tags takes precedence over both handovers. This feature does not change the calculation, bike discount, effort treatment, participation allowance or equipment UI. Community membership remains automatic; sharing still requires the existing sharing rules. Existing multiple-challenge support and Close/archive behavior are retained.

## Try it locally

1. Open Circle & Communities and select a Community you manage.
2. Choose Create challenge, then Virtual distance as its Measure.
3. Choose a map route, preview the destinations and select Use this route.
4. Choose the start date, optional target date and eligible activity types. The route supplies the fixed target. Save a draft or start the challenge.
5. Open Challenge details for the map, shared position, next destination, waypoint stories and your private contribution explanations.

Whole route and Our position are explicit camera controls. New totals update geometry without resetting the map or camera. Selecting a destination on the map or timeline opens the same accessible sheet; future destinations remain labelled Still ahead. Reaching the finish caps the map position but retains extra contribution in the total. Closing before the finish says Closed, not Completed. Closed map challenges stay in the dated Community feed with their route and corrected progress.

## Catalog and geometry

- `src/data/curated-journey-seeds.json`: the handover's 42 coordinate seeds, ten routes, English descriptions and destination story copy. Stories are imaginative pauses, without historical claims or claims members visited the locations.
- `supabase/functions/_shared/journeyGeometry.ts`: shared great-circle distance, spherical interpolation, cumulative distances, sampled geometry, exact progress split and antimeridian handling. Earth radius is 6371.0088 km. Consecutive duplicate locations and duplicate occurrence IDs are rejected.
- `node scripts/generate-journey-catalog.mjs`: generates the bundled catalog, SQL seed and embedded migration seed from that one model. `--check` detects drift. Displayed rounded labels are never target inputs.
- `src/data/curated-journeys.json`: derived versioned catalog, sorted by exact distance. English copy has stable title/description/name/story keys for future localization, matching the app's current English-only interface.
- `JourneyArtwork.tsx`: lazy Mapbox Static Images previews with original local vector illustrations as loading/error/no-token fallbacks. `src/lib/journeyArtwork.ts` builds one stable image URL per route and style, with the complete coral route and destination markers. Compact challenge indicators retain local artwork.

The world route is about 39,099.9 km, not an equatorial-circumference claim. Amsterdam's start and finish have distinct occurrence IDs. The Pacific leg uses the short geodesic. Rendering is sampled, but kilometers and interpolation fractions always use the original geodesic legs. Completed/remaining lines split at the same coordinate as the shared marker. Whole-route bounds use unwrapped longitudes; GeoJSON is split at ±180. This is symbolic geography, not navigation.

## Persistence and access

Migration `20261105030000_curated_map_challenges.sql` adds private immutable `journey_templates`, pins its slug/version on a challenge, and fixes target and geometry version on the server. A caller-supplied target cannot override the route's target. New template versions do not rewrite existing instances. Idempotent seed inserts do not overwrite immutable catalog rows.

The existing `social_challenges` RPC handles creation/editing/closure; organizers retain their existing Community permissions. `social_challenge_values` adds route metadata after the existing authorization check. `social_journey_route` returns the pinned template, existing authorized summary, reached occurrences and next destination. The map consumes that server total, never a client-summed activity list. `social_journey_catalog` exposes only generic catalog content to signed-in users while social features are enabled. Direct browser writes to catalog and trusted contribution tables remain prohibited.

No route progress table, per-member map markers, private GPS, personal notes or independent scoring engine are introduced. Withdrawal, deletion, membership changes and privacy corrections use the existing reconciliation engine and can move the map backwards. The map does not generate notifications or repeat milestone celebrations.

## Mapbox and operation

The detail view lazily loads the existing Mapbox GL JS SDK. One instance is used per open map, updated with GeoJSON sources and removed on unmount. Feed/library previews do not initialize interactive maps. Larger previews request static images directly from the browser when near the visible area; compact indicators use local art. No Directions or Geocoding requests are made. Reduced motion is respected by using immediate camera changes and no animated pulses. Touch gestures are cooperative, scroll-wheel zoom is off, and all progress/destination information remains available outside the canvas.

Reuse `VITE_MAPBOX_ACCESS_TOKEN` (a public URL-restricted browser token). The default basemap reuses `VITE_MAPBOX_STYLE`; optional `VITE_MAPBOX_JOURNEY_STYLE=account/style-id` selects another existing style for these maps. The runtime applies a restrained cooler land/water treatment and separate progress layers. Mapbox logo/attribution and zoom controls remain visible. Missing tokens, map errors/timeouts and WebGL failure show a retry state without removing the text journey.

Official references: [Map lifecycle and sources](https://docs.mapbox.com/mapbox-gl-js/api/map/), [GeoJSON updates](https://docs.mapbox.com/mapbox-gl-js/example/drag-a-point/), [projection behavior](https://docs.mapbox.com/mapbox-gl-js/guides/projections/). No quota or price is assumed; check the actual Mapbox account plan before production release. This work does not access billing or change that account.

Apply the SQL migration before its frontend. No Edge Functions or new secret credentials are needed. Routine local migration application does not reset development data or attach a route to existing challenges automatically. Production deployment is a separate explicit action.

## Verification and limits

Unit tests cover all ten reproducible targets, geometry/marker agreement at zero/partial/boundary/finish/overshoot, loops, the Pacific seam, invalid seeds and exact generated SQL/catalog agreement. SQL tests cover access, target enforcement, immutable versions, unchanged contribution examples, repeated seeding, backward progress after unsharing and closed-before-destination history. The existing full schema and concurrency suites are also run.

`scripts/curated-journey-browser-check.cjs` uses fictional accounts and intercepts Mapbox requests with a local minimal style. It checks selection-to-create, map controls, units, camera/instance preservation, waypoint dialogs, failures/retry, reduced motion, large text and mobile/desktop layout. `CURATED_NO_TOKEN=1 CURATED_BASE_URL=http://127.0.0.1:5183` runs against a fixture server with an empty token for the missing-token check. No live tiles or paid account requests are needed for those tests.

Representative screenshots are fixture views; their intentionally minimal basemap is not the deployed Mapbox style. Physical-device keyboards, actual tile availability and the account's live style/URL restrictions still need a local manual smoke check with the user's configured token. The text timeline does not depend on any of these. Source coordinates are representative destination points from the handover, not meeting or navigation locations.

Verified in this implementation: 299 unit tests, production build, complete disposable schema replay, SQL access/lifecycle checks and real concurrent contribution checks passed. The interactive browser run passed 44 assertions; the separate missing-token run passed 4. The extension was applied to normal local development without a reset. Production and the existing calculation/equipment implementation were not changed.

Representative fictional-fixture screenshots:

- [Route library on desktop](screenshots/curated-map-challenges/library-desktop.png)
- [Paris route on mobile](screenshots/curated-map-challenges/paris-mobile.png)
- [World route on desktop](screenshots/curated-map-challenges/world-desktop.png)
- [Closed before the destination](screenshots/curated-map-challenges/closed-before-finish-desktop.png)

## Static route artwork

All ten routes use fixed Mapbox static-image URLs for the library, route review and large challenge card. The existing browser token and journey/map style are reused. URLs contain curated geometry and destination markers only, with a coral route and the provider's default logo/attribution intact. The Pacific line is split at the antimeridian and the world image uses an explicit whole-world longitude extent. Image dimensions are shared across views so the browser can reuse the same response.

An intersection observer starts image loading near the visible scroll area; browser lazy loading and normal HTTP caching also apply. There is no timer, daily refresh, cache-busting timestamp, server image store or proxy. Totals and unit changes do not affect the URL. A failed image or missing token shows the local vector artwork. These images are display artwork only; scoring, canonical route distances and map position calculations are unchanged.

Additional verification: all ten image URLs fit the API limit, retain destination markers and credits, and keep the Pacific geometry split. Browser tests intercept static-image responses as fictional SVG fixtures, check successful display and failure fallback, and keep interactive-map checks in place. The fixture tests do not exercise actual account billing. Separately, all ten real Static Images responses were loaded successfully in the browser using the existing public token and style. This update is frontend-only; no database or Edge Function deployment is required. Artwork verification passed 312 unit tests, the production build, 47 fictional browser assertions and a separate 12-assertion live-image run. To opt into live requests explicitly, use `CURATED_LIVE_MAPS=1 node scripts/curated-journey-browser-check.cjs` with the normal Mapbox configuration; default runs intercept requests locally.
