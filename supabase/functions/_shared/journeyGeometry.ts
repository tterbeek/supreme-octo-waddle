/** Curated symbolic routes only. No personal GPS or external routing service. */
export type Coordinate=[number,number];
export type JourneyWaypoint={occurrenceId:string;placeId:string;name:string;nameKey:string;story:string;storyKey:string;coordinate:Coordinate;cumulativeKm:number};
export type JourneyTemplate={slug:string;version:number;title:string;titleKey:string;description:string;descriptionKey:string;geometryVersion:string;visualTheme:string;waypoints:JourneyWaypoint[];targetKm:number;isLoop:boolean;crossesAntimeridian:boolean};
export const GEOMETRY_VERSION='great-circle-v1';
export const EARTH_RADIUS_KM=6371.0088;
const rad=Math.PI/180;
export const normalizeLongitude=(lng:number)=>((lng+180)%360+360)%360-180;
export function validateCoordinate(p:Coordinate){if(p.length!==2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90)throw Error('Invalid curated coordinate');}
export function greatCircleKm(a:Coordinate,b:Coordinate){
 validateCoordinate(a);validateCoordinate(b);
 const dlat=(b[1]-a[1])*rad,dlng=(b[0]-a[0])*rad;
 const h=Math.sin(dlat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dlng/2)**2;
 return 2*EARTH_RADIUS_KM*Math.atan2(Math.sqrt(Math.max(0,h)),Math.sqrt(Math.max(0,1-h)));
}
export function interpolateGeodesic(a:Coordinate,b:Coordinate,fraction:number):Coordinate{
 if(fraction<=0)return [...a];if(fraction>=1)return [...b];
 const angle=greatCircleKm(a,b)/EARTH_RADIUS_KM;
 if(angle<1e-12)return [...a];
 if(Math.abs(Math.sin(angle))<1e-10)throw Error('Ambiguous antipodal leg');
 const left=Math.sin((1-fraction)*angle)/Math.sin(angle),right=Math.sin(fraction*angle)/Math.sin(angle);
 const vector=(p:Coordinate)=>[Math.cos(p[1]*rad)*Math.cos(p[0]*rad),Math.cos(p[1]*rad)*Math.sin(p[0]*rad),Math.sin(p[1]*rad)];
 const av=vector(a),bv=vector(b),v=av.map((n,i)=>n*left+bv[i]*right);
 return [normalizeLongitude(Math.atan2(v[1],v[0])/rad),Math.atan2(v[2],Math.hypot(v[0],v[1]))/rad];
}
export function buildJourney(input:Omit<JourneyTemplate,'targetKm'|'isLoop'|'crossesAntimeridian'|'waypoints'|'geometryVersion'>&{waypoints:Omit<JourneyWaypoint,'cumulativeKm'>[]}):JourneyTemplate{
 if(input.waypoints.length<2)throw Error('A route needs at least two destinations');
 const seen=new Set<string>();let cumulativeKm=0;
 const waypoints=input.waypoints.map((w,i)=>{
  validateCoordinate(w.coordinate);if(!w.occurrenceId||seen.has(w.occurrenceId))throw Error('Duplicate waypoint occurrence');seen.add(w.occurrenceId);
  if(i){const leg=greatCircleKm(input.waypoints[i-1].coordinate,w.coordinate);if(leg<1e-6)throw Error('Duplicate consecutive destinations');cumulativeKm+=leg;}
  return {...w,cumulativeKm:Number(cumulativeKm.toFixed(12))};
 });
 return {...input,geometryVersion:GEOMETRY_VERSION,waypoints,targetKm:Number(cumulativeKm.toFixed(12)),isLoop:greatCircleKm(waypoints[0].coordinate,waypoints.at(-1)!.coordinate)<1e-6,crossesAntimeridian:waypoints.some((w,i)=>i>0&&Math.abs(w.coordinate[0]-waypoints[i-1].coordinate[0])>180)};
}
function unwrap(points:Coordinate[]):Coordinate[]{
 return points.reduce<Coordinate[]>((list,p)=>{let lng=p[0];const previous=list.at(-1);if(previous){while(lng-previous[0]>180)lng-=360;while(lng-previous[0]<-180)lng+=360;}list.push([lng,p[1]]);return list;},[]);
}
/** Split at ±180, retaining both seam endpoints. No long chord across the globe. */
export function splitAntimeridian(points:Coordinate[]):Coordinate[][]{
 if(points.length<2)return [];
 const unwrapped=unwrap(points),lines:Coordinate[][]=[];let line:Coordinate[]=[[normalizeLongitude(unwrapped[0][0]),unwrapped[0][1]]];
 for(let i=1;i<unwrapped.length;i++){
  const a=unwrapped[i-1],b=unwrapped[i];const cellA=Math.floor((a[0]+180)/360),cellB=Math.floor((b[0]+180)/360);
  if(cellA!==cellB){
   const east=b[0]>a[0],boundary=(east?cellA+1:cellA)*360-180;
   const latitude=a[1]+(b[1]-a[1])*(boundary-a[0])/(b[0]-a[0]);
   line.push([east?180:-180,latitude]);if(line.length>=2)lines.push(line);
   line=[[east?-180:180,latitude]];
  }
  const lng=normalizeLongitude(b[0]);line.push([lng,b[1]]);
 }
 if(line.length>=2)lines.push(line);return lines;
}
export function journeyPosition(template:JourneyTemplate,rawKm:number){
 const km=Math.max(0,Math.min(template.targetKm,Number.isFinite(rawKm)?rawKm:0));
 const waypoints=template.waypoints;
 const end=waypoints.findIndex((w,i)=>i>0&&km<=w.cumulativeKm);
 const leg=end<0?waypoints.length-1:end;
 const a=waypoints[leg-1],b=waypoints[leg];
 const fraction=(km-a.cumulativeKm)/(b.cumulativeKm-a.cumulativeKm);
 return {km,leg:leg-1,coordinate:interpolateGeodesic(a.coordinate,b.coordinate,fraction),reached:waypoints.map(w=>km>=w.cumulativeKm),next:waypoints.find(w=>w.cumulativeKm>km)??null,extraKm:Math.max(0,Number.isFinite(rawKm)?rawKm-template.targetKm:0)};
}
function sampleLeg(a:Coordinate,b:Coordinate,start=0,end=1):Coordinate[]{
 if(end<=start)return [];
 const count=Math.max(1,Math.ceil(greatCircleKm(a,b)*(end-start)/60));
 return Array.from({length:count+1},(_,i)=>interpolateGeodesic(a,b,start+(end-start)*i/count));
}
export function journeyGeometry(template:JourneyTemplate,rawKm:number){
 const position=journeyPosition(template,rawKm);const complete:Coordinate[]=[],remaining:Coordinate[]=[],whole:Coordinate[]=[];
 const append=(target:Coordinate[],points:Coordinate[])=>{if(!points.length)return;target.push(...(target.length?points.slice(1):points));};
 for(let i=1;i<template.waypoints.length;i++){
  const a=template.waypoints[i-1],b=template.waypoints[i];
  append(whole,sampleLeg(a.coordinate,b.coordinate));
  const fraction=Math.max(0,Math.min(1,(position.km-a.cumulativeKm)/(b.cumulativeKm-a.cumulativeKm)));
  append(complete,sampleLeg(a.coordinate,b.coordinate,0,fraction));append(remaining,sampleLeg(a.coordinate,b.coordinate,fraction,1));
 }
 const unwrapped=unwrap(whole);
 const lngs=unwrapped.map(p=>p[0]),lats=unwrapped.map(p=>p[1]);
 return {position,completed:splitAntimeridian(complete),remaining:splitAntimeridian(remaining),whole:splitAntimeridian(whole),unwrapped,bounds:[[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]] as [Coordinate,Coordinate]};
}
