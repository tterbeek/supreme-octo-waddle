import { useCallback,useEffect,useRef,useState } from 'react';
import { Link,useLocation,useSearchParams } from 'react-router-dom';
import { IconDotsVertical,IconPlus,IconChevronRight } from '@tabler/icons-react';
import FormPage from '../components/forms/FormPage';
import { socialHome,socialFeed,socialChallenges,type SocialHome,type SocialActivity,type Challenge } from '../services/social.service';
import { CIRCLE_FILTER,SOCIAL_UPDATED_EVENT } from '../config/social';
import { CIRCLE_ACCESS_UPDATED_EVENT } from '../services/circle.service';
import { supabase } from '../supabaseClient';
import SocialActivityCard from '../components/social/SocialActivityCard';
import SocialProfileReminder from '../components/social/SocialProfileReminder';
import SocialConversation from '../components/social/SocialConversation';
import OwnSocialComments from '../components/social/OwnSocialComments';
import ChallengeCard from '../components/social/ChallengeCard';
import ChallengePreview from '../components/social/ChallengePreview';
import CommunitySettings from '../components/social/CommunitySettings';
import { SocialRuleSheet,CommunityForm,ChallengeForm } from '../components/social/SocialForms';
import { ruleLabel } from '../lib/social';
import { allowFormNavigation } from '../lib/formLifecycle';

