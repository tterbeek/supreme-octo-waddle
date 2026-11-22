import type { UnitSystem } from './units';
export { targetToKm } from '../../supabase/functions/_shared/journeyDistance';
export function challengeDistance(value:number|string,units:UnitSystem){
 return Number(value)/(units==='imperial'?1.609344:1);
}
export function virtualQuantity(value:number|string,units:UnitSystem){
 return challengeDistance(value,units).toLocaleString(undefined,{maximumFractionDigits:1});
}
