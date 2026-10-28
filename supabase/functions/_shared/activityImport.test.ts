import { describe, expect, it, vi } from 'vitest';
import { finishActivityImport, importCanRetry } from './activityImport';

const attempt = { id: 'canonical-id', user_id: 'owner', import_token: 'attempt-one' };
function fixture() {
  let token = attempt.import_token;
  let state = 'processing';
  let saved: Record<string, unknown> = {};
  const writes: Record<string, unknown>[] = [];
  const client = { from: vi.fn(() => ({ update: (values: Record<string, unknown>) => {
    const filters: Record<string, unknown> = {};
    const query = {
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      then: (resolve: (result: { error: null }) => void) => {
        writes.push(values);
        if (filters.id === attempt.id && filters.user_id === attempt.user_id && filters.import_token === token && filters.import_status === state) {
          saved = values; state = String(values.import_status);
        }
        resolve({ error: null });
      },
    };
    return query;
  } })) };
  return { client: client as unknown as Parameters<typeof finishActivityImport>[0], writes,
    saved: () => saved, state: () => state, retry: () => { token = 'attempt-two'; } };
}
describe('canonical activity import lifecycle', () => {
  it('publishes name and GPS together only after all preparation finishes', async () => {
    const f = fixture();
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const work = finishActivityImport(f.client, attempt, async () => { await waiting; return { title: 'Morning run Brussels', route_polyline: 'route' }; });
    expect(f.writes).toHaveLength(0);
    expect(f.state()).toBe('processing');
    release(); await work;
    expect(f.writes).toHaveLength(1);
    expect(f.saved()).toMatchObject({ title: 'Morning run Brussels', route_polyline: 'route', import_status: 'ready' });
  });
  it('finishes activities without GPS and records failures without replacing the activity', async () => {
    const noGps = fixture();
    await finishActivityImport(noGps.client, attempt, async () => ({ title: 'Morning workout', route_polyline: null }));
    expect(noGps.saved()).toMatchObject({ import_status: 'ready', route_polyline: null });
    const failed = fixture();
    await finishActivityImport(failed.client, attempt, async () => { throw Error('provider unavailable'); });
    expect(failed.saved()).toMatchObject({ import_status: 'failed' });
    expect(failed.saved()).not.toHaveProperty('title');
  });
  it('cannot overwrite a newer retry or a completed record with a stale worker', async () => {
    const f = fixture(); f.retry();
    await finishActivityImport(f.client, attempt, async () => ({ title: 'Stale result' }));
    expect(f.saved()).toEqual({});
    const done = fixture();
    await finishActivityImport(done.client, attempt, async () => ({ title: 'Final' }));
    await finishActivityImport(done.client, attempt, async () => ({ title: 'Duplicate' }));
    expect(done.saved().title).toBe('Final');
  });
  it('allows failed/stalled imports to retry but leaves fresh and ready records alone', () => {
    const now = Date.parse('2026-10-28T10:00:00Z');
    expect(importCanRetry('failed', null, now)).toBe(true);
    expect(importCanRetry('processing', '2026-10-28T09:57:00Z', now)).toBe(true);
    expect(importCanRetry('processing', '2026-10-28T09:59:30Z', now)).toBe(false);
    expect(importCanRetry('ready', null, now)).toBe(false);
  });
});
