import { useEffect,useState } from 'react';
import { socialSettings } from '../../services/social.service';
import { SOCIAL_UPDATED_EVENT } from '../../config/social';
import ActivitySharingSheet from './ActivitySharingSheet';

export default function ActivitySharingStatus({activityId}:{activityId:string}) {
 const [label,setLabel]=useState('Sharing…');const [open,setOpen]=useState(false);
 useEffect(()=>{let cancel=false;const load=()=>{void socialSettings(activityId).then(s=>{if(!cancel)setLabel(s.private?'Only you':s.audiences.filter(a=>a.shared).map(a=>a.name).join(' · ')||'Only you');}).catch(()=>{if(!cancel)setLabel('Sharing options');});};load();window.addEventListener(SOCIAL_UPDATED_EVENT,load);return()=>{cancel=true;window.removeEventListener(SOCIAL_UPDATED_EVENT,load);};},[activityId]);
 return <div onClick={e=>e.stopPropagation()} data-swipe-ignore="true" className="mt-2 text-xs text-movenotes-muted"><button type="button" className="min-h-11 underline underline-offset-2" onClick={()=>setOpen(true)}>{label==='Only you'||label==='Sharing…'||label==='Sharing options'?label:`Shared with ${label}`}</button>{open&&<ActivitySharingSheet activityId={activityId} onClose={()=>setOpen(false)}/>}</div>;
}
