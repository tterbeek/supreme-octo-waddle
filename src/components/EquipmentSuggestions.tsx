import { useEffect, useState } from 'react';
import { IconCheck } from '@tabler/icons-react';
import type { Equipment } from '../types';
import { fetchRecentEquipment } from '../services/equipment.service';

export default function EquipmentSuggestions({activityType,equipment,selected,onChange,onOpenAll}:{
 activityType:string;equipment:Equipment[];selected:string[];
 onChange:(ids:string[])=>void;onOpenAll:()=>void;
}) {
 const [snapshot,setSnapshot]=useState<{type:string;items:Equipment[]}|null>(null);
 useEffect(()=>{
  let active=true;
  void fetchRecentEquipment(activityType).then(items=>{if(active)setSnapshot({type:activityType,items});});
  return()=>{active=false;};
 },[activityType]);
 const recent=snapshot?.type===activityType?snapshot.items:[];
 // Include preset/existing selections even if they are outside the two suggestions.
 const items=[...recent,...equipment.filter(e=>selected.includes(e.id)&&!recent.some(r=>r.id===e.id))];
 return <fieldset className="mt-2 space-y-2">
  <legend className="text-sm text-gray-600">Equipment</legend>
  <div className="flex flex-wrap items-center gap-2">{items.map(item=>{
   const checked=selected.includes(item.id);
   return <button type="button" key={item.id} aria-pressed={checked}
    onClick={()=>onChange(checked?selected.filter(id=>id!==item.id):[...selected,item.id])}
    className={`inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border px-3 py-2 text-sm text-left ${checked?'border-movenotes-primary bg-movenotes-primary/10 text-movenotes-primary':'border-warm-300 text-gray-700'}`}>
    {checked&&<IconCheck size={16} aria-hidden="true"/>}<span className="break-words">{item.name}</span>
   </button>;
  })}<button type="button" onClick={onOpenAll} className="min-h-11 text-sm text-movenotes-primary underline">All equipment</button></div>
 </fieldset>;
}
