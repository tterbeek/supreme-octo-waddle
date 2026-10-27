-- Fictional cross-audience integration/RLS checks; all changes roll back.
begin;
insert into auth.users(id,email) values
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','alice-social@example.test'),
 ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb','bob-social@example.test'),
 ('cccccccc-cccc-4ccc-cccc-cccccccccccc','carol-social@example.test'),
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','dave-social@example.test'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','eve-social@example.test');
insert into user_connections(id,requester_user_id,addressee_user_id,status) values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb','accepted'),
 ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-cccc-cccccccccccc','accepted'),
 ('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','pending');
do $$ begin
 assert not social_enabled(),'rollout starts disabled';
 assert (select count(*) from social_contexts)=0,'migration never backfills private activities';
end $$;
update social_config set enabled=true;
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$ declare home jsonb;x uuid;y uuid;inv jsonb;begin
 home:=social_home();perform set_config('test.circle',home->>'circle',true);
 assert home->'audiences'->0->>'mode'='manual','existing connections do not enable automatic sharing';
 x:=(social_community('create',null,'{"name":"Brussels Runners","description":"Gentle shared movement"}')->>'id')::uuid;
 y:=(social_community('create',null,'{"name":"Secret community"}')->>'id')::uuid;
 perform set_config('test.x',x::text,true);perform set_config('test.y',y::text,true);
 inv:=social_invite('rotate',x);perform set_config('test.token',inv->>'token',true);
 -- The owner's home is the only source of destination IDs.
 perform set_config('test.ax',(select a->>'id' from jsonb_array_elements(social_home()->'audiences') a where a->>'community_id'=x::text),true);
 perform set_config('test.ay',(select a->>'id' from jsonb_array_elements(social_home()->'audiences') a where a->>'community_id'=y::text),true);
end $$;
set local role anon;
set local request.jwt.claim.sub='';
do $$ declare p jsonb;begin
 p:=social_invite('preview',null,current_setting('test.token'));
 assert p->>'name'='Brussels Runners' and not p ? 'members' and not p ? 'id','minimal QR preview only';
 assert social_invite('join',null,current_setting('test.token'))->>'status'='sign_in','authentication required for join';
 assert social_invite('preview',null,repeat('0',64))->>'status'='invalid','invalid QR fails safely';
end $$;
set local role authenticated;
set local request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
do $$ begin
 assert social_invite('join',null,current_setting('test.token'))->>'status'='joined','Bob explicitly joins';
 assert social_invite('join',null,current_setting('test.token'))->>'status'='joined','duplicate join is idempotent';
 begin perform social_invite('rotate',current_setting('test.x')::uuid);raise exception 'ordinary member rotated QR';exception when raise_exception then
  if SQLERRM='ordinary member rotated QR' then raise;end if;end;
 begin perform social_community('role',current_setting('test.x')::uuid,jsonb_build_object('user_id',auth.uid(),'role','admin'));raise exception 'member promoted self';exception when raise_exception then
  if SQLERRM='member promoted self' then raise;end if;end;
 begin perform 1 from community_invites;raise exception 'invite hashes exposed';exception when insufficient_privilege then null;end;
end $$;
set local request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $$ begin
 assert social_invite('join',null,current_setting('test.token'))->>'status'='joined','Dave joins without Circle connection';
end $$;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
insert into activities(id,user_id,type,date,title,notes,feeling_during,effort) values
 ('44444444-4444-4444-8444-444444444444',auth.uid(),'run',current_date,'A shared run','PRIVATE JOURNAL NOTE','happy',5);
insert into activity_photos(id,user_id,activity_id,image_path,thumb_path) values
 ('55555555-5555-4555-8555-555555555555',auth.uid(),'44444444-4444-4444-8444-444444444444',auth.uid()::text||'/private.jpg',auth.uid()::text||'/thumb/private.jpg');
do $$ declare activity uuid:='44444444-4444-4444-8444-444444444444';result jsonb;begin
 assert social_feed() = '[]'::jsonb,'manual by default, no feed before explicit consent';
 result:=social_activity(activity,jsonb_build_object('public_note','A note intended for sharing','audiences',jsonb_build_array(
  jsonb_build_object('id',current_setting('test.circle'),'share',true),
  jsonb_build_object('id',current_setting('test.ax'),'share',true),jsonb_build_object('id',current_setting('test.ay'),'share',true))));
 assert result->>'public_note'='A note intended for sharing','public note explicitly authored';
 result:=social_feed(null,null,activity);
 assert jsonb_array_length(result->0->'photos')=1,'photos are included by default once activity is shared';
 result:=social_activity(activity,'{"photos":["55555555-5555-4555-8555-555555555555"]}');
 perform set_config('test.cc',(select c->>'id' from jsonb_array_elements(social_feed(null,null,activity)->0->'contexts') c where c->>'kind'='circle'),true);
 perform set_config('test.cx',(select c->>'id' from jsonb_array_elements(social_feed(null,null,activity)->0->'contexts') c where c->>'community'=current_setting('test.x')),true);
 perform social_discussion('44444444-4444-4444-8444-444444444444','comment','{"body":"An ordinary free-text comment"}');
