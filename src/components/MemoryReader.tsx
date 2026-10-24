import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import ModalSheet from './ModalSheet';
import EditActivityModal from '../features/activities/EditActivityModal';
import DeleteActivityDialog from './DeleteActivityDialog';
import GalleryLightbox from './GalleryLightbox';
import { useGalleryLightbox } from '../hooks/useGalleryLightbox';
import { NOTE_STORAGE_BUCKET, signStorageValues } from '../services/storage.service';
import { buildGalleryItemsForActivity } from '../lib/photos';
import { loadMemory, memoryNeighbors, type MemoryActivity, type MemoryNeighbors } from '../services/memories.service';
import { memoryTitle, type MemoryContext } from '../lib/memories';
import { ACTIVITY_TYPES } from '../config/activityTypes';
import { resolveFeelingState } from '../lib/feelings';
import { formatDistance, formatDurationMinutes } from '../lib/units';
import { useUnitSystem } from '../contexts/UnitContext';
import { allowFormNavigation } from '../lib/formLifecycle';

const duringLabels: Record<string,string> = { sad:'Struggling',neutral:'Neutral',smile:'Flowing',happy:'Energized' };
const afterLabels: Record<string,string> = { sad:'Drained',smile:'Relaxed',happy:'Good',spark:'Uplifted' };
export default function MemoryReader({ id, context, onClose, onChange, onUpdated, onShowAll }: {
  id: string; context: MemoryContext; onClose: () => void; onChange: (id: string, removed?: string) => void; onUpdated: () => void; onShowAll?: () => void;
}) {
  const [activity,setActivity] = useState<MemoryActivity | null>(null);
  const [neighbors,setNeighbors] = useState<MemoryNeighbors>({});
  const [loading,setLoading] = useState(true); const [error,setError] = useState(false);
  const [retry,setRetry] = useState(0); const [edit,setEdit] = useState(false);
  const [menu,setMenu] = useState(false); const [remove,setRemove] = useState(false);
  const [urls,setUrls] = useState<Record<string,string>>({});
  const [photoIndex,setPhotoIndex] = useState(0);
  const [failedPhotos,setFailedPhotos] = useState<string[]>([]);
  const touch = useRef<{x:number;y:number}|null>(null);
  const gallery = useGalleryLightbox(NOTE_STORAGE_BUCKET);
  const { unitSystem } = useUnitSystem();
  useEffect(() => {
    let cancelled=false; setLoading(true); setError(false); setActivity(null); setUrls({}); setMenu(false); setFailedPhotos([]);
    void Promise.all([loadMemory(id),memoryNeighbors(id,context)]).then(([value,next]) => {
      if(cancelled)return; setActivity(value);setNeighbors(next);setLoading(false);
      const photos=value ? buildGalleryItemsForActivity(value) : [];
      setPhotoIndex(Math.max(0,photos.findIndex(p=>p.photoId===context.photoId)));
      const paths=photos.map(p=>p.imagePath||p.thumbPath).filter((p):p is string=>!!p);
      void signStorageValues(paths).then(signed=>{if(!cancelled)setUrls(signed);}).catch(()=>{});
    }).catch(()=>{if(!cancelled){setError(true);setLoading(false);}});
    return ()=>{cancelled=true;};
  },[id,context,retry]);
  const items=activity ? buildGalleryItemsForActivity(activity) : [];
  const item=items[photoIndex]; const path=item?.imagePath||item?.thumbPath;
  const feelings=resolveFeelingState(activity || {});
  const config=ACTIVITY_TYPES[activity?.type || 'other'] || ACTIVITY_TYPES.other;
  const refresh=()=>{setEdit(false);setRetry(n=>n+1);onUpdated();};
  const earlier=()=>{if(neighbors.earlier)onChange(neighbors.earlier);};
  const later=()=>{if(neighbors.later)onChange(neighbors.later);};
  const navigationReady = Boolean(activity && !loading && !error);
  const navigation = <nav aria-label="Browse memories" className="flex items-center justify-between gap-2">
    <button className="min-h-11 rounded-xl border p-3 disabled:opacity-40" disabled={!navigationReady || !neighbors.later} onClick={later}>← Later</button>
    <span className="text-xs text-center tabular-nums text-movenotes-muted" aria-live="polite">{navigationReady && neighbors.total ? `${neighbors.position} of ${neighbors.total}` : ''}</span>
    <button className="min-h-11 rounded-xl border p-3 disabled:opacity-40" disabled={!navigationReady || !neighbors.earlier} onClick={earlier}>Earlier →</button>
  </nav>;
  return <ModalSheet title="Memory" presentation="fullscreen" layerDepth={1} onClose={onClose}
    sheetClassName="[&>.mn-form-body]:flex-1" footer={navigation}>
    {loading ? <p role="status">Opening memory…</p> : error ? <div role="alert"><p>Couldn't load this memory.</p><button onClick={()=>setRetry(n=>n+1)}>Retry</button></div> : !activity ? <p>This activity is unavailable. <button onClick={onClose} className="underline">Back to browsing</button></p> : <article className="space-y-6 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-between items-center"><button onClick={onClose} className="text-sm underline">Back to browsing</button><div className="relative"><button aria-label="Memory actions" aria-expanded={menu} onClick={()=>setMenu(!menu)} className="p-3"><MoreHorizontal size={20}/></button>{menu&&<div className="absolute right-0 z-10 w-44 rounded-xl border bg-movenotes-surface p-2 shadow"><button className="block p-3 text-sm" onClick={()=>{setMenu(false);setEdit(true);}}>Edit activity</button><button className="block p-3 text-sm" onClick={()=>{setMenu(false);setRemove(true);}}>Delete activity</button></div>}</div></div>
      {context.selection&&<div className="flex min-h-11 flex-wrap items-center justify-between gap-2 text-sm"><span className="text-movenotes-muted">{context.selection==='selected'?'Selected moments':'All activities'}</span>{context.selection==='selected'&&onShowAll&&<button type="button" className="min-h-11 underline" onClick={onShowAll}>All activities</button>}</div>}
      {item && <section aria-label="Activity photos" className="space-y-2">
        <button className="block w-full rounded-2xl overflow-hidden bg-movenotes-bg" aria-label="Open photo fullscreen" onClick={()=>gallery.openGallery(items,photoIndex)}>{path&&urls[path]&&!failedPhotos.includes(path) ? <img src={urls[path]} alt={`Activity photo ${photoIndex+1}`} className="w-full max-h-[55dvh] object-contain" onError={()=>setFailedPhotos(prev=>[...prev,path])}/> : <span className="block p-10 text-sm">Photo unavailable</span>}</button>
        {items.length>1&&<div className="flex justify-between text-sm"><button className="p-2 disabled:opacity-40" disabled={photoIndex===0} onClick={()=>setPhotoIndex(n=>n-1)}>Previous photo</button><span className="p-2">{photoIndex+1} / {items.length}</span><button className="p-2 disabled:opacity-40" disabled={photoIndex===items.length-1} onClick={()=>setPhotoIndex(n=>n+1)}>Next photo</button></div>}
      </section>}
      <div style={{touchAction:'pan-y'}} onTouchStart={e=>{touch.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}} onTouchEnd={e=>{const start=touch.current;touch.current=null;if(!start)return;const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.7){if(dx<0)earlier();else later();}}} className="space-y-6">
        <header aria-live="polite"><p className="text-sm text-movenotes-muted">{new Date(`${activity.date}T12:00:00`).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p><h1 className="text-3xl font-semibold mt-2 break-words">{memoryTitle(activity,config.label)}</h1></header>
        {activity.notes&&<p className="whitespace-pre-wrap break-words leading-relaxed text-lg">{activity.notes}</p>}
        {(feelings.during||feelings.after||activity.effort!=null)&&<dl className="flex flex-wrap gap-6 text-sm">
          {feelings.during&&<div><dt className="text-movenotes-muted">During</dt><dd>{duringLabels[feelings.during]}</dd></div>}
          {feelings.after&&<div><dt className="text-movenotes-muted">After</dt><dd>{afterLabels[feelings.after]}</dd></div>}
          {activity.effort!=null&&<div><dt className="text-movenotes-muted">Effort</dt><dd>{activity.effort} / 5</dd></div>}
        </dl>}
        <div className="flex flex-wrap items-center gap-3 text-sm text-movenotes-muted border-t border-movenotes-border pt-4"><config.Icon size={18}/><span>{config.label}</span>{activity.distance_km!=null&&<span>{formatDistance(activity.distance_km,unitSystem)}</span>}{activity.duration_min!=null&&<span>{formatDurationMinutes(activity.duration_min)}</span>}</div>
      </div>
    </article>}
    {edit&&activity&&<EditActivityModal activity={activity} onClose={()=>setEdit(false)} onUpdated={refresh} onDeleted={refresh}/>}
    {remove&&<DeleteActivityDialog activityId={id} onClose={()=>setRemove(false)} onDeleted={()=>{
      // The delete has committed, but its busy overlay unregisters next render.
      // Permit this completed-save handoff through the existing navigation guard.
      allowFormNavigation(()=>{onUpdated();const next=neighbors.earlier||neighbors.later;if(next)onChange(next,id);else onClose();});
    }}/>}
    <GalleryLightbox open={gallery.open} items={gallery.items} activeIndex={gallery.activeIndex} onActiveIndexChange={gallery.setActiveIndex} onClose={gallery.closeGallery} signedImages={gallery.signedImages} signedThumbs={gallery.signedThumbs}/>
  </ModalSheet>;
}
