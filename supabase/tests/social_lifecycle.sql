-- Additional lifecycle, media, pagination and rollback checks; fictional data only.
begin;
insert into auth.users(id,email) values
 ('a1000000-0000-4000-8000-000000000001','social-owner@example.test'),
 ('b1000000-0000-4000-8000-000000000001','social-viewer@example.test'),
 ('c1000000-0000-4000-8000-000000000001','social-outsider@example.test');
insert into user_connections(requester_user_id,addressee_user_id,status) values
 ('a1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','accepted');
insert into user_preferences(user_id,social_profile_image_path,social_profile_thumb_path) values
 ('a1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001/circle-profile/full.jpg','a1000000-0000-4000-8000-000000000001/circle-profile/thumb.jpg')
 on conflict(user_id) do update set social_profile_image_path=excluded.social_profile_image_path,social_profile_thumb_path=excluded.social_profile_thumb_path;
update social_config set enabled=true;
set local role authenticated;
set local request.jwt.claim.sub='a1000000-0000-4000-8000-000000000001';
do $$ declare h jsonb;c uuid;begin
 h:=social_home();perform set_config('life.circle',h->>'circle',true);
 c:=(social_community('create',null,'{"name":"Lifecycle group"}')->>'id')::uuid;
 perform set_config('life.community',c::text,true);
 perform set_config('life.audience',(select a->>'id' from jsonb_array_elements(social_home()->'audiences') a where a->>'community_id'=c::text),true);
 perform set_config('life.token',social_invite('rotate',c)->>'token',true);
end $$;
insert into activities(id,user_id,type,date,title,notes,note_image_url) values
 ('a2000000-0000-4000-8000-000000000001',auth.uid(),'walk',current_date-40,'An older shared walk','PRIVATE AUTHORITATIVE NOTE',auth.uid()||'/original.jpg');
do $$ begin
 begin
  insert into activity_shares(activity_id,author_user_id,activity_type,occurred_on)
   values('a2000000-0000-4000-8000-000000000001',auth.uid(),'walk',current_date);
  raise exception 'direct legacy copy write bypassed cutover';
 exception when insufficient_privilege then null;end;
 perform social_activity('a2000000-0000-4000-8000-000000000001',jsonb_build_object('legacy_photo',true,'audiences',jsonb_build_array(
  jsonb_build_object('id',current_setting('life.circle'),'share',true),jsonb_build_object('id',current_setting('life.audience'),'share',true))));
end $$;
reset role;
update social_contexts set created_at=now()-interval '40 days';
insert into social_activity_comments(activity_id,author_id,body,created_at)
 select s.activity_id,'a1000000-0000-4000-8000-000000000001','Older comment '||n,now()-interval '40 days'+n*interval '1 second'
 from social_contexts s cross join generate_series(1,105) n where s.audience_id=current_setting('life.circle')::uuid;
insert into storage.objects(bucket_id,name) values('actvity-notes','a1000000-0000-4000-8000-000000000001/original.jpg');
set local role authenticated;
set local request.jwt.claim.sub='b1000000-0000-4000-8000-000000000001';
do $$ declare f jsonb;p jsonb;q jsonb;ctx uuid;begin
 f:=social_feed(null,null,'a2000000-0000-4000-8000-000000000001');
 assert jsonb_array_length(f)=1,'new shares remain readable after the old 14-day TTL';
 ctx:=(f->0->'contexts'->0->>'id')::uuid;perform set_config('life.context',ctx::text,true);
 p:=social_discussion('a2000000-0000-4000-8000-000000000001');q:=social_discussion('a2000000-0000-4000-8000-000000000001','read',jsonb_build_object('before',p->'before'));
 assert jsonb_array_length(p->'comments')=100 and (p->>'has_more')::boolean,'first comment page bounded';
 assert jsonb_array_length(q->'comments')=5 and not(q->>'has_more')::boolean,'older comments remain accessible';
 assert not exists(select 1 from jsonb_array_elements(p->'comments') a join jsonb_array_elements(q->'comments') b on a->>'id'=b->>'id'),'comment cursor has no overlap';
 assert (select count(*) from storage.objects)=0,'recipients cannot mint their own long-lived storage URLs';
 assert social_media_path(ctx,'legacy')->>'owner'='a1000000-0000-4000-8000-000000000001','approved media is resolved through authenticated RPC';
 assert social_media_path(ctx,'profile')->>'path'='a1000000-0000-4000-8000-000000000001/circle-profile/thumb.jpg','authorized viewers can resolve the current author avatar';
 begin perform social_activity('a2000000-0000-4000-8000-000000000001','{"private":true}');raise exception 'viewer changed owner consent';exception when raise_exception then
  if SQLERRM='viewer changed owner consent' then raise;end if;end;
 perform social_invite('join',null,current_setting('life.token'));
