import { encodeRoute } from '../../supabase/functions/_shared/activityRoute';
import { greatCircleKm,interpolateGeodesic,splitAntimeridian,type Coordinate,type JourneyTemplate } from '../../supabase/functions/_shared/journeyGeometry';
import { mapboxStyle,mapboxToken } from './mapbox';
export const journeyArtworkStyle=import.meta.env.VITE_MAPBOX_JOURNEY_STYLE||mapboxStyle;
/** Fixed route artwork only: no user progress, timestamps, private GPS or remote routing. */
export function journeyArtworkUrl(template:JourneyTemplate,token=mapboxToken,style=journeyArtworkStyle):string|null{
 if(!token.startsWith('pk.')||!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(style)||/^mapbox\/standard(?:-satellite)?$/.test(style))return null;
 const points:Coordinate[]=[];
 for(let i=1;i<template.waypoints.length;i++){
  const a=template.waypoints[i-1].coordinate,b=template.waypoints[i].coordinate;
  const steps=Math.max(1,Math.ceil(greatCircleKm(a,b)/180));
  // Sampling is purely presentational. The canonical distances never change.
  for(let n=points.length?1:0;n<=steps;n++)points.push(interpolateGeodesic(a,b,n/steps));
 }
 const lines=splitAntimeridian(points);
 if(!lines.length)return null;
 const paths=lines.map(line=>{
  const encoded=encodeRoute(line.map(([lng,lat])=>[lat,lng]));
  return `path-3+E48A6C-0.95(${encodeURIComponent(encoded!)})`;
 });
 const stops=template.waypoints.filter((w,i,all)=>all.findIndex(p=>p.placeId===w.placeId)===i)
  .map(w=>`pin-s+597D6F(${w.coordinate[0]},${w.coordinate[1]})`);
 // A global overview deliberately includes both Pacific seam endpoints.
 const latitudes=points.map(p=>p[1]);
 const camera=template.crossesAntimeridian?`[-180,${Math.min(...latitudes).toFixed(5)},180,${Math.max(...latitudes).toFixed(5)}]`:'auto';
 const url=new URL(`https://api.mapbox.com/styles/v1/${style}/static/${[...paths,...stops].join(',')}/${camera}/720x330@2x`);
 url.searchParams.set('padding',template.crossesAntimeridian?'20':'40');
 url.searchParams.set('access_token',token);
 // Default provider logo and attribution are retained. Stable URLs let browsers cache.
 return url.toString().length<=8192?url.toString():null;
}
