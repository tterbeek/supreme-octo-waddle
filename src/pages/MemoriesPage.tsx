import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { memoryArchive, memoryFeature, memoryFeatureAction, memoryPage, loadMemory, type ArchiveMonth, type MemoryActivity } from '../services/memories.service';
import { useMemoryReader } from '../hooks/useMemoryReader';
import { monthRange,featureLabels } from '../lib/memories';
import { getActivityPhotos } from '../lib/photos';
import { ACTIVITY_TYPES } from '../config/activityTypes';
import { signStorageValues } from '../services/storage.service';
import { supabase } from '../supabaseClient';

function Photo({path,urls,className=''}:{path?:string|null;urls:Record<string,string>;className?:string}) {
  return path&&urls[path] ? <img loading="lazy" src={urls[path]} alt="" className={className} onError={e=>{e.currentTarget.style.display='none';}}/> : null;
}
export default function MemoriesPage() {
  const [params,setParams]=useSearchParams();
  const [months,setMonths]=useState<ArchiveMonth[]>([]);const [rows,setRows]=useState<MemoryActivity[]>([]);
  const [feature,setFeature]=useState<{day:string;id?:string|null;tier?:number;activity?:MemoryActivity|null}|null>(null);
  const [urls,setUrls]=useState<Record<string,string>>({});
  const [loading,setLoading]=useState(true);const [pageLoading,setPageLoading]=useState(false);
  const [error,setError]=useState(false);const [pageError,setPageError]=useState(false);const [hideError,setHideError]=useState(false);
  const [hasMore,setHasMore]=useState(false);const [version,setVersion]=useState(0);
  const featureElement=useRef<HTMLDivElement>(null); const request=useRef(0);
  const refresh=useCallback(()=>setVersion(n=>n+1),[]);
  const {openMemory,reader}=useMemoryReader(refresh);
  const years=[...new Set(months.map(m=>m.month.slice(0,4)))];
  const requestedMonth=params.get('month');
  const month=requestedMonth&&/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)?requestedMonth:null;
  const requestedYear=params.get('year');
  const year=(requestedYear&&years.includes(requestedYear)?requestedYear:null)||month?.slice(0,4)||years[0];
  const change=(key:string,value:string|null)=>{const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);if(key==='year')next.delete('month');setParams(next,{replace:true});};
  useEffect(()=>{
    let cancelled=false;setError(false);
    void Promise.all([memoryArchive(),memoryFeature()]).then(async([archive,selected])=>{
      const activity=selected.id ? await loadMemory(selected.id) : null;
      if(cancelled)return;setMonths(archive);setFeature({...selected,activity});setLoading(false);
    }).catch(()=>{if(!cancelled){setError(true);setLoading(false);}});
    return()=>{cancelled=true;};
  },[version]);
  useEffect(()=>{
    let day=new Date().toDateString();
    const check=()=>{const next=new Date().toDateString();if(next!==day){day=next;refresh();}};
    const timer=window.setInterval(check,30_000);document.addEventListener('visibilitychange',check);
    return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',check);};
  },[refresh]);
  // No module/global account caches: clear private state on account changes.
  useEffect(()=>{const {data}=supabase.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'||event==='SIGNED_IN'){setMonths([]);setRows([]);setFeature(null);setUrls({});refresh();}});return()=>data.subscription.unsubscribe();},[refresh]);
  useEffect(()=>{
    const ticket=++request.current;setRows([]);setPageError(false);setHasMore(false);
    if(!month)return;const range=monthRange(month);setPageLoading(true);
    void memoryPage(range.start,range.end).then(data=>{if(request.current!==ticket)return;setRows(data);setHasMore(data.length===40);}).catch(()=>{if(request.current===ticket)setPageError(true);}).finally(()=>{if(request.current===ticket)setPageLoading(false);});
  },[month,version]);
  const more=async()=>{if(!month||pageLoading)return;const ticket=request.current;setPageLoading(true);setPageError(false);try{const range=monthRange(month);const data=await memoryPage(range.start,range.end,rows.at(-1));if(ticket!==request.current)return;setRows(prev=>[...prev,...data]);setHasMore(data.length===40);}catch{setPageError(true);}finally{if(ticket===request.current)setPageLoading(false);}};
  useEffect(()=>{
    let cancelled=false;
    const paths=[...months.filter(m=>m.month.startsWith(year||'')).flatMap(m=>m.thumbs||[]),...rows.flatMap(r=>getActivityPhotos(r).slice(0,1).map(p=>p.thumb_path||p.image_path)),...(feature?.activity?getActivityPhotos(feature.activity).slice(0,1).map(p=>p.image_path||p.thumb_path):[])].filter((p):p is string=>!!p);
    void signStorageValues([...new Set(paths)]).then(signed=>{if(!cancelled)setUrls(signed);}).catch(()=>{});
    return()=>{cancelled=true;};
  },[months,rows,feature,year]);
  useEffect(()=>{
    const element=featureElement.current;if(!element||!feature?.id||!feature.activity||month)return;
    let visible=false;let recorded=false;
    const record=()=>{if(!visible||recorded||document.visibilityState!=='visible')return;recorded=true;
      void memoryFeatureAction(feature.day,feature.id!).then(()=>observer.disconnect()).catch(()=>{recorded=false;});};
    const observer=new IntersectionObserver(entries=>{visible=entries.some(e=>e.isIntersecting&&e.intersectionRatio>=0.5);record();},{threshold:0.5});
    observer.observe(element);document.addEventListener('visibilitychange',record);
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',record);};
  },[feature,month]);
  if(loading)return <p role="status" className="py-12 text-center">Opening Memories…</p>;
  if(error)return <div role="alert" className="py-12"><p>Couldn't load Memories.</p><button className="underline p-3" onClick={refresh}>Retry</button></div>;
  return <div className="space-y-8 py-4">
    <header><h1 className="text-2xl font-semibold">Memories</h1><p className="text-sm text-movenotes-muted mt-1">Your movement moments, across time.</p></header>
    {!months.length&&<p className="py-10 text-movenotes-muted">Your activities will be here to revisit whenever you like.</p>}
    {!month&&feature?.activity&&<section ref={featureElement} className="rounded-2xl overflow-hidden border border-movenotes-border bg-movenotes-surface">
      <button className="w-full text-left" onClick={()=>openMemory(feature.activity!.id,monthRange(feature.activity!.date.slice(0,7)))}>
        <Photo path={getActivityPhotos(feature.activity)[0]?.image_path||getActivityPhotos(feature.activity)[0]?.thumb_path} urls={urls} className="w-full max-h-80 object-cover"/>
        <div className="p-5 space-y-2"><p className="text-sm text-movenotes-muted">{featureLabels[feature.tier??2]}</p><h2 className="text-xl font-semibold">{feature.activity.title||ACTIVITY_TYPES[feature.activity.type]?.label||'Activity'}</h2><p className="text-sm">{new Date(`${feature.activity.date}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</p>{feature.activity.notes&&<p className="line-clamp-3 whitespace-pre-wrap">{feature.activity.notes.slice(0,180)}</p>}</div>
      </button>
      <button className="text-xs underline px-5 pb-4 text-movenotes-muted" onClick={()=>{setHideError(false);void memoryFeatureAction(feature.day,feature.id!,true).then(()=>setFeature(null)).catch(()=>setHideError(true));}}>Hide this suggestion</button>{hideError&&<p role="alert" className="px-5 pb-3 text-sm">Couldn't hide this suggestion. Please try again.</p>}
    </section>}
    {!!months.length&&<section className="space-y-4">
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Through the years</h2><label className="text-sm">Year <select aria-label="Archive year" className="bg-transparent border rounded-lg p-2 ml-2" value={year} onChange={e=>change('year',e.target.value)}>{years.map(y=><option key={y}>{y}</option>)}</select></label></div>
      {month ? <><button className="underline text-sm" onClick={()=>change('month',null)}>← All months</button><h3 className="text-xl">{new Date(`${month}-01T12:00:00`).toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</h3><div className="space-y-3">{rows.map(activity=>{const config=ACTIVITY_TYPES[activity.type]||ACTIVITY_TYPES.other;const photo=getActivityPhotos(activity)[0];return <button key={activity.id} className="w-full text-left rounded-2xl border border-movenotes-border bg-movenotes-surface p-4 flex gap-4" onClick={()=>openMemory(activity.id,monthRange(month))}><div className="w-16 h-20 shrink-0 rounded-lg overflow-hidden bg-movenotes-bg flex items-center justify-center">{photo ? <Photo path={photo.thumb_path||photo.image_path} urls={urls} className="w-full h-full object-cover"/> : <config.Icon size={28}/>}</div><div className="min-w-0"><p className="text-xs text-movenotes-muted">{activity.date} · {config.label}</p><h4 className="font-semibold break-words">{activity.title||config.label}</h4>{activity.notes&&<p className="text-sm line-clamp-2 whitespace-pre-wrap mt-1">{activity.notes}</p>}</div></button>;})}</div>{pageLoading&&<p role="status">Loading activities…</p>}{pageError&&<p role="alert">Couldn't load activities. <button className="underline" onClick={()=>rows.length?void more():refresh()}>Retry</button></p>}{hasMore&&<button disabled={pageLoading} className="border rounded-xl p-3 w-full" onClick={()=>void more()}>More activities</button>}</> : <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{months.filter(m=>m.month.startsWith(year)).map(m=><button key={m.month} className="text-left rounded-2xl overflow-hidden border border-movenotes-border bg-movenotes-surface" onClick={()=>change('month',m.month)}>{m.thumbs?.length>0&&<div className="flex h-28 overflow-hidden">{m.thumbs.filter(Boolean).map((p,i)=><Photo key={`${p}:${i}`} path={p} urls={urls} className="min-w-0 flex-1 w-1/3 h-full object-cover"/>)}</div>}<div className="p-5"><h3 className="text-lg font-semibold">{new Date(`${m.month}-01T12:00:00`).toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</h3><p className="text-sm text-movenotes-muted">{m.count} {m.count===1?'activity':'activities'}</p></div></button>)}</div>}
    </section>}
    {reader}
  </div>;
}
