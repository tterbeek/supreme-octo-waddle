import { useEffect,useMemo,useRef,useState } from 'react';
import { journeyArtworkUrl } from '../../lib/journeyArtwork';
import { journeyGeometry,type JourneyTemplate } from '../../lib/curatedJourneys';
const themes:Record<string,[string,string]>={river:['#e8eff3','#b3cbd6'],sage:['#e8eee5','#c5d3bb'],teal:['#e1eceb','#b2ceca'],olive:['#efeee5','#d5d6bd'],alpine:['#e8efef','#c1d4ce'],forest:['#e5ece8','#bdcfc6'],sea:['#e3eff3','#b0d0dc'],sand:['#f1ede4','#dad1bc'],blossom:['#f2ebed','#dfc8d1'],ocean:['#e4edf4','#b9d2e1']};
/** Original local SVG route artwork, not a remotely fetched map. */
export function LocalJourneyArtwork({template,progress=0}:{template:JourneyTemplate;progress?:number}){
 const geometry=useMemo(()=>journeyGeometry(template,progress),[template,progress]);
 const {unwrapped,bounds}=geometry;const [bg,accent]=themes[template.visualTheme]??themes.sage;
 const width=480,height=220,pad=34;
 const dx=Math.max(.001,bounds[1][0]-bounds[0][0]),dy=Math.max(.001,bounds[1][1]-bounds[0][1]);
 const scale=Math.min((width-pad*2)/dx,(height-pad*2)/dy);
 const project=(p:number[])=>[width/2+(p[0]-(bounds[0][0]+bounds[1][0])/2)*scale,height/2-(p[1]-(bounds[0][1]+bounds[1][1])/2)*scale];
 const path=unwrapped.map((p,i)=>`${i?'L':'M'}${project(p).map(n=>n.toFixed(2)).join(',')}`).join(' ');
 const closest=(p:number[],index:number)=>{let lng=p[0];const ref=unwrapped[Math.round(index/(template.waypoints.length-1)*(unwrapped.length-1))]?.[0]??lng;while(lng-ref>180)lng-=360;while(lng-ref< -180)lng+=360;return project([lng,p[1]]);};
 return <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${template.title}: ${template.waypoints.map(w=>w.name).join(' → ')}`} className="block aspect-[24/11] w-full">
  <rect width={width} height={height} fill={bg}/>
  <path d="M0 175Q100 65 220 140T480 80V220H0Z" fill={accent} opacity=".24"/>
  {[80,160,240,320,400].map(x=><path key={x} d={`M${x} 0V220`} stroke="white" opacity=".28"/>)}
  <path d={path} fill="none" stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
  <path d={path} fill="none" stroke="#597D6F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  {template.waypoints.map((w,i)=>{const [x,y]=closest(w.coordinate,i);return <g key={w.occurrenceId}><circle cx={x} cy={y} r={i===0||i===template.waypoints.length-1?6:4} fill={i===0?'#E48A6C':bg} stroke="#597D6F" strokeWidth="2"/></g>;})}
  <text x="16" y="204" fill="#486858" fontSize="11" fontFamily="system-ui">{template.waypoints[0].name} → {template.waypoints.at(-1)!.name}</text>
 </svg>;
}

/** Direct browser images, shared by library/review/feed; SVG stays visible until loaded. */
export default function JourneyArtwork({template,progress=0}:{template:JourneyTemplate;progress?:number}){
 const url=useMemo(()=>journeyArtworkUrl(template),[template]);
 const frame=useRef<HTMLDivElement>(null);
 const [visible,setVisible]=useState(false),[loaded,setLoaded]=useState<string|null>(null),[failed,setFailed]=useState<string|null>(null);
 useEffect(()=>{
  if(!url||visible||!frame.current)return;
  if(typeof IntersectionObserver==='undefined'){setVisible(true);return;}
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'150px'});
  observer.observe(frame.current);return()=>observer.disconnect();
 },[url,visible]);
 if(!url||failed===url)return <LocalJourneyArtwork template={template} progress={progress}/>;
 return <div ref={frame} className="relative aspect-[24/11] w-full overflow-hidden" data-journey-artwork={template.slug}>
  <div aria-hidden="true" className="absolute inset-0"><LocalJourneyArtwork template={template}/></div>
  {visible&&<img src={url} alt={`Map of ${template.title}: ${template.waypoints.map(w=>w.name).join(' → ')}`} width={720} height={330} loading="lazy" decoding="async"
   className={`absolute inset-0 h-full w-full object-contain ${loaded===url?'opacity-100':'opacity-0'}`}
   onLoad={()=>setLoaded(url)} onError={()=>setFailed(url)}/>}
 </div>;
}
