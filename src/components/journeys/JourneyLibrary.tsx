import { useState } from 'react';
import { IconArrowLeft,IconChevronRight } from '@tabler/icons-react';
import ModalSheet from '../ModalSheet';
import { FormActions } from '../forms/FormLayout';
import { curatedJourneys,type JourneyTemplate } from '../../lib/curatedJourneys';
import { virtualQuantity } from '../../lib/virtualDistance';
import { useUnitSystem } from '../../contexts/UnitContext';
import JourneyArtwork from './JourneyArtwork';
export default function JourneyLibrary({onChoose,onClose}:{onChoose:(template:JourneyTemplate)=>void;onClose:()=>void}){
 const [selected,setSelected]=useState<JourneyTemplate|null>(null);const {unitSystem}=useUnitSystem();const unit=unitSystem==='imperial'?'miles':'km';
 return <ModalSheet title={selected?'Review route':'Choose a map route'} sheetClassName="max-w-5xl" onClose={onClose}><div className="space-y-5">
  {selected?<>
   <button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm text-movenotes-primary" onClick={()=>setSelected(null)}><IconArrowLeft size={18}/>All routes</button>
   <div className="overflow-hidden rounded-2xl"><JourneyArtwork template={selected}/></div>
   <h3 className="text-2xl font-semibold">{selected.title}</h3><p className="text-movenotes-muted">{selected.description}</p>
   <p className="font-medium">Fixed target: {virtualQuantity(selected.targetKm,unitSystem)} virtual {unit}</p>
   <ol className="space-y-3">{selected.waypoints.map((w,i)=><li key={w.occurrenceId} className="flex items-baseline gap-3"><span className="text-sm text-movenotes-muted">{i+1}</span><span className="font-medium">{w.name}</span><span className="ml-auto text-sm text-movenotes-muted">{virtualQuantity(w.cumulativeKm,unitSystem)} {unit}</span></li>)}</ol>
   <p className="text-sm text-movenotes-muted">A virtual journey between destinations, not a navigation route.</p>
   <p className="text-sm">The route fixes the target. Your Community’s currently shared activities move the group along it using the existing Virtual distance rules.</p>
   <FormActions><button type="button" onClick={()=>onChoose(selected)}>Use this route</button></FormActions>
  </>:<>
   <p className="text-sm text-movenotes-muted">Choose somewhere to go together. Routes are ordered from shorter to longer; take as much time as you need.</p>
   <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{curatedJourneys.map(t=><button type="button" key={t.slug} aria-label={`Preview ${t.title}`} onClick={()=>setSelected(t)} className="flex flex-col overflow-hidden rounded-2xl border border-warm-200 bg-white/25 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-movenotes-primary">
    <JourneyArtwork template={t}/><span className="flex flex-1 flex-col gap-2 p-4"><span className="text-lg font-semibold">{t.title}</span><span className="text-sm text-movenotes-muted">{t.description}</span><span className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-movenotes-primary"><span>About {virtualQuantity(t.targetKm,unitSystem)} virtual {unit} · {t.waypoints.length} stops</span><IconChevronRight size={18}/></span></span>
   </button>)}</div>
  </>}
 </div></ModalSheet>;
}
