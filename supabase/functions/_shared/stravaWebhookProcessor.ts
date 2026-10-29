import { stravaEventAction, type StravaEvent } from './stravaWebhook.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

type QueuedEvent = StravaEvent & { id: string; attempts: number };
type ImportOne = (userId: string, externalId: string) => Promise<Response>;

export async function processStravaEvent(client: SupabaseClient, event: QueuedEvent, importOne: ImportOne) {
  const action = stravaEventAction(event);
  if (action === 'ignore') return;
  const { data: connection, error } = await client.from('user_strava_connections')
    .select('user_id').eq('strava_athlete_id', event.owner_id).maybeSingle();
  if (error) throw new Error('Connection lookup failed');
  // Past participation/queued events cannot authorize access after disconnect.
  if (!connection) return;
  const userId = connection.user_id;
  if (action === 'disconnect') {
    const { error: disconnectError } = await client.rpc('disconnect_strava_account', { p_user_id: userId });
    if (disconnectError) throw new Error('Connection removal failed');
    return;
  }
  if (action === 'remove' ||
      (action === 'privacy' && [true, 'true'].includes(event.updates.private as boolean | string))) {
    const { error: removalError } = await client.rpc('remove_strava_workout_data', {
      p_user_id: userId, p_external_id: String(event.object_id),
    });
    if (removalError) throw new Error('Provider data removal failed');
    return;
  }
  if (action !== 'import') return;
  const response = await importOne(userId, String(event.object_id));
  if (response.status === 404) {
    // A removed/inaccessible existing resource must no longer be displayed.
    // A brand-new upload may not be readable yet: leave it retryable.
    const { data: existing, error: lookupError } = await client.from('activities').select('id')
      .eq('user_id', userId).eq('external_source', 'strava').eq('external_id', String(event.object_id)).maybeSingle();
    if (lookupError) throw new Error('Activity lookup failed');
    if (existing) {
      const { error: removalError } = await client.rpc('remove_strava_workout_data', {
        p_user_id: userId, p_external_id: String(event.object_id),
      });
      if (removalError) throw new Error('Provider data removal failed');
      return;
    }
  }
  if (!response.ok) {
    // Import core returns only a status to this boundary: never store raw provider errors or tokens.
    throw new Error(`Activity import failed (HTTP ${response.status})`);
  }
}

export async function drainStravaEvents(client: SupabaseClient, importOne: ImportOne, budgetMs = 45_000) {
  const started = Date.now();
  let processed = 0;
  while (processed < 5 && Date.now() - started < budgetMs) {
    const { data, error } = await client.rpc('claim_strava_webhook');
    if (error) throw new Error('Could not claim webhook event');
    const event = data?.[0] as QueuedEvent | undefined;
    if (!event) break;
    try {
      await processStravaEvent(client, event, importOne);
      const { error: saveError } = await client.from('strava_webhook_events')
        .update({ state: 'done', completed_at: new Date().toISOString(), lease_until: null, last_error: null })
        .eq('id', event.id).eq('attempts', event.attempts).eq('state', 'processing');
      if (saveError) throw new Error('Could not complete event');
    } catch (error) {
      const message = error instanceof Error && /^Activity import failed \(HTTP \d+\)$/.test(error.message)
        ? error.message : 'Webhook processing failed';
      console.warn('[strava-webhook-worker]', { eventId: event.id, attempt: event.attempts, reason: message });
      const delaySeconds = message.includes('429') ? 900 : Math.min(3600, 60 * 2 ** Math.min(event.attempts, 6));
      const { error: saveError } = await client.from('strava_webhook_events').update({
        state: event.attempts >= 8 ? 'failed' : 'pending', lease_until: null,
        available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
        last_error: message,
      }).eq('id', event.id).eq('attempts', event.attempts).eq('state', 'processing');
      if (saveError) throw new Error('Could not persist webhook retry');
    }
    processed++;
  }
  return processed;
}
