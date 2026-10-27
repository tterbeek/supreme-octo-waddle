-- Addendum release gate: one thread through every currently authorized route.
begin;
insert into auth.users(id,email) values
 ('a8000000-0000-4000-8000-000000000001','one-owner@example.test'),
 ('b8000000-0000-4000-8000-000000000001','one-circle@example.test'),
 ('c8000000-0000-4000-8000-000000000001','one-community@example.test'),
 ('d8000000-0000-4000-8000-000000000001','one-later@example.test');
insert into user_preferences(user_id,social_display_name,social_profile_thumb_path) values
 ('b8000000-0000-4000-8000-000000000001','Bob','b8000000-0000-4000-8000-000000000001/thumb/profile.jpg')
 on conflict(user_id) do update set social_display_name=excluded.social_display_name,social_profile_thumb_path=excluded.social_profile_thumb_path;
insert into user_connections(requester_user_id,addressee_user_id,status) values
 ('a8000000-0000-4000-8000-000000000001','b8000000-0000-4000-8000-000000000001','accepted');
update social_config set enabled=true;
set local role authenticated;
set local request.jwt.claim.sub='a8000000-0000-4000-8000-000000000001';
do $$ declare x uuid;y uuid;begin
 perform set_config('one.circle',social_home()->>'circle',true);
 x:=(social_community('create',null,'{"name":"Community X"}')->>'id')::uuid;
 y:=(social_community('create',null,'{"name":"Hidden Community Y"}')->>'id')::uuid;
 perform set_config('one.x',x::text,true);perform set_config('one.y',y::text,true);
 perform set_config('one.tx',social_invite('rotate',x)->>'token',true);perform set_config('one.ty',social_invite('rotate',y)->>'token',true);
 perform set_config('one.ax',(select a->>'id' from jsonb_array_elements(social_home()->'audiences') a where a->>'community_id'=x::text),true);
 perform set_config('one.ay',(select a->>'id' from jsonb_array_elements(social_home()->'audiences') a where a->>'community_id'=y::text),true);
end $$;
set local request.jwt.claim.sub='c8000000-0000-4000-8000-000000000001';
select social_invite('join',null,current_setting('one.tx'));
set local request.jwt.claim.sub='d8000000-0000-4000-8000-000000000001';
select social_invite('join',null,current_setting('one.ty'));
set local request.jwt.claim.sub='a8000000-0000-4000-8000-000000000001';
select social_community('role',current_setting('one.x')::uuid,'{"user_id":"c8000000-0000-4000-8000-000000000001","role":"admin"}');
insert into activities(id,user_id,type,date,title,notes) values
 ('a8000000-0000-4000-8000-000000000002',auth.uid(),'run',current_date,'Shared run','PRIVATE JOURNAL WORDS');
do $$ begin
 perform social_activity('a8000000-0000-4000-8000-000000000002',jsonb_build_object('audiences',jsonb_build_array(
  jsonb_build_object('id',current_setting('one.circle'),'share',true),jsonb_build_object('id',current_setting('one.ax'),'share',true))));
 perform set_config('one.old_context',(social_feed()->0->'contexts'->0->>'id'),true);
end $$;
reset role;
insert into social_comments(context_id,author_id,body) values(current_setting('one.old_context')::uuid,'a8000000-0000-4000-8000-000000000001','RESTRICTED DEV WORDS');
set local role authenticated;
set local request.jwt.claim.sub='b8000000-0000-4000-8000-000000000001';
do $$ declare result jsonb;begin
 assert social_discussion('a8000000-0000-4000-8000-000000000002')->'comments'='[]','restricted dev history was not broadened';
 begin perform social_conversation(current_setting('one.old_context')::uuid);raise exception 'old RPC remained active';exception when insufficient_privilege then null;end;
 result:=social_discussion('a8000000-0000-4000-8000-000000000002','comment','{"body":"Bob through Circle"}');
 perform set_config('one.bcomment',result->'comments'->0->>'id',true);
 perform social_discussion('a8000000-0000-4000-8000-000000000002','reaction','{"reaction":"CHEER"}');
 begin perform 1 from social_activity_comments;raise exception 'private base comment table exposed';exception when insufficient_privilege then null;end;
 assert not(social_feed()::text like '%Hidden Community Y%'),'hidden provenance is not disclosed';
 assert not(social_feed()::text like '%PRIVATE JOURNAL WORDS%'),'safe projection never exposes private notes';
