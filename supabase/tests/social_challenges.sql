begin;
insert into auth.users(id,email) values
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','challenge-owner@example.test'),
 ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb','challenge-member@example.test'),
 ('cccccccc-cccc-4ccc-cccc-cccccccccccc','challenge-late-member@example.test');
update social_config set enabled=true;
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$ declare c uuid;token text;begin
 c:=(social_community('create',null,'{"name":"Optional movement"}')->>'id')::uuid;
 perform set_config('test.challenge_community',c::text,true);
 token:=social_invite('rotate',c)->>'token';perform set_config('test.challenge_token',token,true);
 perform social_challenges(c,'create',jsonb_build_object('title','Together','metric','distance','target',100,'scope','collective','types',jsonb_build_array('run'),
  'starts_on',current_date-1,'ends_on',current_date+3,'time_zone','UTC'));
 perform set_config('test.challenge_id',social_challenges(c)->0->>'id',true);
end $$;
set local request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
do $$ begin
 perform social_invite('join',null,current_setting('test.challenge_token'));
 assert (social_challenges(current_setting('test.challenge_community')::uuid)->0->>'participating')::boolean,'membership automatically includes the user in challenges';
 assert social_feed()='[]','automatic inclusion does not publish private activities';
 perform set_config('test.challenge_audience',(select a->>'id' from jsonb_array_elements(social_home()->'audiences') a where a->>'community_id'=current_setting('test.challenge_community')),true);
end $$;
insert into activities(id,user_id,type,date,distance_km,duration_min,started_at,source) values
 ('11111111-1111-4111-8111-111111111111',auth.uid(),'run',current_date,10,60,now(),'polar'),
 ('22222222-2222-4222-8222-222222222222',auth.uid(),'walk',current_date,40,30,now(),'manual');
do $$ declare c uuid:=current_setting('test.challenge_community')::uuid;original jsonb;begin
 assert (social_challenges(c)->0->>'total')::numeric=0,'private activity contributes nothing';
 perform social_activity('11111111-1111-4111-8111-111111111111',jsonb_build_object('audiences',jsonb_build_array(jsonb_build_object('id',current_setting('test.challenge_audience'),'share',true))));
 perform social_activity('22222222-2222-4222-8222-222222222222',jsonb_build_object('audiences',jsonb_build_array(jsonb_build_object('id',current_setting('test.challenge_audience'),'share',true))));
 assert (social_challenges(c)->0->>'total')::numeric=10,'only eligible shared activity type counts';
 original:=social_challenges(c)->0;
 perform set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',true);
 perform social_challenges(c,'update',original||'{"metric":"duration"}'::jsonb);
 assert (social_challenges(c)->0->>'total')::numeric=60,'editing the measure recomputes existing eligible shared activities';
 perform social_challenges(c,'update',original);
 perform set_config('request.jwt.claim.sub','bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',true);

 begin perform social_challenges(c,'update',(social_challenges(c)->0)||'{"title":"Forged"}'::jsonb);raise exception 'ordinary member edited challenge';exception when raise_exception then
  if SQLERRM='ordinary member edited challenge' then raise;end if;end;
 begin perform social_challenges(c,'leave',jsonb_build_object('id',current_setting('test.challenge_id')));raise exception 'individual challenge opt-out was accepted';exception when raise_exception then
  if SQLERRM='individual challenge opt-out was accepted' then raise;end if;end;
 begin perform social_challenges(c,'cancel',jsonb_build_object('id',current_setting('test.challenge_id')));raise exception 'ordinary member cancelled challenge';exception when raise_exception then
  if SQLERRM='ordinary member cancelled challenge' then raise;end if;end;
 perform social_activity('11111111-1111-4111-8111-111111111111',jsonb_build_object('audiences',jsonb_build_array(jsonb_build_object('id',current_setting('test.challenge_audience'),'share',true))));
 assert (social_challenges(c)->0->>'total')::numeric=10,'idempotent shares never duplicate contributions';
 update activities set distance_km=7 where id='11111111-1111-4111-8111-111111111111';
 assert (social_challenges(c)->0->>'total')::numeric=7,'canonical edits recompute contributions';
 update activities set distance_km=null where id='11111111-1111-4111-8111-111111111111';
 assert (social_challenges(c)->0->>'total')::numeric=0,'missing distance is never inferred';
 update activities set distance_km=9 where id='11111111-1111-4111-8111-111111111111';
 perform social_activity('11111111-1111-4111-8111-111111111111',jsonb_build_object('audiences',jsonb_build_array(jsonb_build_object('id',current_setting('test.challenge_audience'),'share',false))));
 assert (social_challenges(c)->0->>'total')::numeric=0,'unsharing immediately removes contributions';
 perform social_activity('11111111-1111-4111-8111-111111111111',jsonb_build_object('audiences',jsonb_build_array(jsonb_build_object('id',current_setting('test.challenge_audience'),'share',true))));
 perform social_community('leave',c);
