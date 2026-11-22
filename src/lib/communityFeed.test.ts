import {expect,it} from 'vitest';
import {buildCommunityFeed} from './communityFeed';
import type {Challenge,SocialActivity} from '../services/social.service';
const activity=(id:string,date:string)=>({id,shared_at:date} as SocialActivity);
const challenge=(id:string,date:string,state='closed')=>({id,closed_at:date,state} as Challenge);
it('places closed challenges among activities using closure date, without pinning active challenges',()=>{
 const entries=buildCommunityFeed([activity('new','2026-11-05'),activity('old','2026-11-01')],[challenge('archive','2026-11-03'),challenge('active','2026-11-06','active')],false);
 expect(entries.map(e=>e.kind==='activity'?e.activity.id:e.challenge.id)).toEqual(['new','archive','old']);
});
it('keeps older archives behind unloaded activity pages and reveals them at the end',()=>{
 const activities=[activity('recent','2026-11-05')],archives=[challenge('old','2026-10-01')];
 expect(buildCommunityFeed(activities,archives,true)).toHaveLength(1);
 expect(buildCommunityFeed(activities,archives,false)).toHaveLength(2);
 expect(buildCommunityFeed([],archives,false)).toHaveLength(1);
});
