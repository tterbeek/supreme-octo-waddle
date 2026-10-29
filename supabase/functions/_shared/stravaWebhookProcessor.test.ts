import { describe, expect, it, vi } from 'vitest';
import { drainStravaEvents, processStravaEvent } from './stravaWebhookProcessor';

const event = { id: 'event-1', attempts: 1, owner_id: 123, object_id: 456, subscription_id: 789,
  event_time: 1793260800, object_type: 'activity' as const, aspect_type: 'create' as const, updates: {} };
function fixture(connected = true) {
  const writes: Array<{ table: string; values: Record<string, unknown> }> = [];
  const filters: Array<[string, unknown]> = [];
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const client = { rpc, from: vi.fn((table: string) => {
    const query = {
      select: () => query,
      delete: () => { writes.push({ table, values: { deleted: true } }); return query; },
      update: (values: Record<string, unknown>) => { writes.push({ table, values }); return query; },
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      maybeSingle: async () => ({ data: table === 'user_strava_connections' && connected ? { user_id: 'actual-owner' } : null, error: null }),
      then: (resolve: (result: { error: null }) => void) => resolve({ error: null }),
    };
    return query;
  }) };
  return { client: client as unknown as Parameters<typeof processStravaEvent>[0], rpc, writes, filters };
}
describe('Strava queued processing', () => {
  it('maps the athlete to its actual owner and imports only that activity', async () => {
    const f = fixture(); const importer = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await processStravaEvent(f.client, event, importer);
    expect(f.filters).toContainEqual(['strava_athlete_id', 123]);
    expect(importer).toHaveBeenCalledWith('actual-owner', '456');
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('does not import queued events after disconnect or rewrite ordinary edits', async () => {
    const importer = vi.fn();
    await processStravaEvent(fixture(false).client, event, importer);
    const f = fixture();
    await processStravaEvent(f.client, { ...event, aspect_type: 'update', updates: { title: 'Changed' } }, importer);
    expect(importer).not.toHaveBeenCalled();
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it('removes provider data for deletion/private events without importing', async () => {
    const f = fixture(); const importer = vi.fn();
    await processStravaEvent(f.client, { ...event, aspect_type: 'delete' }, importer);
    expect(f.rpc).toHaveBeenCalledWith('remove_strava_workout_data', { p_user_id: 'actual-owner', p_external_id: '456' });
    await processStravaEvent(f.client, { ...event, aspect_type: 'update', updates: { private: 'true' } }, importer);
    expect(f.rpc).toHaveBeenCalledTimes(2);
    expect(importer).not.toHaveBeenCalled();
  });
  it('removes credentials only after successful account-wide cleanup', async () => {
    const f = fixture(); const importer = vi.fn();
    await processStravaEvent(f.client, { ...event, object_type: 'athlete', aspect_type: 'update', updates: { authorized: false } }, importer);
    expect(f.rpc).toHaveBeenCalledWith('disconnect_strava_account', { p_user_id: 'actual-owner' });
    const failed = fixture(); failed.rpc.mockResolvedValue({ error: new Error('db failure') });
    await expect(processStravaEvent(failed.client, { ...event, object_type: 'athlete', updates: { authorized: false } }, importer)).rejects.toThrow();
    expect(failed.writes).toHaveLength(0);
  });
  it('retries transient import failures without storing raw credential-bearing errors', async () => {
    const f = fixture();
    f.rpc.mockResolvedValueOnce({ data: [event], error: null }).mockResolvedValue({ data: [], error: null });
    const importer = vi.fn().mockRejectedValue(new Error('sensitive provider response'));
    expect(await drainStravaEvents(f.client, importer)).toBe(1);
    expect(f.writes[0].values).toMatchObject({ state: 'pending', lease_until: null });
    expect(JSON.stringify(f.writes)).not.toContain('sensitive');
    expect(Date.parse(String(f.writes[0].values.available_at))).toBeGreaterThan(Date.now());
  });
  it('marks success and bounds retries on repeatedly failed jobs', async () => {
    const f = fixture();
    f.rpc.mockResolvedValueOnce({ data: [event] }).mockResolvedValue({ data: [] });
    await drainStravaEvents(f.client, vi.fn().mockResolvedValue(new Response()));
    expect(f.writes[0].values).toMatchObject({ state: 'done', last_error: null });
    const failed = fixture();
    failed.rpc.mockResolvedValueOnce({ data: [{ ...event, attempts: 8 }] }).mockResolvedValue({ data: [] });
    await drainStravaEvents(failed.client, vi.fn().mockRejectedValue(new Error()));
    expect(failed.writes[0].values.state).toBe('failed');
  });
});
