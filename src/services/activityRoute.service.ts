import pLimit from 'p-limit';
import { supabase } from '../supabaseClient';

// Serialize route fetches within this client to avoid a burst of token refreshes.
const queue = pLimit(1);
const pending = new Map<string, Promise<string | null>>();

export function loadPolarRoute(activityId: string): Promise<string | null> {
  const existing = pending.get(activityId);
  if (existing) return existing;
  const request = queue(async () => {
    const { data, error } = await supabase.functions.invoke('polar-activity-route', { body: { activityId }, signal: AbortSignal.timeout(30_000) });
    if (error) throw new Error('Could not load the route. Please try again.');
    return typeof data?.polyline === 'string' ? data.polyline : null;
  }).finally(() => pending.delete(activityId));
  pending.set(activityId, request);
  return request;
}