end $$;
set local request.jwt.claim.sub='c8000000-0000-4000-8000-000000000001';
do $$ declare result jsonb;begin
 assert social_discussion('a8000000-0000-4000-8000-000000000002')::text like '%Bob through Circle%','Community-only member reads Circle participant comment';
 assert social_discussion_media_path('a8000000-0000-4000-8000-000000000002','b8000000-0000-4000-8000-000000000001')->>'owner'='b8000000-0000-4000-8000-000000000001','commenter avatar is authorized without a connection';
 assert not exists(select 1 from user_preferences where user_id='b8000000-0000-4000-8000-000000000001'),'avatar access grants no private profile access';
 result:=social_discussion('a8000000-0000-4000-8000-000000000002','comment','{"body":"Carol through Community"}');
 perform set_config('one.ccomment',(select c->>'id' from jsonb_array_elements(result->'comments') c where c->>'author_id'=auth.uid()::text),true);
 perform social_discussion('a8000000-0000-4000-8000-000000000002','reaction','{"reaction":"CHEER"}');
 assert not(result->>'can_moderate')::boolean,'Community admin is not a global thread moderator';
 begin perform social_discussion('a8000000-0000-4000-8000-000000000002','delete_comment',jsonb_build_object('id',current_setting('one.bcomment')));raise exception 'admin globally deleted another author comment';exception when raise_exception then
  if SQLERRM='admin globally deleted another author comment' then raise;end if;end;
 perform social_discussion('a8000000-0000-4000-8000-000000000002','report',jsonb_build_object('comment',current_setting('one.bcomment'),'reason','Please review'));
 assert social_feed(current_setting('one.ax')::uuid)->0->>'comment_count'='2','Community feed has the activity-wide count';
end $$;
set local request.jwt.claim.sub='b8000000-0000-4000-8000-000000000001';
do $$ declare all_feed jsonb;circle_feed jsonb;begin
 all_feed:=social_feed();circle_feed:=social_feed('00000000-0000-0000-0000-000000000001');
 assert all_feed->0->>'comment_count'='2' and all_feed->0->'reaction_counts'=circle_feed->0->'reaction_counts','counts agree across feeds';
 assert social_discussion('a8000000-0000-4000-8000-000000000002')->'reactions'->0->>'count'='2','reactions are unique per activity and person';
end $$;
-- Later audience sees the existing thread, not restricted dev history or memberships.
set local request.jwt.claim.sub='a8000000-0000-4000-8000-000000000001';
select social_activity('a8000000-0000-4000-8000-000000000002',jsonb_build_object('audiences',jsonb_build_array(jsonb_build_object('id',current_setting('one.ay'),'share',true))));
set local request.jwt.claim.sub='d8000000-0000-4000-8000-000000000001';
do $$ begin
 assert jsonb_array_length(social_discussion('a8000000-0000-4000-8000-000000000002')->'comments')=2,'later sharing exposes the existing unified thread';
 assert jsonb_array_length(social_feed()->0->'contexts')=1,'later viewer sees only authorized provenance';
end $$;
-- Admin can remove only X's placement. Earlier comments/reactions remain.
set local request.jwt.claim.sub='c8000000-0000-4000-8000-000000000001';
select social_remove_community_activity('a8000000-0000-4000-8000-000000000002',current_setting('one.x')::uuid);
do $$ begin
 begin perform social_discussion('a8000000-0000-4000-8000-000000000002');raise exception 'removed route grants access';exception when raise_exception then
  if SQLERRM='removed route grants access' then raise;end if;end;
 begin perform social_discussion_media_path('a8000000-0000-4000-8000-000000000002','b8000000-0000-4000-8000-000000000001');raise exception 'revoked reader gets commenter avatar';exception when raise_exception then
  if SQLERRM='revoked reader gets commenter avatar' then raise;end if;end;
 assert not(social_own_comments()::text like '%activity_id%'),'past author list does not disclose the inaccessible activity';
 assert social_own_comments()::text like '%Carol through Community%','author retains access to their own words only';
 assert not social_delete_own_comment(current_setting('one.bcomment')::uuid),'cannot delete another author through own-comments endpoint';
