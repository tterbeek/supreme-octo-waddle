import { useEffect, useState } from 'react';
import { socialMapConsent, type SocialMapConsent as Consent } from '../../services/social.service';
import { SOCIAL_UPDATED_EVENT } from '../../config/social';

export default function SocialMapConsent({ editable = false }: { editable?: boolean }) {
 const [value,setValue]=useState<Consent|null>(null);
 const [editing,setEditing]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  const load=()=>{void socialMapConsent().then(v=>{if(active)setValue(v);}).catch(()=>{});};
  load();window.addEventListener(SOCIAL_UPDATED_EVENT,load);
  return()=>{active=false;window.removeEventListener(SOCIAL_UPDATED_EVENT,load);};
 },[]);
 const save=async(enabled:boolean)=>{
  setBusy(true);setError('');
  try{setValue(await socialMapConsent(enabled));setEditing(false);}
  catch{setError('Could not save map sharing. Please try again.');}
  finally{setBusy(false);}
 };
 if(!value||(!value.has_route&&!value.decided)||(!editable&&value.decided))return null;
 const choosing=!value.decided||editing;
 return <section aria-label="Map sharing" className="rounded-xl border border-warm-200 bg-warm-100 p-4 space-y-3">
  {choosing?<>
   <h2 className="font-semibold">Share protected maps?</h2>
   <p className="text-sm text-movenotes-muted">Include maps with activities you share with Circle and Communities, including activities already shared and automatic shares. Route sections within about 500 m of the start and finish are hidden, including return visits. The surrounding area may still be recognizable.</p>
   <div className="flex flex-wrap gap-2">
    <button type="button" disabled={busy} onClick={()=>void save(true)} className="min-h-11 rounded-full bg-movenotes-primary px-4 text-sm text-primary-text disabled:opacity-50">Share protected maps</button>
    <button type="button" disabled={busy} onClick={()=>void save(false)} className="min-h-11 rounded-full border border-warm-300 px-4 text-sm disabled:opacity-50">Keep maps private</button>
   </div>
  </>:<div className="flex flex-wrap items-center justify-between gap-2">
   <p className="text-sm">{value.enabled?'Protected maps are shared with Circle and Communities.':'Maps are kept private.'}</p>
   <button type="button" className="min-h-11 text-sm underline" onClick={()=>setEditing(true)}>Change map sharing</button>
  </div>}
  {error&&<p role="alert" className="text-sm">{error}</p>}
 </section>;
}
