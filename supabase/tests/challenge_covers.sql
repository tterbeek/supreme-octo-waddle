-- Challenge covers are Community assets, never a shortcut to private attachments.
begin;
insert into auth.users(id,email) values
 ('a7000000-0000-4000-8000-000000000001','cover-owner@example.test'),
 ('b7000000-0000-4000-8000-000000000001','cover-member@example.test'),
 ('c7000000-0000-4000-8000-000000000001','cover-outsider@example.test');
insert into storage.objects(bucket_id,name) values
 ('actvity-notes','a7000000-0000-4000-8000-000000000001/challenge-cover-first.jpg'),
 ('actvity-notes','b7000000-0000-4000-8000-000000000001/challenge-cover-replacement.jpg'),
 ('actvity-notes','a7000000-0000-4000-8000-000000000001/private-journal.jpg');
update social_config set enabled=true;
set local role authenticated;
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000001';
do $$ declare c uuid;rows jsonb;begin
 c:=(social_community('create',null,'{"name":"Challenge cover group"}')->>'id')::uuid;
 perform set_config('cover.community',c::text,true);perform set_config('cover.token',social_invite('rotate',c)->>'token',true);
 rows:=social_challenges(c,'create',jsonb_build_object('title','A shared adventure','metric','distance','target',10,'scope','collective','types',jsonb_build_array('run','walk'),
  'starts_on',current_date,'ends_on',current_date+10,'time_zone','UTC','cover_path','a7000000-0000-4000-8000-000000000001/challenge-cover-first.jpg'));
 perform set_config('cover.challenge',rows->0->>'id',true);
 assert (rows->0->>'has_cover')::boolean,'cover can be attached during challenge creation';
 assert not(rows::text like '%challenge-cover-first.jpg%') and not(rows->0 ? 'cover_owner_id'),'member challenge projection does not reveal storage paths';
 assert social_challenge_media_path((rows->0->>'id')::uuid)->>'path'='a7000000-0000-4000-8000-000000000001/challenge-cover-first.jpg','authorized resolver returns selected cover';
 begin perform social_challenges(c,'cover',jsonb_build_object('id',current_setting('cover.challenge'),'cover_path','a7000000-0000-4000-8000-000000000001/private-journal.jpg'));raise exception 'private journal attachment accepted as cover';exception when raise_exception then
  if SQLERRM='private journal attachment accepted as cover' then raise;end if;end;
 begin perform social_challenges(c,'cover',jsonb_build_object('id',current_setting('cover.challenge'),'cover_path','b7000000-0000-4000-8000-000000000001/challenge-cover-replacement.jpg'));raise exception 'another users upload accepted';exception when raise_exception then
  if SQLERRM='another users upload accepted' then raise;end if;end;
 begin perform social_challenges(c,'cover',jsonb_build_object('id',current_setting('cover.challenge'),'cover_path','a7000000-0000-4000-8000-000000000001/challenge-cover-missing.jpg'));raise exception 'nonexistent upload accepted';exception when raise_exception then
  if SQLERRM='nonexistent upload accepted' then raise;end if;end;
end $$;
set local request.jwt.claim.sub='c7000000-0000-4000-8000-000000000001';
do $$ begin
 begin perform social_challenge_media_path(current_setting('cover.challenge')::uuid);raise exception 'outsider retrieved cover';exception when raise_exception then
  if SQLERRM='outsider retrieved cover' then raise;end if;end;
end $$;
set local request.jwt.claim.sub='b7000000-0000-4000-8000-000000000001';
select social_invite('join',null,current_setting('cover.token'));
do $$ begin
 assert social_challenge_media_path(current_setting('cover.challenge')::uuid)->>'owner'='a7000000-0000-4000-8000-000000000001','member can view cover without a Circle connection';
 assert not exists(select 1 from storage.objects where name='a7000000-0000-4000-8000-000000000001/challenge-cover-first.jpg'),'member cannot mint a long-lived storage URL';
 begin perform social_challenges(current_setting('cover.community')::uuid,'cover',jsonb_build_object('id',current_setting('cover.challenge'),'cover_path','b7000000-0000-4000-8000-000000000001/challenge-cover-replacement.jpg'));raise exception 'member changed cover';exception when raise_exception then
  if SQLERRM='member changed cover' then raise;end if;end;
end $$;
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000001';
select social_community('role',current_setting('cover.community')::uuid,'{"user_id":"b7000000-0000-4000-8000-000000000001","role":"admin"}');
set local request.jwt.claim.sub='b7000000-0000-4000-8000-000000000001';
do $$ begin
 perform social_challenges(current_setting('cover.community')::uuid,'cover',jsonb_build_object('id',current_setting('cover.challenge'),'cover_path','b7000000-0000-4000-8000-000000000001/challenge-cover-replacement.jpg'));
 assert social_challenge_media_path(current_setting('cover.challenge')::uuid)->>'owner'=auth.uid()::text,'admins can replace covers with their own upload';
end $$;
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000001';
do $$ declare original jsonb;begin
 original:=social_challenges(current_setting('cover.community')::uuid)->0;
 perform social_challenges(current_setting('cover.community')::uuid,'update',original||'{"title":"Renamed adventure"}'::jsonb);
 assert social_challenge_media_path(current_setting('cover.challenge')::uuid)->>'owner'='b7000000-0000-4000-8000-000000000001','metadata edits preserve the existing cover and uploader';
 perform social_community('remove',current_setting('cover.community')::uuid,'{"user_id":"b7000000-0000-4000-8000-000000000001"}');
 assert social_challenge_media_path(current_setting('cover.challenge')::uuid)->>'owner'='b7000000-0000-4000-8000-000000000001','chosen Community cover remains after its uploader leaves';
end $$;
set local request.jwt.claim.sub='b7000000-0000-4000-8000-000000000001';
do $$ begin
 begin perform social_challenge_media_path(current_setting('cover.challenge')::uuid);raise exception 'removed member retained cover API access';exception when raise_exception then
  if SQLERRM='removed member retained cover API access' then raise;end if;end;
end $$;
reset role;
delete from auth.users where id='b7000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='a7000000-0000-4000-8000-000000000001';
do $$ begin
 assert not(social_challenges(current_setting('cover.community')::uuid)->0->>'has_cover')::boolean,'deleted uploader does not leave a signable orphan';
 perform social_challenges(current_setting('cover.community')::uuid,'cover',jsonb_build_object('id',current_setting('cover.challenge'),'cover_path',null));
 assert not(social_challenges(current_setting('cover.community')::uuid)->0->>'has_cover')::boolean,'cover can be removed';
 assert exists(select 1 from storage.objects where name='a7000000-0000-4000-8000-000000000001/private-journal.jpg'),'cover changes never delete Journal media';
end $$;
rollback;
