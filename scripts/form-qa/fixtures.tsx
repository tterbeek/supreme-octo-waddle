import SwipeActions from "../../src/components/SwipeActions";
import PullToRefresh from "../../src/components/PullToRefresh";
import { syncPolarIfStale, POLAR_PULL_COOLDOWN_MS } from "../../src/services/polar.service";
import { useActivityImports } from "../../src/hooks/useActivityImports";
import ImportingActivityCard from "../../src/components/ImportingActivityCard";
// Dev-only fictional fixtures. Not imported by the app or included in dist.
import { useState } from "react";
import RecentActivityCard from "../../src/components/RecentActivityCard";
import { encodeRoute } from "../../supabase/functions/_shared/activityRoute";
import TrendsTab from "../../src/components/stats/TrendsTab";
import { useActivityTrends, type TrendPeriod } from "../../src/hooks/useActivityTrends";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../src/supabaseClient";
import { UnitContext } from "../../src/contexts/UnitContext";
import FormNavigationGuard from "../../src/components/forms/FormNavigationGuard";
import { allowFormNavigation } from "../../src/lib/formLifecycle";
import AddActivityForm from "../../src/features/activities/AddActivityForm";
import EditActivityModal from "../../src/features/activities/EditActivityModal";
import AddNoteModal from "../../src/components/AddNoteModal";
import JournalEntryModal from "../../src/components/JournalEntryModal";
import AddPresetModal from "../../src/features/presets/AddPresetModal";
import EditPresetModal from "../../src/features/presets/EditPresetModal";
import AddPresetPage from "../../src/pages/AddPresetPage";
import EquipmentFormSheet from "../../src/components/EquipmentFormSheet";
import EquipmentDialog from "../../src/components/EquipmentDialog";
import ManageEquipmentPage from "../../src/pages/ManageEquipmentPage";
import AddGoalModal from "../../src/components/AddGoalModal";
import EditGoalModal from "../../src/components/EditGoalModal";
import DirectionAddModal from "../../src/components/DirectionAddModal";
import GoalDirectionSheet from "../../src/components/GoalDirectionSheet";
import MicroAdjustmentCreateModal from "../../src/components/MicroAdjustmentCreateModal";
import TinyTweakStrip from "../../src/components/TinyTweakStrip";
import WeeklyCompanionCard from "../../src/components/WeeklyCompanionCard";
import CompanionSettings from "../../src/components/CompanionSettings";
import AdminWeeklyCompanion from "../../src/components/AdminWeeklyCompanion";
import SettingsPage from "../../src/pages/SettingsPage";
import ActivityPreferencesPage from "../../src/pages/ActivityPreferencesPage";
import ManageCirclePage from "../../src/pages/ManageCirclePage";
import ProfileSettingsPage from "../../src/pages/ProfileSettingsPage";
import CircleInvitePage from "../../src/pages/CircleInvitePage";
import ConnectionsPage from "../../src/pages/ConnectionsPage";
import PolarCallbackPage from "../../src/pages/PolarCallbackPage";
import StravaCallbackPage from "../../src/pages/StravaCallbackPage";
import Login from "../../src/pages/Login";
import Signup from "../../src/pages/Signup";
import OnboardingWizard from "../../src/components/OnboardingWizard";
import OnboardingCarousel from "../../src/components/OnboardingCarousel";
import AddBottomSheet from "../../src/components/AddBottomSheet";
import { SelectActivityTypeModal } from "../../src/components/SelectActivityTypeModal";
import Sidebar from "../../src/components/Sidebar";
import GalleryLightbox from "../../src/components/GalleryLightbox";
import ActivityImageSheet from "../../src/components/ActivityImageSheet";
import SocialPage from '../../src/pages/SocialPage';
import CommunityJoinPage from '../../src/pages/CommunityJoinPage';
import ActivitySharingSheet from '../../src/components/social/ActivitySharingSheet';
import MemoriesPage from '../../src/pages/MemoriesPage';
import MemoryReader from '../../src/components/MemoryReader';
import CalendarPage from '../../src/pages/CalendarPage';
import PhotosPage from '../../src/pages/PhotosPage';
import Layout from '../../src/components/Layout';
import "../../src/index.css";

