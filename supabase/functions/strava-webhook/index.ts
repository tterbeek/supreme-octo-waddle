import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createStravaWebhookHandler } from '../_shared/stravaWebhookHandler.ts';

// Strava does not sign event POSTs. The secret callback URL and subscription ID
// protect this endpoint. Never log URLs, event bodies or credentials.
Deno.serve(createStravaWebhookHandler({
  callbackSecret: Deno.env.get('STRAVA_WEBHOOK_CALLBACK_SECRET'),
  verifyToken: Deno.env.get('STRAVA_WEBHOOK_VERIFY_TOKEN'),
  subscriptionId: Deno.env.get('STRAVA_WEBHOOK_SUBSCRIPTION_ID'),
  async persist(event, eventKey) {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { error } = await client.from('strava_webhook_events').upsert({
      event_key: eventKey, owner_id: event.owner_id, object_id: event.object_id,
      object_type: event.object_type, aspect_type: event.aspect_type, event_time: event.event_time,
      updates: event.updates,
    }, { onConflict: 'event_key', ignoreDuplicates: true });
    return !error;
  },
  wake() {
    const work = fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/strava-webhook-worker`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-worker-secret': Deno.env.get('STRAVA_WEBHOOK_WORKER_SECRET')! },
      body: '{}', signal: AbortSignal.timeout(5000),
    }).then(() => {}).catch(() => {});
    const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil(task: Promise<unknown>): void } }).EdgeRuntime;
    if (runtime) runtime.waitUntil(work);
  },
}));
