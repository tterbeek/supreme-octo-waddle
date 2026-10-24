import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MemoryReader from '../components/MemoryReader';
import type { MemoryContext } from '../lib/memories';
import { supabase } from '../supabaseClient';

const emptyContext: MemoryContext = {};
export function useMemoryReader(onUpdated: (id: string) => void = () => {}) {
  const location=useLocation(); const navigate=useNavigate();
  const [identityVersion,setIdentityVersion]=useState(0);
  useEffect(()=>{const {data}=supabase.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'||event==='SIGNED_IN')setIdentityVersion(n=>n+1);});return()=>data.subscription.unsubscribe();},[]);
  const params=new URLSearchParams(location.search); const id=params.get('memory');
  const state=location.state as { memoryContext?: MemoryContext; memoryOpened?: boolean } | null;
  const openMemory=useCallback((activityId: string, context: MemoryContext={})=>{
    const search=new URLSearchParams(location.search);search.set('memory',activityId);
    navigate({pathname:location.pathname,search:search.toString()},{state:{...location.state,memoryContext:context,memoryOpened:true}});
  },[location,navigate]);
  const close=()=>{if(state?.memoryOpened){navigate(-1);}else{params.delete('memory');navigate({pathname:location.pathname,search:params.toString()},{replace:true});}};
  const reader=id ? <MemoryReader key={`${identityVersion}:${id}`} id={id} context={state?.memoryContext||emptyContext} onClose={close} onUpdated={()=>onUpdated(id)}
    onShowAll={()=>{params.set('view','all');navigate({pathname:location.pathname,search:params.toString()},{replace:true,state:{...location.state,memoryContext:{...state?.memoryContext,selection:'all',ids:undefined}}});}}
    onChange={(next,removed)=>{params.set('memory',next);const nextContext=state?.memoryContext;const nextState=removed&&nextContext?.ids?{...location.state,memoryContext:{...nextContext,ids:nextContext.ids.filter(value=>value!==removed)}}:location.state;navigate({pathname:location.pathname,search:params.toString()},{replace:true,state:nextState});}}/> : null;
  return {openMemory,reader};
}
