import { describe, expect, it, vi } from 'vitest';
const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('../supabaseClient', () => ({ supabase: { rpc, from } }));
vi.mock('./activityLocation.service', () => ({ attachLocationTagsToActivities: async (rows: unknown[]) => rows }));
import { fetchFeedPage, fetchCalendarActivities } from './activities.service';

describe('Journal route loading', () => {
  it('loads routes for manual preset activities as well as imports', async () => {
    rpc.mockResolvedValue({ data: [
      { id: 'manual', entry_kind: 'activity', source: 'manual' },
      { id: 'import', entry_kind: 'activity', source: 'polar' },
      { id: 'note', entry_kind: 'journal_entry' },
    ], error: null });
    const include = vi.fn().mockResolvedValue({ data: [
      { id: 'manual', route_polyline: 'preset-route', import_status: 'ready' },
      { id: 'import', route_polyline: 'import-route', import_status: 'ready' },
    ], error: null });
    from.mockReturnValue({ select: vi.fn().mockReturnValue({ in: include }) });
    const result = await fetchFeedPage(20);
    expect(include).toHaveBeenCalledWith('id', ['manual', 'import']);
    expect(result.data[0]).toMatchObject({ source: 'manual', route_polyline: 'preset-route' });
    expect(result.data[1]).toMatchObject({ source: 'polar', route_polyline: 'import-route' });
    expect(result.data[2].entry_kind).toBe('journal_entry');
  });
});

it('loads complete Calendar months beyond the default limit with stable ownership and ordering',async()=>{
  const records=Array.from({length:1001},(_,i)=>({id:String(i)}));
  const q={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),gte:vi.fn().mockReturnThis(),lt:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),range:vi.fn(async(start:number,end:number)=>({data:records.slice(start,end+1),error:null}))};
  from.mockReturnValue(q);
  const result=await fetchCalendarActivities('owner','2024-10-01','2024-11-01');
  expect(result.data).toHaveLength(1001);expect(q.range.mock.calls).toEqual([[0,499],[500,999],[1000,1499]]);
  expect(q.eq).toHaveBeenCalledWith('user_id','owner');expect(q.order).toHaveBeenCalledWith('id',{ascending:true});
});
