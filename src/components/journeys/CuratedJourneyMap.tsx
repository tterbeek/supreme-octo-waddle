import { useEffect,useRef,useState } from 'react';
import * as mapboxgl from 'mapbox-gl/esm';
import 'mapbox-gl/dist/mapbox-gl.css';
import { mapboxStyle,mapboxToken } from '../../lib/mapbox';
import { journeyGeometry,type JourneyTemplate,type JourneyWaypoint } from '../../lib/curatedJourneys';
const geo=(coordinates:number[][][])=>({type:'Feature' as const,properties:{},geometry:{type:'MultiLineString' as const,coordinates}});
export default function CuratedJourneyMap({template,total,onWaypoint}:{template:JourneyTemplate;total:number;onWaypoint:(w:JourneyWaypoint)=>void}){
 const container=useRef<HTMLDivElement>(null),instance=useRef<mapboxgl.Map|null>(null);
 const current=useRef({total,onWaypoint});current.current={total,onWaypoint};
 const positionMarker=useRef<mapboxgl.Marker|null>(null);
 const markers=useRef<{marker:mapboxgl.Marker;button:HTMLButtonElement;index:number}[]>([]);
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0);
 function update(map:mapboxgl.Map){
  const g=journeyGeometry(template,current.current.total);
  (map.getSource('journey-complete') as mapboxgl.GeoJSONSource|undefined)?.setData(geo(g.completed));
  (map.getSource('journey-remaining') as mapboxgl.GeoJSONSource|undefined)?.setData(geo(g.remaining));
  (map.getSource('journey-position') as mapboxgl.GeoJSONSource|undefined)?.setData({type:'Feature',properties:{},geometry:{type:'Point',coordinates:g.position.coordinate}});
  positionMarker.current?.setLngLat(g.position.coordinate);
  for(const {button,index} of markers.current){const reached=g.position.reached[index],dot=button.firstElementChild as HTMLSpanElement;dot.textContent=reached?'✓':String(index+1);dot.style.background=reached?'#597D6F':'#F3F5F0';dot.style.color=reached?'white':'#365B4D';button.setAttribute('aria-label',`${template.waypoints[index].name} · ${reached?'Reached':'Still ahead'}`);}
 }
 useEffect(()=>{
  if(!container.current)return;
  let map:mapboxgl.Map|undefined,stopped=false;setLoading(true);setError('');
  if(!mapboxToken.startsWith('pk.')){setLoading(false);setError('The map is unavailable. Your progress and destinations are still below.');return;}
  const whole=journeyGeometry(template,0);
  const timeout=window.setTimeout(()=>{if(!stopped){setLoading(false);setError('The map is taking longer to load. Your progress and destinations are still available.');}},20_000);
  try{
   map=new mapboxgl.Map({container:container.current,accessToken:mapboxToken,style:`mapbox://styles/${import.meta.env.VITE_MAPBOX_JOURNEY_STYLE||mapboxStyle}`,projection:'mercator',bounds:whole.bounds,fitBoundsOptions:{padding:45,maxZoom:9,duration:0},maxPitch:0,dragRotate:false,pitchWithRotate:false,cooperativeGestures:true});
   instance.current=map;map.scrollZoom.disable();map.touchZoomRotate.disableRotation();
   map.getCanvas().setAttribute('aria-label','Shared challenge route. Use arrow keys to pan, plus and minus to zoom; destinations are also listed below.');
   map.addControl(new mapboxgl.NavigationControl({showCompass:false}),'top-right');
   map.on('load',()=>{
    if(stopped||!map)return;
    // Keep the configured basemap, with a calm cooler land/water treatment.
    for(const layer of map.getStyle().layers??[]){
     if(layer.type==='background')map.setPaintProperty(layer.id,'background-color','#F2F5F3');
     if(layer.type==='fill'&&layer.id==='water')map.setPaintProperty(layer.id,'fill-color','#D7E6EC');
     if(layer.type==='fill'&&['land','landcover','landuse'].includes(layer.id))map.setPaintProperty(layer.id,'fill-color','#E3EBDD');
    }
    map.addSource('journey-complete',{type:'geojson',data:geo([])});map.addSource('journey-remaining',{type:'geojson',data:geo([])});
    map.addSource('journey-position',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Point',coordinates:template.waypoints[0].coordinate}}});
    map.addLayer({id:'journey-remaining',source:'journey-remaining',type:'line',paint:{'line-color':'#8D9FA7','line-width':3,'line-dasharray':[2,2]},layout:{'line-cap':'round','line-join':'round'}});
    map.addLayer({id:'journey-casing',source:'journey-complete',type:'line',paint:{'line-color':'#F7FAF6','line-width':8},layout:{'line-cap':'round','line-join':'round'}});
    map.addLayer({id:'journey-complete',source:'journey-complete',type:'line',paint:{'line-color':'#597D6F','line-width':4},layout:{'line-cap':'round','line-join':'round'}});
    map.addLayer({id:'journey-position-halo',source:'journey-position',type:'circle',paint:{'circle-radius':13,'circle-color':'#E48A6C','circle-opacity':.24}});
    map.addLayer({id:'journey-position',source:'journey-position',type:'circle',paint:{'circle-radius':7,'circle-color':'#D97C60','circle-stroke-width':2,'circle-stroke-color':'#FFFDF8'}});
    markers.current=template.waypoints.map((w,index)=>{
     const button=document.createElement('button');button.type='button';button.style.cssText='width:44px;height:44px;border:0;background:transparent;display:grid;place-items:center;cursor:pointer';
     const dot=document.createElement('span');dot.style.cssText='width:26px;height:26px;display:grid;place-items:center;border-radius:50%;border:2px solid #597D6F;font:600 11px system-ui';button.appendChild(dot);
     // Separate the two occurrences on closed loops; the timeline always has both.
     const offset: [number,number]=template.isLoop&&index===0?[-14,0]:template.isLoop&&index===template.waypoints.length-1?[14,0]:[0,0];
     button.addEventListener('click',()=>current.current.onWaypoint(w));
     const marker=new mapboxgl.Marker({element:button,offset}).setLngLat(w.coordinate).addTo(map!);return {marker,button,index};
    });
    const position=document.createElement('div');position.setAttribute('role','img');position.setAttribute('aria-label','Our shared position');position.style.cssText='width:18px;height:18px;border-radius:50%;background:#D97C60;border:2px solid #FFFDF8;box-shadow:0 0 0 5px #E48A6C55;z-index:2;pointer-events:none';
    positionMarker.current=new mapboxgl.Marker({element:position}).setLngLat(template.waypoints[0].coordinate).addTo(map);
    update(map);map.resize();window.clearTimeout(timeout);setLoading(false);setError('');
   });
   map.on('error',()=>{if(!stopped){setLoading(false);setError('The map could not load. Your progress and destinations are still available.');}});
   map.getCanvas().addEventListener('webglcontextlost',()=>{if(!stopped){setLoading(false);setError('The map is unavailable in this browser. Your progress and destinations are still available.');}});
  }catch{setLoading(false);setError('The map could not start. Your progress and destinations are still available.');}
  const observer=new ResizeObserver(()=>map?.resize());observer.observe(container.current);
  return()=>{stopped=true;window.clearTimeout(timeout);observer.disconnect();markers.current.forEach(m=>m.marker.remove());markers.current=[];positionMarker.current?.remove();positionMarker.current=null;map?.remove();instance.current=null;};
  // A template version is immutable. Progress updates change sources, never the camera or instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[template.slug,template.version,attempt]);
 useEffect(()=>{if(instance.current?.getSource('journey-complete'))update(instance.current);},[total]);
 const focus=(whole:boolean)=>{const map=instance.current;if(!map)return;if(whole)map.fitBounds(journeyGeometry(template,0).bounds,{padding:45,maxZoom:9,duration:0});else{const p=journeyGeometry(template,current.current.total).position.coordinate;let lng=p[0];while(lng-map.getCenter().lng>180)lng-=360;while(lng-map.getCenter().lng< -180)lng+=360;map.jumpTo({center:[lng,p[1]],zoom:Math.max(map.getZoom(),5)});}};
 return <div className="space-y-2">
  <div className="relative h-[320px] overflow-hidden rounded-2xl bg-[#E6EEED] shadow-sm sm:h-[460px]" aria-label="Curated challenge map"><div ref={container} style={{position:'absolute',inset:0}}/>
   {loading&&<p role="status" className="absolute left-3 top-3 rounded-xl bg-movenotes-bg/95 p-3 text-sm">Opening the map…</p>}
   {error&&<div role="status" className="absolute left-3 right-14 top-3 rounded-xl bg-movenotes-bg/95 p-3 text-sm"><p>{error}</p><button type="button" onClick={()=>setAttempt(v=>v+1)} className="min-h-11 underline">Retry map</button></div>}
  </div>
  <div className="flex flex-wrap gap-2"><button type="button" disabled={loading||!!error} className="min-h-11 rounded-full border border-warm-200 px-4 text-sm disabled:opacity-50" onClick={()=>focus(true)}>Whole route</button><button type="button" disabled={loading||!!error} className="min-h-11 rounded-full border border-warm-200 px-4 text-sm disabled:opacity-50" onClick={()=>focus(false)}>Our position</button></div>
 </div>;
}
