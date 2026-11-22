# MoveNotes — Curated Community Journeys

Codex implementation handover 2 of 2 · 4 November 2026

## Outcome

Build a visually pleasing library of **ten predefined collective journeys**, using Mapbox, curated destinations and connected point-to-point lines. Communities choose a journey and travel along it together through the Journey km calculated by handover 1. There is no navigation requirement, runtime route search or Directions API dependency.

The experience should feel like opening a small shared travel journal: a calm map, a visible route, a shared position, destinations to discover and a sense of going somewhere together. Keep the community's progress central. Avoid performance rankings, streaks, pressure, countdown warnings and confetti on routine contributions.

## Read before implementing

Inspect the repository, AGENTS.md, design tokens, existing Mapbox integration, mobile sheet/dialog patterns, community permissions, localization and challenge models. The supplied MoveNotes descriptions establish private journaling and selective sharing, but do not establish that a Community module already exists. Reuse real existing structures; do not assume the prior design discussion reflects shipped code.

Implement against the contribution contract in `MoveNotes-01-Journey-Distance-Codex-Handover.md`. Geometry, catalog and interface development can use mock summary data, but production progress must come from the authorized server summary. These two handovers share journey-instance IDs, lifecycle, policy version and exact contribution totals.

## Scope

- Ten seeded, versioned journey templates, with ordered coordinates and short waypoint descriptions.
- Library/selection view, creation/confirmation flow, journey detail, milestones and completed-journey view.
- Mapbox map in journey detail; lightweight reusable route artwork for library cards.
- Deterministic progress geometry and shared marker from collective Journey km.
- Mobile, desktop, accessible text alternative, loading/error/empty states.

Custom routes, user-entered place search, turn-by-turn navigation, elevation challenges, leaderboards, photo procurement and assistance levels are outside v1.

## The ten journeys

Coordinates below are proposed curated seeds, in **[longitude, latitude]** order. They are representative city/landmark points, not verified meeting locations or navigation access points. Check geographic placement visually before shipping. Names and descriptions must be localizable. Do not use the earlier conversation's short/medium/long labels as geographic facts.

Distances below were calculated from these seeds using successive great-circle distances with mean Earth radius 6,371.0088 km, rounded here to 0.1 km. Generate authoritative totals and per-waypoint distances from the same geometry algorithm in code; never maintain rounded labels as a second source of truth.

| Stable slug | Journey title | Ordered milestones | Approximate Journey km | Card mood |
| --- | --- | --- | ---: | --- |
| weekend-in-paris | A Weekend in Paris | Amsterdam → Brussels → Paris | 436.9 | Soft blue rivers, warm city accents |
| benelux-loop | The Benelux Loop | Amsterdam → Rotterdam → Antwerp → Brussels → Luxembourg → Maastricht → Amsterdam | 682.6 | Sage land, quiet coastlines |
| british-isles | Around the British Isles | London → Cardiff → Dublin → Belfast → Edinburgh → London | 1,409.9 | Muted teal sea, warm landmark dots |
| road-to-rome | The Road to Rome | Amsterdam → Paris → Lyon → Milan → Rome | 1,638.5 | Warm stone, olive route |
| across-the-alps | Across the Alps | Geneva → Chamonix → Zermatt → Innsbruck → Salzburg | 582.3 | Gentle terrain detail, cool greens |
| nordic-adventure | The Nordic Adventure | Copenhagen → Oslo → Bergen → Stockholm → Helsinki | 1,904.4 | Slate water, pale forest tones |
| mediterranean-explorer | Mediterranean Explorer | Barcelona → Marseille → Rome → Athens → Istanbul | 2,554.1 | Clear blue sea, terracotta accent |
| coast-to-coast-america | Coast to Coast America | New York → Chicago → Denver → Las Vegas → San Francisco | 4,266.3 | Sand land, muted blue water |
| discover-japan | Discover Japan | Tokyo → Mount Fuji → Kyoto → Osaka → Hiroshima → Fukuoka | 899.3 | Ivory land, subdued blossom accent |
| around-the-world | Around the World Together | Amsterdam → Istanbul → Singapore → Sydney → San Francisco → New York → Amsterdam | 39,099.9 | Blue oceans, warm shared marker |

All are symbolic waypoint journeys. Lines can cross water, mountains and borders. Say this clearly: “A virtual journey between destinations, not a navigation route.” The world route is approximately 39,100 km because of its selected waypoints; do not label it 40,075 km or claim it measures Earth's equatorial circumference.

### Coordinate seed catalog

Reuse these points by stable place ID; use a distinct waypoint occurrence ID for repeated visits to the same place.