end $$;
set local request.jwt.claim.sub='c1000000-0000-4000-8000-000000000001';
do $$ declare foreign_circle text;begin
 foreign_circle:=social_home()->>'circle';perform set_config('life.foreign_circle',foreign_circle,true);
 assert social_feed(null,null,'a2000000-0000-4000-8000-000000000001')='[]','outsider sees no shared summary';
 begin perform social_media_path(current_setting('life.context')::uuid,'profile');raise exception 'outsider avatar resolved';exception when raise_exception then
  if SQLERRM='outsider avatar resolved' then raise;end if;end;
 begin perform social_media_path(current_setting('life.context')::uuid,'legacy');raise exception 'outsider media resolved';exception when raise_exception then
  if SQLERRM='outsider media resolved' then raise;end if;end;
end $$;
set local request.jwt.claim.sub='a1000000-0000-4000-8000-000000000001';
insert into activity_photos(id,activity_id,user_id,image_path,thumb_path,is_shared) values
 ('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001',auth.uid(),auth.uid()||'/photo.jpg',auth.uid()||'/thumb.jpg',true);
update activity_photos set image_path=auth.uid()||'/new-photo.jpg' where id='a3000000-0000-4000-8000-000000000001';
do $$ begin
 assert (select is_shared from activity_photos where id='a3000000-0000-4000-8000-000000000001'),'replaced attachment keeps its shared state';
 begin perform social_activity('a2000000-0000-4000-8000-000000000001',jsonb_build_object('audiences',jsonb_build_array(jsonb_build_object('id',current_setting('life.foreign_circle'),'share',true))));raise exception 'foreign Circle accepted';exception when raise_exception then
  if SQLERRM='foreign Circle accepted' then raise;end if;end;
 update activities set note_image_url=auth.uid()||'/replacement.jpg' where id='a2000000-0000-4000-8000-000000000001';
 assert (select share_legacy_photo from activities where id='a2000000-0000-4000-8000-000000000001'),'replacement cover keeps its shared state';
 perform social_community('transfer',current_setting('life.community')::uuid,'{"user_id":"b1000000-0000-4000-8000-000000000001"}');
 perform social_community('leave',current_setting('life.community')::uuid);
 assert jsonb_array_length(social_feed(null,null,'a2000000-0000-4000-8000-000000000001')->0->'contexts')=1,'leaving removes Community shares but retains Circle';
end $$;
reset role;
-- Rollback must retain exclusions, not resurrect the new Circle context.
update social_config set enabled=false;
set local role authenticated;
set local request.jwt.claim.sub='a1000000-0000-4000-8000-000000000001';
select unshare_activity('a2000000-0000-4000-8000-000000000001',auth.uid());
reset role;
update social_config set enabled=true;
set local role authenticated;
set local request.jwt.claim.sub='b1000000-0000-4000-8000-000000000001';
do $$ begin
 assert social_feed(null,null,'a2000000-0000-4000-8000-000000000001')='[]','rollback unshare remains revoked on re-enable';
 perform social_community('delete',current_setting('life.community')::uuid);
end $$;
reset role;
do $$ begin
 assert not exists(select 1 from communities where id=current_setting('life.community')::uuid),'transferred owner can delete Community';
 assert (select notes from activities where id='a2000000-0000-4000-8000-000000000001')='PRIVATE AUTHORITATIVE NOTE','Community deletion never deletes Journal record';
end $$;
-- Author account deletion cascades social authorization, with no orphaned context.
delete from auth.users where id='a1000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='b1000000-0000-4000-8000-000000000001';
do $$ begin
 assert social_feed(null,null,'a2000000-0000-4000-8000-000000000001')='[]','deleted account cannot retain activity visibility';
end $$;
rollback;
