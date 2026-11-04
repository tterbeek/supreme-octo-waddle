# Circle and Community maps

Maps remain private until the owner chooses “Share protected maps.”
The decision is stored once per account, across devices. “Keep maps private” is
also remembered. Change it through Circle & Communities → Configure or an
activity's Modify sharing dialog.

Confirmation applies to maps on existing and future shared activities, including
automatic shares. It never shares an activity with another audience by itself.
Unsharing, blocking, losing membership or disabling map consent stops new route
requests immediately. Maps are account-wide; there is no full-route option in
social sharing.

## Protection

The same geometry clipper used by Share other removes route sections within
approximately 500 metres of both endpoints, including return visits and segments
crossing those areas. A rounding buffer prevents encoded paths entering the
hidden area. Disconnected visible sections are never joined across hidden areas.

The social-route function authenticates the viewer, checks current canonical
activity access and the owner's consent, then clips on the server. Only protected
segments reach the browser and Mapbox. The safe social feed exposes has_map,
never raw geometry. The raw-route helper is callable by service_role only.

Very short or fully hidden routes produce no shared map; they never fall back to
the full route. The surrounding neighbourhood can still be recognizable, as the
confirmation explains. Owner Journal maps and Share other's explicit hide switch
keep their existing behaviour.

Photo-free cards display a map; cards with photos provide View route.
Mapbox attribution remains in the static image. The fullscreen shared view uses
the same protected static map.

## Deploy

Apply migration 20261104000000_social_maps.sql, then deploy the new function and
frontend. No new secrets or subscription changes are required.

~~~bash
npx supabase db push --linked --dry-run
npx supabase db push --linked
npx supabase functions deploy social-route --project-ref ljthydvstmbcgqdnqkvx --use-api
~~~

Then deploy the frontend normally. The migration changes no existing sharing
decisions; every account starts with map sharing off.

For local development, run npx supabase migration up --local and serve the
social-route function with the project's normal local function setup.

## Verification

Unit tests cover server authentication, forged viewer IDs, missing consent/access,
short routes and identical clipping for loops and endpoint crossings.
SQL checks cover default privacy, remembered decline, positive consent, safe feed
projection, server-only raw access, blocking, unsharing, identity restoration and
consent withdrawal. The full migration replay passed on the isolated test stack.

The focused browser check is:
~~~bash
node scripts/social-map-browser-check.cjs
~~~
It uses the existing form QA fixture server on port 5182 with
VITE_SOCIAL_V2_ENABLED=true and VITE_MAPBOX_ACCESS_TOKEN=pk.fixture.
It mocks Supabase and Mapbox; no production data or paid map requests are used.
Sixteen assertions cover remembered decisions, changing consent and mobile/desktop
map display. Screenshots are written to /tmp/movenotes-social-map-previews.

Live deployment, real Mapbox appearance, Community membership removal and a live
webhook-imported map remain release smoke checks; they were not exercised by the
browser fixture.
