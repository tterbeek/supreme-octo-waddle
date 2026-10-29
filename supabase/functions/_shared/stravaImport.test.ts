import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('npm:@mapbox/polyline', () => ({ default: { decode: () => [] } }));
vi.mock('./locationResolver.ts', () => ({ getLocationPriority: () => 0, resolveLocation: async () => null }));
import { importStravaActivities } from './stravaImport';
const owner = 'user-1';
const detail = { id: 456, athlete: { id: 123 }, name: 'Morning run', sport_type: 'Run',
  type: 'Run', start_date: '2026-10-29T08:00:00Z', start_date_local: '2026-10-29T09:00:00Z',
  distance: 5000, moving_time: 1800, map: { summary_polyline: null } };
function fixture() {
  let activity: Record<string, unknown> | null = null;
  const writes: Array<{table: string; values: Record<string, unknown>}> = [];
  const client = { from: vi.fn((table: string) => {
    let operation = 'select', values: Record<string, unknown> = {};
    const filters: Record<string, unknown> = {};
    const execute = () => {
      if (table === 'user_strava_connections') return { data: {
        user_id: owner, strava_athlete_id: 123, access_token: 'fixture',
        refresh_token: 'fixture', token_expires_at: new Date(Date.now()+3600_000).toISOString(),
      }, error: null };
      if (table === 'strava_removed_activities') return { data: null, error: null };
      if (operation === 'insert') { activity = { ...values, id: 'canonical-id' }; return { data: activity, error: null }; }
      if (operation === 'update') {
        if (activity && Object.entries(filters).every(([key,value]) => activity![key] === value)) Object.assign(activity,values);
        return { data: activity,error: null };
      }
      if (Array.isArray(filters.external_id)) return { data: activity?.import_status === 'ready' ? [] : [activity], error: null };
      return { data: activity, error: null };
    };
    const query = {
      select: () => query, insert: (v: Record<string, unknown>) => { operation='insert'; values=v; writes.push({table,values:v});return query; },
      update: (v: Record<string, unknown>) => { operation='update'; values=v; writes.push({table,values:v});return query; },
      eq: (key:string,value:unknown) => { filters[key]=value;return query; },
      is: (key:string,value:unknown) => { filters[key]=value;return query; },
      in: (key:string,value:unknown) => { filters[key]=value;return query; },
      neq: () => query, maybeSingle: async () => execute(), single: async () => execute(),
      then: (resolve: (value: ReturnType<typeof execute>) => void) => resolve(execute()),
    };
    return query;
  }) };
  return { client: client as unknown as Parameters<typeof importStravaActivities>[0]['serviceClient'],
    writes, activity: () => activity };
}
afterEach(() => vi.unstubAllGlobals());
describe('targeted Strava webhook import', () => {
  it('creates one pending canonical activity and retries without replacing user enrichment', async () => {
    const f = fixture(); const request = vi.fn().mockImplementation(async () => Response.json(detail));
    vi.stubGlobal('fetch',request);
    const options = { serviceClient:f.client,userId:owner,externalActivityId:'456',waitForCompletion:true,
      stravaClientId:'fixture',stravaClientSecret:'fixture' };
    expect((await importStravaActivities(options)).status).toBe(200);
    expect(request.mock.calls[0][0]).toBe('https://www.strava.com/api/v3/activities/456');
    expect(f.activity()).toMatchObject({ id:'canonical-id',external_source:'strava',external_id:'456',
      user_enrichment_status:'pending',import_status:'ready',distance_km:5,duration_min:30 });
    Object.assign(f.activity()!,{ title:'My own title',user_enrichment_status:'completed',notes:'My own note' });
    expect((await importStravaActivities(options)).status).toBe(200);
    expect(f.writes.filter(w=>w.table==='activities' && w.values.external_id==='456')).toHaveLength(1);
    expect(f.activity()).toMatchObject({ id:'canonical-id',title:'My own title',notes:'My own note',user_enrichment_status:'completed' });
  });
  it('rejects a provider response belonging to another athlete', async () => {
    const f=fixture();
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({...detail,athlete:{id:999}})));
    const result=await importStravaActivities({ serviceClient:f.client,userId:owner,externalActivityId:'456',
      stravaClientId:'fixture',stravaClientSecret:'fixture',waitForCompletion:true });
    expect(result.status).toBe(403);
    expect(f.writes).toHaveLength(0);
  });
});
