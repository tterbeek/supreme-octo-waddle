import { supabase } from '../supabaseClient';
import { SOCIAL_UPDATED_EVENT } from '../config/social';
import { socialMediaUrl } from '../lib/socialMedia';
import type { Json,Database } from '../database.types';

export type SocialAudience = { id:string;kind:'circle'|'community';name:string;community_id:string|null;role:'owner'|'admin'|'member'|null;mode:'manual'|'all'|'types';types:string[];description:string|null };
export type SocialHome = {enabled:boolean;circle?:string;audiences:SocialAudience[]};
export type SocialContext = {id:string;audience:string;kind:'circle'|'community';community:string|null;name:string};
export type SocialActivity = {id:string;date:string;shared_at:string;author_id:string;author:string;title:string|null;type:string;distance_km:number|null;duration_min:number|null;public_note:string|null;photos:Array<{id:string;order:number}>;contexts:SocialContext[];comment_count?:number;reaction_counts?:Array<{reaction:string;count:number}>};
export type SocialSettings = {private:boolean;public_note:string|null;legacy_photo:boolean;has_legacy_photo:boolean;photos:Array<{id:string;shared:boolean;thumb:string}>;audiences:Array<{id:string;name:string;shared:boolean}>};
export type SocialComment = {id:string;author_id:string;author:string;body:string;created_at:string;can_delete:boolean;has_avatar?:boolean};
export type Conversation = {can_moderate:boolean;comments:SocialComment[];reactions:Array<{reaction:string;count:number}>;my_reaction:string|null;blocked?:boolean;reports?:Array<{id:string;reason:string;comment_id:string|null}>;has_more?:boolean;before?:{created_at:string;id:string}|null;comment_count?:number};
export type Community = {id:string;name:string;description:string;owner_id:string;members:Array<{id:string;name:string;role:'owner'|'admin'|'member'}>};
export type Challenge = {id:string;title:string;metric:'distance'|'duration'|'count'|'days';target:number;scope:'collective'|'personal';types:string[];starts_on:string;ends_on:string;time_zone:string;total:number;mine:number;participating:boolean;state:'upcoming'|'active'|'completed'|'cancelled';has_cover?:boolean;cover_updated_at?:string|null};

type SocialFunction = 'social_home'|'social_set_rule'|'social_activity'|'social_community'|'social_invite'|'social_feed'|'social_discussion'|'social_challenges'|'social_own_comments'|'social_delete_own_comment'|'social_remove_community_activity';
async function call<T>(name:SocialFunction,args:Record<string,Json|undefined>={},mutates=false):Promise<T> {
  const {data,error}=await supabase.rpc(name as keyof Database['public']['Functions'],args as never);
  if(error)throw new Error(error.message);
  if(mutates)window.dispatchEvent(new Event(SOCIAL_UPDATED_EVENT));
  return data as unknown as T;
}
export const socialHome=async()=>{const home=await call<SocialHome>('social_home');return {...home,audiences:home.audiences||[]};};
export const socialRule=(audience:string,mode:string,types:string[])=>call<void>('social_set_rule',{p_audience:audience,p_mode:mode,p_types:types,p_zone:Intl.DateTimeFormat().resolvedOptions().timeZone},true);
export const socialSettings=(id:string,change?:Json)=>call<SocialSettings>('social_activity',{p_activity:id,...(change?{p_change:change}:{})},!!change);
export const socialCommunity=(action:string,id?:string,data:Json={})=>call<Community&{ok?:boolean}>('social_community',{p_action:action,p_id:id,p_data:data},action!=='get');
export const socialInvite=(action:string,community?:string,token?:string)=>call<{status?:string;name?:string;description?:string;token?:string;id?:string;expires_at?:string}>('social_invite',{p_action:action,p_community:community,p_token:token},action!=='preview'&&action!=='get');
export const socialFeed=(audience?:string,before?:SocialActivity,activity?:string)=>call<SocialActivity[]>('social_feed',{p_audience:audience,p_activity:activity,...(before?{p_before:{date:before.date,shared_at:before.shared_at,id:before.id}}:{})});
export const socialConversation=(activity:string,action='read',data:Json={})=>call<Conversation>('social_discussion',{p_activity:activity,p_action:action,p_data:data},action!=='read');
export async function socialHistory(activity:string,pages=1) {
 let value=await socialConversation(activity);
 for(let page=1;page<pages&&value.has_more&&value.before;page++){
  const older=await socialConversation(activity,'read',{before:value.before});
  const seen=new Set<string>();const comments=[...older.comments,...value.comments].filter(c=>{if(seen.has(c.id))return false;seen.add(c.id);return true;});
  value={...value,comments,has_more:older.has_more,before:older.before};
 }
 return value;
}
export const socialChallenges=(community:string,action='list',data:Json={})=>call<Challenge[]>('social_challenges',{p_community:community,p_action:action,p_data:data},action!=='list');
export async function socialChallengeCover(challenge:string):Promise<string>{
 const {data,error}=await supabase.functions.invoke('social-media',{body:{challenge}});
 if(error||!data?.url)throw new Error('Cover unavailable');return socialMediaUrl(data.url,import.meta.env.VITE_SUPABASE_URL);
}
export type OwnComments={comments:Array<{id:string;body:string;created_at:string}>;has_more:boolean;before:{created_at:string;id:string}|null};
export const socialOwnComments=(before?:OwnComments['before'])=>call<OwnComments>('social_own_comments',before?{p_before:before}:{});
export const socialDeleteOwnComment=(id:string)=>call<boolean>('social_delete_own_comment',{p_id:id},true);
export const socialRemovePlacement=(activity:string,community:string)=>call<void>('social_remove_community_activity',{p_activity:activity,p_community:community},true);
export async function socialCommentAvatar(activity:string,author:string):Promise<string>{
 const {data,error}=await supabase.functions.invoke('social-media',{body:{activity,author}});
 if(error||!data?.url)throw new Error('Photo unavailable');return socialMediaUrl(data.url,import.meta.env.VITE_SUPABASE_URL);
}
export async function socialPhoto(context:string,photo:string,thumb=false):Promise<string> {
  const {data,error}=await supabase.functions.invoke('social-media',{body:{context,photo,thumb}});
  if(error||!data?.url)throw new Error('Photo unavailable');return socialMediaUrl(data.url,import.meta.env.VITE_SUPABASE_URL);
}
