// Run with a private ignored env file. Never print credentials or callback URLs.
const required = ['STRAVA_CLIENT_ID','STRAVA_CLIENT_SECRET','STRAVA_WEBHOOK_VERIFY_TOKEN',
  'STRAVA_WEBHOOK_CALLBACK_SECRET','SUPABASE_PROJECT_URL'];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}
const callback = new URL('/functions/v1/strava-webhook', process.env.SUPABASE_PROJECT_URL);
if (callback.protocol !== 'https:') throw new Error('Use an HTTPS Supabase project URL');
callback.pathname += '/' + encodeURIComponent(process.env.STRAVA_WEBHOOK_CALLBACK_SECRET);
if (callback.toString().length > 255) throw new Error('Callback URL exceeds Strava limit');
const credentials = { client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET };
const endpoint = 'https://www.strava.com/api/v3/push_subscriptions';
const existingResponse = await fetch(`${endpoint}?${new URLSearchParams(credentials)}`);
if (!existingResponse.ok) throw new Error(`Subscription lookup failed (HTTP ${existingResponse.status})`);
const existing = await existingResponse.json();
if (!Array.isArray(existing)) throw new Error('Unexpected subscription response');
let subscription = existing.find(item => item.callback_url === callback.toString());
if (!subscription && existing.length) throw new Error('This Strava app already has another subscription. Review it manually; nothing was changed.');
if (!subscription) {
  // Reproduce Strava's GET handshake without exposing the secret callback URL.
  const challenge = 'movenotes-registration-check';
  const probe = new URL(callback);
  probe.searchParams.set('hub.mode', 'subscribe');
  probe.searchParams.set('hub.verify_token', process.env.STRAVA_WEBHOOK_VERIFY_TOKEN);
  probe.searchParams.set('hub.challenge', challenge);
  let check;
  try {
    check = await fetch(probe, { signal: AbortSignal.timeout(2000) });
  } catch {
    throw new Error('Callback did not respond within two seconds or could not be reached. Check the deployed strava-webhook function.');
  }
  if (!check.ok) {
    const hint = check.status === 401 ? 'Deploy strava-webhook with JWT verification disabled.'
      : check.status === 403 ? 'The callback secret or verification token differs between your env file and Supabase function secrets.'
      : check.status === 404 ? 'Deploy strava-webhook to the project in SUPABASE_PROJECT_URL.'
      : 'Check the strava-webhook function status.';
    throw new Error(`Callback handshake failed (HTTP ${check.status}). ${hint}`);
  }
  const echo = await check.json().catch(() => null);
  if (echo?.['hub.challenge'] !== challenge) throw new Error('Callback returned an invalid verification challenge.');
  console.log('Callback verification passed.');
  const response = await fetch(endpoint, {
    method: 'POST',
    body: new URLSearchParams({ ...credentials, callback_url: callback.toString(), verify_token: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    // Strava uses labels with spaces (e.g. "callback url", "not verifiable").
    // Accept diagnostic words, while excluding URLs, secret values and token-like text.
    const secretValues = ['STRAVA_CLIENT_SECRET', 'STRAVA_WEBHOOK_VERIFY_TOKEN',
      'STRAVA_WEBHOOK_CALLBACK_SECRET'].map(name => process.env[name]).filter(Boolean);
    const diagnostic = value => {
      if (typeof value !== 'string') return '[unknown]';
      let safe = value;
      for (const secret of secretValues) {
        safe = safe.split(secret).join('[redacted]');
        safe = safe.split(encodeURIComponent(secret)).join('[redacted]');
      }
      return safe.replace(/https?:\/\/[^\s"'<>]+/gi, '[URL redacted]')
        .replace(/[a-f0-9]{32,}/gi, '[token redacted]')
        .replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 500);
    };
    const details = Array.isArray(payload?.errors) ? payload.errors.slice(0, 5).map(error =>
      `${diagnostic(error?.resource)} / ${diagnostic(error?.field)}: ${diagnostic(error?.code)}`
    ).join('; ') : '';
    throw new Error(`Subscription creation failed (HTTP ${response.status})${details ? ': ' + details : ''}. The direct callback test passed; this diagnostic is Strava's response. Check strava-webhook invocation logs for its verification request.`);
  }
  subscription = await response.json();
}
if (!Number.isSafeInteger(subscription.id)) throw new Error('Missing subscription ID');
console.log(`STRAVA_WEBHOOK_SUBSCRIPTION_ID=${subscription.id}`);
console.log('Save this ID as a Supabase function secret. No client credentials were printed.');
