import { decodeRoute, polarRoutePolyline } from './activityRoute.ts';

export type RouteActivity = { id: string; external_id: string | null; external_source: string | null; date: string; started_at: string | null; route_polyline: string | null; route_checked_at: string | null };
export type RouteSession = Parameters<typeof polarRoutePolyline>[0] & { identifier?: { id?: string } };
type RouteViewer = {
  findActivity: (id: string) => Promise<RouteActivity | null>;
  loadDay: (day: string) => Promise<RouteSession[]>;
  save: (id: string, polyline: string | null, checkedAt: string) => Promise<void>;
};
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

export function createPolarRouteHandler(viewer: (request: Request) => Promise<RouteViewer | null>, now = () => new Date()) {
  return async (request: Request) => {
    const respond = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
    if (request.method === 'OPTIONS') return respond(200, {});
    if (request.method !== 'POST') return respond(405, { error: 'Method not allowed.' });
    try {
      const user = await viewer(request);
      if (!user) return respond(401, { error: 'Please sign in.' });
      const body = await request.json().catch(() => null);
      if (typeof body?.activityId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.activityId)) return respond(400, { error: 'Invalid activity.' });
      const activity = await user.findActivity(body.activityId);
      if (!activity || activity.external_source !== 'polar' || !activity.external_id) return respond(404, { error: 'Activity unavailable.' });
      if (decodeRoute(activity.route_polyline).length) return respond(200, { polyline: activity.route_polyline });
      if (activity.route_checked_at && now().getTime() - Date.parse(activity.route_checked_at) < 86400_000) return respond(200, { polyline: null });
      const day = (activity.started_at || activity.date).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day))) return respond(400, { error: 'Activity date unavailable.' });
      // started_at is UTC, while Polar's day queries use local wall-clock dates.
      // Try the saved local date first if plausible, then the UTC date/neighbours.
      // This also survives user edits to the activity's displayed date.
      const instantDay = new Date(`${day}T00:00:00Z`);
      const nearbyDays = [-1, 0, 1].map(offset => new Date(instantDay.getTime() + offset * 86400_000).toISOString().slice(0, 10));
      const days = [...new Set([...(nearbyDays.includes(activity.date) ? [activity.date] : []), day, ...nearbyDays])];
      let session: RouteSession | undefined;
      for (const candidate of days) {
        const sessions = await user.loadDay(candidate);
        session = sessions.find(item => item.identifier?.id === activity.external_id);
        if (session) break;
      }
      const polyline = session ? polarRoutePolyline(session) : null;
      await user.save(activity.id, polyline, now().toISOString());
      return respond(200, { polyline });
    } catch { return respond(502, { error: 'Could not load the Polar route. Please try again.' }); }
  };
}
