import { useEffect,useState } from 'react';
import QRCode from 'qrcode';
import { IconCopy,IconCheck } from '@tabler/icons-react';
import ModalSheet from '../ModalSheet';
import DialogSheet from '../DialogSheet';
import { FormActions,FormError } from '../forms/FormLayout';
import { socialCommunity,socialInvite,type Community } from '../../services/social.service';
import { supabase } from '../../supabaseClient';
import { CommunityForm } from './SocialForms';

export default function CommunitySettings({id,onClose,onChanged}:{id:string;onClose:()=>void;onChanged:()=>void}) {
 const [community,setCommunity]=useState<Community|null>(null);const [uid,setUid]=useState('');const [version,setVersion]=useState(0);const [qr,setQr]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [edit,setEdit]=useState(false);
 const [confirm,setConfirm]=useState<{action:string;user?:string;label:string}|null>(null);
 const [inviteLink,setInviteLink]=useState('');const [copied,setCopied]=useState(false);const [copyError,setCopyError]=useState('');
 const [inviteLoading,setInviteLoading]=useState(true);const [inviteNotice,setInviteNotice]=useState('');
 useEffect(()=>{let cancel=false;setError('');void Promise.all([socialCommunity('get',id),supabase.auth.getUser()]).then(([c,a])=>{if(!cancel){setCommunity(c);setUid(a.data.user?.id||'');}}).catch(e=>{if(!cancel)setError(e.message);});return()=>{cancel=true;};},[id,version]);
 const owner=community?.owner_id===uid;const admin=community?.members.some(m=>m.id===uid&&['owner','admin'].includes(m.role));
 useEffect(()=>{
  let cancelled=false;
  if(!community||!uid)return;
  setInviteLink('');setQr('');setCopied(false);setInviteNotice('');setInviteLoading(true);
  if(!admin){setInviteLoading(false);return;}
  void socialInvite('get',id).then(async result=>{
   if(cancelled)return;
   if(result.token){const link=`${window.location.origin}/community/join/${result.token}`;const image=await QRCode.toDataURL(link,{width:300,margin:2,color:{dark:'#374D44',light:'#FFFFFF'}});if(!cancelled){setInviteLink(link);setQr(image);}}
   else if(result.status==='unrecoverable')setInviteNotice('This older invite cannot be redisplayed. Rotate it once to save a reusable QR and link.');
   else if(result.status!=='missing')throw new Error('Could not load invitation.');
  }).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setInviteLoading(false);});
  return()=>{cancelled=true;};
 },[id,admin,community,uid]);
 const perform=async(action:string,user?:string,role?:string)=>{setBusy(true);setError('');try{await socialCommunity(action,id,{...(user?{user_id:user}:{}),...(role?{role}:{})});setConfirm(null);onChanged();if(action==='leave'||action==='delete')onClose();else setVersion(n=>n+1);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const rotate=async()=>{setBusy(true);setError('');setCopied(false);setCopyError('');setInviteLink('');setQr('');try{const result=await socialInvite('rotate',id);if(!result.token)throw new Error('Could not create QR');const link=`${window.location.origin}/community/join/${result.token}`;setInviteLink(link);setQr(await QRCode.toDataURL(link,{width:300,margin:2,color:{dark:'#374D44',light:'#FFFFFF'}}));}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const copyInvite=async()=>{setCopyError('');setCopied(false);try{await navigator.clipboard.writeText(inviteLink);setCopied(true);}catch{setCopyError('Could not copy. Select the link and copy it manually.');}};
 return <ModalSheet title="Community settings" onClose={onClose} busy={busy}><div className="space-y-4">
  {!community&&!error&&<p role="status">Loading Community…</p>}
  <FormError>{error}</FormError>{error&&!community&&<button className="underline" onClick={()=>setVersion(n=>n+1)}>Retry</button>}
  {community&&<>
   <h3 className="text-xl font-semibold">{community.name}</h3><p className="whitespace-pre-wrap">{community.description}</p>
   {admin&&<><button className="min-h-11 underline" onClick={()=>setEdit(true)}>Edit name and rules</button>
    <section className="rounded-xl border p-4 space-y-3"><h4 className="font-semibold">Invite by QR</h4><p className="text-sm text-movenotes-muted">Anyone holding a valid QR can explicitly join after signing in. It can be photographed or forwarded; it does not prove physical presence. New members can see still-shared history.</p>
     <button type="button" disabled={busy||inviteLoading} className="mn-primary disabled:opacity-50" onClick={()=>void rotate()}>{inviteLoading?'Loading invite…':qr?'Rotate QR invite':'Create / rotate QR invite'}</button>
     {inviteNotice&&!inviteLink&&<p className="text-sm text-movenotes-muted">{inviteNotice}</p>}
     {inviteLink&&<><div className="flex flex-col items-center gap-4 sm:flex-row">
      {qr&&<img src={qr} alt="Community invitation QR code" className="w-full max-w-48 shrink-0 rounded-lg"/>}
      <div className="min-w-0 w-full space-y-2"><label htmlFor="community-invite-link" className="block text-sm font-medium">Invitation link</label><input id="community-invite-link" type="text" readOnly value={inviteLink} onFocus={event=>event.currentTarget.select()} className="w-full rounded-lg border bg-transparent p-3 text-sm"/>
       <button type="button" onClick={()=>void copyInvite()} className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm">{copied?<IconCheck size={18}/>:<IconCopy size={18}/>}Copy link</button>
       <p role="status" className="text-xs text-movenotes-muted">{copyError||(copied?'Link copied.':'')}</p>
      </div>
     </div><p className="text-xs text-movenotes-muted">The QR and link are valid for 30 days. Creating another invite invalidates both previous versions, without removing members.</p></>}
    </section></>}
   <section className="space-y-3"><h4 className="font-semibold">Members</h4>{community.members.map(m=><div key={m.id} className="rounded-xl border p-3 space-y-2"><p>{m.name} <span className="text-xs text-movenotes-muted">{m.role}{m.id===uid?' · You':''}</span></p>
    {owner&&m.id!==uid&&<div className="flex flex-wrap gap-3 text-sm"><button className="min-h-11 underline" onClick={()=>void perform('role',m.id,m.role==='admin'?'member':'admin')}>{m.role==='admin'?'Make member':'Make admin'}</button><button className="min-h-11 underline" onClick={()=>setConfirm({action:'transfer',user:m.id,label:`Transfer ownership to ${m.name}?`})}>Transfer ownership</button></div>}
    {admin&&m.id!==uid&&m.role!=='owner'&&(owner||m.role==='member')&&<button className="min-h-11 underline text-sm" onClick={()=>setConfirm({action:'remove',user:m.id,label:`Remove ${m.name}?`})}>Remove member</button>}
   </div>)}</section>
   {owner?<><p className="text-xs text-movenotes-muted">Transfer ownership before leaving. Deleting the Community removes its social history, not anyone's Journal activities.</p><button className="min-h-11 underline" onClick={()=>setConfirm({action:'delete',label:'Delete Community?'})}>Delete Community</button></>:<button className="min-h-11 underline" onClick={()=>setConfirm({action:'leave',label:'Leave Community?'})}>Leave Community</button>}
  </>}
  {edit&&community&&<CommunityForm community={community} onClose={()=>setEdit(false)} onSaved={()=>{setVersion(n=>n+1);onChanged();}}/>}
  {confirm&&<DialogSheet title={confirm.label} onClose={()=>setConfirm(null)} busy={busy}>
   <p>{confirm.action==='transfer'?'You will become an admin. The new owner can manage or delete this Community.':'Access and relevant shares will be revoked. Journal activities stay intact. Rejoining does not restore old sharing consent.'}</p>
   <FormError>{error}</FormError><button className="mn-form-cancel" onClick={()=>setConfirm(null)}>Cancel</button><FormActions><button disabled={busy} onClick={()=>void perform(confirm.action,confirm.user)}>Confirm</button></FormActions>
  </DialogSheet>}
 </div></ModalSheet>;
}
