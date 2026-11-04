import { ACTIVITY_TYPES } from '../config/activityTypes';

export default function EquipmentActivityTypes({value,onChange}:{value:string[];onChange:(types:string[])=>void}) {
 return <fieldset className="space-y-2">
  <legend className="text-sm font-medium">Activity types</legend>
  <p className="text-xs text-movenotes-muted">Choose where this equipment should be suggested. You can select more than one.</p>
  <div className="grid grid-cols-2 gap-2">{Object.values(ACTIVITY_TYPES).filter(t=>t.id!=='any').map(t=>
   <label key={t.id} className="flex min-h-11 items-center gap-2 rounded-xl border border-warm-200 px-3 py-2 text-sm">
    <input type="checkbox" checked={value.includes(t.id)} onChange={event=>onChange(event.target.checked?[...value,t.id]:value.filter(id=>id!==t.id))}/>{t.label}
   </label>)}</div>
 </fieldset>;
}
