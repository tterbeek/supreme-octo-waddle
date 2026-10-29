import { describe, expect, it, vi } from 'vitest';
import { createStravaWebhookHandler } from './stravaWebhookHandler';

const event = { object_type: 'activity', aspect_type: 'create', object_id: 456, owner_id: 123,
  subscription_id: 789, event_time: 1793260800, updates: {} };
function fixture() {
  const deps = { callbackSecret: 'callback-secret', verifyToken: 'verify-secret', subscriptionId: '789',
    persist: vi.fn().mockResolvedValue(true), wake: vi.fn() };
  return { deps, handler: createStravaWebhookHandler(deps) };
}
function post(body: unknown = event, query = '?key=callback-secret') {
  return new Request('https://fixture.test/webhook' + query, { method: 'POST', body: JSON.stringify(body) });
}
describe('Strava webhook HTTP boundary', () => {
  it('validates and echoes the Strava challenge before any DB or worker access', async () => {
    const f = fixture();
    const reply = await f.handler(new Request('https://fixture.test/webhook?key=callback-secret&hub.mode=subscribe&hub.verify_token=verify-secret&hub.challenge=challenge'));
    expect(reply.status).toBe(200);
    expect(await reply.json()).toEqual({ 'hub.challenge': 'challenge' });
    expect(f.deps.persist).not.toHaveBeenCalled();
    expect(f.deps.wake).not.toHaveBeenCalled();
    const denied = await f.handler(new Request('https://fixture.test/webhook?key=callback-secret&hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge'));
    expect(denied.status).toBe(403);
  });
  it('verifies a path-secret callback when Strava supplies its own query string', async () => {
    const f = fixture();
    const response = await f.handler(new Request('https://fixture.test/functions/v1/strava-webhook/callback-secret?hub.mode=subscribe&hub.verify_token=verify-secret&hub.challenge=strava-challenge'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ 'hub.challenge': 'strava-challenge' });
    expect((await f.handler(new Request('https://fixture.test/functions/v1/strava-webhook/wrong?hub.mode=subscribe&hub.verify_token=verify-secret&hub.challenge=test'))).status).toBe(403);
  });

  it('rejects unauthorized, mismatched and oversized requests without persisting', async () => {
    const f = fixture();
    expect((await f.handler(post(event, '?key=wrong'))).status).toBe(403);
    expect((await f.handler(post({ ...event, subscription_id: 1 }))).status).toBe(400);
    expect((await f.handler(post({ ...event, padding: 'x'.repeat(17000) }))).status).toBe(413);
    expect(f.deps.persist).not.toHaveBeenCalled();
  });
  it('only acknowledges after durable persistence and wakes without waiting for import', async () => {
    const f = fixture(); const order: string[] = [];
    f.deps.persist.mockImplementation(async () => { order.push('persist'); return true; });
    f.deps.wake.mockImplementation(() => { order.push('wake'); });
    const response = await f.handler(post());
    expect(response.status).toBe(200);
    expect(order).toEqual(['persist', 'wake']);
    expect(f.deps.persist).toHaveBeenCalledOnce();
  });
  it('returns retryable failure if persistence fails; worker failure does not lose accepted events', async () => {
    const f = fixture(); f.deps.persist.mockResolvedValue(false);
    expect((await f.handler(post())).status).toBe(503);
    expect(f.deps.wake).not.toHaveBeenCalled();
    f.deps.persist.mockResolvedValue(true);
    f.deps.wake.mockImplementation(() => { throw new Error('Worker unavailable'); });
    expect((await f.handler(post())).status).toBe(200);
  });
  it('ignores title edits without storing provider text or triggering work', async () => {
    const f = fixture();
    expect((await f.handler(post({ ...event, aspect_type: 'update', updates: { title: 'Changed' } }))).status).toBe(200);
    expect(f.deps.persist).not.toHaveBeenCalled();
    expect(f.deps.wake).not.toHaveBeenCalled();
  });
});
