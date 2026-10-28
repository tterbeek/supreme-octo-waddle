-- Private preview data only. Existing activity RLS remains authoritative.
-- Shared feed/media projections intentionally do not expose these columns.
alter table public.activities
 add column route_polyline text check(route_polyline is null or length(route_polyline)<=5000),
 add column route_checked_at timestamptz;
