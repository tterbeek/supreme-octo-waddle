import {beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({getUser:vi.fn(),from:vi.fn(),rpc:vi.fn()}));
vi.mock('../supabaseClient',()=>({supabase:{auth:{getUser:mocks.getUser},from:mocks.from,rpc:mocks.rpc}}));
import {loadMemory,memoryNeighbors,memoryPage} from './memories.service';
beforeEach(()=>vi.resetAllMocks());
it('authenticates before direct reader access',async()=>{
 mocks.getUser.mockResolvedValue({data:{user:null}});
 await expect(loadMemory('other')).rejects.toThrow('sign in');expect(mocks.from).not.toHaveBeenCalled();
});
it('requires exact activity owner, retains original content and performs no writes',async()=>{
 mocks.getUser.mockResolvedValue({data:{user:{id:'owner'}}});
 const record={id:'a',notes:'Full\noriginal words',photos:[]};
 const q={select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:record,error:null})};mocks.from.mockReturnValue(q);
 expect(await loadMemory('a')).toEqual(record);expect(q.eq.mock.calls).toEqual([['user_id','owner'],['id','a']]);
});
it('uses value cursor across pages rather than depending on a surviving last record',async()=>{
 mocks.rpc.mockResolvedValue({data:[],error:null});
 await memoryPage('2024-01-01','2024-02-01',{id:'deleted',date:'2024-01-10',created_at:null} as never);
 expect(mocks.rpc).toHaveBeenCalledWith('memory_page',{p_start:'2024-01-01',p_end:'2024-02-01',p_before:{id:'deleted',date:'2024-01-10',created_at:null}});
});
it('direct URL requires no preloaded collection and query errors stay distinct from empty',async()=>{
 expect(await memoryNeighbors('a',{})).toEqual({});expect(mocks.rpc).not.toHaveBeenCalled();
 mocks.rpc.mockResolvedValue({data:null,error:new Error('network')});
 await expect(memoryPage('2024-01-01','2024-02-01')).rejects.toThrow('network');
});