| Place ID | Display name | Longitude | Latitude |
| --- | --- | ---: | ---: |
| amsterdam | Amsterdam | 4.9041 | 52.3676 |
| brussels | Brussels | 4.3517 | 50.8503 |
| paris | Paris | 2.3522 | 48.8566 |
| rotterdam | Rotterdam | 4.4777 | 51.9244 |
| antwerp | Antwerp | 4.4025 | 51.2194 |
| luxembourg | Luxembourg | 6.1319 | 49.6116 |
| maastricht | Maastricht | 5.6900 | 50.8514 |
| london | London | -0.1276 | 51.5072 |
| cardiff | Cardiff | -3.1791 | 51.4816 |
| dublin | Dublin | -6.2603 | 53.3498 |
| belfast | Belfast | -5.9301 | 54.5973 |
| edinburgh | Edinburgh | -3.1883 | 55.9533 |
| lyon | Lyon | 4.8357 | 45.7640 |
| milan | Milan | 9.1900 | 45.4642 |
| rome | Rome | 12.4964 | 41.9028 |
| geneva | Geneva | 6.1432 | 46.2044 |
| chamonix | Chamonix | 6.8694 | 45.9237 |
| zermatt | Zermatt | 7.7491 | 46.0207 |
| innsbruck | Innsbruck | 11.4041 | 47.2692 |
| salzburg | Salzburg | 13.0550 | 47.8095 |
| copenhagen | Copenhagen | 12.5683 | 55.6761 |
| oslo | Oslo | 10.7522 | 59.9139 |
| bergen | Bergen | 5.3221 | 60.39299 |
| stockholm | Stockholm | 18.0686 | 59.3293 |
| helsinki | Helsinki | 24.9384 | 60.1699 |
| barcelona | Barcelona | 2.1734 | 41.3851 |
| marseille | Marseille | 5.3698 | 43.2965 |
| athens | Athens | 23.7275 | 37.9838 |
| istanbul | Istanbul | 28.9784 | 41.0082 |
| new-york | New York | -74.0060 | 40.7128 |
| chicago | Chicago | -87.6298 | 41.8781 |
| denver | Denver | -104.9903 | 39.7392 |
| las-vegas | Las Vegas | -115.1398 | 36.1699 |
| san-francisco | San Francisco | -122.4194 | 37.7749 |
| tokyo | Tokyo | 139.6917 | 35.6895 |
| mount-fuji | Mount Fuji | 138.7274 | 35.3606 |
| kyoto | Kyoto | 135.7681 | 35.0116 |
| osaka | Osaka | 135.5023 | 34.6937 |
| hiroshima | Hiroshima | 132.4553 | 34.3853 |
| fukuoka | Fukuoka | 130.4017 | 33.5902 |
| singapore | Singapore | 103.8198 | 1.3521 |
| sydney | Sydney | 151.2093 | -33.8688 |

Seed one or two short descriptive sentences per destination. Keep them about the place, with no claim that members physically visited it. Use ordinary factual descriptions and verify any specific historical or geographic fact before including it. No external fact-generation service is required at runtime. Starting destinations are available immediately; future destination names remain visible, with their story cards marked “Still ahead”.

## Distance and geometry: one authoritative model

Use the geodesic distance between successive curated waypoints. Point-to-point means no road routing; modest sampling along a great-circle segment is allowed for smooth rendering of long legs. This is especially important for the Pacific crossing. It adds no external API dependency.

1. Validate coordinates and ordered waypoint occurrences.
2. Calculate great-circle leg lengths using one shared algorithm/library.
3. Store cumulative kilometers at each waypoint, beginning with zero.
4. Generate a sufficiently sampled rendering line from those same legs. Retain distance references to the original cumulative lengths; sampling must not introduce a competing target distance.
5. The template's exact target is the final cumulative length.
6. Given credited Journey km `K`, use `D = clamp(K, 0, targetKm)` for map position. Find the leg containing D, calculate its fractional distance and interpolate along that same geodesic leg.
7. Split completed/remaining geometry **at that exact position**. The marker must use the identical coordinate. Milestones are reached when D is at least their cumulative distance.

Do not apply total-distance percentage directly to vertex count, screen pixel length or Mapbox `line-progress`: Mapbox's gradient progress is measured in projected geometry, which need not match ground kilometers. Prefer separate completed and remaining GeoJSON sources with an explicitly calculated split. A gradient is optional decoration, not the authority for progress.

Handle `K = 0`, exact waypoint boundaries, `K >= target`, overshoot, closed loops, repeated start/end places and zero-length duplicate consecutive points. Reject or remove accidental duplicate consecutive points at catalog validation. Starting and finishing Amsterdam are separate occurrences so the finish does not appear reached at zero progress. Store raw collective contribution even after reaching the destination; cap the route display at the destination and report any extra contribution calmly in details. Never loop the marker around again.

