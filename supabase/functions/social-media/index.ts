import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createSocialMediaHandler } from '../_shared/socialMedia.ts';

const url=Deno.env.get('SUPABASE_URL')!;
Deno.serve(createSocialMediaHandler({
 async viewer(authorization){
  const client=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}}});
  const {data,error}=await client.auth.getUser();
  if(error||!data.user)return null;
  return {async challenge(id){
   const result=await client.rpc('social_challenge_media_path',{p_challenge:id});
   return result.error||!result.data?.path||!result.data?.owner?null:result.data;
  },async profile(activity,author){
   const result=await client.rpc('social_discussion_media_path',{p_activity:activity,p_author:author});
   return result.error||!result.data?.path||!result.data?.owner?null:result.data;
  },async photo(context,photo,thumb){
   const result=await client.rpc('social_media_path',{p_context:context,p_photo:photo,p_thumb:thumb});
   return result.error||!result.data?.path||!result.data?.owner?null:result.data;
  }};
 },
 async sign(bucket,path,seconds){
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const {data,error}=await admin.storage.from(bucket).createSignedUrl(path,seconds);
  return error?null:data?.signedUrl||null;
 }
}));
