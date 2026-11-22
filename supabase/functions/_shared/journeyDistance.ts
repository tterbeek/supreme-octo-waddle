import policyV1 from './journey-distance-v1.json' with { type: 'json' };
export const JOURNEY_POLICY = policyV1;
export type BikeMode = 'conventional'|'electric'|'unknown'|'not_applicable';
export type BikeSource = 'equipment'|'conflicting_bikes'|'import'|'unspecified'|null;
export type BikeSnapshot = {mode:BikeMode;source:BikeSource};
export type ContributionCalculation = {
 basis:'recorded_distance'|'recorded_duration'|'participation'|'invalid';
 rawJourneyKm:string;policyVersion:string;category:string;resolvedBikeMode:BikeMode;
 bikeModeSource:BikeSource;durationMinutesUsed:string|null;referenceSpeedKmh:string|null;
 recordedDistanceKm:string|null;distanceMultiplier:string|null;
 effortSource:'not_used';effortFactor:string|null;explanationCode:string;
 diagnostic:string|null;
};
type Fraction={n:bigint;d:bigint};
function decimal(value:unknown):Fraction|null {
 if(typeof value!=='number'&&typeof value!=='string')return null;
 if(typeof value==='number'&&!Number.isFinite(value))return null;
 const match=String(value).match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
 if(!match)return null;
 const exp=Number(match[4]||0)-(match[3]?.length||0);
 if(Math.abs(exp)>100||match[2].length+(match[3]?.length||0)>100)return null;
 const n=BigInt(match[2]+(match[3]||''))*(match[1]==='-'?-1n:1n);
 return exp>=0?{n:n*10n**BigInt(exp),d:1n}:{n,d:10n**BigInt(-exp)};
}
function multiply(a:Fraction,b:Fraction):Fraction{return {n:a.n*b.n,d:a.d*b.d};}
function divide(a:Fraction,b:Fraction):Fraction{return {n:a.n*b.d,d:a.d*b.n};}
function format(a:Fraction,places=12):string {
 const scale=10n**BigInt(places), negative=a.n<0n;
 const n=negative?-a.n:a.n;
 const rounded=(n*scale+a.d/2n)/a.d;
 const result=(rounded/scale).toString()+'.'+(rounded%scale).toString().padStart(places,'0');
 return (negative?'-':'')+result;
}
export function targetToKm(value:string,imperial:boolean):string|null {
 const parsed=decimal(value);
 if(!parsed||parsed.n<=0n)return null;
 return format(imperial?multiply(parsed,decimal('1.609344')!):parsed);
}
export function resolveJourneyBike(input:{
 type:string;bikes?:Array<{category?:string|null;electric_assist?:string|null}>;sportSubtype?:string|null;
}):BikeSnapshot {
 if(input.type!=='ride')return {mode:'not_applicable',source:null};
 const bikes=(input.bikes??[]).filter(b=>b.category==='bike');
 const modes=new Set(bikes.map(b=>b.electric_assist==='none'?'conventional':b.electric_assist==='electric'?'electric':'unknown'));
 if(modes.size>1)return {mode:'unknown',source:'conflicting_bikes'};
 if(modes.size===1&&!modes.has('unknown'))return {mode:[...modes][0] as BikeMode,source:'equipment'};
 const subtype=(input.sportSubtype??'').toLowerCase().replace(/[ _-]/g,'');
 if(policyV1.electricSubtypes.includes(subtype))return {mode:'electric',source:'import'};
 if(policyV1.conventionalSubtypes.includes(subtype))return {mode:'conventional',source:'import'};
 return {mode:'unknown',source:'unspecified'};
}
export function calculateJourneyContribution(input:{
 activityType:string;durationMinutes?:unknown;distanceKm?:unknown;effort?:unknown;bike?:BikeSnapshot;
},policy=policyV1):ContributionCalculation {
 if(policy.id!==policyV1.id)throw new Error('Unsupported virtual-distance policy');
 const bike=input.activityType==='ride'?(input.bike??{mode:'unknown',source:'unspecified'}):{mode:'not_applicable' as const,source:null};
 const categories:Record<string,string>=policy.activityCategories;
 const category=input.activityType==='ride'&&bike.mode==='electric'?'electric_cycling':categories[input.activityType]??'other';
 const result:ContributionCalculation={
  basis:'participation',rawJourneyKm:'0.000000000000',policyVersion:policy.id,category,
  resolvedBikeMode:bike.mode,bikeModeSource:bike.source,durationMinutesUsed:null,referenceSpeedKmh:null,
  effortSource:'not_used',effortFactor:null,explanationCode:'participation',
  recordedDistanceKm:null,distanceMultiplier:null,diagnostic:null,
 };
 const duration=input.durationMinutes==null?{n:0n,d:1n}:decimal(input.durationMinutes);
 const distance=input.distanceKm==null?{n:0n,d:1n}:decimal(input.distanceKm);
 if(!duration||!distance||duration.n<0n||distance.n<0n){
  return {...result,basis:'invalid',diagnostic:'invalid_measurement',explanationCode:'invalid_measurement',effortFactor:null};
 }
 const multipliers:Record<string,string>=policy.distanceMultipliers;
 let amount:Fraction;
 if(distance.n>0n&&multipliers[category]){
  result.basis='recorded_distance';result.recordedDistanceKm=format(distance);result.distanceMultiplier=multipliers[category];
  amount=multiply(distance,decimal(multipliers[category])!);
 }else if(duration.n>0n){
  result.basis='recorded_duration';result.durationMinutesUsed=format(duration);
  const timeFactor=category==='electric_cycling'?policy.electricTimeFactor:'1';
  amount=divide(multiply(multiply(duration,decimal(policy.virtualKmPerHour)!),decimal(timeFactor)!),decimal('60')!);
 }else return {...result,explanationCode:distance.n>0n?'no_distance_conversion':'participation'};
 if(amount.n>=10n**26n*amount.d)return {...result,basis:'invalid',rawJourneyKm:'0.000000000000',diagnostic:'invalid_measurement',explanationCode:'invalid_measurement',durationMinutesUsed:null,referenceSpeedKmh:null};
 result.rawJourneyKm=format(amount);
 result.explanationCode=result.basis;
 return result;
}
