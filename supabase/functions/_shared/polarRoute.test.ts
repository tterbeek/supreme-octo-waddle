import { describe, expect, it, vi } from 'vitest';
import { createPolarRouteHandler, type RouteActivity } from './polarRoute';
const id = 'fa000000-0000-4000-8000-000000000001';
const activity: RouteActivity = { id, external_id: 'polar-one', external_source: 'polar', date: '2026-10-28', started_at: '2026-10-28T07:00:00Z', route_polyline: null, route_checked_at: null };
const request = (body: unknown = { activityId: id }) => new Request('http://local/route', { method: 'POST', body: JSON.stringify(body) });
function fixture(value: RouteActivity | null = activity) {
  const loadDay = vi.fn().mockResolvedValue([{ identifier: { id: 'polar-one' }, routes: { route: { wayPoints: [{ latitude: 50, longitude: 4 }, { latitude: 50.01, longitude: 4.01 }] } } }]);
  const save = vi.fn();
  return { loadDay, save, handler: createPolarRouteHandler(async () => ({ findActivity: async () => value, loadDay, save }), () => new Date('2026-10-28T10:00:00Z')) };
}
describe('Polar route endpoint', () => {
  it('requires authentication and an owned Polar activity', async () => {
    expect((await createPolarRouteHandler(async () => null)(request())).status).toBe(401);
    const f = fixture(null);
    expect((await f.handler(request())).status).toBe(404);
    expect(f.loadDay).not.toHaveBeenCalled();
    expect((await fixture({ ...activity, external_source: 'strava' }).handler(request())).status).toBe(404);
  });
  it('fetches one day and stores only the matching activity preview', async () => {
    const f = fixture();
    const response = await f.handler(request());
    expect(response.status).toBe(200);
    expect(f.loadDay).toHaveBeenCalledWith('2026-10-28');
    expect((await response.json()).polyline).toBeTruthy();
    expect(f.save).toHaveBeenCalledWith(id, expect.any(String), '2026-10-28T10:00:00.000Z');
  });
  it('reuses a stored route and a recent no-GPS check', async () => {
    for (const value of [{ ...activity, route_polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' }, { ...activity, route_checked_at: '2026-10-28T09:00:00Z' }]) {
      const f = fixture(value);
      expect((await f.handler(request())).status).toBe(200);
      expect(f.loadDay).not.toHaveBeenCalled();
    }
  });
  it('does not store errors as no-GPS results or import another session track', async () => {
    const f = fixture(); f.loadDay.mockRejectedValueOnce(new Error('Unavailable'));
    expect((await f.handler(request())).status).toBe(502);
    expect(f.save).not.toHaveBeenCalled();
    f.loadDay.mockResolvedValue([{ identifier: { id: 'someone-else' } }]);
    expect((await (await f.handler(request())).json()).polyline).toBeNull();
    expect(f.save).toHaveBeenCalledWith(id, null, expect.any(String));
    expect(f.loadDay).toHaveBeenCalledTimes(4); // one failed request, three bounded day checks
  });
  it('finds a local-date workout across UTC midnight', async () => {
    const f = fixture({ ...activity, date: '2026-10-28', started_at: '2026-10-27T23:30:00Z' });
    expect((await f.handler(request())).status).toBe(200);
    expect(f.loadDay).toHaveBeenCalledExactlyOnceWith('2026-10-28');
  });
  it('does not rely on a user-edited date for locating the source workout', async () => {
    const f = fixture({ ...activity, date: '2026-09-01' });
    f.loadDay.mockResolvedValueOnce([]);
    expect((await f.handler(request())).status).toBe(200);
    expect(f.loadDay.mock.calls.map(call => call[0])).toEqual(['2026-10-28', '2026-10-27']);
  });
});
