import { lazy,Suspense,useEffect,useState } from 'react';
import { socialCuratedRoute,type Challenge,type CuratedRouteDetails } from '../../services/social.service';
import { journeyPosition,type JourneyWaypoint } from '../../lib/curatedJourneys';
import { virtualQuantity } from '../../lib/virtualDistance';
import { useUnitSystem } from '../../contexts/UnitContext';
import ModalSheet from '../ModalSheet';
import JourneyDetails from '../social/JourneyDetails';
const Map=lazy(()=>import('./CuratedJourneyMap'));
export default function CuratedJourneyDetails({challenge}:{challenge:Challenge}){
 const {unitSystem}=useUnitSystem();const unit=unitSystem==='imperial'?'miles':'km';
 const [value,setValue]=useState<CuratedRouteDetails|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[waypoint,setWaypoint]=useState<JourneyWaypoint|null>(null);
 useEffect(()=>{let live=true;setError('');void socialCuratedRoute(challenge.id).then(v=>{if(live)setValue(v);}).catch(()=>{if(live){setValue(null);setError('This challenge could not be loaded. Access may have changed.');}});return()=>{live=false;};},[challenge.id,challenge.total,challenge.state,attempt]);
 if(error)return <div role="alert"><p>{error}</p><button className="min-h-11 underline" onClick={()=>setAttempt(v=>v+1)}>Retry challenge</button></div>;
 if(!value)return <p role="status">Opening the shared route…</p>;
 const {summary,template}=value;const total=Number(summary.total),p=journeyPosition(template,total);
 const current=p.next?.occurrenceId;const reached=p.reached.filter(Boolean).length;
 return <div className="space-y-5">
  <div><h3 className="text-2xl font-semibold break-words">{summary.title}</h3><p className="mt-2 text-movenotes-muted">{template.description}</p></div>
  <Suspense fallback={<div className="h-[320px] rounded-2xl bg-movenotes-primary/10 p-4 sm:h-[460px]" role="status">Opening the map…</div>}><Map template={template} total={total} onWaypoint={setWaypoint}/></Suspense>
  <div role="status" aria-live="polite" aria-atomic="true" className="space-y-1"><p className="text-xl font-semibold text-movenotes-primary">{virtualQuantity(total,unitSystem)} of {virtualQuantity(template.targetKm,unitSystem)} virtual {unit}</p><p className="text-sm text-movenotes-muted">{summary.contributors_count??0} people moving us forward · {reached} of {template.waypoints.length} destinations reached</p></div>
  {summary.state==='closed'&&<p className="text-sm font-medium">Closed{summary.closed_at?' · '+new Date(summary.closed_at).toLocaleDateString():''}{p.next?' — this chapter ended before the final destination.':'.'}</p>}
  {summary.state==='draft'&&<p className="text-sm">Draft — movement starts counting when the challenge is started.</p>}
  {summary.state==='cancelled'&&<p className="text-sm">Cancelled — this challenge is no longer collecting progress.</p>}
  <section className="rounded-2xl bg-movenotes-primary/[0.07] p-4 space-y-2" aria-label={p.next?'Next destination':'Destination reached'}>
   <p className="text-xs uppercase tracking-wide text-movenotes-primary">{p.next?'Next destination':'Destination reached'}</p>
   <h4 className="text-xl font-semibold">{p.next?.name??template.waypoints.at(-1)!.name}</h4>
   {p.next?<p className="text-sm">{virtualQuantity(p.next.cumulativeKm-p.km,unitSystem)} virtual {unit} to go</p>:<p className="text-sm">You reached the final destination together. Take a moment to enjoy how far the group has come.</p>}
   <p className="text-sm text-movenotes-muted">{p.next?.story??template.waypoints.at(-1)!.story}</p>
   {p.extraKm>0&&<p className="text-sm">Another {virtualQuantity(p.extraKm,unitSystem)} virtual {unit} beyond the destination. The route stays at the finish.</p>}
  </section>
  <section aria-label="Destinations"><h4 className="mb-3 font-semibold">Along the way</h4><ol className="space-y-2">{template.waypoints.map((w,index)=>{
   const status=p.reached[index]?'Reached':w.occurrenceId===current?'Next destination':'Still ahead';
   return <li key={w.occurrenceId}><button type="button" className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-warm-200 p-3 text-left" onClick={()=>setWaypoint(w)} aria-current={w.occurrenceId===current?'step':undefined}>
    <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-movenotes-primary ${p.reached[index]?'bg-movenotes-primary text-white':'text-movenotes-primary'}`}>{p.reached[index]?'✓':index+1}</span>
    <span className="min-w-0"><span className="block font-medium break-words">{w.name}</span><span className="block text-xs text-movenotes-muted">{status} · {virtualQuantity(w.cumulativeKm,unitSystem)} virtual {unit}</span></span>
   </button></li>;
  })}</ol></section>
  <p className="text-xs text-movenotes-muted">A virtual journey between destinations, not a navigation route. The marker is your shared progress, not anyone’s live location.</p>
  <details><summary className="min-h-11 py-3 cursor-pointer text-sm text-movenotes-primary">How movement contributes</summary><JourneyDetails challenge={challenge.id}/></details>
  {waypoint&&<ModalSheet title={waypoint.name} onClose={()=>setWaypoint(null)}><div className="space-y-4"><p>{waypoint.story}</p><p>{virtualQuantity(waypoint.cumulativeKm,unitSystem)} virtual {unit} from the start · {p.reached[template.waypoints.findIndex(w=>w.occurrenceId===waypoint.occurrenceId)]?'Reached':'Still ahead'}</p><p className="text-sm text-movenotes-muted">A destination in your shared virtual adventure, not a record of a physical visit.</p></div></ModalSheet>}
 </div>;
}