const qa = (window as any).formQA = { fail: false, delay: 0, writes: [], invocations: [], saved: 0, closed: 0, case: "", network: [], select: (_name: string) => {} };
const originalFetch = window.fetch;
window.fetch = (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes("supabase") || url.includes(":54321")) { qa.network.push(url); return Promise.reject(new Error("QA blocks all Supabase network requests")); }
  return originalFetch(input, init);
};
const user = { id: "fictional-owner", email: "fictional@example.invalid", email_confirmed_at: "2026-10-01" };
const socialAudiences:any[]=[{id:'circle-owner',kind:'circle',name:'Circle',community_id:null,role:null,mode:'manual',types:[]},{id:'audience-community',kind:'community',name:'Brussels Runners',community_id:'community-one',role:'owner',mode:'manual',types:[],description:'A closed group for gentle movement.'}];
const socialSharing:any={private:false,public_note:'',legacy_photo:false,has_legacy_photo:false,photos:[],audiences:[{id:'circle-owner',name:'Circle',shared:false},{id:'audience-community',name:'Brussels Runners',shared:false}]};
const socialRows:any[]=[{id:'social-activity',date:'2026-10-25',shared_at:'2026-10-25T09:00:00Z',author_id:'fictional-friend',author:'Fictional friend',title:'A morning walk',type:'walk',distance_km:4,duration_min:45,public_note:'Some shared words.',photos:[],contexts:[{id:'circle-context',audience:'circle-owner',kind:'circle',community:null,name:'Circle'},{id:'community-context',audience:'audience-community',kind:'community',community:'community-one',name:'Brussels Runners'}]}];
const socialComments:any={'social-activity':[{id:'thread-comment',author_id:'fictional-friend',author:'Fictional friend',body:'One shared conversation',created_at:'2026-10-25T09:00:00Z',can_delete:false,has_avatar:true}]};
const socialReactions:Record<string,string|null>={};const fixtureChallenges:any[]=[];
qa.setChallengeTotal=(total:number)=>{fixtureChallenges[0].total=total;};
qa.setChallengeDemo=()=>{qa.challengeDemo=true;if(!socialRows[0].contexts.some((c:any)=>c.community==='community-one'))socialRows[0].contexts.push({id:'community-context',audience:'audience-community',kind:'community',community:'community-one',name:'Brussels Runners'});fixtureChallenges.length=0;fixtureChallenges.push({id:'challenge-demo',title:'Around the world together',metric:'distance',target:10,scope:'collective',types:['walk','run','ride'],starts_on:'2026-10-19',ends_on:'2026-11-02',time_zone:'Europe/Brussels',state:'active',total:16,mine:4,has_cover:true,cover_updated_at:'2026-10-26T10:00:00Z'});};
qa.setCardOwner=(owner:boolean)=>{socialRows[0].author_id=owner?user.id:'fictional-friend';};
qa.setCardDemo=(orientation:string,total=8,photoCount=1)=>{
 Object.assign(socialRows[0],{title:'Morning run Woluwe-Saint-Lambert',type:'run',distance_km:5,duration_min:33,public_note:'A quiet morning in the park. Lovely light through the trees.',photos:Array.from({length:photoCount},(_,i)=>({id:'qa-'+orientation+(i?'-'+i:''),order:i}))});
 socialComments['social-activity']=Array.from({length:total},(_,i)=>({id:'demo-comment-'+i,author_id:'demo-author-'+i,author:['Emma','Ben','Alex'][i%3],body:'A shared moment '+(i+1),created_at:new Date(Date.now()-(8-i)*3600_000).toISOString(),can_delete:false}));
};
const activity: any = { id: "fictional-activity", user_id: user.id, title: "A gentle morning walk", type: "walk", date: "2026-10-17", distance_km: 4, duration_min: 45, notes: "A private note that must be kept.", feeling_during: "smile", feeling_after: "happy", effort: 2, source: "manual", activity_equipment: [] };
const memoryContext={start:'2024-10-01',end:'2024-11-01'};
const memoryRows=Array.from({length:45},(_,i)=>({...activity,id:`memory-${i}`,created_at:`2024-10-24T12:00:${String(59-i).padStart(2,'0')}`,date:'2024-10-24',title:i===1?'Polar walk':i===2?'A feeling remembered':i===3?'A photo without a note':`An October walk ${i+1}`,
 notes:i===0?'We took the quieter path.\n\nThere was time to stop and talk.\n'+('These are my original words. '.repeat(40)):i===1||i===2||i===3||i>=35?null:activity.notes,
 feeling_during:i===1||i===3||i>=35?null:'smile',feeling_after:i===1||i===3||i>=35?null:'happy',effort:i===1||i===3?null:2,distance_km:i===1?null:4,duration_min:i===1?null:45,
 source:i===1?'polar':'manual',photos:i===0||i===3?[1,2].map(n=>({id:`photo-${n}`,image_path:`fictional-owner/memory-${n}.svg`,thumb_path:`fictional-owner/memory-thumb-${n}.svg`,sort_order:n,created_at:'2024-10-24'})):[]}));