For the world route, normalize/unwrap longitude during interpolation and split GeoJSON at the antimeridian as needed. Keep the short intended Pacific segment from Sydney to San Francisco; never draw an accidental long line across Europe. Handle camera bounds for wrapped geometry rather than blindly fitting normalized -180…180 min/max. A globe or suitable overview is welcome if supported by the existing SDK; the textual milestone view must work independently of projection.

## Data model and versioning

Suggested responsibilities; adapt naming to the actual codebase:

```ts
type JourneyTemplate = {
  id: string;
  slug: string;
  version: number;
  titleKey: string;
  descriptionKey: string;
  waypoints: Array<{
    occurrenceId: string;
    placeId: string;
    coordinate: [number, number];
    storyKey: string;
    cumulativeKm: number;
  }>;
  targetKm: number; // derived from geometry
  geometryVersion: string;
  visualTheme: string;
  previewAsset: string | null;
  isLoop: boolean;
  crossesAntimeridian: boolean;
};
```

An instantiated journey pins template version, geometry version, scoring policy version, community ID, organizer, start time, timezone, optional aspirational target date, lifecycle and closure cutoff. Use handover 1's `draft`, `active`, `closed`, `cancelled` lifecycle and derived destination-reached state. Pin immutable catalog data or a complete template snapshot so editing a route later cannot move an active community or its milestones. Reseeding must be idempotent; template updates create versions and do not overwrite pinned history.

Expose a scoped summary with credited Journey km, target, unique contributors, viewer contribution if authorized, current waypoint leg, reached milestones and next destination. Avoid duplicating independently mutable progress state; derive it from the contribution total and pinned geometry. If precomputed for performance, support deterministic reconciliation.

## Screen and interaction direction

### 1. Journey library

Use a polished responsive grid: one column on narrow phones, two on medium screens and up to three on wide screens. Each card has consistent proportions, a route illustration/map, title, a short evocative description, approximate Journey km and a small milestone count. Use rounded cards, ample spacing and existing MoveNotes typography/tokens. Make card art visually distinct through geography and a restrained accent palette, rather than ten unrelated design styles.

Favor locally generated SVG route illustrations from the seeded coordinates for the ten library cards; use a suitable projection and outline assets with proper licensing if included. These are preview artwork, not an interactive map. Do not mount ten live Mapbox instances in the grid. If reusing an existing compliant Static Images implementation is simpler, make it configuration-controlled and follow provider caching/attribution requirements. Do not put unapproved downloaded imagery in the catalog.

Sort by ascending derived distance or provide a calm short/long sort. Avoid labeling a journey “easy”: a short route can still take a small community time. Never claim Japan is longer than the Rome route just because it was labeled “long” in the earlier brainstorm.

### 2. Create a journey

Authorized organizers select a template, review the complete route and exact target, choose a start and optional target date, then create the instance. Present “How movement contributes” before joining, with a clear link to the Journey km rules. Reuse existing membership/invite mechanics. Do not silently opt every community member into activity sharing.

The target is fixed by the route. Do not ask for points, custom difficulty or a kilometer goal. If there is no existing journey feature, default to one active journey per community for v1 while preserving closed history; enforce this transactionally. Reuse any established more capable model rather than adding a conflicting limit.

### 3. Journey detail

Order the page for an immediate sense of place:

1. Journey title and a brief shared-travel description.
2. A generous map panel: approximately 300–380 px tall on a phone, 420–520 px on desktop, responsive to available space. Avoid consuming the full phone viewport.
3. “842 of 1,638 Journey km” and “18 people moving us forward” using actual live values and localized formatting.
4. A next-destination card: place name, Journey km remaining on this leg and one short description. At completion, show the destination and a quiet shared acknowledgement.
5. A waypoint timeline with reached/current/still-ahead states and cumulative distances.
6. Recent shared contributions only if existing sharing permissions allow them, plus a concise “How this works” explanation.

The map should have pale land, gentle water, sparse geographic labels and a high-contrast route. Completed route: solid primary color with a subtle light casing. Remaining route: subdued contrasting line, optional dashes. Reached waypoint: filled marker; future waypoint: outlined marker. Shared position: one distinctive marker with a visible halo, not one marker per member. Distinguish states with shape/text as well as color.

Reuse existing brand tokens; suggested hues in the catalog are art direction rather than mandatory hex codes. Keep Mapbox attribution and required branding visible with enough clearance from overlays. Put most text outside the map. Do not hide the route under a large bottom overlay on small screens.

