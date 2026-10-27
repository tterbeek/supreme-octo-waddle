import { useEffect,useState } from 'react';
import { Link,useNavigate,useParams } from 'react-router-dom';
import { socialHome,socialInvite } from '../services/social.service';
import { supabase } from '../supabaseClient';
import { SOCIAL_V2_ENABLED } from '../config/social';
import FormPage from '../components/forms/FormPage';
import { FormActions,FormError } from '../components/forms/FormLayout';
import { SocialRuleSheet } from '../components/social/SocialForms';
import type { SocialAudience } from '../services/social.service';

export default function CommunityJoinPage() {
 const {token=''}=useParams();const navigate=useNavigate();const [preview,setPreview]=useState<{status?:string;name?:string;description?:string}|null>(null);const [signedIn,setSignedIn]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [retry,setRetry]=useState(0);const [rule,setRule]=useState<SocialAudience|null>(null);
 useEffect(()=>{let cancel=false;if(!SOCIAL_V2_ENABLED)return;setError('');void Promise.all([socialInvite('preview',undefined,token),supabase.auth.getUser()]).then(([p,a])=>{if(!cancel){setPreview(p);setSignedIn(!!a.data.user);}}).catch(()=>{if(!cancel)setError('Could not check this invitation.');});return()=>{cancel=true;};},[token,retry]);
 const join=async()=>{setBusy(true);setError('');try{const result=await socialInvite('join',undefined,token);if(result.status!=='joined'||!result.id)throw new Error(result.status==='removed'?'This QR cannot be used to rejoin after removal. Ask an admin for a new invitation.':'This invitation is unavailable.');const h=await socialHome();const destination=h.audiences.find(a=>a.community_id===result.id);if(destination){setRule(destination);}else navigate('/circle');}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 const finish=()=>{navigate(rule?`/circle?audience=${rule.id}`:'/circle');};
 return <FormPage title="Community invitation" backTo="/" busy={busy}>
  {!SOCIAL_V2_ENABLED?<p>Community invitations are not available in this environment yet.</p>:<>
   <FormError>{error}</FormError>{error&&<button className="min-h-11 underline" onClick={()=>setRetry(n=>n+1)}>Retry</button>}
   {!preview&&!error&&<p role="status">Checking invitation…</p>}
   {preview?.status==='valid'?<><h2 className="text-xl font-semibold">{preview.name}</h2><p className="whitespace-pre-wrap">{preview.description}</p><p className="text-sm">This is a closed Community. Joining is optional and does not connect you in anyone's Circle or share your activities. Community challenges include all members; only activities shared here contribute. Members can see still-shared Community history. Anyone with a valid QR can request to join; it does not prove physical presence.</p>
    {signedIn?<FormActions><button disabled={busy} onClick={()=>void join()}>Join Community</button></FormActions>:<div className="flex flex-wrap gap-4"><Link className="min-h-11 py-3 underline" to={`/login?next=${encodeURIComponent(`/community/join/${token}`)}`}>Sign in to join</Link><Link className="min-h-11 py-3 underline" to={`/signup?next=${encodeURIComponent(`/community/join/${token}`)}`}>Create account</Link></div>}
   </>:preview&&<p>This invitation is invalid, expired, rotated, or temporarily unavailable. Ask an admin for a current QR.</p>}
  </>}
  {rule&&<SocialRuleSheet audience={rule} onClose={finish} onSaved={()=>{}}/>}
 </FormPage>;
}