end $$;
set local request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
do $$ declare f jsonb;c jsonb;begin
 f:=social_feed(null,null,'44444444-4444-4444-8444-444444444444');
 assert jsonb_array_length(f)=1 and jsonb_array_length(f->0->'contexts')=2,'All deduplicates Circle and Community routes';
 assert not f::text like '%Secret community%' and not f::text like '%PRIVATE%' and not f::text like '%private.jpg%','safe summary hides other audiences, notes, storage paths';
 assert not(f->0 ? 'notes') and not(f->0 ? 'feeling') and not(f->0 ? 'effort') and not(f->0 ? 'equipment'),'explicit projection';
 assert not exists(select 1 from activities where id='44444444-4444-4444-8444-444444444444'),'direct private activity access still denied';
 assert not exists(select 1 from activity_photos where id='55555555-5555-4555-8555-555555555555'),'direct private photo metadata denied';
 assert social_media_path(current_setting('test.cx')::uuid,'55555555-5555-4555-8555-555555555555')->>'owner'='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','approved photo can be resolved only through live authorized context';
 c:=social_discussion('44444444-4444-4444-8444-444444444444','comment','{"body":"Bob is here"}');
 c:=social_discussion('44444444-4444-4444-8444-444444444444','reaction','{"reaction":"CHEER"}');
 assert jsonb_array_length(c->'comments')=2,'Circle conversation works for eligible connections';
 begin perform social_activity('44444444-4444-4444-8444-444444444444','{"public_note":"forged"}');raise exception 'nonowner changed activity';exception when raise_exception then
  if SQLERRM='nonowner changed activity' then raise;end if;end;
 begin perform social_decide('44444444-4444-4444-8444-444444444444',current_setting('test.ax')::uuid,'include',true);raise exception 'internal helper exposed';exception when insufficient_privilege then null;end;
end $$;
set local request.jwt.claim.sub='cccccccc-cccc-4ccc-cccc-cccccccccccc';
do $$ declare c jsonb;begin
 c:=social_discussion('44444444-4444-4444-8444-444444444444');
 assert c::text like '%Bob is here%','Carol reads Bob without a Bob-Carol connection';
 assert social_discussion('44444444-4444-4444-8444-444444444444')::text like '%Bob is here%','all authorized routes see the same thread';
end $$;
set local request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $$ declare f jsonb;begin
 f:=social_feed(null,null,'44444444-4444-4444-8444-444444444444');
 assert jsonb_array_length(f->0->'contexts')=1,'Community-only Dave gets only that context';
 assert jsonb_array_length(social_discussion('44444444-4444-4444-8444-444444444444')->'comments')=2,'Community-only viewer reads the activity-wide thread';
 assert social_discussion('44444444-4444-4444-8444-444444444444')::text like '%Bob is here%','all authorized routes see the same thread';
end $$;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$ declare c uuid:=current_setting('test.circle')::uuid;x uuid:=current_setting('test.ax')::uuid;begin
 perform social_set_rule(c,'all','{}','UTC');perform social_set_rule(x,'all','{}','UTC');
end $$;
insert into activities(id,user_id,type,date,title,started_at,source) values
 ('66666666-6666-4666-8666-666666666666',auth.uid(),'run',current_date,'Automatic',now(),'polar'),
 ('77777777-7777-4777-8777-777777777777',auth.uid(),'run',current_date-365,'Backfill',now()-interval '1 year','polar');
do $$ declare a uuid:='66666666-6666-4666-8666-666666666666';begin
 assert jsonb_array_length(social_feed(null,null,a)->0->'contexts')=2,'one imported activity shares to both configured destinations';
 assert social_feed(null,null,'77777777-7777-4777-8777-777777777777')->0->'contexts'='[]','old import stays private';
 perform social_activity(a,jsonb_build_object('audiences',jsonb_build_array(jsonb_build_object('id',current_setting('test.circle'),'share',false))));
 update activities set type='walk',distance_km=12 where id=a;
 assert jsonb_array_length(social_feed(null,null,a)->0->'contexts')=1,'manual exclusion survives type correction';
 perform social_activity(a,'{"private":true}');update activities set type='run' where id=a;
 assert social_feed(null,null,a)->0->'contexts'='[]','Keep private suppresses all automatic sharing';
 perform social_set_rule(current_setting('test.circle')::uuid,'types',array['run'],'UTC');
 assert social_feed(null,null,a)->0->'contexts'='[]','preference changes never undo overrides';
