import { useId,useState } from 'react';
import ModalSheet from '../ModalSheet';
import DialogSheet from '../DialogSheet';
import { FormActions,FormError } from '../forms/FormLayout';
import FormTextarea from '../forms/FormTextarea';
import { ACTIVITY_TYPES } from '../../config/activityTypes';
import { socialRule,socialCommunity,socialChallenges,type SocialAudience,type Community,type Challenge } from '../../services/social.service';
import { allowFormNavigation } from '../../lib/formLifecycle';
import ChallengeCoverPicker from './ChallengeCoverPicker';
import { saveChallengeWithCover } from '../../services/challengeCover.service';

export function TypeChoices({value,onChange}:{value:string[];onChange:(next:string[])=>void}) {
 return <fieldset className="space-y-2"><legend className="text-sm mb-2">Activity types</legend><div className="grid grid-cols-2 gap-2">{Object.values(ACTIVITY_TYPES).filter(t=>t.id!=='any').map(t=><label key={t.id} className="flex items-center gap-2 rounded-xl border border-warm-200 p-3"><input type="checkbox" checked={value.includes(t.id)} onChange={e=>onChange(e.target.checked?[...value,t.id]:value.filter(v=>v!==t.id))}/>{t.label}</label>)}</div></fieldset>;
}
export function SocialRuleSheet({audience,onClose,onSaved}:{audience:SocialAudience;onClose:()=>void;onSaved:()=>void}) {
 const group=useId();
 const [mode,setMode]=useState(audience.mode);const [types,setTypes]=useState(audience.types);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const save=async()=>{setBusy(true);setError('');try{await socialRule(audience.id,mode,types);allowFormNavigation(()=>{onSaved();onClose();});}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <ModalSheet title={`Sharing in ${audience.name}`} onClose={onClose} busy={busy} draft={{mode,types}}><div className="space-y-4">
  <p className="text-sm text-movenotes-muted">Choose what to share automatically from now on. Existing activities stay as they are. Old imported workouts stay private.</p>
  <fieldset className="space-y-2"><legend className="sr-only">Sharing mode</legend>{(['manual','all','types'] as const).map(m=><label key={m} className="flex gap-3 items-center border rounded-xl p-4"><input type="radio" name={group} checked={mode===m} onChange={()=>setMode(m)}/>{m==='manual'?'Manual':m==='all'?'All activities':'Selected activity types'}</label>)}</fieldset>
  {mode==='types'&&<TypeChoices value={types} onChange={setTypes}/>}
  <p className="text-sm">Shared summaries stay available until unshared or access ends. New accepted connections or Community members can see still-shared history, including existing comments and reactions. Every audience reads the same activity thread. Private notes, feelings and equipment stay private. Photos are included by default when an activity is shared. You can unshare individual photos in Modify sharing.</p>
  <FormError>{error}</FormError><FormActions><button disabled={busy||mode==='types'&&!types.length} onClick={()=>void save()}>Save sharing choice</button></FormActions>
 </div></ModalSheet>;
}
export function CommunityForm({community,onClose,onSaved}:{community?:Community;onClose:()=>void;onSaved:(id:string)=>void}) {
 const id=useId();const [name,setName]=useState(community?.name||'');const [description,setDescription]=useState(community?.description||'');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const save=async()=>{setBusy(true);setError('');try{const result=await socialCommunity(community?'edit':'create',community?.id,{name,description});onSaved(community?.id||result.id);onClose();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <ModalSheet title={community?'Edit Community':'Create Community'} onClose={onClose} busy={busy} draft={{name,description}}><div className="space-y-4">
  <div className="mn-field"><label htmlFor={id+'name'}>Name</label><input id={id+'name'} className="w-full" maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></div>
  <div className="mn-field"><label htmlFor={id+'description'}>Description and rules</label><FormTextarea id={id+'description'} maxLength={1500} value={description} onChange={e=>setDescription(e.target.value)}/></div>
  <p className="text-sm text-movenotes-muted">Closed, QR-invite only. Joining does not connect people in Circle or automatically share their activities.</p>
  <FormError>{error}</FormError><FormActions><button disabled={busy||!name.trim()} onClick={()=>void save()}>{community?'Save Community':'Create Community'}</button></FormActions>
 </div></ModalSheet>;
}
export function ChallengeForm({community,challenge,onClose,onSaved}:{community:string;challenge?:Challenge;onClose:()=>void;onSaved:()=>void}) {
 const [coverFile,setCoverFile]=useState<File|null>(null);const [removeCover,setRemoveCover]=useState(false);
 const id=useId();const [title,setTitle]=useState(challenge?.title||'');const [metric,setMetric]=useState(challenge?.metric||'count');const [target,setTarget]=useState(challenge?String(challenge.target):'');const [scope,setScope]=useState(challenge?.scope||'collective');const [types,setTypes]=useState<string[]>(challenge?.types||[]);
 const [start,setStart]=useState(challenge?.starts_on||'');const [end,setEnd]=useState(challenge?.ends_on||'');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [confirmCancel,setConfirmCancel]=useState(false);
 const zone=challenge?.time_zone||Intl.DateTimeFormat().resolvedOptions().timeZone;
 const save=async()=>{setBusy(true);setError('');try{await saveChallengeWithCover(community,challenge?'update':'create',{...(challenge?{id:challenge.id}:{}),title,metric,target:Number(target),scope,types,starts_on:start,ends_on:end,time_zone:zone},coverFile,removeCover);onSaved();onClose();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const cancel=async()=>{if(!challenge)return;setBusy(true);setError('');try{await socialChallenges(community,'cancel',{id:challenge.id});onSaved();onClose();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <ModalSheet title={challenge?'Update challenge':'Create challenge'} onClose={onClose} busy={busy} draft={{title,metric,target,scope,types,start,end,coverFile,removeCover}}><div className="space-y-4">
  <ChallengeCoverPicker challenge={challenge} file={coverFile} removed={removeCover} onFile={file=>{setCoverFile(file);setRemoveCover(false);}} onRemove={()=>{setCoverFile(null);setRemoveCover(true);}}/>
  <div className="mn-field"><label htmlFor={id+'title'}>Title</label><input id={id+'title'} className="w-full" maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></div>
  <div className="mn-field"><label htmlFor={id+'scope'}>Goal</label><select id={id+'scope'} className="w-full" value={scope} onChange={e=>setScope(e.target.value as Challenge['scope'])}><option value="collective">Collective target</option><option value="personal">Personal target</option></select></div>
  <div className="mn-field"><label htmlFor={id+'metric'}>Measure</label><select id={id+'metric'} className="w-full" value={metric} onChange={e=>setMetric(e.target.value as Challenge['metric'])}><option value="count">Activities</option><option value="distance">Distance (km)</option><option value="duration">Duration (minutes)</option><option value="days">Distinct active dates</option></select></div>
  <div className="mn-field"><label htmlFor={id+'target'}>Target</label><input id={id+'target'} className="w-full" type="number" min="0.01" step="any" value={target} onChange={e=>setTarget(e.target.value)}/></div>
  <div className="mn-field"><label htmlFor={id+'start'}>Starts on (included)</label><input id={id+'start'} className="w-full" type="date" value={start} onChange={e=>setStart(e.target.value)}/></div>
  <div className="mn-field"><label htmlFor={id+'end'}>Ends on (excluded)</label><input id={id+'end'} className="w-full" type="date" min={start} value={end} onChange={e=>setEnd(e.target.value)}/></div>
  <TypeChoices value={types} onChange={setTypes}/><p className="text-xs text-movenotes-muted">No types selected means all types. Dates use {zone}. All Community members are included automatically. Only current Community shares count; private activities stay private. Totals can change after edits, unsharing or leaving. Collective active dates count each calendar date once across the Community.</p>
  {challenge&&<button type="button" className="min-h-11 underline text-sm" disabled={busy||challenge.state==='cancelled'} onClick={()=>setConfirmCancel(true)}>{challenge.state==='cancelled'?'Challenge cancelled':'Cancel challenge'}</button>}
  <FormError>{error}</FormError><FormActions><button disabled={busy||!title.trim()||!Number.isFinite(Number(target))||Number(target)<=0||!start||!end||end<=start} onClick={()=>void save()}>{challenge?'Save changes':'Create challenge'}</button></FormActions>
  {confirmCancel&&<DialogSheet title="Cancel challenge?" onClose={()=>setConfirmCancel(false)} busy={busy}><p>This cancels the challenge for the Community. Shared activities stay as they are. Any unsaved edits here will be discarded.</p><FormError>{error}</FormError><FormActions><button disabled={busy} onClick={()=>void cancel()}>Cancel challenge</button></FormActions></DialogSheet>}
 </div></ModalSheet>;
}
