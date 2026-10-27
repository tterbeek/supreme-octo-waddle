import { useEffect,useState } from 'react';
import ModalSheet from '../ModalSheet';
import { FormActions,FormError } from '../forms/FormLayout';
import FormTextarea from '../forms/FormTextarea';
import { socialSettings,socialFeed,type SocialSettings,type SocialActivity } from '../../services/social.service';
import SocialConversation from './SocialConversation';
import { signStorageValues } from '../../services/storage.service';

export default function ActivitySharingSheet({activityId,onClose,onSaved}:{activityId:string;onClose:()=>void;onSaved?:()=>void}) {
 const [initial,setInitial]=useState<SocialSettings|null>(null);const [note,setNote]=useState('');const [audiences,setAudiences]=useState<string[]>([]);const [photos,setPhotos]=useState<string[]>([]);const [legacy,setLegacy]=useState(false);const [thumbs,setThumbs]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [retry,setRetry]=useState(0);
 const [discussion,setDiscussion]=useState<SocialActivity|null>(null);const [openingDiscussion,setOpeningDiscussion]=useState(false);
 useEffect(()=>{let cancel=false;setInitial(null);setError('');void socialSettings(activityId).then(data=>{if(cancel)return;setInitial(data);setNote(data.public_note||'');setAudiences(data.audiences.filter(a=>a.shared).map(a=>a.id));setPhotos(data.photos.filter(p=>p.shared).map(p=>p.id));setLegacy(data.legacy_photo);void signStorageValues(data.photos.map(p=>p.thumb).filter(Boolean)).then(map=>{if(!cancel)setThumbs(map);}).catch(()=>{});}).catch(e=>{if(!cancel)setError(e.message);});return()=>{cancel=true;};},[activityId,retry]);
 const save=async(keepPrivate=false)=>{if(!initial)return;setBusy(true);setError('');try{
  const changes=initial.audiences.filter(a=>a.shared!==audiences.includes(a.id)).map(a=>({id:a.id,share:audiences.includes(a.id)}));
  await socialSettings(activityId,keepPrivate?{private:true}:{public_note:note,photos,legacy_photo:legacy,...(initial.private&&audiences.length?{private:false}:{}),audiences:changes});
  onSaved?.();onClose();
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const dirty=!!initial&&(note!==(initial.public_note||'')||legacy!==initial.legacy_photo||JSON.stringify([...audiences].sort())!==JSON.stringify(initial.audiences.filter(a=>a.shared).map(a=>a.id).sort())||JSON.stringify([...photos].sort())!==JSON.stringify(initial.photos.filter(p=>p.shared).map(p=>p.id).sort()));
 return <ModalSheet title="Activity sharing" onClose={onClose} busy={busy} dirty={dirty}><div className="space-y-4">
  <p className="text-sm text-movenotes-muted">These choices affect this activity only. Shares persist until unshared or access ends; future eligible connections/members can see still-shared history.</p>
  <p className="text-sm text-movenotes-muted">Sharing with another audience also makes existing comments and reactions visible to its eligible members. Future eligible connections and members can see the same thread.</p>
  {!initial&&!error&&<p role="status">Loading sharing choices…</p>}
  <FormError>{error}</FormError>{!initial&&error&&<button type="button" className="underline" onClick={()=>setRetry(n=>n+1)}>Retry</button>}
  {initial&&<>
   <button type="button" disabled={openingDiscussion} className="min-h-11 underline text-sm" onClick={()=>{setOpeningDiscussion(true);void socialFeed(undefined,undefined,activityId).then(rows=>{if(!rows[0])throw Error('Conversation unavailable');setDiscussion(rows[0]);}).catch(e=>setError(e.message)).finally(()=>setOpeningDiscussion(false));}}>Comments and reactions</button>
   <fieldset className="space-y-2"><legend>Share with</legend>{initial.audiences.map(a=><label key={a.id} className="flex items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={audiences.includes(a.id)} onChange={e=>setAudiences(e.target.checked?[...audiences,a.id]:audiences.filter(id=>id!==a.id))}/>{a.name}</label>)}</fieldset>
   <button type="button" className="min-h-11 underline text-sm" disabled={initial.private} onClick={()=>void save(true)}>{initial.private?'Kept private':'Keep this activity private'}</button>
   <p className="text-xs text-movenotes-muted">Keep private turns off all audiences and suppresses automatic sharing. Choosing an audience explicitly makes it shared again.</p>
   <div className="mn-field"><label htmlFor="activity-shared-note">Shared note (optional)</label><FormTextarea id="activity-shared-note" maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/><p className="text-xs text-movenotes-muted">Visible to people you share this activity with. Your private Journal note is separate and is never copied here.</p></div>
   {(initial.photos.length>0||initial.has_legacy_photo)&&<fieldset className="space-y-2"><legend>Photos to share (optional)</legend><p className="text-xs text-movenotes-muted">Unselected photos stay private. New photos are not selected automatically.</p>{initial.photos.map((p,i)=><label key={p.id} className="flex items-center gap-3 rounded-xl border p-3"><input type="checkbox" checked={photos.includes(p.id)} onChange={e=>setPhotos(e.target.checked?[...photos,p.id]:photos.filter(id=>id!==p.id))}/>{thumbs[p.thumb]&&<img src={thumbs[p.thumb]} alt="" className="w-12 h-12 rounded-lg object-cover"/>}Photo {i+1}</label>)}{initial.has_legacy_photo&&(!initial.photos.length||legacy)&&<label className="flex gap-3 items-center"><input type="checkbox" checked={legacy} onChange={e=>setLegacy(e.target.checked)}/>Original activity photo</label>}</fieldset>}
  </>}
  <FormActions><button disabled={busy||!initial} onClick={()=>void save()}>Save sharing</button></FormActions>
  {discussion&&<SocialConversation activity={discussion} viewerId={discussion.author_id} onClose={()=>setDiscussion(null)} onChanged={()=>{}}/>}
 </div></ModalSheet>;
}
