import { JOURNEY_POLICY, type ContributionCalculation } from '../../../supabase/functions/_shared/journeyDistance';
import { useUnitSystem } from '../../contexts/UnitContext';
import { challengeDistance, virtualQuantity } from '../../lib/virtualDistance';

export function contributionExplanation(c:ContributionCalculation,unit:'metric'|'imperial'){
 const unitName=unit==='imperial'?'virtual miles':'virtual km';
 const allowance=challengeDistance(1,unit).toLocaleString(undefined,{maximumFractionDigits:2});
 if(c.explanationCode==='participation_already_counted')return "Included in today's participation contribution.";
 if(c.basis==='invalid')return 'Not counted because a recorded measurement is invalid.';
 if(c.basis==='participation')return `Movement without usable measurements adds up to ${allowance} ${unitName} per person per day, alongside any measured movement.`;
 if(c.basis==='recorded_distance')return `Based on ${virtualQuantity(c.recordedDistanceKm??0,unit)} recorded ${unit==='imperial'?'miles':'km'} × ${Number(c.distanceMultiplier).toLocaleString()}. Your pace and effort rating do not change this contribution.`;
 const minutes=Number(c.durationMinutesUsed).toLocaleString(undefined,{maximumFractionDigits:1});
 return `Based on ${minutes} logged minutes, using ${virtualQuantity(Number(JOURNEY_POLICY.virtualKmPerHour)*(c.category==='electric_cycling'?Number(JOURNEY_POLICY.electricTimeFactor):1),unit)} ${unitName} per hour because no supported distance was logged.`;
}
export default function VirtualDistanceHelp(){
 const {unitSystem}=useUnitSystem();const unit=unitSystem==='imperial'?'miles':'km';const allowance=challengeDistance(1,unitSystem).toLocaleString(undefined,{maximumFractionDigits:2});
 return <details className="space-y-2 text-sm">
  <summary className="min-h-11 py-3 text-movenotes-primary cursor-pointer">How activities become virtual distance</summary>
  <p>Cycling sets the baseline. Running, walking and swimming get a boost so different kinds of movement help your Community travel together.</p>
  <ul className="list-disc pl-5 space-y-2">
   <li>A {virtualQuantity(5,unitSystem)} {unit} run adds {virtualQuantity(11.25,unitSystem)} virtual {unit}, however quickly you finish.</li>
   <li>No distance? An hour of movement adds {virtualQuantity(JOURNEY_POLICY.virtualKmPerHour,unitSystem)} virtual {unit}.</li>
   <li>No time or distance? Your activities can still add up to {allowance} virtual {unit} a day, on top of movement with measurements.</li>
  </ul>
  <p>Effort ratings do not change your contribution. Electric bikes contribute half the normal cycling amount. Your Journal keeps its original measurements.</p>
  <p>Only activities that match this challenge and are shared with this Community count. This is a shared adventure, not a fitness score.</p>
  <details className="space-y-2">
   <summary className="min-h-11 py-3 text-movenotes-primary cursor-pointer">See the calculation details</summary>
   <p>We use distance first for cycling, running, walking and swimming: normal cycling ×1, electric cycling ×0.5, running ×2.25, walking ×4 and swimming ×9.</p>
   <p>When that distance is missing, we use logged time at {virtualQuantity(JOURNEY_POLICY.virtualKmPerHour,unitSystem)} virtual {unit} per hour. Electric cycling uses half that hourly amount. Strength and other activities use logged time or the daily allowance.</p>
   <p>Private notes, feelings, GPS and photos are not used in this calculation.</p>
  </details>
 </details>;
}
