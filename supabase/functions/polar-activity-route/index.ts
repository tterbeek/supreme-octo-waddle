import { authorizedUser, requestPolarTokens, tokenExpiresAt } from '../_shared/polar.ts';
import { polarList, polarRangeDateTime } from '../_shared/polarImport.ts';
import { createPolarRouteHandler, type RouteSession } from '../_shared/polarRoute.ts';

Deno.serve(createPolarRouteHandler(async request => {
  const context = await authorizedUser(request);
  if (!context) return null;
  return {
    async findActivity(id) {
      const { data, error } = await context.admin.from('activities')
        .select('id, external_id, external_source, date, started_at, route_polyline, route_checked_at')
        .eq('id', id).eq('user_id', context.user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    async loadDay(day) {
      const { data: connection, error } = await context.admin.from('user_polar_connections').select('access_token, refresh_token, token_expires_at').eq('user_id', context.user.id).maybeSingle();
      if (error || !connection) throw new Error('Polar not connected');
      let accessToken = connection.access_token;
      if (Date.parse(connection.token_expires_at) <= Date.now() + 5 * 60_000) {
        const tokens = await requestPolarTokens(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: connection.refresh_token }));
        accessToken = tokens.access_token;
        const result = await context.admin.from('user_polar_connections').update({ access_token: accessToken, refresh_token: tokens.refresh_token ?? connection.refresh_token, token_expires_at: tokenExpiresAt(tokens), updated_at: new Date().toISOString() }).eq('user_id', context.user.id);
        if (result.error) throw result.error;
      }
      const from = new Date(`${day}T00:00:00Z`), to = new Date(from.getTime() + 86400_000);
      const query = new URLSearchParams({ from: polarRangeDateTime(from), to: polarRangeDateTime(to), features: 'routes' });
      const response = await fetch(`https://www.polaraccesslink.com/v4/data/training-sessions/list?${query}`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error('Polar route request failed');
      return polarList<RouteSession>(await response.json(), 'trainingSessions');
    },
    async save(id, polyline, checkedAt) {
      const { error } = await context.admin.from('activities').update({ route_polyline: polyline, route_checked_at: checkedAt }).eq('id', id).eq('user_id', context.user.id).eq('external_source', 'polar');
      if (error) throw error;
    },
  };
}));
