# Journal pull-to-refresh

Pull down at the top of the Journal feed, then release after “Release to
refresh” appears. The Journal refreshes immediately, and Polar is checked if
the last sync/attempt is at least 60 seconds old. The small Refresh Journal
button provides the same action for desktop and keyboard users.

Repeated pulls within the cooldown still refresh the Journal. Automatic Polar
checks retain their existing 30-minute default. Overlapping pulls, automatic
syncs and imports from Connections reuse the same in-flight import for the
signed-in account. A manual check is not lost if an overlapping automatic
check skips because of its longer cooldown.

Short/cancelled pulls, horizontal gestures, normal scrolling through older
activities, nested photo controls and open dialogs do not trigger refresh.
The Journal suppresses the browser's native overscroll refresh while mounted
and restores the previous behavior when leaving. Loading and errors appear
inline. Disconnected accounts still refresh the Journal without importing.
New workouts use the existing background-import template cards.

The service checks the server's last successful sync timestamp; in-memory
per-user attempt times also throttle failures. A surfaced Polar 429 starts
a conservative 15-minute per-user browser backoff. This is a frontend
safeguard, not a new shared server quota system. No scheduled polling interval,
database schema, Edge Function or Strava availability is changed.

Verification: unit checks cover the two cooldowns, server timestamps,
disconnected accounts, overlapping imports, automatic/manual races, rate-limit
backoff and account isolation. `scripts/pull-refresh-browser-check.cjs` uses
real Chromium touch input with fictional provider responses, covering gesture
thresholds, cancellation, overlays, scrolling, cooldowns, loading, errors,
desktop, enlarged text and overscroll cleanup. Screenshots are written to
`/tmp/movenotes-pull-previews`. Physical iOS/Safari gestures and a live Polar
account were not exercised.

This is a frontend-only release: build/deploy the frontend through the normal
flow. No Supabase migration or function deployment is needed for this change.