end $$;
set local request.jwt.claim.sub='b8000000-0000-4000-8000-000000000001';
do $$ begin
 assert jsonb_array_length(social_discussion('a8000000-0000-4000-8000-000000000002')->'comments')=2,'removing X does not erase Carol comments';
 assert social_discussion('a8000000-0000-4000-8000-000000000002')->'reactions'->0->>'count'='2','losing access does not erase prior reactions';
end $$;
set local request.jwt.claim.sub='c8000000-0000-4000-8000-000000000001';
select social_delete_own_comment(current_setting('one.ccomment')::uuid);
-- Remove every route. Only the owner can still manage the activity thread.
set local request.jwt.claim.sub='a8000000-0000-4000-8000-000000000001';
select social_activity('a8000000-0000-4000-8000-000000000002','{"private":true}');
do $$ begin
 assert social_discussion('a8000000-0000-4000-8000-000000000002')->>'can_moderate'='true','owner manages unshared thread';
 assert social_feed(null,null,'a8000000-0000-4000-8000-000000000002')->0->'contexts'='[]','private detail is owner-only';
 assert social_feed()='[]','private owner activity never enters normal social feed';
end $$;
set local request.jwt.claim.sub='b8000000-0000-4000-8000-000000000001';
do $$ begin
 assert social_feed(null,null,'a8000000-0000-4000-8000-000000000002')='[]','stale detail links cannot access private thread';
 begin perform social_discussion('a8000000-0000-4000-8000-000000000002','reaction','{"reaction":"MOVED"}');raise exception 'past participation grants access';exception when raise_exception then
  if SQLERRM='past participation grants access' then raise;end if;end;
end $$;
set local request.jwt.claim.sub='a8000000-0000-4000-8000-000000000001';
select social_activity('a8000000-0000-4000-8000-000000000002',jsonb_build_object('private',false,'audiences',jsonb_build_array(jsonb_build_object('id',current_setting('one.circle'),'share',true),jsonb_build_object('id',current_setting('one.ax'),'share',true))));
set local request.jwt.claim.sub='b8000000-0000-4000-8000-000000000001';
do $$ begin
 assert social_discussion('a8000000-0000-4000-8000-000000000002')->'comments'->0->>'id'=current_setting('one.bcomment'),'re-sharing restores the same thread and IDs';
 perform social_discussion('a8000000-0000-4000-8000-000000000002','reaction','{"reaction":"CHEER"}');
 assert social_discussion('a8000000-0000-4000-8000-000000000002')->'reactions'->0->>'count'='2','retry through another route never duplicates reactions';
end $$;
-- Blocking applies to the whole activity, independent of incoming route.
set local request.jwt.claim.sub='c8000000-0000-4000-8000-000000000001';
select social_discussion('a8000000-0000-4000-8000-000000000002','comment','{"body":"A new Carol comment"}');
set local request.jwt.claim.sub='b8000000-0000-4000-8000-000000000001';
select social_discussion('a8000000-0000-4000-8000-000000000002','block','{"author":"c8000000-0000-4000-8000-000000000001"}');
do $$ begin
 assert jsonb_array_length(social_discussion('a8000000-0000-4000-8000-000000000002')->'comments')=1,'blocked participant comments are filtered';
 assert social_feed()->0->>'comment_count'='1','feed counts use the same safety filtering';
end $$;
set local request.jwt.claim.sub='a8000000-0000-4000-8000-000000000001';
do $$ begin
 assert jsonb_array_length(social_discussion('a8000000-0000-4000-8000-000000000002')->'reports')=1,'owner alone reviews thread reports';
 assert (select notes from activities where id='a8000000-0000-4000-8000-000000000002')='PRIVATE JOURNAL WORDS','source Journal survives every moderation/share operation';
end $$;
delete from activities where id='a8000000-0000-4000-8000-000000000002';
set local request.jwt.claim.sub='b8000000-0000-4000-8000-000000000001';
do $$ begin
 assert social_feed()='[]','source deletion removes every social route';
 assert social_own_comments()->'comments'='[]','source deletion follows canonical cascade lifecycle';
end $$;
reset role;
do $$ begin
 assert (select count(*) from user_connections)=1,'connections preserved';
 assert not has_function_privilege('anon','public.social_discussion(uuid,text,jsonb)','execute'),'anonymous thread API denied';
 assert not has_function_privilege('authenticated','public.social_discussion_counts(uuid)','execute'),'internal counts cannot bypass authorization';
end $$;
rollback;
