# Strava webhook import

New Strava activities import while MoveNotes is closed. They use the same canonical
activity, background naming/GPS and optional Add details → reflection flow as
manual sync. Normal title/type updates are ignored, preserving MoveNotes edits.

## Production setup

Nothing is activated merely by deploying the frontend. Use the existing Strava app
(client ID 209776); one subscription covers its connected athletes.

1. Review/apply the migration:
   ~~~bash
   npx supabase db push --linked --dry-run
   npx supabase db push --linked
   ~~~
   This creates two service-only tables, removal/claim helpers and a one-minute
   scheduler. The scheduler does nothing until its Vault values are configured.
   The migration does not modify existing workouts.

2. Generate three different random secrets (run openssl rand -hex 32 three times).
   In Supabase Edge Function secrets, add:
   - STRAVA_WEBHOOK_CALLBACK_SECRET
   - STRAVA_WEBHOOK_VERIFY_TOKEN
   - STRAVA_WEBHOOK_WORKER_SECRET

   Retain existing STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET and naming/geocoding
   configuration. These belong on Supabase, never in public Vite/Vercel variables.
   Treat the callback URL with its secret path suffix as confidential.

3. Deploy the functions:
   ~~~bash
   npx supabase functions deploy strava-webhook --project-ref ljthydvstmbcgqdnqkvx --use-api
   npx supabase functions deploy strava-webhook-worker --project-ref ljthydvstmbcgqdnqkvx --use-api
   npx supabase functions deploy strava-import-activities --project-ref ljthydvstmbcgqdnqkvx --use-api
   npx supabase functions deploy strava-disconnect --project-ref ljthydvstmbcgqdnqkvx --use-api
   ~~~
   Deploy importer/disconnect after the migration. Receiver/worker have gateway
   JWT verification disabled in config; they enforce their own secrets.
   The browser importer still validates auth.getUser() and never accepts a user
   ID from the client.

4. Register once. Create an ignored .env.strava-webhooks.local file:
   ~~~dotenv
   SUPABASE_PROJECT_URL=https://ljthydvstmbcgqdnqkvx.supabase.co
   STRAVA_CLIENT_ID=209776
   STRAVA_CLIENT_SECRET=YOUR_EXISTING_SECRET
   STRAVA_WEBHOOK_CALLBACK_SECRET=YOUR_CALLBACK_SECRET
   STRAVA_WEBHOOK_VERIFY_TOKEN=YOUR_VERIFY_TOKEN
   ~~~
   Run:
   ~~~bash
   node --env-file=.env.strava-webhooks.local scripts/register-strava-webhook.mjs
   ~~~
   The script finds a matching subscription or creates one and prints only its ID.
   It refuses to delete a different existing subscription. Save the printed
   STRAVA_WEBHOOK_SUBSCRIPTION_ID as a Supabase Edge Function secret immediately.
   No change to the portal OAuth callback domain is needed.

5. In the production Supabase SQL editor, configure the retry scheduler:
   ~~~sql
   select vault.create_secret(
     'https://ljthydvstmbcgqdnqkvx.supabase.co/functions/v1/strava-webhook-worker',
     'strava_webhook_worker_url'
   );
   select vault.create_secret(
     'YOUR_STRAVA_WEBHOOK_WORKER_SECRET',
     'strava_webhook_worker_secret'
   );
   ~~~
   Configure once; rotate by updating existing Vault secrets rather than creating
   duplicate names. The Vault worker secret must match the Edge secret.
   The service-role key is not stored in Vault or sent to Strava.

6. Deploy the frontend for the updated connection/privacy explanation. Create a
   genuinely new Strava activity with MoveNotes closed, then reopen the Journal.
   Verify name, route when supplied, Add details, same-ID save and reflection.
   Existing connections need no reconnect solely for webhooks. Initial history
   import still happens through OAuth.

## Reliability and access

The receiver checks the unguessable callback path secret (legacy query keys remain supported), subscription ID, event shape,
safe identifiers and payload size. GET verification also checks the verify token
and echoes only the challenge. Strava does not sign event POSTs.

Events are persisted before HTTP 200; no provider/geocoding calls delay the
acknowledgement. Strava requires a response within two seconds. Hosted cold-start
and database latency still need live verification.

Duplicate events do not reset completed jobs. Five-minute leases recover abandoned
work. One active event serializes worker token refresh and removal. Unique
provider IDs prevent duplicate activities. The worker maps the athlete to its
current connection and checks fetched activity ownership before targeted imports.
A missing connection cannot authorize an import.

Transient failures retry with backoff, stopping after eight attempts. Failed
records remain available for operator review. No provider bodies, credentials or
verification tokens are logged or stored. Existing Journal realtime/import
polling reveals background work when open; pull-to-refresh and Sync remain.

Removed-workout tombstones prevent stale creates/retries/manual sync from restoring
withdrawn data. Later public/create events do not automatically restore it.

## Removal and personal material

Delete events can mean deletion or access loss after a privacy change.
Private=true updates withdraw imported data too. This first version uses the
same conservative removal path, including when read_all access was granted.

Withdrawal clears source title/type/start/date/metrics/route/provider identifiers,
revokes social placements and converts the canonical record to a private manual
"Personal movement reflection" dated by its MoveNotes creation date. Own notes,
feelings, effort, equipment and uploaded photos remain on the same activity ID.
Source-derived titles are cleared, even if previously edited. Nothing is sent
back to Strava. Conversation access follows the revoked placements.

Deauthorization strips all the account's imported workout data before deleting
credentials. Manual Disconnect uses the same cleanup if no webhook arrives.
Queue rows contain operational IDs/flags, not workout titles or GPS.

This feature is not a full audit of historical Strava-derived exports, AI outputs,
backups, or the policy's general cache-retention requirements.

## Monitoring and recovery

~~~sql
select state,count(*) from public.strava_webhook_events group by state;
select id,state,attempts,last_error,available_at
from public.strava_webhook_events where state<>'done' order by created_at;
~~~

After fixing a failed event's cause:
~~~sql
update public.strava_webhook_events
set state='pending',attempts=0,available_at=now(),lease_until=null
where id='THE_EVENT_UUID' and state='failed';
select public.wake_strava_webhook_worker();
~~~

Disable the subscription in Strava to stop inbound events. To stop processing:
~~~sql
select cron.unschedule('strava-webhook-worker');
~~~

Sync remains available. Do not post full callback URLs or OAuth tokens.

## Local tests and limits

Do not point the production subscription at localhost: one app allows only one
subscription. Use fictional event/API fixtures, or a separate Strava app plus an
HTTPS tunnel for live dev testing.

Tests cover input/secrets, owner routing, ignored updates, removal, disconnect,
retry and sanitized errors. SQL covers service-only access, dedupe, leases,
recovery, personal enrichment preservation and withdrawal tombstones. Schema
replay uses an isolated disposable Supabase stack.

A real production event, Strava verification timing, deployed secrets/Vault,
and the complete mobile browser journey remain manual release checks.

References:
- https://developers.strava.com/docs/webhooks/
- https://www.strava.com/legal/api_policy
