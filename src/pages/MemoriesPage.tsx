import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { memoryArchive, memoryFeature, memoryFeatureAction, memoryPage, loadMemory, type ArchiveMonth, type MemoryActivity } from '../services/memories.service';
import { useMemoryReader } from '../hooks/useMemoryReader';
import { monthRange,featureLabels } from '../lib/memories';
import { getActivityPhotos } from '../lib/photos';
import { ACTIVITY_TYPES } from '../config/activityTypes';
import { signStorageValues } from '../services/storage.service';
import { supabase } from '../supabaseClient';
import MemoryHighlightPhotos from '../components/MemoryHighlightPhotos';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MemoryActivityPreview from '../components/MemoryActivityPreview';
import MemoryMonthCard from '../components/MemoryMonthCard';

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
  const selected=params.get('view')!=='all';
  const requestedYear=params.get('year');
  const year=(requestedYear&&years.includes(requestedYear)?requestedYear:null)||month?.slice(0,4)||years[0];
  const yearIndex=years.indexOf(year);
  const previousYear=years[yearIndex+1];
  const nextYear=yearIndex>0?years[yearIndex-1]:undefined;
  const change=(key:string,value:string|null)=>{const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);if(key==='year')next.delete('month');setParams(next,{replace:true});};
  const openMonth=(key:string,all=false)=>{const next=new URLSearchParams(params);next.set('month',key);next.set('year',key.slice(0,4));if(all)next.set('view','all');setParams(next,{replace:true});};
  const openActivity=(activity:MemoryActivity,key:string,selection=selected)=>openMemory(activity.id,{...monthRange(key),selection:selection?'selected':'all'});
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
    void memoryPage(range.start,range.end,undefined,selected).then(data=>{if(request.current!==ticket)return;setRows(data);setHasMore(data.length===40);}).catch(()=>{if(request.current===ticket)setPageError(true);}).finally(()=>{if(request.current===ticket)setPageLoading(false);});
  },[month,version,selected]);
  const more=async()=>{if(!month||pageLoading)return;const ticket=request.current;setPageLoading(true);setPageError(false);try{const range=monthRange(month);const data=await memoryPage(range.start,range.end,rows.at(-1),selected);if(ticket!==request.current)return;setRows(prev=>[...prev,...data]);setHasMore(data.length===40);}catch{setPageError(true);}finally{if(ticket===request.current)setPageLoading(false);}};
  useEffect(()=>{
    let cancelled=false;
    const paths=[...months.filter(m=>m.month.startsWith(year||'')).flatMap(m=>[...(m.thumbs||[]),...(m.moments||[]).flatMap(r=>getActivityPhotos(r).slice(0,1).map(p=>p.thumb_path||p.image_path))]),...rows.flatMap(r=>getActivityPhotos(r).slice(0,1).map(p=>p.thumb_path||p.image_path)),...(feature?.activity?getActivityPhotos(feature.activity).map(p=>p.image_path||p.thumb_path):[])].filter((p):p is string=>!!p);
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
    {!!months.length&&<div className="space-y-2">
      <div role="group" aria-label="Activity selection" className="flex rounded-full border border-movenotes-border p-1">
        <button type="button" aria-pressed={selected} onClick={()=>change('view',null)} className={`min-h-11 flex-1 rounded-full px-3 text-sm ${selected?'bg-movenotes-primary/15 text-movenotes-primary':'text-movenotes-muted'}`}>Selected moments</button>
        <button type="button" aria-pressed={!selected} onClick={()=>change('view','all')} className={`min-h-11 flex-1 rounded-full px-3 text-sm ${!selected?'bg-movenotes-primary/15 text-movenotes-primary':'text-movenotes-muted'}`}>All activities</button>
      </div>
      {selected&&<p className="text-xs text-movenotes-muted">Photos and personal notes, plus occasional activities with less recorded context.</p>}
    </div>}
    {!months.length&&<p className="py-10 text-movenotes-muted">Your activities will be here to revisit whenever you like.</p>}
    {!month&&feature?.activity&&<section ref={featureElement} className="rounded-2xl overflow-hidden border border-movenotes-border bg-movenotes-surface">
      <MemoryHighlightPhotos key={`${feature.activity.id}:${getActivityPhotos(feature.activity).map(photo=>photo.id).join(',')}`} photos={getActivityPhotos(feature.activity)} urls={urls}
        onOpen={photoId=>openMemory(feature.activity!.id,{...monthRange(feature.activity!.date.slice(0,7)),photoId,selection:selected?'selected':'all',includeId:feature.activity!.id})}/>
      <button className="w-full text-left" onClick={()=>openMemory(feature.activity!.id,{...monthRange(feature.activity!.date.slice(0,7)),selection:selected?'selected':'all',includeId:feature.activity!.id})}>
        <div className="p-5 space-y-2"><p className="text-sm text-movenotes-muted">{featureLabels[feature.tier??2]}</p><h2 className="text-xl font-semibold">{feature.activity.title||ACTIVITY_TYPES[feature.activity.type]?.label||'Activity'}</h2><p className="text-sm">{new Date(`${feature.activity.date}T12:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</p>{feature.activity.notes&&<p className="line-clamp-3 whitespace-pre-wrap">{feature.activity.notes.slice(0,180)}</p>}</div>
      </button>
      <button className="text-xs underline px-5 pb-4 text-movenotes-muted" onClick={()=>{setHideError(false);void memoryFeatureAction(feature.day,feature.id!,true).then(()=>setFeature(null)).catch(()=>setHideError(true));}}>Hide this suggestion</button>{hideError&&<p role="alert" className="px-5 pb-3 text-sm">Couldn't hide this suggestion. Please try again.</p>}
    </section>}
    {!!months.length&&<section className="space-y-4">
      {years.length>1&&<>
      <h2 className="text-xl font-semibold">Through the years</h2>
      <nav aria-label="Archive year" className="relative grid grid-cols-3 items-center gap-2 py-2">
        <span aria-hidden="true" className="absolute inset-x-6 top-1/2 h-px bg-movenotes-border"/>
        <button type="button" disabled={!previousYear} aria-label={previousYear?`Show year ${previousYear}`:'No earlier year'}
          className="relative min-h-11 flex items-center justify-center gap-1 rounded-full bg-movenotes-bg px-2 text-sm text-movenotes-muted disabled:opacity-30"
          onClick={()=>previousYear&&change('year',previousYear)}><ChevronLeft size={16} aria-hidden="true"/><span>{previousYear||'—'}</span></button>
        <span aria-current="true" aria-label={`Selected year ${year}`} className="relative flex min-h-11 items-center justify-center rounded-full border border-movenotes-primary/20 bg-movenotes-bg px-3 font-semibold text-movenotes-primary">{year}</span>
        <button type="button" disabled={!nextYear} aria-label={nextYear?`Show year ${nextYear}`:'No later year'}
          className="relative min-h-11 flex items-center justify-center gap-1 rounded-full bg-movenotes-bg px-2 text-sm text-movenotes-muted disabled:opacity-30"
          onClick={()=>nextYear&&change('year',nextYear)}><span>{nextYear||'—'}</span><ChevronRight size={16} aria-hidden="true"/></button>
      </nav>
      </>}
      {month ? <>
        <button className="underline text-sm" onClick={()=>change('month',null)}>← All months</button>
        <h3 className="text-xl">{new Date(`${month}-01T12:00:00`).toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</h3>
        <div className="space-y-3">{rows.map(activity=><MemoryActivityPreview key={activity.id} activity={activity} urls={urls} onOpen={()=>openActivity(activity,month)}/>)}</div>
        {pageLoading&&<p role="status">Loading activities…</p>}
        {pageError&&<p role="alert">Couldn't load activities. <button className="underline" onClick={()=>rows.length?void more():refresh()}>Retry</button></p>}
        {hasMore&&<button disabled={pageLoading} className="border rounded-xl p-3 w-full" onClick={()=>void more()}>More activities</button>}
        {selected&&<button type="button" className="min-h-11 underline text-sm" onClick={()=>change('view','all')}>Show all {months.find(m=>m.month===month)?.count||''} activities</button>}
      </> : <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">{months.filter(m=>m.month.startsWith(year)).map(m=><MemoryMonthCard key={m.month} month={m} selected={selected} urls={urls}
        onOpenMonth={()=>openMonth(m.month,selected&&m.personal_count===0)} onShowAll={()=>openMonth(m.month,true)}
        onOpenActivity={activity=>openActivity(activity,m.month,true)}/>)}</div>}

    </section>}
    {reader}
  </div>;
}
