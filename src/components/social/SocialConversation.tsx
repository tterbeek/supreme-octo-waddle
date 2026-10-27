import { useEffect,useRef,useState } from 'react';
import ModalSheet from '../ModalSheet';
import DialogSheet from '../DialogSheet';
import FormTextarea from '../forms/FormTextarea';
import { FormActions,FormError } from '../forms/FormLayout';
import AppreciationButton from './AppreciationButton';
import CommentActions from './CommentActions';
import { socialConversation,socialHistory,socialRemovePlacement,socialCommentAvatar,type SocialActivity,type SocialComment,type Conversation } from '../../services/social.service';
import { allowFormNavigation } from '../../lib/formLifecycle';

export default function SocialConversation({activity,onClose,onChanged,viewerId,moderationCommunity}:{activity:SocialActivity;moderationCommunity?:{id:string;name:string};onClose:()=>void;onChanged:()=>void;viewerId?:string}) {
 const activityId=activity.id;
 const [selectedComment,setSelectedComment]=useState<SocialComment|null>(null);
 const [data,setData]=useState<Conversation|null>(null);const [body,setBody]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [version,setVersion]=useState(0);const [action,setAction]=useState<'report'|'block'|null>(null);const [reason,setReason]=useState('');
 const [removePlacement,setRemovePlacement]=useState(false);
 const [avatars,setAvatars]=useState<Record<string,string>>({});
 const avatarAuthors=(data?.comments||[]).filter(c=>c.has_avatar).map(c=>c.author_id).filter((id,index,all)=>all.indexOf(id)===index).sort().join(',');
 useEffect(()=>{let cancelled=false;setAvatars({});const load=async()=>{const pairs=await Promise.all(avatarAuthors.split(',').filter(Boolean).map(async author=>{try{return [author,await socialCommentAvatar(activity.id,author)];}catch{return [author,''];}}));if(!cancelled)setAvatars(Object.fromEntries(pairs));};void load();const timer=window.setInterval(()=>{if(document.visibilityState==='visible')void load();else setAvatars({});},45_000);return()=>{cancelled=true;window.clearInterval(timer);};},[activity.id,avatarAuthors]);
 const pages=useRef(1);const [dataActivity,setDataActivity]=useState('');
 useEffect(()=>{pages.current=1;},[activityId]);
 useEffect(()=>{let cancel=false;setError('');if(!activityId)return;const load=()=>void socialHistory(activityId,pages.current).then(value=>{if(!cancel){setData(value);setDataActivity(activityId);}}).catch(()=>{if(!cancel){setData(null);setError('This conversation is unavailable. Access may have changed.');}});load();const timer=window.setInterval(load,30_000);return()=>{cancel=true;window.clearInterval(timer);};},[activityId,version]);
 const mutate=async(next:string,payload:Record<string,string|null>={})=>{setBusy(true);setError('');try{const value=await socialConversation(activityId,next,payload);if(value.blocked){setBody('');allowFormNavigation(()=>{onChanged();onClose();});return;}if(next==='comment')setBody('');if(next==='report'){setAction(null);setReason('');}setData(value);onChanged();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <ModalSheet title="Shared activity conversation" onClose={onClose} busy={busy} dirty={!!body.trim()}><div className="space-y-4">
  <h3 className="font-semibold">{activity.title||activity.type}</h3>
  {!activity.contexts.length&&activity.author_id===viewerId&&<p className="text-sm text-movenotes-muted">Only you can access this thread until you share the activity again.</p>}
  <FormError>{error}</FormError>{error&&activityId&&<button className="underline" onClick={()=>setVersion(n=>n+1)}>Retry</button>}
  {data&&dataActivity===activityId&&<>
   <AppreciationButton appreciated={data.my_reaction==='CHEER'} othersAppreciated={(data.reactions.find(r=>r.reaction==='CHEER')?.count||0)>(data.my_reaction==='CHEER'?1:0)} disabled={busy} onToggle={()=>void mutate('reaction',{reaction:data.my_reaction==='CHEER'?null:'CHEER'})}/>
   <div className="space-y-3">{data.comments.map(c=><button type="button" key={c.id} data-comment-id={c.id} aria-label={`Actions for comment by ${c.author}`} onClick={()=>setSelectedComment(c)} className="w-full rounded-xl border p-3 text-left"><div className="flex items-center gap-2 text-xs text-movenotes-muted">{avatars[c.author_id]&&<img src={avatars[c.author_id]} alt={`${c.author}'s profile picture`} className="h-7 w-7 rounded-full object-cover" onError={()=>setAvatars(a=>({...a,[c.author_id]:''}))}/>}<p>{c.author} · {new Date(c.created_at).toLocaleDateString()}</p></div><p className="whitespace-pre-wrap break-words mt-2">{c.body}</p></button>)}</div>
   {data.has_more&&<button type="button" className="min-h-11 underline text-sm" onClick={()=>{pages.current++;setVersion(n=>n+1);}}>Older comments</button>}
   {data.can_moderate&&!!data.reports?.length&&<section className="rounded-xl border p-3 space-y-2"><h4 className="text-sm font-semibold">Reports in this conversation</h4>{data.reports.map(report=><div key={report.id}><p className="text-sm whitespace-pre-wrap break-words">{report.reason}</p><button className="min-h-11 underline text-sm" onClick={()=>void mutate('resolve_report',{id:report.id})}>Mark reviewed</button></div>)}</section>}
   <div className="mn-field"><label htmlFor="social-comment">Your comment</label><FormTextarea id="social-comment" maxLength={1000} value={body} onChange={e=>setBody(e.target.value)} placeholder="Add a comment if you wish"/><p className="text-xs text-movenotes-muted">Comments are visible to everyone this activity is shared with.</p></div>
   <div className="flex flex-wrap gap-4 text-sm"><button className="min-h-11 underline" onClick={()=>setAction('report')}>Report</button>{activity.author_id!==viewerId&&<button className="min-h-11 underline" onClick={()=>setAction('block')}>Block author</button>}</div>
   <FormActions><button disabled={busy||!body.trim()} onClick={()=>void mutate('comment',{body})}>Post comment</button></FormActions>
  </>}
  {selectedComment&&<CommentActions activityId={activityId} comment={selectedComment} onClose={()=>setSelectedComment(null)} onUpdated={value=>{setData(value);setVersion(n=>n+1);onChanged();}}/>}
  {action&&<DialogSheet title={action==='report'?'Report activity':'Block author?'} onClose={()=>setAction(null)} busy={busy} dirty={action==='report'&&!!reason.trim()}>
   {action==='report'?<div className="mn-field"><label htmlFor="social-report">What should be reviewed?</label><FormTextarea id="social-report" maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/><p className="text-xs text-movenotes-muted">Reports are visible to the activity owner.</p></div>:<p>Activities and conversations between you and this author will no longer be accessible through Circle or Communities. Any unsent comment here will be discarded.</p>}
   <FormError>{error}</FormError><FormActions><button disabled={busy||(action==='report'&&!reason.trim())} onClick={()=>void mutate(action,action==='report'?{reason}:{})}>{action==='report'?'Send report':'Block author'}</button></FormActions>
  </DialogSheet>}
  {moderationCommunity&&activity.author_id!==viewerId&&<button className="min-h-11 underline text-sm" onClick={()=>setRemovePlacement(true)}>Remove from {moderationCommunity.name}</button>}
  {removePlacement&&moderationCommunity&&<DialogSheet title="Remove Community placement?" onClose={()=>setRemovePlacement(false)} busy={busy}>
   <p>This removes the activity from {moderationCommunity.name} only. Its Journal record, other shares, comments and reactions stay intact. Any unsent comment here will be discarded.</p>
   <FormError>{error}</FormError><FormActions><button disabled={busy} onClick={()=>{setBusy(true);void socialRemovePlacement(activity.id,moderationCommunity.id).then(()=>allowFormNavigation(()=>{onChanged();onClose();})).catch(e=>setError(e.message)).finally(()=>setBusy(false));}}>Remove from Community</button></FormActions>
  </DialogSheet>}
 </div></ModalSheet>;
}