Provide “Whole journey” and “Our position” controls. Start at a whole-route overview, preserve a person's camera when totals update, and animate only after an explicit action or a restrained first visit. Support reduced motion and avoid perpetual marker pulses. Route lines are symbolic: do not position the marker on a nearby road or imply live participant tracking.

### 4. Waypoint details and history

Selecting a waypoint on either the map or timeline opens the same accessible detail content: place, story, cumulative journey distance and reached/still-ahead status. Reuse the app's standardized dialog/sheet component with visible close control, working dismissal and one intentional scroll region. Selecting a future stop does not unlock or misstate progress.

A closed journey retains its route, stories and corrected aggregate progress. A closed journey may have ended before its destination; do not label every archived journey “completed”. Reconcile record withdrawal and privacy corrections using handover 1. Milestone notices inside the journey are enough for v1; push notifications and outbound messages are outside scope.

## Mapbox implementation and operating costs

Use the repository's existing supported Mapbox SDK and configuration when available. Otherwise use the appropriate web SDK for the actual stack and load it only when needed. No hard-coded claim about current free quotas or pricing: verify the account plan and SDK billing before release.

- Coordinates and GeoJSON come from the bundled/versioned catalog. No Directions or Geocoding calls are needed.
- One interactive map for the open detail view. Initialize once, update sources on progress changes, resize on container changes and remove listeners/resources on unmount. Do not reinitialize for every contribution or camera update.
- Keep list/feed previews lightweight. Do not regenerate a remote static map for every new fraction of a kilometer.
- Use an appropriately scoped public browser token with production/preview URL restrictions. Secret management tokens stay server-side. Do not log credentials or commit secret tokens.
- Respect provider terms, attribution and asset caching rules. No tile proxy or offline tile harvesting is part of this feature.
- Map/token/network/WebGL failure must leave the journey total and waypoint timeline usable, with a restrained unavailable-map state and retry action.
- Maps show curated journey geography only. Never publish personal activity routes, live location or private notes.

Official implementation references checked while drafting:

- [Mapbox GL JS overview and attribution](https://docs.mapbox.com/mapbox-gl-js/)
- [GeoJSON line gradient example](https://docs.mapbox.com/mapbox-gl-js/example/line-gradient/) — gradients require the relevant GeoJSON line metrics configuration.
- [Mapbox layer specification](https://docs.mapbox.com/style-spec/reference/layers/) — projected `line-progress` is not a geodesic kilometer measure.
- [Map projections](https://docs.mapbox.com/mapbox-gl-js/guides/projections/)

These references inform rendering details; they do not replace checking the SDK version used by the app.

## Accessibility and performance

All journey status and milestone information must be available outside the canvas. Provide meaningful map labeling, keyboard-accessible controls, visible focus, adequate contrast and touch targets, and no interaction that requires dragging. Map marker controls need accessible names. Use a polite, batched progress announcement rather than announcing each remote update. Respect reduced motion and locale units/number formatting, while consistently identifying the unit as virtual Journey km.

Avoid scroll trapping in the page or nested sheets. Keep normal page scrolling available on phones. Test long localized titles, large text and landscape orientation. Use restrained tile density/terrain and no heavy 3D buildings for this feature by default.

## Acceptance and delivery

Deliver the ten template seeds with localization-ready copy, distance-generation/validation script, shared geometry functions, scoped journey endpoints, library/create/detail/history UI, map styling and fallbacks, permission integration and tests. Include screenshots of representative phone and desktop states for review.

Meaningful checks:

- Ten valid unique templates, every occurrence resolvable, coordinates in range, strictly increasing cumulative distances and reproducible targets. Seed reruns create no duplicates.
- Marker and completed line agree at zero, half of a leg, an exact waypoint, final target and overshoot. A 50% total is measured in kilometers, not waypoint count.
- Amsterdam start/finish occurrences and the Pacific antimeridian crossing render correctly. Confirm no erroneous globe-spanning seam, full-world zoom on a local route or world route cropped to Europe.
- Contributions edited/deleted/unshared move the route and milestone states backward when appropriate, without duplicate milestone celebrations. Catalog changes do not rewrite pinned instances.
- No Directions/Geocoding requests; no live maps in the card grid; detail updates do not remount the map. One member cannot read or modify another community's private journey.
- Mobile/desktop visual review of a short route, the Alps, Japan and the world journey; zero progress, partial progress, destination reached and closed-before-destination states.
- Missing token, failed tiles, no WebGL, keyboard-only use, reduced motion and long text all retain a usable milestone list and progress summary.

The finished experience should make the shared destination immediately understandable and attractive, while explaining that different movement types add virtual Journey km. Keep the calculations available on demand and the shared adventure at the center of the screen.
