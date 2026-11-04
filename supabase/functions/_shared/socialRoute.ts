import { sharedRouteSegments } from './sharedActivityRoute.ts';

const headers = {
 'Access-Control-Allow-Origin': '*',
 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods': 'POST, OPTIONS',
 'Cache-Control': 'no-store',
 'Content-Type': 'application/json',
};
type Dependencies = {
 viewer(authorization: string): Promise<string | null>;
 route(activityId: string, viewerId: string): Promise<string | null>;
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function createSocialRouteHandler(deps: Dependencies) {
 return async (req: Request) => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  const authorization = req.headers.get('Authorization');
  if (!authorization) return json(401, { error: 'Sign in to view shared maps' });
  try {
   const viewer = await deps.viewer(authorization);
   if (!viewer) return json(401, { error: 'Sign in to view shared maps' });
   const body = await req.json().catch(() => null);
   if (typeof body?.activity !== 'string' || !uuid.test(body.activity)) return json(400, { error: 'Invalid activity' });
   const route = await deps.route(body.activity, viewer);
   if (!route) return json(404, { error: 'Shared map unavailable' });
   const segments = sharedRouteSegments(route, true);
   if (!segments.length) return json(404, { error: 'Not enough route remains after protecting the start and finish' });
   return json(200, { segments });
  } catch { return json(503, { error: 'Could not load shared map' }); }
 };
}
