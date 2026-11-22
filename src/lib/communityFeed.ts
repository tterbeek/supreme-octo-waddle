import type { Challenge, SocialActivity } from '../services/social.service';
type Entry={kind:'activity';activity:SocialActivity}|{kind:'challenge';challenge:Challenge};
export function buildCommunityFeed(activities:SocialActivity[],challenges:Challenge[],hasMore:boolean):Entry[]{
 const oldest=activities.length?Math.min(...activities.map(a=>Date.parse(a.shared_at))):Infinity;
 const entries:{entry:Entry;date:number;key:string}[]=activities.map(activity=>({entry:{kind:'activity',activity},date:Date.parse(activity.shared_at),key:'activity-'+activity.id}));
 for(const challenge of challenges){
  if(challenge.state!=='closed'||!challenge.closed_at)continue;
  const date=Date.parse(challenge.closed_at);
  if(!Number.isFinite(date)||(hasMore&&date<oldest))continue;
  entries.push({entry:{kind:'challenge',challenge},date,key:'challenge-'+challenge.id});
 }
 return entries.sort((a,b)=>b.date-a.date||a.key.localeCompare(b.key)).map(e=>e.entry);
}
