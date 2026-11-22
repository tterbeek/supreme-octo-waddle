import { useEffect,useState } from 'react';
import { socialJourneyDetails,type JourneyDetails as Details } from '../../services/social.service';
import { useUnitSystem } from '../../contexts/UnitContext';
import { virtualQuantity } from '../../lib/virtualDistance';
import VirtualDistanceHelp,{contributionExplanation} from './VirtualDistanceHelp';

export default function JourneyDetails({challenge}:{challenge:string}){
 const {unitSystem}=useUnitSystem();const [value,setValue]=useState<Details|null>(null);const [error,setError]=useState('');
 useEffect(()=>{let active=true;void socialJourneyDetails(challenge).then(v=>{if(active)setValue(v);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[challenge]);
 return <div className="space-y-4">
  <VirtualDistanceHelp/>
  {error&&<p role="alert">{error}</p>}
  {!value&&!error&&<p role="status">Loading your contributions…</p>}
  {value&&<>
   <p className="text-sm">Your contribution: {virtualQuantity(value.summary.mine,unitSystem)} virtual {unitSystem==='imperial'?'miles':'km'}. Visible here only to you.</p>
   <div className="space-y-2">{value.own.map(item=><details key={item.id} className="rounded-xl border border-warm-200 p-3">
    <summary className="cursor-pointer min-h-11">{item.title||item.type} · {virtualQuantity(item.amount,unitSystem)} virtual {unitSystem==='imperial'?'miles':'km'} — How this counted</summary>
    <p className="text-sm text-movenotes-muted">{contributionExplanation(item.calculation,unitSystem)}</p>
   </details>)}</div>
   {!value.own.length&&<p className="text-sm text-movenotes-muted">Your eligible shared activities will appear here.</p>}
  </>}
 </div>;
}
