# Maps in Share other

The existing activity menu → Share → Share other image sheet offers **Map**
alongside No image and individual photos when a route is available and Mapbox
is configured. Older Polar activities whose route has not yet been checked can
load it through the existing authenticated route endpoint on selection.
Known activities without GPS do not offer Map. No route is shared automatically
with Circle or Communities by this feature.

Selecting Map produces a PNG through the existing image renderer, native share
sheet and save-image fallback. It includes the activity title, date, original
metrics, imported-from source and MoveNotes branding. Notes, feelings and other
private Journal fields remain excluded. The static map uses the configured
MoveNotes Mapbox style and coral route; its baked-in logo and attribution are
retained uncropped. Interactive-map screenshots are not used.

## Start and finish hiding

**Hide start and finish** defaults to on every time the share sheet opens.
The user can switch it off to explicitly include the full route. Changing this
choice invalidates the prepared file immediately; Share/Save cannot use an old
PNG while its replacement is being prepared. The displayed preview is the same
file supplied to the native share sheet.

With hiding on, the export removes route sections within approximately 500 m of
both recorded endpoints, including later visits to those areas. Segment/circle
intersections handle sparse GPS tracks; hidden gaps remain separate paths so
there are no connecting lines through the hidden areas. The clipping uses a
local metre projection and a small conservative buffer for projection/polyline
rounding. Dateline-crossing routes are not guessed at while hiding is enabled.
This works on the app's existing simplified route preview, not the raw recording.

Only the resulting visible paths reach the Mapbox Static Images API. The
canonical route and Journal/interactive map remain unchanged. If nothing usable
remains, the UI explains why and blocks the map export; it never silently falls
back to the full route. The user may choose another image or explicitly turn
hiding off. Showing the surrounding map can still identify the general area;
this is not an anonymity guarantee.

## Delivery and checks

This is a frontend-only change using existing private route columns and the
existing Polar route endpoint. No new migration, Edge Function, settings page
or persistent privacy preference is required. Existing Mapbox environment
variables continue to apply. Each uncached image request uses the Static Images
API; previews use stable URLs and normal browser caching.

Unit tests cover default clipping, explicit opt-out, crossings/return visits,
short routes, high latitudes, invalid input, URL geometry and failed map requests.
`scripts/map-share-browser-check.cjs` exercises the actual PNG renderer with
fictional intercepted maps, substitute local test fonts, private photo fixtures
and a simulated native share sheet. It checks default privacy, full/hidden PNGs,
exact preview/share equality, stale-response protection, short/no-GPS routes,
legacy Polar route loading, map retry, portrait photos, mobile/desktop and
large text. No database writes or production requests occur. Screenshots and
sample exports are written to `/tmp/movenotes-map-share-previews`.

A live Mapbox image download and physical-device WhatsApp/share-sheet delivery
still need a manual dev check; the browser test does not claim real delivery.
