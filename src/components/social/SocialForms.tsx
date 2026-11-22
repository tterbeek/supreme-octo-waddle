import JourneyLibrary from '../journeys/JourneyLibrary';
import JourneyArtwork from '../journeys/JourneyArtwork';
import { curatedJourney,type JourneyTemplate } from '../../lib/curatedJourneys';
import { useUnitSystem } from '../../contexts/UnitContext';
import { challengeDistance,targetToKm } from '../../lib/virtualDistance';
import VirtualDistanceHelp from './VirtualDistanceHelp';
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
export function ChallengeForm({community,challenge,journey=false,onClose,onSaved}:{community:string;challenge?:Challenge;journey?:boolean;onClose:()=>void;onSaved:()=>void}) {
 const {unitSystem}=useUnitSystem();const id=useId();
 const [coverFile,setCoverFile]=useState<File|null>(null);const [removeCover,setRemoveCover]=useState(false);
 const [route,setRoute]=useState<JourneyTemplate|undefined>(challenge?.route?curatedJourney(challenge.route.slug,challenge.route.version):undefined);
 const [library,setLibrary]=useState(false);
 const hasRoute=!!route||!!challenge?.route;
 const initialMetric=challenge?.metric||(journey?'virtual_distance':'count');
 const initialTarget=challenge?String(['distance','virtual_distance'].includes(challenge.metric)?Math.round(challengeDistance(challenge.target,unitSystem)*1e6)/1e6:challenge.target):'';
 const [title,setTitle]=useState(challenge?.title||'');const [metric,setMetric]=useState(initialMetric);
 const [target,setTarget]=useState(initialTarget);const [scope,setScope]=useState(challenge?.scope||'collective');
 const [types,setTypes]=useState<string[]>(challenge?.types||[]);
 const [activityScope,setActivityScope]=useState<'all'|'selected'>(challenge?.activity_scope||(challenge?.types.length?'selected':'all'));
 const [start,setStart]=useState(challenge?.starts_on||(journey?new Date().toLocaleDateString('en-CA'):''));const [end,setEnd]=useState(challenge?.ends_on||'');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [confirmAction,setConfirmAction]=useState<'close'|'cancel'|null>(null);
 const virtual=metric==='virtual_distance';const distance=virtual||metric==='distance';const units=unitSystem==='imperial'?'miles':'km';
 const frozen=challenge?.metric==='virtual_distance'&&challenge.state!=='draft';
 const zone=challenge?.time_zone||Intl.DateTimeFormat().resolvedOptions().timeZone;
 const canonicalTarget=route?route.targetKm.toFixed(12):challenge&&target===initialTarget&&metric===challenge.metric?String(challenge.target):distance?targetToKm(target,unitSystem==='imperial'):target;
 const invalid=!title.trim()||!canonicalTarget||!Number.isFinite(Number(canonicalTarget))||Number(canonicalTarget)<=0||!start||(!virtual&&(!end||end<=start))||(virtual&&!!end&&end<=start)||(activityScope==='selected'&&!types.length);
 const save=async(status='active')=>{setBusy(true);setError('');try{
  await saveChallengeWithCover(community,challenge?'update':'create',{
   ...(challenge?{id:challenge.id}:{}),...(route?{journey_template_slug:route.slug,journey_template_version:route.version}:{}),title,metric,target:canonicalTarget,scope:virtual?'collective':scope,
   activity_scope:activityScope,types:activityScope==='all'?[]:types,starts_on:start,ends_on:end||null,time_zone:zone,...(virtual?{status}:{})
  },coverFile,removeCover);onSaved();onClose();
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const applyAction=async()=>{if(!challenge||!confirmAction)return;setBusy(true);setError('');try{await socialChallenges(community,confirmAction,{id:challenge.id});onSaved();onClose();}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <ModalSheet title={challenge?'Update challenge':'Create challenge'} onClose={onClose} busy={busy} draft={{route:route?`${route.slug}@${route.version}`:null,title,metric,target,scope,activityScope,types,start,end,coverFile,removeCover}}><div className="space-y-4">
  <ChallengeCoverPicker challenge={challenge} file={coverFile} removed={removeCover} onFile={file=>{setCoverFile(file);setRemoveCover(false);}} onRemove={()=>{setCoverFile(null);setRemoveCover(true);}}/>
  <div className="mn-field"><label htmlFor={id+'title'}>Title</label><input id={id+'title'} className="w-full" maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/></div>
  {!virtual&&<div className="mn-field"><label htmlFor={id+'scope'}>Goal</label><select id={id+'scope'} className="w-full" value={scope} onChange={e=>setScope(e.target.value as Challenge['scope'])}><option value="collective">Collective target</option><option value="personal">Personal target</option></select></div>}
  <div className="mn-field"><label htmlFor={id+'metric'}>Measure</label><select id={id+'metric'} className="w-full" value={metric} disabled={frozen||hasRoute} onChange={e=>setMetric(e.target.value as Challenge['metric'])}>
   <option value="count">Activities</option><option value="distance">Recorded distance</option>
   <option value="virtual_distance" disabled={!!challenge&&challenge.metric!=='virtual_distance'}>Virtual distance · All activities count</option>
   <option value="duration">Duration (minutes)</option><option value="days">Distinct active dates</option>
  </select></div>
  {virtual?<p className="text-sm text-movenotes-muted">Activities contribute based on distance, or logged time when distance is unavailable. Activities without measurements count too. These are virtual {units} for your shared adventure.</p>:metric==='distance'?<p className="text-sm text-movenotes-muted">Add up the {unitSystem==='imperial'?'miles':'kilometres'} recorded in activities. Only activities with a recorded distance can contribute.</p>:null}
  {virtual&&<section className="space-y-3" aria-label="Map route">
   <p className="text-sm font-medium">Map route (optional)</p>
   {route&&<><div className="overflow-hidden rounded-xl"><JourneyArtwork template={route}/></div><p className="font-medium">{route.title}</p><p className="text-sm text-movenotes-muted">{route.waypoints.map(w=>w.name).join(' → ')}</p></>}
   {!challenge?.route&&!frozen&&<button type="button" className="min-h-11 rounded-full border border-warm-200 px-4 text-sm text-movenotes-primary" onClick={()=>setLibrary(true)}>{route?'Choose another route':'Choose a map route'}</button>}
   {route&&!challenge?.route&&<button type="button" className="block min-h-11 text-sm underline" onClick={()=>setRoute(undefined)}>Remove map route</button>}
   {hasRoute&&<p className="text-sm text-movenotes-muted">The route fixes the target. A virtual journey between destinations, not a navigation route.</p>}
  </section>}
  {hasRoute?<div className="mn-field"><p className="text-sm font-medium">Route target</p><p>{challengeDistance(route?.targetKm??challenge?.target??0,unitSystem).toLocaleString(undefined,{maximumFractionDigits:1})} virtual {units}</p></div>:<div className="mn-field"><label htmlFor={id+'target'}>Target{distance?' ('+units+')':''}</label><input id={id+'target'} className="w-full" type="number" min="0.01" step="any" value={target} onChange={e=>setTarget(e.target.value)}/></div>}

  <div className="mn-field"><label htmlFor={id+'start'}>Starts on (included)</label><input id={id+'start'} disabled={frozen} className="w-full" type="date" value={start} onChange={e=>setStart(e.target.value)}/></div>
  <div className="mn-field"><label htmlFor={id+'end'}>{virtual?'Target date (optional, aspirational)':'Ends on (excluded)'}</label><input id={id+'end'} className="w-full" type="date" min={start} value={end} onChange={e=>setEnd(e.target.value)}/></div>
  <fieldset disabled={frozen} className="space-y-2"><legend className="text-sm font-medium">Activities that count</legend>
   <label className="flex items-center gap-2 min-h-11"><input type="radio" name={id+'filter'} checked={activityScope==='all'} onChange={()=>setActivityScope('all')}/>All activity types</label>
   <label className="flex items-center gap-2 min-h-11"><input type="radio" name={id+'filter'} checked={activityScope==='selected'} onChange={()=>setActivityScope('selected')}/>Choose specific types</label>
   {activityScope==='selected'&&<TypeChoices value={types} onChange={setTypes}/>}
  </fieldset>
  {activityScope==='selected'&&!types.length&&<p role="alert" className="text-sm">Choose at least one activity type.</p>}
  {virtual&&<p className="text-xs text-movenotes-muted">Every included activity is converted into virtual {units}, so different kinds of movement can contribute together. All Community members participate automatically. Only currently shared activities count. The target date does not close the challenge.</p>}
  {!virtual&&<p className="text-xs text-movenotes-muted">Dates use {zone}. All Community members are included automatically. Only current Community shares count; private activities stay private.</p>}
  {virtual&&<VirtualDistanceHelp/>}
  {challenge&&['active','completed','upcoming'].includes(challenge.state)&&<button type="button" className="block min-h-11 underline text-sm" disabled={busy} onClick={()=>setConfirmAction('close')}>Close challenge</button>}
  {challenge&&!['cancelled','closed'].includes(challenge.state)&&<button type="button" className="block min-h-11 underline text-sm" disabled={busy} onClick={()=>setConfirmAction('cancel')}>Cancel challenge</button>}
  {virtual&&(!challenge||challenge.state==='draft')&&<button type="button" disabled={busy||invalid} className="block min-h-11 underline text-sm" onClick={()=>void save('draft')}>Save draft</button>}
  <FormError>{error}</FormError><FormActions><button disabled={busy||invalid} onClick={()=>void save()}>{virtual&&(!challenge||challenge.state==='draft')?'Start challenge':challenge?'Save changes':'Create challenge'}</button></FormActions>
  {library&&<JourneyLibrary onClose={()=>setLibrary(false)} onChoose={selected=>{setRoute(selected);setTarget(String(challengeDistance(selected.targetKm,unitSystem)));if(!title.trim())setTitle(selected.title);setLibrary(false);}}/>}
  {confirmAction&&<DialogSheet title={confirmAction==='close'?'Close challenge?':'Cancel challenge?'} onClose={()=>setConfirmAction(null)} busy={busy}><p>{confirmAction==='close'?'This archives the challenge in the Community feed under its closed date. Later movement will no longer count. Corrections to earlier eligible activities can still update the total.':'This cancels the challenge. Shared activities stay as they are.'}</p><FormError>{error}</FormError><FormActions><button disabled={busy} onClick={()=>void applyAction()}>{confirmAction==='close'?'Close challenge':'Cancel challenge'}</button></FormActions></DialogSheet>}
 </div></ModalSheet>;
}