export default function SocialPage() {
 const [params,setParams]=useSearchParams();const audience=params.get('audience')||undefined;
 const {pathname}=useLocation();const configure=params.get('configure')==='true';
 const [ownComments,setOwnComments]=useState(false);const [menuOpen,setMenuOpen]=useState(false);const menu=useRef<HTMLDivElement>(null);const menuButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!menuOpen)return;menu.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus();const outside=(event:PointerEvent)=>{if(!menu.current?.contains(event.target as Node))setMenuOpen(false);};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setMenuOpen(false);menuButton.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[menuOpen]);
 const [home,setHome]=useState<SocialHome|null>(null);const [feed,setFeed]=useState<SocialActivity[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [more,setMore]=useState(false);const [loadingMore,setLoadingMore]=useState(false);const [version,setVersion]=useState(0);
 const [uid,setUid]=useState('');const [rule,setRule]=useState<string|null>(null);const [create,setCreate]=useState(false);const [settings,setSettings]=useState<string|null>(null);const [challengeForm,setChallengeForm]=useState(false);const [challenges,setChallenges]=useState<Challenge[]>([]);const [editingChallenge,setEditingChallenge]=useState<Challenge|null>(null);const [detail,setDetail]=useState<SocialActivity|null>(null);
 const activityId=params.get('activity');
 const loadedPages=useRef(1);const selection=useRef(audience);selection.current=audience;
 const refresh=useCallback(()=>setVersion(n=>n+1),[]);
 useEffect(()=>{loadedPages.current=1;setFeed([]);},[audience]);
 useEffect(()=>{let cancel=false;setLoading(true);setError('');const readFeed=async()=>{let rows=await socialFeed(audience);let hasMore=rows.length===30;for(let page=1;page<loadedPages.current&&hasMore;page++){const older=await socialFeed(audience,rows.at(-1));rows=[...rows,...older];hasMore=older.length===30;}return {rows,hasMore};};void Promise.all([socialHome(),readFeed(),supabase.auth.getUser()]).then(([h,f,a])=>{if(cancel)return;setHome(h);setFeed(f.rows);setMore(f.hasMore);setUid(a.data.user?.id||'');setLoading(false);}).catch(e=>{if(!cancel){setError(e.message);setLoading(false);}});return()=>{cancel=true;};},[audience,version]);
 useEffect(()=>{const update=()=>refresh();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')refresh();},30_000);window.addEventListener(SOCIAL_UPDATED_EVENT,update);window.addEventListener(CIRCLE_ACCESS_UPDATED_EVENT,update);const {data}=supabase.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'||event==='SIGNED_IN'){setHome(null);setFeed([]);setDetail(null);setChallenges([]);refresh();}});return()=>{window.clearInterval(timer);window.removeEventListener(SOCIAL_UPDATED_EVENT,update);window.removeEventListener(CIRCLE_ACCESS_UPDATED_EVENT,update);data.subscription.unsubscribe();};},[refresh]);
 const selectedAudience=home?.audiences?.find(a=>a.id===audience);
 const community=selectedAudience?.community_id;
 const [challengeIndicators,setChallengeIndicators]=useState<{audience:string;communityName:string;challenge:Challenge}[]>([]);
 const [showAllChallenges,setShowAllChallenges]=useState(false);
 useEffect(()=>{
  let cancel=false;
  setChallengeIndicators([]);
  if(!audience&&home?.enabled){
   const communities=home.audiences.filter(a=>a.kind==='community'&&a.community_id);
   void Promise.all(communities.map(async a=>{
    try{
     const items=await socialChallenges(a.community_id!);
     return items.filter(ch=>ch.state==='active'||ch.state==='upcoming').map(challenge=>({audience:a.id,communityName:a.name,challenge}));
    }catch{return [];}
   })).then(items=>{if(!cancel)setChallengeIndicators(items.flat());});
  }
  return()=>{cancel=true;};
 },[audience,home]);
 useEffect(()=>{let cancel=false;setChallenges([]);if(community)void socialChallenges(community).then(value=>{if(!cancel)setChallenges(value);}).catch(e=>{if(!cancel)setError(e.message);});return()=>{cancel=true;};},[community,version]);
 useEffect(()=>{let cancel=false;setDetail(previous=>previous?.id===activityId?previous:null);if(activityId)void socialFeed(undefined,undefined,activityId).then(value=>{if(!cancel){setDetail(value[0]||null);if(!value.length)setError('Shared activity unavailable. Access may have changed.');}}).catch(()=>{if(!cancel)setError('Shared activity unavailable.');});return()=>{cancel=true;};},[activityId,version]);
 const openConversation=(activity:string)=>{const next=new URLSearchParams(params);next.set('activity',activity);next.delete('context');setParams(next,{state:{socialOpened:true}});};
 const closeConversation=()=>{const next=new URLSearchParams(params);next.delete('activity');next.delete('context');setParams(next,{replace:true});};
 const loadMore=async()=>{if(!feed.length||loadingMore)return;setLoadingMore(true);try{const data=await socialFeed(audience,feed.at(-1));if(selection.current!==audience)return;loadedPages.current++;setFeed(prev=>{const ids=new Set(prev.map(a=>a.id));return [...prev,...data.filter(a=>!ids.has(a.id))];});setMore(data.length===30);}catch(e){if(selection.current===audience)setError((e as Error).message);}finally{setLoadingMore(false);}};

 if(loading&&!home)return <p role="status" className="py-10">Opening Circle and Communities…</p>;
 return <div className="py-3 space-y-5">
  {configure?<FormPage title="Configure Circle & Communities" backTo={`${pathname}${audience?`?audience=${encodeURIComponent(audience)}`:''}`}>
   {error&&<div role="alert" className="rounded-xl border p-4"><p>{error}</p><button className="min-h-11 underline" onClick={refresh}>Retry</button></div>}
   {home&&!home.enabled&&<p>The new sharing experience is not enabled in this environment yet.</p>}
   {home?.enabled&&<>
    <Link className="inline-block min-h-11 py-3 underline text-sm" to="/settings/circle">Manage Circle connections</Link>
    <button className="block min-h-11 underline text-sm" onClick={()=>setOwnComments(true)}>Your comments</button>
    {home.audiences.map(a=><section key={a.id} className="rounded-xl border p-4 space-y-2">
     <h2 className="font-semibold break-words">{a.name}</h2>
     <p className="text-sm">Sharing here: {ruleLabel(a)} · <button className="min-h-11 underline" onClick={()=>setRule(a.id)}>Change</button></p>
     {a.description&&<p className="text-sm whitespace-pre-wrap break-words">{a.description}</p>}
     {a.community_id&&<button className="min-h-11 underline text-sm" onClick={()=>setSettings(a.community_id)}>Community settings and QR invite</button>}
    </section>)}
   </>}
  </FormPage>:<>
  <header className="flex items-center justify-between gap-3">
   <h1 className="text-2xl font-semibold">Circle &amp; Communities</h1>
   <div className="relative shrink-0" ref={menu} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setMenuOpen(false);}}>
    <button type="button" ref={menuButton} aria-label="Circle and Communities actions" aria-haspopup="menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(open=>!open)} className="p-3 rounded-full text-gray-500 hover:bg-white/50"><IconDotsVertical size={18}/></button>
    {menuOpen&&<div role="menu" aria-label="Circle and Communities actions" className="absolute right-0 top-full z-20 min-w-40 rounded-xl border border-warm-200 bg-movenotes-bg p-1 shadow-lg">
     <button type="button" role="menuitem" className="w-full rounded-lg px-4 py-3 text-left text-sm hover:bg-white/50" onClick={()=>{setMenuOpen(false);const next=new URLSearchParams(params);next.set('configure','true');setParams(next);}}>Configure</button>
    </div>}
   </div>
  </header>
  {error&&<div role="alert" className="rounded-xl border p-4"><p>{error}</p><button className="min-h-11 underline" onClick={refresh}>Retry</button></div>}
  {home&&!home.enabled?<p>The new sharing experience is not enabled in this environment yet.</p>:home&&<>
   <nav aria-label="Social feed audience" className="flex flex-wrap items-center gap-2">{[{id:'',name:'All'},{id:CIRCLE_FILTER,name:'Circle'},...(home.audiences||[]).filter(a=>a.kind==='community')].map(a=><button type="button" key={a.id} aria-pressed={(audience||'')===a.id} className={`min-h-11 max-w-full rounded-full border px-4 text-sm [overflow-wrap:anywhere] ${(audience||'')===a.id?'bg-movenotes-primary/15':''}`} onClick={()=>{const next=new URLSearchParams();if(a.id)next.set('audience',a.id);setParams(next);}}>{a.name}</button>)}<button type="button" aria-label="Create Community" title="Create Community" className="flex min-h-11 min-w-11 items-center justify-center rounded-full border px-3 text-movenotes-muted hover:bg-white/50" onClick={()=>setCreate(true)}><IconPlus size={18}/></button></nav>
   <SocialProfileReminder userId={uid} hasCommunity={home.audiences.some(a=>a.kind==='community')}/>
   {!audience&&challengeIndicators.length>0&&<section aria-label="Community challenges" className="space-y-3">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Challenges</h2>{challengeIndicators.length>1&&<button type="button" aria-expanded={showAllChallenges} onClick={()=>setShowAllChallenges(value=>!value)} className="inline-flex min-h-11 items-center gap-1 text-sm text-movenotes-primary">{showAllChallenges?'Show less':'View all'}<IconChevronRight size={18} aria-hidden="true"/></button>}</div>
    {(showAllChallenges?challengeIndicators:challengeIndicators.slice(0,1)).map(({audience:target,communityName,challenge})=><ChallengePreview key={challenge.id} challenge={challenge} communityName={communityName} onOpen={()=>setParams({audience:target})}/>)}
   </section>}
   {community&&<section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Our challenges</h2>{selectedAudience?.role!=='member'&&<button type="button" aria-label="Create challenge" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-movenotes-primary px-4 py-2 text-sm text-movenotes-primary" onClick={()=>setChallengeForm(true)}><IconPlus size={20}/><span className="sm:hidden">Create</span><span className="hidden sm:inline">Create challenge</span></button>}</div>
    {!challenges.length&&<p className="text-sm text-movenotes-muted">No challenges yet.</p>}
    {challenges.map(ch=><ChallengeCard key={ch.id} challenge={ch} community={community} canManage={selectedAudience?.role!=='member'} onUpdate={()=>setEditingChallenge(ch)} onChanged={refresh}/>)}
   </section>}
   {!feed.length&&!loading&&<p className="rounded-xl border p-5 text-sm">Nothing shared here yet. Your Journal stays private until you choose to share.</p>}
   <div className="space-y-4">{feed.map(a=><SocialActivityCard key={a.id} activity={a} viewerId={uid} onConversation={()=>openConversation(a.id)}/>)}</div>
   {more&&<button className="min-h-11 w-full rounded-full border" disabled={loadingMore} onClick={()=>void loadMore()}>{loadingMore?'Loading…':'Older activities'}</button>}
  </>}
  </>}
  {ownComments&&<OwnSocialComments onClose={()=>setOwnComments(false)}/>}
  {rule&&home?.audiences.find(a=>a.id===rule)&&<SocialRuleSheet audience={home.audiences.find(a=>a.id===rule)!} onClose={()=>setRule(null)} onSaved={refresh}/>}
  {create&&<CommunityForm onClose={()=>setCreate(false)} onSaved={id=>{refresh();void socialHome().then(h=>{setHome(h);const a=h.audiences.find(a=>a.community_id===id);if(a)allowFormNavigation(()=>setParams({audience:a.id}));setSettings(id);}).catch(e=>setError(e.message));}}/>}
  {settings&&<CommunitySettings id={settings} onClose={()=>setSettings(null)} onChanged={refresh}/>}
  {editingChallenge&&community&&<ChallengeForm community={community} challenge={editingChallenge} onClose={()=>setEditingChallenge(null)} onSaved={refresh}/>}
  {challengeForm&&community&&<ChallengeForm community={community} onClose={()=>setChallengeForm(false)} onSaved={refresh}/>}
  {detail&&activityId&&<SocialConversation activity={detail} moderationCommunity={community&&selectedAudience?.role!=='member'?{id:community,name:selectedAudience!.name}:undefined} viewerId={uid} onClose={closeConversation} onChanged={refresh}/>}
 </div>;
}