end $$;
insert into activities(id,user_id,type,date,title) select md5('social-page-'||n)::uuid,auth.uid(),'run',current_date,'Page '||n from generate_series(1,31) n;
set local request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
do $$ declare first jsonb;second jsonb;last jsonb;begin
 first:=social_feed();last:=first->(jsonb_array_length(first)-1);
 second:=social_feed(null,jsonb_build_object('date',last->>'date','shared_at',last->>'shared_at','id',last->>'id'));
 assert jsonb_array_length(first)=30 and jsonb_array_length(second)>0,'stable pagination extends beyond initial page';
 assert (select count(distinct x->>'id') from jsonb_array_elements(first||second) x)=jsonb_array_length(first||second),'deduplication happens before pagination';
end $$;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$ declare original uuid:=current_setting('test.cx')::uuid;fresh uuid;begin
 perform social_activity('44444444-4444-4444-8444-444444444444',jsonb_build_object('audiences',jsonb_build_array(jsonb_build_object('id',current_setting('test.ax'),'share',false))));
 assert jsonb_array_length(social_discussion('44444444-4444-4444-8444-444444444444')->'comments')=2,'unsharing one placement retains the activity thread';
 perform social_activity('44444444-4444-4444-8444-444444444444',jsonb_build_object('audiences',jsonb_build_array(jsonb_build_object('id',current_setting('test.ax'),'share',true))));
 select (c->>'id')::uuid into fresh from jsonb_array_elements(social_feed(null,null,'44444444-4444-4444-8444-444444444444')->0->'contexts') c where c->>'community'=current_setting('test.x');
 assert fresh<>original and jsonb_array_length(social_discussion('44444444-4444-4444-8444-444444444444')->'comments')=2,'new placement does not reset the activity thread';
 perform set_config('test.cx',fresh::text,true);
 update activities set title='Live edited title',distance_km=8 where id='44444444-4444-4444-8444-444444444444';
 assert social_feed(null,null,'44444444-4444-4444-8444-444444444444')->0->>'title'='Live edited title','all audiences read canonical edits';
 perform social_community('remove',current_setting('test.x')::uuid,'{"user_id":"bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb"}');
end $$;
set local request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
do $$ begin
 assert social_invite('join',null,current_setting('test.token'))->>'status'='removed','removed member cannot reuse same QR';
 assert jsonb_array_length(social_feed(null,null,'44444444-4444-4444-8444-444444444444')->0->'contexts')=1,'Circle survives removal of Community route';
end $$;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$ declare fresh jsonb;begin
 fresh:=social_invite('rotate',current_setting('test.x')::uuid);
 assert social_invite('preview',null,current_setting('test.token'))->>'status'='invalid','rotation invalidates old QR';
 perform set_config('test.token',fresh->>'token',true);
 begin perform social_community('leave',current_setting('test.x')::uuid);raise exception 'owner orphaned Community';exception when raise_exception then
  if SQLERRM='owner orphaned Community' then raise;end if;end;
end $$;
set local request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
do $$ begin
 assert social_invite('join',null,current_setting('test.token'))->>'status'='joined','fresh QR permits explicit rejoin';
 assert (select a->>'mode' from jsonb_array_elements(social_home()->'audiences') a where a->>'community_id'=current_setting('test.x'))='manual','rejoin does not restore automatic consent';
 perform social_discussion('44444444-4444-4444-8444-444444444444','report','{"reason":"Please review this activity"}');
 perform social_discussion('44444444-4444-4444-8444-444444444444','block');
 assert social_feed(null,null,'44444444-4444-4444-8444-444444444444')='[]','block suppresses both routes';
end $$;
-- Source deletion / insert-based undo does not silently restore automatic sharing.
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
delete from activities where id=md5('social-page-1')::uuid;
insert into activities(id,user_id,type,date,title) values(md5('social-page-1')::uuid,auth.uid(),'run',current_date,'Restored');
do $$ begin
 assert (select social_private from activities where id=md5('social-page-1')::uuid),'undo remains private';
 assert social_feed(null,null,md5('social-page-1')::uuid)->0->'contexts'='[]','undo cannot republish old conversations';
end $$;
reset role;
do $$ begin
 assert (select count(*) from user_connections)=3,'all connection records survive';
 assert (select status from user_connections where id='11111111-1111-4111-8111-111111111111')='accepted','accepted connection remains accepted';
 assert (select notes from activities where id='44444444-4444-4444-8444-444444444444')='PRIVATE JOURNAL NOTE','canonical private note is intact';
end $$;
rollback;
