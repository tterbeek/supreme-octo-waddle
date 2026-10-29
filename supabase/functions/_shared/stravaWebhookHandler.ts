import { parseStravaEvent, secretMatches, stravaEventAction, stravaEventKey, type StravaEvent } from './stravaWebhook.ts';

type Dependencies = {
  callbackSecret?: string; verifyToken?: string; subscriptionId?: string;
  persist(event: StravaEvent, key: string): Promise<boolean>;
  wake(): void;
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
export function createStravaWebhookHandler(deps: Dependencies) {
  return async (req: Request) => {
    const url = new URL(req.url);
    // A path secret survives providers replacing/appending verification query parameters.
    // Continue accepting the old query form for existing subscriptions.
    let pathSecret: string | null = null;
    try { pathSecret = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? ''); }
    catch { return json(403, { error: 'Forbidden' }); }
    if (!secretMatches(pathSecret, deps.callbackSecret) &&
        !secretMatches(url.searchParams.get('key'), deps.callbackSecret)) return json(403, { error: 'Forbidden' });
    if (req.method === 'GET') {
      if (url.searchParams.get('hub.mode') !== 'subscribe' ||
        !secretMatches(url.searchParams.get('hub.verify_token'), deps.verifyToken) ||
        !url.searchParams.get('hub.challenge')) return json(403, { error: 'Verification failed' });
      return json(200, { 'hub.challenge': url.searchParams.get('hub.challenge') });
    }
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
    if (!deps.subscriptionId) return json(503, { error: 'Subscription not configured' });
    let event: StravaEvent | null;
    const reader = req.body?.getReader();
    try {
      if (!reader) return json(400, { error: 'Invalid event' });
      const chunks: Uint8Array[] = []; let size = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 16_384) { await reader.cancel(); return json(413, { error: 'Payload too large' }); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      event = parseStravaEvent(JSON.parse(new TextDecoder().decode(bytes)), deps.subscriptionId);
    } catch { return json(400, { error: 'Invalid event' }); }
    finally { reader?.releaseLock(); }
    if (!event) return json(400, { error: 'Invalid event' });
    if (stravaEventAction(event) === 'ignore') return json(200, { accepted: true });
    try {
      if (!await deps.persist(event, stravaEventKey(event))) return json(503, { error: 'Could not accept event' });
    } catch { return json(503, { error: 'Could not accept event' }); }
    // Enqueue first; the wake callback must never await processing on this path.
    try { deps.wake(); } catch { /* The persistent scheduler is the fallback. */ }
    return json(200, { accepted: true });
  };
}
