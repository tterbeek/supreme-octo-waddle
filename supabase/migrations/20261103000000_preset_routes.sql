-- A preset stores a reusable route snapshot, not a reference to an imported workout.
alter table public.presets add column route_polyline text
 check(route_polyline is null or length(route_polyline)<=5000);
