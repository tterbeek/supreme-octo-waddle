import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSocialRouteHandler } from '../_shared/socialRoute.ts';

const url = Deno.env.get('SUPABASE_URL')!;
Deno.serve(createSocialRouteHandler({
 async viewer(authorization) {
  const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user?.id ?? null;
 },
 async route(activityId, viewerId) {
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc('social_route_input', { p_activity: activityId, p_viewer: viewerId });
  if (error) throw new Error('Shared map unavailable');
  return typeof data === 'string' ? data : null;
 },
}));
