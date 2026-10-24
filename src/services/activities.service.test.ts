import { expect,it,vi } from 'vitest';
const mock=vi.hoisted(()=>({from:vi.fn()}));
vi.mock('../supabaseClient',()=>({supabase:{from:mock.from}}));
import { fetchCalendarActivities } from './activities.service';
it('loads complete Calendar months beyond the default limit with stable ownership and ordering',async()=>{
  const records=Array.from({length:1001},(_,i)=>({id:String(i)}));
  const q={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),gte:vi.fn().mockReturnThis(),lt:vi.fn().mockReturnThis(),order:vi.fn().mockReturnThis(),range:vi.fn(async(start:number,end:number)=>({data:records.slice(start,end+1),error:null}))};
  mock.from.mockReturnValue(q);
  const result=await fetchCalendarActivities('owner','2024-10-01','2024-11-01');
  expect(result.data).toHaveLength(1001);expect(q.range.mock.calls).toEqual([[0,499],[500,999],[1000,1499]]);
  expect(q.eq).toHaveBeenCalledWith('user_id','owner');expect(q.order).toHaveBeenCalledWith('id',{ascending:true});
});
