export type EquipmentClassificationValue={category:'bike'|'shoes'|'other'|null;electricAssist:'none'|'electric'|'unknown'|null};
const tags=[{id:'shoes',label:'Shoes'},{id:'bike',label:'Bike'},{id:'electric_bike',label:'Electric bike'},{id:'other',label:'Other'}] as const;
export default function EquipmentClassification({value,onChange}:{value:EquipmentClassificationValue;onChange:(value:EquipmentClassificationValue)=>void}){
 const tag=value.category==='bike'?(value.electricAssist==='electric'?'electric_bike':'bike'):value.category;
 return <fieldset className="space-y-2">
  <legend className="text-sm font-medium">Tag (optional)</legend>
  <div className="flex flex-wrap gap-2">{tags.map(item=><button key={item.id} type="button" aria-pressed={tag===item.id}
   className={`inline-flex min-h-11 items-center rounded-full border px-3 py-2 text-sm ${tag===item.id?'border-movenotes-primary bg-movenotes-primary/10 text-movenotes-primary':'border-warm-300 text-gray-700'}`}
   onClick={()=>{
    const next=tag===item.id?null:item.id;
    onChange(next==='electric_bike'?{category:'bike',electricAssist:'electric'}:
     next==='bike'?{category:'bike',electricAssist:'none'}:
     {category:next,electricAssist:null});
   }}>{item.label}</button>)}</div>
 </fieldset>;
}
