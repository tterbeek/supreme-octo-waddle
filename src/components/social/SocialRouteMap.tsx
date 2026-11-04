import { useEffect, useRef, useState } from 'react';
import { IconMap2, IconMaximize } from '@tabler/icons-react';
import ModalSheet from '../ModalSheet';
import { socialRoute } from '../../services/social.service';
import { sharedSegmentsMapUrl } from '../../lib/sharedActivityRoute';
import type { RoutePoint } from '../../../supabase/functions/_shared/activityRoute';
import { mapboxToken } from '../../lib/mapbox';

export default function SocialRouteMap({activityId,preview=true}:{activityId:string;preview?:boolean}) {
 const target=useRef<HTMLDivElement>(null);
 const [visible,setVisible]=useState(false);
 const [open,setOpen]=useState(false);
 const [segments,setSegments]=useState<RoutePoint[][]|null>(null);
 const [loaded,setLoaded]=useState(false);
 const [failed,setFailed]=useState(false);
 const [retry,setRetry]=useState(0);
 const configured=mapboxToken.startsWith('pk.');
 useEffect(()=>{
  if(!target.current||!configured)return;
  const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){setVisible(true);observer.disconnect();}},{rootMargin:'150px'});
  observer.observe(target.current);return()=>observer.disconnect();
 },[configured]);
 useEffect(()=>{
  if(!configured||!(open||(preview&&visible)))return;
  let active=true;const controller=new AbortController();
  setLoaded(false);setFailed(false);setSegments(null);
  void socialRoute(activityId,controller.signal).then(value=>{if(active){setSegments(value);setLoaded(true);}})
   .catch(()=>{if(active){setFailed(true);setLoaded(true);}});
  return()=>{active=false;controller.abort();};
 },[activityId,configured,open,preview,visible,retry]);
 if(!configured)return null;
 const image=segments?sharedSegmentsMapUrl(segments):null;
 const map=<>{image?<img src={image} alt="Shared activity map with start and finish hidden" className="w-full rounded-xl" loading="lazy" onError={()=>setFailed(true)}/>:
  !loaded?<p role="status" className="p-3 text-xs text-movenotes-muted">Loading protected map…</p>:null}
  {failed&&<div className="text-sm text-movenotes-muted">Map unavailable. <button type="button" className="min-h-11 underline" onClick={()=>setRetry(n=>n+1)}>Retry</button></div>}</>;
 return <div ref={target} className="mx-auto w-full max-w-lg pt-2" onClick={event=>event.stopPropagation()}>
  {preview?<div className="relative rounded-xl bg-movenotes-map shadow-sm">{map}{image&&<button type="button" aria-label="Open protected shared map" onClick={()=>setOpen(true)} className="absolute bottom-6 right-2 min-h-11 min-w-11 rounded-full bg-white/85 text-movenotes-primary"><IconMaximize className="mx-auto" size={22}/></button>}</div>
   :<button type="button" onClick={()=>setOpen(true)} className="inline-flex min-h-11 items-center gap-2 text-sm text-movenotes-primary"><IconMap2 size={18}/>View route</button>}
  {open&&<ModalSheet title="Shared activity map" onClose={()=>setOpen(false)} presentation="fullscreen">
   {map}<p className="mt-2 text-xs text-movenotes-muted">Start and finish areas are hidden.</p>
  </ModalSheet>}
 </div>;
}
