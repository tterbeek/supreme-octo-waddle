import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { secretMatches } from '../_shared/stravaWebhook.ts';
import { drainStravaEvents } from '../_shared/stravaWebhookProcessor.ts';
import { importStravaActivities } from '../_shared/stravaImport.ts';

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!secretMatches(req.headers.get('x-worker-secret'), Deno.env.get('STRAVA_WEBHOOK_WORKER_SECRET'))) return new Response('Forbidden', { status: 403 });
  const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const clientId = Deno.env.get('STRAVA_CLIENT_ID'), clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');
  if (!url || !key || !clientId || !clientSecret) return new Response('Worker not configured', { status: 503 });
  const client = createClient(url, key);
  try {
    const processed = await drainStravaEvents(client, (userId, externalActivityId) => importStravaActivities({
      serviceClient: client, userId, externalActivityId, waitForCompletion: true,
      stravaClientId: clientId, stravaClientSecret: clientSecret,
      googleMapsApiKey: Deno.env.get('GOOGLE_MAPS_API_KEY'),
    }));
    return Response.json({ processed });
  } catch {
    console.warn('[strava-webhook-worker] Queue processing failed; scheduler will retry.');
    return new Response('Worker temporarily unavailable', { status: 503 });
  }
});