let memoryHidden=false;
const olderMemory={...activity,id:'memory-older',date:'2023-06-10',created_at:'2023-06-10T12:00:00',notes:null,photos:[],feeling_during:null,feeling_after:null};
function fixtureSelected(rows: typeof memoryRows) {
  const personal=rows.filter(r=>r.notes?.trim()||r.photos?.length);
  const details=rows.filter(r=>!personal.includes(r)&&(r.feeling_during||r.feeling_after));
  const basic=rows.filter(r=>!personal.includes(r)&&!details.includes(r));
  const ids=new Set([...personal,...details.slice(0,1),...basic.slice(0,1)].map(r=>r.id));
  return rows.filter(r=>ids.has(r.id));
}
const equipment: any[] = Array.from({ length: 45 }, (_, i) => ({ id: `equipment-${i}`, user_id: user.id, name: i === 0 ? "Walking shoes" : `Fictional equipment ${i + 1}`, notes: "A remembered detail.", is_active: true, created_at: "2026-01-01" }));
const presets: any[] = Array.from({ length: 18 }, (_, i) => ({ id: `preset-${i}`, user_id: user.id, name: `Gentle walk ${i + 1}`, type: "walk", distance_km: 4, duration_min: 45, effort: 2, equipment_ids: [], preset_equipment: [] }));
const goal: any = { id: "goal", user_id: user.id, activity_type: "walk", metric: "distance", target: 10, period: "week", name: "Room to move", updated_at: "2026-10-17" };
const tweak = { id: "tweak", text: "Leave room for a short walk", started_at: "2026-10-01", ended_at: "2026-10-10", end_flow_state: "prompt_reflection" };
const post: any = { id: "post", generated_at: "2026-10-12T07:00:00.123456+00:00", week_start: "2026-10-05", week_end: "2026-10-11", status: "ready", thought: "The running Direction you said mattered to you can sit alongside the way these outings felt. Reaching the distance you chose does not have to tell the whole story of the week.\n\nThere may be room to notice what that goal gave you, without making the next run a test of doing more. What part felt worth carrying with you?", user_reflection: "", sources: [{ kind: "direction", label: "Direction", detail: "20 distance per week\nComputed progress: 30.4 / 20 km · 0 km remaining\nPeriod: 2026-10-05–2026-10-11 · as of 2026-10-11" }], includes_activity_notes: false };
const rows: Record<string, any[]> = {
  activities: [activity], equipment, presets, goals: [goal], activity_equipment: [], preset_equipment: [], activity_photos: [], activity_preferences: [],
  user_activity_types: ["walk", "run", "ride", "yoga"].map((activity_type, i) => ({ user_id: user.id, activity_type, is_enabled: true, sort_order: i * 10 })),
  user_preferences: [{ user_id: user.id, social_display_name: "Fictional mover", login_email: user.email, unit_system: "metric" }],
  companion_preferences: [{ user_id: user.id, enabled: false, allow_activity_notes: false, time_zone: "Europe/Brussels" }],
  journal_entries: [], micro_adjustments: [], user_strava_connections: [], circle_connections: [],
  companion_feedback: [],
};
const wait = () => new Promise(resolve => setTimeout(resolve, qa.delay));
qa.setSocialProfile = (name:string,accepted:number,community=true,photo=false) => {
  rows.user_preferences[0].social_display_name=name;
  rows.user_preferences[0].social_profile_image_path=photo?'fictional-owner/profile.jpg':null;
  rows.user_connections=Array.from({length:accepted},()=>({status:'accepted',requester_user_id:user.id,addressee_user_id:'fictional-friend'}));
  qa.profileNoCommunity=!community;
};
const auth: any = supabase.auth;
auth.getUser = async () => ({ data: { user: (qa as any).signedOut?null:qa.case === "admin-weekly" ? { ...user, email: "me@thijsterbeek.com" } : user }, error: null });
auth.getSession = async () => ({ data: { session: { user, access_token: "fictional-not-a-token" } }, error: null });
auth.onAuthStateChange = () => ({ data: { subscription: { unsubscribe() {} } } });
auth.signInWithOtp = async () => { await wait(); return { error: qa.fail ? { message: "Simulated auth error" } : null }; };
auth.verifyOtp = async () => { await wait(); return { data: { session: { user }, user }, error: qa.fail ? { message: "Simulated auth error" } : null }; };
(supabase as any).from = (table: string) => {
  let op = "read"; let payload: any; let filters: any[] = []; const ranges: Array<[string,string,unknown]> = []; let selection = "";
  const result = async (single = false) => {
    if (op !== "read") { qa.writes.push({ table, op, payload, filters }); await wait(); }
    if (op !== "read" && qa.fail) return { data: null, error: { message: "Simulated save error" }, count: 0 };
    let data = rows[table] || [];
    if (qa.case.startsWith('import-') && table === 'activities') data = qa.importRows ?? [];
    if(qa.case.startsWith('share-map') && table==='activities') data=[{...activity,source:qa.case==='share-map-none'?'manual':'polar',
      route_polyline:['share-map-none','share-map-legacy'].includes(qa.case)?null:encodeRoute(qa.case==='share-map-short'?[[50.83,4.43],[50.831,4.43]]:[[50.83,4.43],[50.85,4.43],[50.85,4.46],[50.87,4.46]]),
      route_checked_at:qa.case==='share-map-legacy'?null:new Date().toISOString()}];
    if(qa.case.startsWith('share-map') && table==='activities')qa.shareSourceRoute=data[0].route_polyline;
    if(qa.case.startsWith('share-map') && table==='activity_photos') data=[{id:'share-photo',image_path:'share-photo.jpg',thumb_path:'share-photo-thumb.jpg',sort_order:0,created_at:'2026-10-28'}];
    if(qa.case.startsWith('memor')&&table==='activities') {
      data=[...memoryRows,olderMemory].filter(row=>filters.every(([key,value])=>row[key as keyof typeof row]===value)&&ranges.every(([op,key,value])=>op==='gte'?String(row[key as keyof typeof row])>=String(value):op==='lt'?String(row[key as keyof typeof row])<String(value):true));
      if(qa.case==='memories-missing')data=[];
      if(qa.fail||qa.case==='memories-error')return {data:null,error:{message:'Fictional fetch failure'}};
      if(op==='update')data.forEach(row=>Object.assign(row,payload));
      if(op==='delete')data.forEach(row=>{const index=memoryRows.indexOf(row);if(index>=0)memoryRows.splice(index,1);});
    }
    if(table==="user_preferences"&&op!=="read"){Object.assign(rows.user_preferences[0],payload);data=rows.user_preferences;}
    if (table === "companion_feedback") {
      data = data.filter(row => filters.every(([key, value]) => row[key] === value));
      if (op === "delete") rows[table] = rows[table].filter(row => !data.includes(row));
      return { data: single ? data[0] || null : data, error: null };
    }
    if (qa.case === 'pull-refresh' && table === 'micro_adjustments' && filters.some(([key,value])=>key==='status'&&value==='active')) data=[{id:'pull-tweak',text:'Leave room for a short walk',started_at:new Date().toISOString()}];
    if (table === "micro_adjustments" && filters.some(([key, value]) => key === "status" && value === "ended")) data = [tweak];
    if (table === "activities" && selection === "id"&&!qa.case.startsWith('memories')) data = [];
    if (op !== "read") data = [{ ...(data[0] || {}), ...(Array.isArray(payload) ? payload[0] : payload), id: data[0]?.id || "fictional-saved" }];
    return { data: single ? data[0] || null : data, error: null, count: 0 };
  };
  const q: any = {};
  q.select = (value = "*") => { selection = value; return q; };
  q.eq = (key: string, value: unknown) => { filters.push([key, value]); return q; };
  for (const method of ["insert", "update", "upsert", "delete"]) q[method] = (value: unknown) => { op = method; payload = value; return q; };
  for (const method of ["order", "limit", "gte", "lte", "gt", "lt", "in", "is", "not", "or", "range", "neq"]) q[method] = () => q;
  if(qa.case.startsWith('memories'))for(const op of ['gte','lt'])q[op]=(key:string,value:unknown)=>{ranges.push([op,key,value]);return q;};
  q.single = q.maybeSingle = () => result(true);
  q.then = (resolve: any, reject: any) => result().then(resolve, reject);
  return q;
};
(supabase as any).rpc = async (name: string, args: any) => {
  if(name==='stats_activity_trends'){
    const period=args.p_period;qa.invocations.push({name,options:args});await wait();
    if(qa.fail)return {data:null,error:{message:'Simulated trends error'}};
    if(qa.trendEmpty)return {data:[],error:null};
    const dates=period==='year'?['2020-01-01','2023-01-01','2026-01-01']:period==='month'?['2026-01-01','2026-03-01','2026-10-01']:['2026-10-05','2026-10-12','2026-10-19'];
    return {data:dates.map((period_start,i)=>({activity_type:'run',period_start,distance_value:10+i,duration_value:30+i})),error:null};
  }
  if(name.startsWith('social_')){
    if(qa.socialReadDelay)await new Promise(resolve=>setTimeout(resolve,qa.socialReadDelay));
    if(qa.fail)return {data:null,error:{message:'Simulated social error'}};
    const read=name==='social_home'||name==='social_feed'||name==='social_activity'&&!args.p_change||name==='social_community'&&args.p_action==='get'||name==='social_discussion'&&args.p_action==='read'||name==='social_own_comments'||name==='social_challenges'&&args.p_action==='list'||name==='social_invite'&&['preview','get'].includes(args.p_action);
    if(!read){qa.writes.push({table:name,payload:args});await wait();}
    if(name==='social_home')return {data:{enabled:true,circle:'circle-owner',audiences:qa.profileNoCommunity?socialAudiences.filter(a=>a.kind==='circle'):qa.challengeDemo?socialAudiences.filter(a=>a.kind==='circle'||a.community_id==='community-one'):socialAudiences},error:null};
    if(name==='social_set_rule'){Object.assign(socialAudiences.find(a=>a.id===args.p_audience),{mode:args.p_mode,types:args.p_types});return {data:null,error:null};}
    if(name==='social_activity'){
      const c=args.p_change;if(c){if(c.photos)socialSharing.photos.forEach((p:any)=>p.shared=c.photos.includes(p.id));if(c.private!==undefined)socialSharing.private=c.private;if(c.public_note!==undefined)socialSharing.public_note=c.public_note;if(c.private)socialSharing.audiences.forEach((a:any)=>a.shared=false);for(const a of c.audiences||[])socialSharing.audiences.find((x:any)=>x.id===a.id).shared=a.share;}
      return {data:{...socialSharing,audiences:socialSharing.audiences.map((a:any)=>({...a}))},error:null};
    }
    if(name==='social_feed'&&args.p_activity==='social-owned-activity')return {data:[{...socialRows[0],id:'social-owned-activity',author_id:user.id,author:'You',contexts:[]}],error:null};
    if(name==='social_feed')return {data:socialRows.filter(a=>!args.p_activity||a.id===args.p_activity).map(a=>({...a,comment_count:(socialComments[a.id]||[]).length,reaction_counts:socialReactions[a.id]?[{reaction:socialReactions[a.id],count:1}]:[],contexts:args.p_audience?a.contexts.filter((c:any)=>args.p_audience==='00000000-0000-0000-0000-000000000001'?c.kind==='circle':c.audience===args.p_audience):a.contexts})).filter(a=>a.contexts.length),error:null};
    if(name==='social_community'){
      if(args.p_action==='create'){const id='community-created';if(!socialAudiences.some(a=>a.community_id===id))socialAudiences.push({id:'audience-created',kind:'community',community_id:id,name:args.p_data.name,description:args.p_data.description,role:'owner',mode:'manual',types:[]});return {data:{id},error:null};}
      if(args.p_action==='edit')Object.assign(socialAudiences.find(a=>a.community_id===args.p_id),{name:args.p_data.name,description:args.p_data.description});
      const a=socialAudiences.find(a=>a.community_id===args.p_id)||socialAudiences[1];
      return {data:{id:args.p_id,name:a.name,description:a.description,owner_id:user.id,members:[{id:user.id,name:'Fictional owner',role:'owner'},{id:'member-two',name:'Fictional member',role:'member'}]},error:null};
    }
    if(name==='social_invite'){
      if(args.p_action==='get')return {data:{status:'missing'},error:null};
      if(args.p_action==='rotate')return {data:{token:'a'.repeat(64),expires_at:'2026-11-25'},error:null};
      if(args.p_action==='join'){if(!socialAudiences.some(a=>a.id==='audience-joined'))socialAudiences.push({id:'audience-joined',kind:'community',community_id:'community-joined',name:'Joined Community',role:'member',mode:'manual',types:[]});return {data:{status:'joined',id:'community-joined'},error:null};}
      return {data:{status:'valid',name:'Joined Community',description:'A QR-only closed Community.'},error:null};
    }
    if(name==='social_discussion'){
      const c=args.p_activity;const p=args.p_data||{};socialComments[c]??=[];
      if(args.p_action==='comment')socialComments[c].push({id:'my-comment-'+qa.writes.length,author_id:user.id,author:'You',body:p.body,created_at:new Date().toISOString(),can_delete:true});
      if(args.p_action==='delete_comment')socialComments[c]=socialComments[c].filter((x:any)=>x.id!==p.id);
      if(args.p_action==='reaction')socialReactions[c]=p.reaction;
      if(args.p_action==='block'){socialRows.length=0;return {data:{blocked:true},error:null};}
      return {data:{can_moderate:c==='social-owned-activity',comments:[...socialComments[c]],comment_count:socialComments[c].length,reactions:(socialReactions[c]||qa.otherAppreciation)?[{reaction:'CHEER',count:(socialReactions[c]?1:0)+(qa.otherAppreciation?1:0)}]:[],my_reaction:socialReactions[c]||null,reports:[]},error:null};
    }
    if(name==='social_own_comments')return {data:{comments:(socialComments['social-activity']||[]).filter((c:any)=>c.author_id===user.id).map(({id,body,created_at}:any)=>({id,body,created_at})),has_more:false,before:null},error:null};
    if(name==='social_delete_own_comment'){socialComments['social-activity']=socialComments['social-activity'].filter((c:any)=>c.id!==args.p_id||c.author_id!==user.id);return {data:true,error:null};}
    if(name==='social_remove_community_activity'){for(const a of socialRows)a.contexts=a.contexts.filter((c:any)=>c.community!==args.p_community);return {data:null,error:null};}
    if(name==='social_challenges'){
      if(args.p_action==='create')fixtureChallenges.push({...args.p_data,id:'challenge-new',state:'active',total:0,mine:0,participating:false});
      if(args.p_action==='update')Object.assign(fixtureChallenges.find(c=>c.id===args.p_data.id),args.p_data);
      if(args.p_action==='cancel')fixtureChallenges.find(c=>c.id===args.p_data.id).state='cancelled';
      if(['create','update','cover'].includes(args.p_action)&&'cover_path' in (args.p_data||{})){const challenge=fixtureChallenges.find(c=>c.id===(args.p_data.id||'challenge-new'));challenge.has_cover=!!args.p_data.cover_path;challenge.cover_updated_at=new Date().toISOString();}
      return {data:fixtureChallenges.map(c=>({...c})),error:null};
    }
  }
  if(qa.case.startsWith('memories')&&name==='get_journal_feed_page_v2')return {data:memoryRows.slice(args.p_offset,args.p_offset+args.p_limit).map(row=>({...row,entry_kind:'activity'})),error:null};
  if(name.startsWith('memory_')) {
    if(qa.fail)return {data:null,error:{message:'Fictional Memories failure'}};
    if(name==='memory_archive')return {data:qa.case==='memories-empty'?[]:[{month:'2024-10',count:memoryRows.length,thumbs:['fictional-owner/memory-1.svg','fictional-owner/memory-2.svg']},{month:'2023-06',count:1,thumbs:[]}],error:null};
    if(name==='memory_archive_v2')return {data:qa.case==='memories-empty'?[]:[{month:'2024-10',count:memoryRows.length,selected_count:fixtureSelected(memoryRows).length,personal_count:memoryRows.filter(r=>r.notes||r.photos.length).length,moments:fixtureSelected(memoryRows).slice(0,3),thumbs:['fictional-owner/memory-1.svg','fictional-owner/memory-2.svg']},{month:'2023-06',count:1,selected_count:1,personal_count:0,moments:[olderMemory],thumbs:[]}],error:null};
    if(name==='memory_page_v2'||name==='memory_neighbors_v2') {
      const allRows=args.p_start.startsWith('2023')?[olderMemory]:memoryRows;
      const eligible=args.p_selected?fixtureSelected(allRows as typeof memoryRows):allRows;
      if(name==='memory_page_v2'){const index=args.p_before?eligible.findIndex(r=>r.id===args.p_before.id)+1:0;return {data:eligible.slice(index,index+40),error:null};}
      const i=eligible.findIndex(r=>r.id===args.p_id);return {data:i<0?{}:{earlier:eligible[i+1]?.id,later:eligible[i-1]?.id,position:i+1,total:eligible.length},error:null};
    }
    if(name==='memory_feature')return {data:qa.case==='memories-empty'||qa.case==='memories-recent'?{day:'2026-10-24'}:{day:'2026-10-24',id:memoryHidden?null:'memory-0',tier:0},error:null};
    if(name==='memory_feature_action'){qa.writes.push({table:name,payload:args});if(args.p_hide)memoryHidden=true;return {data:null,error:null};}
    if(name==='memory_page'){const index=args.p_before?memoryRows.findIndex(r=>r.id===args.p_before.id)+1:0;return {data:memoryRows.slice(index,index+40),error:null};}
    if(name==='memory_neighbors'){const i=memoryRows.findIndex(r=>r.id===args.p_id);return {data:{earlier:memoryRows[i+1]?.id,later:memoryRows[i-1]?.id,position:i+1,total:memoryRows.length},error:null};}
  }
  if (name === "save_companion_feedback") {
    qa.writes.push({ table: name, payload: args }); await wait();
    if (qa.fail) return { data: null, error: { message: "Simulated save error" } };
    const previous = rows.companion_feedback.find(row => row.post_id === args.p_post_id && row.output_generated_at === args.p_output_generated_at);
    const value = { post_id: args.p_post_id, output_generated_at: args.p_output_generated_at, rating: args.p_rating,
      comment: args.p_save_comment ? args.p_comment : previous?.comment ?? null, updated_at: new Date().toISOString() };
    rows.companion_feedback = [value];
    return { data: value, error: null };
  }
  if (name.startsWith("set_") || name.startsWith("accept_") || name.startsWith("create_") || name === "delete_companion_post") { qa.writes.push({ table: name, payload: args }); await wait(); if (qa.fail) return { data: null, error: { message: "Simulated save error" } }; }
  const data = name === "has_companion_access" ? true
    : name === "get_circle_invite_preview" ? [{ invite_status: "valid", friendly_name: "Fictional friend", account_email: "friend@example.invalid" }]
    : name.includes("micro_adjustment_suggestions") ? [1, 2, 3].map(id => ({ id: String(id), text: `Make room for a little movement ${id}`, category: "gentle" }))
    : name === "accept_circle_invite" ? "connected" : [];
  return { data, error: null };
};
Object.defineProperty(supabase, "functions", { value: { invoke: async (name: string, options: unknown) => {
  qa.invocations.push({ name, options }); await wait();
  if(qa.case==='pull-refresh' && name==='polar-connection')return {data:{connected:true,last_synced_at:null},error:null};
  if(qa.case==='pull-refresh' && name==='polar-import-activities')return {data:{ok:true,inserted:0},error:qa.fail?{message:'Simulated Polar failure'}:null};
  if(name.endsWith('-import-activities') && qa.case.startsWith('import-')) {
    if(qa.fail)return {data:null,error:{message:'Simulated retry failure'}};
    qa.importRows.forEach((row:any)=>Object.assign(row,{import_status:'processing',import_updated_at:new Date().toISOString()}));
    qa.importNotify?.();
    return {data:{ok:true},error:null};
  }
  if(name==='polar-activity-route'&&qa.case==='share-map-legacy')return {data:{polyline:encodeRoute([[50.83,4.43],[50.85,4.43],[50.85,4.46],[50.87,4.46]])},error:null};
  if(name==='polar-activity-route')return {data:{polyline:qa.case==='map-none'?null:encodeRoute([[50.835,4.435],[50.837,4.438],[50.839,4.436],[50.838,4.431],[50.835,4.435]])},error:qa.fail?{message:'Simulated route failure'}:null};
  if(name==='social-media'&&(options as any)?.body?.challenge)return {data:{url:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="330"><rect width="900" height="330" fill="#bad3c4"/><circle cx="450" cy="165" r="135" fill="#5a7c6d"/><path d="M0 280 900 90" stroke="#f3dfae" stroke-width="15"/><text x="450" y="175" text-anchor="middle" font-family="sans-serif" font-size="36" fill="#fff">Fictional Community cover</text></svg>'),expires_in:60},error:null};
  if(name==='social-media'&&(options as any)?.body?.photo?.startsWith('qa-')){const portrait=(options as any).body.photo==='qa-portrait';return {data:{url:'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${portrait?400:600}" height="${portrait?600:400}" viewBox="0 0 600 400"><rect width="600" height="400" fill="#b7c9ac"/><path d="M0 400 280 150 600 400" fill="#6e8b73"/><circle cx="460" cy="85" r="45" fill="#f3dfae"/><text x="300" y="365" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#fff">Fictional shared photo</text></svg>`),expires_in:60},error:null};}
  if(name==='social-media'&&((options as any)?.body?.photo==='profile'||(options as any)?.body?.author))return {data:{url:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="#5a7c6d"/><circle cx="16" cy="12" r="6" fill="#f3ede4"/></svg>'),expires_in:60},error:null};
  if (name === "weekly-companion") return { data: { status: "ready", ...((options as any)?.body?.store_test_request ? { diagnostics: {
    request_timestamp: "2026-10-20T12:00:00Z", endpoint: "https://api.openai.com/v1/responses", requested_model: "fixture-model", model: "fixture-model",
    response_id: "resp_fictional", request_id: "req_fictional", project_id: "proj_fictional", store_requested: true, store_returned: true, http_status: 200,
  } } : {}) }, error: qa.fail ? { message: "Simulated generation error" } : null };
  return { data: { connected: false, fetched: 0, inserted: 0, skipped: 0 }, error: null };
} } });
(supabase.storage as any).from = () => ({ createSignedUrls: async (paths:string[]) => ({ data: paths.filter(p=>p.includes('memory-')||p.includes('circle-profile')).map(path=>({path,signedUrl:'data:image/svg+xml,'+encodeURIComponent(`<svg data-fixture-path="${path}" xmlns="http://www.w3.org/2000/svg" width="${path.includes('1')?600:450}" height="${path.includes('1')?450:600}" viewBox="0 0 600 450"><rect width="600" height="450" fill="${path.includes('1')?'#b4c9b8':'#e4c9ad'}"/><circle cx="300" cy="210" r="110" fill="#f3ede4"/><text x="300" y="380" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#374d44">Fictional activity photo ${path.includes('1')?'1':'2'}</text></svg>`)})), error: null }), download: async () => qa.case.startsWith('share-map') ? ({data:new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#b7c9ac"/><text x="25" y="300">Fictional portrait photo</text></svg>'],{type:'image/svg+xml'}),error:null}) : ({ data: null, error: { message: "Fictional missing photo" } }), upload: async () => ({ data: {}, error: null }), remove: async () => ({ error: null }) });
HTMLMediaElement.prototype.play = async () => {};

function TrendsScenario() {
  const [period,setPeriod]=useState<TrendPeriod>('week');
  const [units,setUnits]=useState<'metric'|'imperial'>('metric');
  const trends=useActivityTrends(user.id,true,period);
  return <div className="mx-auto max-w-3xl px-4 py-3"><button onClick={()=>setUnits(v=>v==='metric'?'imperial':'metric')}>Switch units</button><TrendsTab {...trends} period={period} onPeriodChange={setPeriod} unitSystem={units}/></div>;
}

function PullRefreshScenario() {
  const [count,setCount]=useState(0);
  const [overlay,setOverlay]=useState(false);
  return <div className="mx-auto max-w-xl px-4"><PullToRefresh onRefresh={async()=>{
    qa.pullRefreshCalls=(qa.pullRefreshCalls??0)+1;
    setCount(value=>value+1);
    await syncPolarIfStale(POLAR_PULL_COOLDOWN_MS);
  }}>
    <SwipeActions onEdit={()=>{qa.cardEdits=(qa.cardEdits??0)+1;}}>
      <div data-pull-target onClick={event=>{event.stopPropagation();qa.cardEdits=(qa.cardEdits??0)+1;}} className="rounded-xl border p-5"><h2>Fictional Journal</h2><p>Pull down here to check for missing activities.</p><p>Feed refreshes: {count}</p></div>
    </SwipeActions>
    <TinyTweakStrip userId={user.id}/>
    <button onClick={()=>setOverlay(true)}>Open overlay</button>
    <div data-swipe-ignore className="my-4 rounded border p-4">Photo/swipe control</div>
    <div style={{height:1800}}>Previously logged activities</div>
    {overlay&&<div role="dialog" aria-modal="true" aria-label="Fictional overlay" className="fixed inset-0 bg-white p-8"><button onClick={()=>setOverlay(false)}>Close overlay</button><p>Overlay content</p></div>}
  </PullToRefresh></div>;
}

// A connected fictional import journey using the production hook and cards.
function ImportScenario({ name }: { name: string }) {
  const [feed, setFeed] = useState<any[]>([]);
  const imports = useActivityImports(user.id, () => setFeed([...(qa.importRows ?? [])]));
  const source = name === 'import-strava' ? 'strava' : 'polar';
  qa.importAction = (action:string) => {
    if (action === 'discover') qa.importRows = [{ ...activity, id:'fa000000-0000-4000-8000-000000000010',
      external_source:source, source, import_status:'processing', imported_at:new Date().toISOString(),
      import_updated_at:new Date().toISOString(), title:'Running', route_polyline:null }];
    else if(action === 'ready' || action === 'no-gps') Object.assign(qa.importRows[0], {
      import_status:'ready', import_updated_at:new Date().toISOString(), title:'Morning run Brussels',
      route_polyline:action==='ready'?encodeRoute([[50.835,4.435],[50.837+(qa.routeVariant??0),4.438],[50.839,4.436]]):null,
      route_checked_at:new Date().toISOString(),
    });
    else if(action === 'failed') qa.importRows[0].import_status='failed';
    else if(action === 'stalled') qa.importRows[0].import_updated_at=new Date(Date.now()-180_000).toISOString();
    qa.importNotify?.();
  };
  return <div className="mx-auto max-w-xl space-y-4 px-4">
    <section aria-label="Importing activities" className="space-y-3">{imports.pending.map(row=><ImportingActivityCard key={row.id} activity={row} onMapLoaded={imports.mapLoaded}/>)}</section>
    <h2>Previously logged activities</h2>
    {feed.filter(row=>!imports.blockedIds.has(row.id)&&row.import_status==='ready').map(row=><RecentActivityCard key={row.id}
      activity={row} signedNoteImages={{}} signedNoteThumbs={{}} noteImageOrientation={{}}
      onEdit={()=>{qa.edited=(qa.edited??0)+1;}} onDeleted={()=>{}} onNoteImageLoad={()=>{}} unitSystem="metric" tooltipVisible={false} onTooltipClose={()=>{}} onOpenGallery={()=>{}}/>)}
    <p>A previously logged manual activity</p>
  </div>;
}
const originalChannel = supabase.channel.bind(supabase);
(supabase as any).channel = (...args:any[]) => {
  if(!qa.case.startsWith('import-'))return (originalChannel as any)(...args);
  const channel:any={on:(_event:string,_filter:any,callback:()=>void)=>{qa.importNotify=callback;return channel;},subscribe:()=>channel,unsubscribe:async()=>{},topic:'fixture'};
  return channel;
};

function MapScenario({ name }: { name: string }) {
  const photo=name==='map-photos';
  const source=['map-stored','map-image-error'].includes(name)?'strava':'polar';
  const id='fa000000-0000-4000-8000-000000000010';
  const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#b7c9ac"/><text x="30" y="150">Fictional activity photo</text></svg>');
  const route=source==='strava'?encodeRoute([[50.835,4.435],[50.837,name==='map-image-error'?4.439:4.438],[50.839,4.436],[50.838,4.431],[50.835,4.435]]):null;
  return <div className="mx-auto max-w-xl px-4" style={name==='map-offscreen'?{paddingTop:2000}:undefined}><RecentActivityCard
    activity={{...activity,id,title:'A fictional park loop',notes:'',source,external_source:source,user_enrichment_status:'completed',route_polyline:route,route_checked_at:route?new Date().toISOString():null,photos:photo?[{id:'one',image_path:'fake.jpg',thumb_path:'fake-thumb.jpg'}]:[]}}
    signedNoteImages={photo?{[id]:image}:{}} signedNoteThumbs={photo?{[id]:image}:{}} noteImageOrientation={{}}
    onEdit={()=>{qa.mapEdits=(qa.mapEdits??0)+1;}} onNoteImageLoad={()=>{}} unitSystem="metric" tooltipVisible={false} onTooltipClose={()=>{}} onOpenGallery={()=>{}}/>
  </div>;
}

function Scenario({ name, close, saved }: { name: string; close: () => void; saved: () => void }) {
  if(name.startsWith('share-map'))return <ActivityImageSheet activityId={activity.id} onClose={close}/>;
  if(name==='pull-refresh')return <PullRefreshScenario/>;
  if(name.startsWith("import-"))return <ImportScenario key={name} name={name}/>;
  if(name.startsWith("map-"))return <MapScenario name={name}/>;
  switch (name) {
    case "trends": return <TrendsScenario/>;
    case 'social-page': return <SocialPage/>;
    case 'social-sharing': return <ActivitySharingSheet activityId="social-owned-activity" onClose={close} onSaved={saved}/>;
    case 'community-join': return <CommunityJoinPage/>;
    case 'memories': case 'memories-empty': case 'memories-recent': return <MemoriesPage/>;
    case 'memories-reader': case 'memories-missing': case 'memories-error': return <MemoryReader id="memory-0" context={memoryContext} onClose={close} onChange={()=>{}} onUpdated={saved}/>;
    case "log": return <AddActivityForm initialType="walk" onClose={close} onLogged={saved} />;
    case "import": return <AddActivityForm existingActivity={{ ...activity, source: "polar", user_enrichment_status: "pending" }} onClose={close} onLogged={saved} />;
    case "edit": return <EditActivityModal activity={activity} onClose={close} onUpdated={saved} onDeleted={saved} />;
    case "edit-reflection": return <EditActivityModal activity={activity} reflectionOnly onClose={close} onUpdated={saved} onDeleted={saved} />;
    case "note": return <AddNoteModal activityId={activity.id} onSkip={close} onSave={() => { saved(); close(); }} />;
    case "journal": return <JournalEntryModal open onClose={close} onSaved={saved} />;
    case "journal-edit": return <JournalEntryModal open entry={{ id: "note", text: "Existing words", entry_type: "journal_note" }} onClose={close} onSaved={saved} />;
    case "preset-add": return <AddPresetModal initialType="walk" onClose={close} onSaved={() => { saved(); close(); }} />;
    case "preset-edit": return <EditPresetModal preset={presets[0]} onClose={close} onSaved={() => { saved(); close(); }} onDeleted={saved} />;
    case "preset-page": return <AddPresetPage />;
    case "equipment-add": return <EquipmentFormSheet title="Add equipment" primaryLabel="Add equipment" onClose={close} onSubmit={async () => { await wait(); if (qa.fail) return { ok: false, error: "Simulated save error" }; saved(); return { ok: true }; }} />;
    case "equipment-select": return <EquipmentDialog equipment={equipment} selectedEquipmentIds={[]} onChange={saved} onClose={close} onAddEquipment={async name => ({ ...equipment[0], id: "added", name })} />;
    case "equipment-page": return <ManageEquipmentPage />;
    case "direction-choice": return <DirectionAddModal open onClose={close} onSelectDirection={saved} onSelectMicroAdjustment={saved} />;
    case "direction-measures": return <GoalDirectionSheet group={{ activity_type: "walk", period: "week", goals: [{ ...goal, goal_id: goal.id, current_value: 4, progress_ratio: 0.4 }] }} onClose={close} onEditGoal={saved} onAddGoal={saved} />;
    case "direction-add": return <AddGoalModal onClose={close} onAdded={saved} onDuplicate={saved} existingGoals={[]} />;
    case "direction-edit": return <EditGoalModal goal={goal} onClose={close} onUpdated={saved} onDeleted={saved} />;
    case "tweak": return <MicroAdjustmentCreateModal open onClose={close} onCompleted={saved} />;
    case "tweak-adjust": return <MicroAdjustmentCreateModal open mode="adjust" activeTweak={tweak} onClose={close} onCompleted={saved} />;
    case "tweak-review": return <TinyTweakStrip userId={user.id} />;
    case "companion-response": return <WeeklyCompanionCard post={post} onSaved={saved} />;
    case "companion-settings": return <CompanionSettings onClose={close} />;
    case "admin-weekly": return <AdminWeeklyCompanion />;
    case "admin-weekly-denied": return <AdminWeeklyCompanion />;
    case "settings": return <SettingsPage />;
    case "activity-preferences": return <ActivityPreferencesPage />;
    case "profile-settings":
    case "circle-profile": return <ProfileSettingsPage />;
    case "circle-connections": return <ManageCirclePage />;
    case "circle-invite": return <CircleInvitePage />;
    case "connections": return <ConnectionsPage />;
    case "polar-callback": return <PolarCallbackPage />;
    case "strava-callback": return <StravaCallbackPage />;
    case "login": return <Login />;
    case "signup": return <Signup />;
    case "onboarding": return <OnboardingWizard onSkip={close} onComplete={close} />;
    case "welcome": return <OnboardingCarousel onSkip={close} onComplete={close} />;
    case "add-choice": return <AddBottomSheet open onClose={close} onSelectActivity={saved} onSelectJournalEntry={saved} />;
    case "type-choice": return <SelectActivityTypeModal open onClose={close} onSelect={saved} />;
    case "drawer": return <Sidebar open onClose={close} />;
    case "export": return <ActivityImageSheet activityId={activity.id} onClose={close} />;
    case "gallery": return <GalleryLightbox open items={[{ key: "one", activity, imagePath: null, thumbPath: null, photoId: null }]} activeIndex={0} onActiveIndexChange={() => {}} onClose={close} signedImages={{}} signedThumbs={{}} />;
    default: return null;
  }
}
function MemoryNavigationFixture() {
  const location=useLocation();
  return <Layout menuOpen={false} setMenuOpen={()=>{}}>{location.pathname==='/calendar'?<CalendarPage/>:location.pathname==='/photos'?<PhotosPage/>:<MemoriesPage/>}</Layout>;
}
function Harness() {
  const [name, setName] = useState(""); const [key, setKey] = useState(0); const [open, setOpen] = useState(false);
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric");
  const navigate = useNavigate(); const location = useLocation();
  qa.select = (value: string) => { allowFormNavigation(() => navigate(value === "circle-invite" ? "/circle/invite/fictional" : value==='community-join'?'/community/join/'+'a'.repeat(64):value==='memories-nav'?'/memories':"/forms", { replace: true })); qa.case = value; qa.fail = false; qa.delay = 0; setName(value); setKey(n => n + 1); setOpen(true); };
  qa.checkpoint = () => allowFormNavigation(() => navigate("/forms?checkpoint=1"));
  qa.navigate = (to: string) => navigate(to);
  const close = () => { qa.closed++; setOpen(false); };
  return <UnitContext.Provider value={{ unitSystem, setUnitSystem }}><FormNavigationGuard />
    <main className="p-4" style={{ minHeight: 1800 }}><button type="button" onClick={() => setOpen(true)}>Open form</button><p>Fictional form QA only</p>
      {name==='memories-nav'?<MemoryNavigationFixture key={key}/>:(["/forms","/settings","/settings/profile","/settings/circle","/circle"].includes(location.pathname) || location.pathname.startsWith("/circle/invite/") || location.pathname.startsWith('/community/join/')) && open && <Scenario key={key+location.pathname} name={location.pathname==="/settings/profile"?"profile-settings":location.pathname==="/settings"?"settings":location.pathname==="/settings/circle"?"circle-connections":name} close={close} saved={() => qa.saved++} />}
    </main>
  </UnitContext.Provider>;
}
const router = createBrowserRouter([{ path: "*", element: <Harness /> }, { path: "/circle/invite/:token", element: <Harness /> },{path:'/community/join/:token',element:<Harness/>}]);
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