end $$;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$ begin
 assert (social_challenges(current_setting('test.challenge_community')::uuid)->0->>'total')::numeric=0,'leaving removes shared history and participation contributions';
end $$;
-- A later Community member contributes without per-challenge signup.
set local request.jwt.claim.sub='cccccccc-cccc-4ccc-cccc-cccccccccccc';
select social_invite('join',null,current_setting('test.challenge_token'));
insert into activities(id,user_id,type,date,distance_km) values('99999999-9999-4999-8999-999999999999',auth.uid(),'run',current_date,3);
do $$ declare c uuid:=current_setting('test.challenge_community')::uuid;begin
 assert (social_challenges(c)->0->>'participating')::boolean,'new members automatically belong to existing challenges';
 assert (social_challenges(c)->0->>'total')::numeric=0,'new members private activities still do not count';
 perform social_activity('99999999-9999-4999-8999-999999999999',jsonb_build_object('audiences',jsonb_build_array(jsonb_build_object('id',current_setting('test.challenge_audience'),'share',true))));
 assert (social_challenges(c)->0->>'total')::numeric=3,'new members shared activities count without challenge enrollment';
 perform social_community('leave',c);
end $$;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$ begin
 assert (social_challenges(current_setting('test.challenge_community')::uuid)->0->>'total')::numeric=0,'membership departure removes contributions';
end $$;
-- Owner edits the same challenge, preserving identity and validating updates.
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$ declare c uuid:=current_setting('test.challenge_community')::uuid;original jsonb;result jsonb;other uuid;begin
 original:=social_challenges(c)->0;
 result:=social_challenges(c,'update',original||'{"title":"Updated Community goal","target":200,"metric":"duration"}'::jsonb);
 assert result->0->>'id'=original->>'id' and result->0->>'title'='Updated Community goal' and result->0->>'target'='200','update modifies existing challenge without duplicating it';
 assert jsonb_array_length(result)=1 and result->0->>'time_zone'=original->>'time_zone','update preserves timezone and challenge identity';
 begin perform social_challenges(c,'update',original||'{"target":0}'::jsonb);raise exception 'invalid target accepted';exception when check_violation then null;end;
 begin perform social_challenges(c,'update',original||'{"time_zone":"Invalid/Zone"}'::jsonb);raise exception 'invalid timezone accepted';exception when raise_exception then
  if SQLERRM='invalid timezone accepted' then raise;end if;end;
 other:=(social_community('create',null,'{"name":"Other challenge Community"}')->>'id')::uuid;
 begin perform social_challenges(other,'update',original);raise exception 'cross-Community challenge edit accepted';exception when raise_exception then
  if SQLERRM='cross-Community challenge edit accepted' then raise;end if;end;
end $$;
-- Completed totals remain correctable. Exercise precise timezone boundaries and
-- distinct-day counting using a past challenge with explicit fixture consent.
reset role;
insert into community_members(community_id,user_id,role,status) values(current_setting('test.challenge_community')::uuid,'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb','member','active')
 on conflict(community_id,user_id) do update set status='active';
insert into community_challenges(id,community_id,creator_id,title,metric,target,types,starts_on,ends_on,time_zone,scope) values
 ('33333333-3333-4333-8333-333333333333',current_setting('test.challenge_community')::uuid,'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Past active dates','days',2,'{}','2026-01-01','2026-01-02','Europe/Brussels','collective');
set local role authenticated;
set local request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
insert into activities(id,user_id,type,date,started_at,source) values
 ('44444444-4444-4444-8444-444444444444',auth.uid(),'run','2025-12-31','2025-12-31 23:30:00+00','polar'),
 ('55555555-5555-4555-8555-555555555555',auth.uid(),'run','2026-01-01','2026-01-01 10:00:00+00','polar'),
 ('66666666-6666-4666-8666-666666666666',auth.uid(),'run','2026-01-01','2026-01-01 23:30:00+00','polar');
do $$ declare activity uuid;begin
 foreach activity in array array['44444444-4444-4444-8444-444444444444'::uuid,'55555555-5555-4555-8555-555555555555'::uuid,'66666666-6666-4666-8666-666666666666'::uuid] loop
  perform social_activity(activity,jsonb_build_object('audiences',jsonb_build_array(jsonb_build_object('id',current_setting('test.challenge_audience'),'share',true))));
 end loop;
end $$;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$ declare result jsonb;begin
 select c into result from jsonb_array_elements(social_challenges(current_setting('test.challenge_community')::uuid)) c where c->>'id'='33333333-3333-4333-8333-333333333333';
 assert result->>'state'='completed' and (result->>'total')::numeric=1,'local midnight, exclusive end, and distinct dates are respected';
end $$;
set local request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
delete from activities where id in('44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555');
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$ declare result jsonb;begin
 select c into result from jsonb_array_elements(social_challenges(current_setting('test.challenge_community')::uuid)) c where c->>'id'='33333333-3333-4333-8333-333333333333';
 assert (result->>'total')::numeric=0,'completed result corrects after source deletion';
end $$;
rollback;
