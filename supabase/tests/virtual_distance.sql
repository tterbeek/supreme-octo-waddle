begin;
-- The existing auth and Community model supplies automatic participation.
update social_config set enabled=true;
insert into auth.users(id,email) values
 ('a5000000-0000-4000-8000-000000000001','virtual-owner@example.test'),
 ('a5000000-0000-4000-8000-000000000002','virtual-member@example.test'),
 ('a5000000-0000-4000-8000-000000000003','virtual-outsider@example.test');
insert into communities(id,owner_id,name) values('a5100000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','Virtual fixture');
insert into community_members(community_id,user_id,role,status,joined_at) values
 ('a5100000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','owner','active','2019-01-01T00:00:00Z'),
 ('a5100000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000002','member','active','2019-01-01T00:00:00Z');
insert into social_audiences(id,kind,community_id) values('a5200000-0000-4000-8000-000000000001','community','a5100000-0000-4000-8000-000000000001');
insert into equipment(id,user_id,name) values('a5300000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','Specialized Vado');
do $$begin
 assert (select category is null and electric_assist is null from equipment where id='a5300000-0000-4000-8000-000000000001'),'no category inferred from names';
end $$;
update equipment set category='bike',electric_assist='electric' where id='a5300000-0000-4000-8000-000000000001';
insert into community_challenges(id,community_id,creator_id,title,metric,target,scope,starts_on,ends_on,time_zone,journey_policy_version)
 values('a5400000-0000-4000-8000-000000000001','a5100000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001',
 'All movement','virtual_distance',100,'collective','2020-01-01','2020-02-01','Europe/Brussels','journey-distance-v1');
insert into community_challenges(id,community_id,creator_id,title,metric,target,scope,starts_on,ends_on,time_zone,journey_policy_version,activity_scope,types)
 values('a5400000-0000-4000-8000-000000000002','a5100000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001',
 'Runs only','virtual_distance',100,'collective','2020-01-01',null,'Europe/Brussels','journey-distance-v1','selected','{run}');
insert into activities(id,user_id,type,date,started_at,duration_min,distance_km,effort) values
 ('a5500000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','run','2020-10-24','2020-10-24T10:00Z',60,30,3),
 ('a5500000-0000-4000-8000-000000000002','a5000000-0000-4000-8000-000000000001','ride','2020-10-24','2020-10-24T11:00Z',null,22,null),
 ('a5500000-0000-4000-8000-000000000003','a5000000-0000-4000-8000-000000000001','strength','2020-10-25','2020-10-25T00:30Z',null,null,5),
 ('a5500000-0000-4000-8000-000000000004','a5000000-0000-4000-8000-000000000001','walk','2020-10-25','2020-10-25T01:30Z',null,null,null),
 ('a5500000-0000-4000-8000-000000000005','a5000000-0000-4000-8000-000000000001','swim','2020-10-24','2020-10-24T12:00Z',null,2,null),
 ('a5500000-0000-4000-8000-000000000006','a5000000-0000-4000-8000-000000000001','run','2020-10-25','2020-10-25T03:00Z',null,null,null),
 ('a5500000-0000-4000-8000-000000000007','a5000000-0000-4000-8000-000000000002','walk','2020-10-24','2020-10-24T14:00Z',24,null,null),
 ('a5500000-0000-4000-8000-000000000008','a5000000-0000-4000-8000-000000000001','run',current_date+10,now()+interval '10 days',60,null,3),
 ('a5500000-0000-4000-8000-000000000009','a5000000-0000-4000-8000-000000000001','run','2020-10-25','2020-10-25T04:00Z',-5,null,null);
insert into activity_equipment values('a5500000-0000-4000-8000-000000000002','a5300000-0000-4000-8000-000000000001');
insert into social_contexts(activity_id,audience_id) select id,'a5200000-0000-4000-8000-000000000001' from activities where id::text like 'a5500000-%';
do $$declare j uuid:='a5400000-0000-4000-8000-000000000001';r jsonb;begin
 perform reconcile_journey(j);perform reconcile_journey(j);
 assert (select sum(journey_km) from journey_contributions where challenge_id=j and active)=104.7,'worked examples plus one shared participation day, no future or negative credit';
 assert (select count(*) from journey_participation_days where challenge_id=j)=1,'DST repeated hour belongs to one local activity day';
 assert (select count(*) from journey_contributions where challenge_id=j and activity_id='a5500000-0000-4000-8000-000000000001')=1,'repeated imports/jobs do not duplicate';
 assert not exists(select 1 from journey_contributions where activity_id='a5500000-0000-4000-8000-000000000008' and active),'future occurrence not credited';
 assert (select basis='invalid' from (select calculation->>'basis' basis from journey_contributions where challenge_id=j and activity_id='a5500000-0000-4000-8000-000000000009')x),'invalid does not create participation';
 perform reconcile_journey('a5400000-0000-4000-8000-000000000002');
 assert (select sum(journey_km) from journey_contributions where challenge_id='a5400000-0000-4000-8000-000000000002' and active)=68.5,'type filtering precedes participation allocation';
 assert (select activity_id from journey_participation_days where challenge_id='a5400000-0000-4000-8000-000000000002')='a5500000-0000-4000-8000-000000000006','excluded entries never consume allowance';
 update activities set duration_min=24 where id='a5500000-0000-4000-8000-000000000006';
 perform reconcile_journey(j);
 assert (select sum(journey_km) from journey_contributions where challenge_id=j and active)=111.9,'measured movement and daily participation are separate';
 perform reconcile_journey('a5400000-0000-4000-8000-000000000002');
 assert (select sum(journey_km) from journey_contributions where challenge_id='a5400000-0000-4000-8000-000000000002' and active)=74.7,'participation to measured';
 update activities set duration_min=null,type='walk' where id='a5500000-0000-4000-8000-000000000006';
 perform reconcile_journey('a5400000-0000-4000-8000-000000000002');
 assert (select sum(journey_km) from journey_contributions where challenge_id='a5400000-0000-4000-8000-000000000002' and active)=67.5,'type change withdraws contribution';
 update activities set type='run' where id='a5500000-0000-4000-8000-000000000006';
 update activities set date='2020-10-26',started_at='2020-10-26T10:00Z' where id='a5500000-0000-4000-8000-000000000003';
 perform reconcile_journey(j);
 assert (select sum(journey_km) from journey_contributions where challenge_id=j and active)=105.7,'old and new day buckets rebuilt atomically';
 update social_contexts set revoked_at=now() where activity_id='a5500000-0000-4000-8000-000000000003';
 perform reconcile_journey(j);perform reconcile_journey(j);
 assert (select sum(journey_km) from journey_contributions where challenge_id=j and active)=104.7,'stale retry cannot restore unshared credit';
 delete from activities where id='a5500000-0000-4000-8000-000000000004';
 perform reconcile_journey(j);
 assert (select activity_id from journey_participation_days where challenge_id=j)='a5500000-0000-4000-8000-000000000006','deleted credited activity reallocates';
 insert into activities(id,user_id,type,date,started_at,effort) values('a5500000-0000-4000-8000-000000000004','a5000000-0000-4000-8000-000000000001','walk','2020-10-25','2020-10-25T01:30Z',null);
 insert into social_contexts(activity_id,audience_id) values('a5500000-0000-4000-8000-000000000004','a5200000-0000-4000-8000-000000000001');
 perform reconcile_journey(j);
 assert (select social_private from activities where id='a5500000-0000-4000-8000-000000000004'),'undo preserves the existing private-by-default restoration policy';
 assert (select activity_id from journey_participation_days where challenge_id=j)='a5500000-0000-4000-8000-000000000006','private undo does not silently reshare';
 update activities set social_private=false where id='a5500000-0000-4000-8000-000000000004';
 perform reconcile_journey(j);
 assert (select activity_id from journey_participation_days where challenge_id=j)='a5500000-0000-4000-8000-000000000004','undo restores the deterministic earlier winner once';
 assert (select distance_km from activities where id='a5500000-0000-4000-8000-000000000005')=2,'recorded swim distance unchanged';
 assert (select duration_min from activities where id='a5500000-0000-4000-8000-000000000001')=60,'original measurements authoritative';
end $$;

-- An explicit equipment edit does not silently change historical bike snapshots.
update equipment set electric_assist='none' where id='a5300000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='a5000000-0000-4000-8000-000000000001';
select set_activity_equipment('a5500000-0000-4000-8000-000000000002',array['a5300000-0000-4000-8000-000000000001']::uuid[]);
reset role;
do $$begin
 perform reconcile_journey('a5400000-0000-4000-8000-000000000001');
 assert (select calculation->>'resolvedBikeMode' from journey_contributions where challenge_id='a5400000-0000-4000-8000-000000000001' and activity_id='a5500000-0000-4000-8000-000000000002')='electric','unchanged equipment selection preserves historical snapshot';
end $$;
set local role authenticated;
set local request.jwt.claim.sub='a5000000-0000-4000-8000-000000000001';
select refresh_activity_bike_default('a5500000-0000-4000-8000-000000000002');
reset role;
do $$begin
 perform reconcile_journey('a5400000-0000-4000-8000-000000000001');
 assert (select journey_km from journey_contributions where challenge_id='a5400000-0000-4000-8000-000000000001' and activity_id='a5500000-0000-4000-8000-000000000002')=22,'refreshing to a conventional bike restores the normal distance baseline';
 update equipment set category='shoes' where id='a5300000-0000-4000-8000-000000000001';
 assert (select electric_assist is null from equipment where id='a5300000-0000-4000-8000-000000000001'),'Shoes clears bike assistance';
 update equipment set category='bike' where id='a5300000-0000-4000-8000-000000000001';
 assert (select electric_assist is null from equipment where id='a5300000-0000-4000-8000-000000000001'),'switching back never restores electric setting';
 begin
  insert into equipment(user_id,name,electric_assist) values('a5000000-0000-4000-8000-000000000001','Not a bike','electric');
  raise exception 'Non-bike assistance accepted';
 exception when check_violation then null;end;
 assert (select name from equipment where id='a5300000-0000-4000-8000-000000000001')='Specialized Vado','equipment identity/name retained';
end $$;

-- Scoped summaries and private explanations. No user can write trusted amounts.
set local role authenticated;
set local request.jwt.claim.sub='a5000000-0000-4000-8000-000000000002';
do $$declare summary jsonb;details jsonb;begin
 summary:=social_challenge_values('a5400000-0000-4000-8000-000000000001');
 assert (summary->>'contributors_count')::int=2,'unique contributing member count';
 assert summary->>'policy_version'='journey-distance-v1','policy pinned on instance';
 details:=social_journey_details('a5400000-0000-4000-8000-000000000001');
 assert jsonb_array_length(details->'own')=1,'only own individual calculations visible';
 assert not (details->'own'->0 ? 'notes') and not (details->'own'->0 ? 'route_polyline'),'no private journal fields copied';
 assert not has_table_privilege('authenticated','public.journey_contributions','INSERT'),'client cannot submit trusted amount';
 assert not has_function_privilege('authenticated','public.reconcile_journey(uuid)','EXECUTE'),'worker authorization enforced';
 assert not has_table_privilege('authenticated','public.journey_bike_snapshots','SELECT'),'sensitive bike input snapshots are private';
end $$;
set local request.jwt.claim.sub='a5000000-0000-4000-8000-000000000003';
do $$begin
 assert social_challenge_values('a5400000-0000-4000-8000-000000000001') is null,'outsider summary denied';
 begin perform social_journey_details('a5400000-0000-4000-8000-000000000001');raise exception 'Outsider allowed';
 exception when raise_exception then if sqlerrm='Outsider allowed' then raise;end if;end;
end $$;
reset role;
-- Membership removal withdraws credit; rejoining does not create an opt-in registry.
select social_leave('a5100000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000002','left');
do $$begin
 perform reconcile_journey('a5400000-0000-4000-8000-000000000001');
 assert not exists(select 1 from journey_contributions where challenge_id='a5400000-0000-4000-8000-000000000001' and user_id='a5000000-0000-4000-8000-000000000002' and active),'leave withdraws live contributions';
 update community_members set status='active',joined_at=now() where user_id='a5000000-0000-4000-8000-000000000002';
 insert into social_contexts(activity_id,audience_id) values('a5500000-0000-4000-8000-000000000007','a5200000-0000-4000-8000-000000000001');
 perform reconcile_journey('a5400000-0000-4000-8000-000000000001');
 assert not exists(select 1 from journey_contributions where activity_id='a5500000-0000-4000-8000-000000000007' and active),'current membership interval respected for automatic history';
 insert into social_activity_state(activity_id,audience_id,decision) values('a5500000-0000-4000-8000-000000000007','a5200000-0000-4000-8000-000000000001','include');
 perform reconcile_journey('a5400000-0000-4000-8000-000000000001');
 assert (select count(*) from journey_contributions where challenge_id='a5400000-0000-4000-8000-000000000001' and activity_id='a5500000-0000-4000-8000-000000000007' and active)=1,'explicit scoped re-sharing can restore once';
end $$;

-- Explicit closure is the exclusive cutoff; aspirational target dates did not end credit.
update community_challenges set status='closed',closed_at='2020-10-24T11:00Z' where id='a5400000-0000-4000-8000-000000000001';
do $$declare event_count int;begin
 perform reconcile_journey('a5400000-0000-4000-8000-000000000001');
 assert (select sum(journey_km) from journey_contributions where challenge_id='a5400000-0000-4000-8000-000000000001' and active)=67.5,'exclusive cutoff excludes activity exactly at close';
 assert not (select reached from journey_milestones where challenge_id='a5400000-0000-4000-8000-000000000001'),'corrections remove reached badge';
 insert into activities(id,user_id,type,date,started_at,duration_min,effort) values('a5500000-0000-4000-8000-000000000010','a5000000-0000-4000-8000-000000000001','run','2020-10-24','2020-10-24T09:00Z',12,null);
 insert into social_contexts(activity_id,audience_id) values('a5500000-0000-4000-8000-000000000010','a5200000-0000-4000-8000-000000000001');
 perform reconcile_journey('a5400000-0000-4000-8000-000000000001');
 assert (select sum(journey_km) from journey_contributions where challenge_id='a5400000-0000-4000-8000-000000000001' and active)=71.1,'late import before closure still reconciles';
 select count(*) into event_count from journey_progress_events;
 perform reconcile_journey('a5400000-0000-4000-8000-000000000001');
 assert (select count(*) from journey_progress_events)=event_count,'retries do not duplicate milestone events';
 begin update community_challenges set types='{ride}',activity_scope='selected' where id='a5400000-0000-4000-8000-000000000001';raise exception 'Closed rule changed';
 exception when raise_exception then if sqlerrm='Closed rule changed' then raise;end if;end;
 begin update journey_policies set config='{}' where version='journey-distance-v1';raise exception 'Policy changed';
 exception when raise_exception then if sqlerrm='Policy changed' then raise;end if;end;
end $$;

set local role authenticated;
set local request.jwt.claim.sub='a5000000-0000-4000-8000-000000000001';
do $$declare result jsonb;draft_id uuid;args jsonb;before_count integer;begin
 args:=jsonb_build_object('title','Draft journey fixture','metric','virtual_distance','target','20','scope','collective',
  'activity_scope','all','types','[]'::jsonb,'starts_on','2020-01-01','ends_on',null,'time_zone','Europe/Brussels','status','draft');
 result:=social_challenges('a5100000-0000-4000-8000-000000000001','create',args);
 select (value->>'id')::uuid into draft_id from jsonb_array_elements(result) where value->>'title'='Draft journey fixture';
 assert draft_id is not null,'journey creation reuses challenge API';
 assert (social_challenge_values(draft_id)->>'state')='draft' and (social_challenge_values(draft_id)->>'total')::numeric=0,'draft does not collect contributions';
 select jsonb_array_length(social_challenges('a5100000-0000-4000-8000-000000000001','list','{}')) into before_count;
 begin
  perform social_challenges('a5100000-0000-4000-8000-000000000001','create',args||'{"activity_scope":"selected"}');
  raise exception 'Empty selected scope accepted';
 exception when raise_exception then if sqlerrm='Empty selected scope accepted' then raise;end if;end;
 assert jsonb_array_length(social_challenges('a5100000-0000-4000-8000-000000000001','list','{}'))=before_count,'invalid filter creates no instance';
 perform social_challenges('a5100000-0000-4000-8000-000000000001','update',args||jsonb_build_object('id',draft_id,'status','active'));
 assert (social_challenge_values(draft_id)->>'state')='active','explicit activation';
 begin
  perform social_challenges('a5100000-0000-4000-8000-000000000001','update',args||jsonb_build_object('id',draft_id,'status','active','activity_scope','selected','types',jsonb_build_array('run')));
  raise exception 'Active filter changed';
 exception when raise_exception then if sqlerrm='Active filter changed' then raise;end if;end;
 -- Recorded distance is not virtual, and existing identifiers stay stable.
 result:=social_challenges('a5100000-0000-4000-8000-000000000001','create',args||jsonb_build_object('title','Recorded fixture','metric','distance','ends_on','2099-01-01','activity_scope','selected','types',jsonb_build_array('ride')));
 select (value->>'id')::uuid into draft_id from jsonb_array_elements(result) where value->>'title'='Recorded fixture';
 assert (social_challenge_values(draft_id)->>'total')::numeric=22,'recorded cycling distance ignores electric conversion and participation';
 assert social_challenge_values(draft_id)->>'activity_scope'='selected','recorded-distance filter persisted explicitly';
end $$;
reset role;
-- SQL and TypeScript use the same worked policy values.
do $$declare r record;calc jsonb;begin
 for r in select * from (values
  ('run',60::numeric,null::numeric,3,18::numeric),
  ('strength',60,null,3,18),('ride',60,null,3,18),('walk',60,null,3,18),('swim',60,null,3,18),
  ('run',null,8,null,18),('walk',null,4.5,null,18),('swim',null,2,null,18)
 )v(typ,dur,dist,eff,expected) loop
  calc:=calculate_journey_contribution(jsonb_build_object('activityType',r.typ,'durationMinutes',r.dur,'distanceKm',r.dist,'effort',r.eff));
  assert (calc->>'rawJourneyKm')::numeric=r.expected,'server worked policy example';
 end loop;
 calc:=calculate_journey_contribution('{"activityType":"ride","distanceKm":22,"bike":{"mode":"electric","source":"import"}}');
 assert (calc->>'rawJourneyKm')::numeric=11,'electric cycling contributes half its recorded distance';
 calc:=calculate_journey_contribution('{"activityType":"ride","durationMinutes":60,"effort":4,"bike":{"mode":"electric","source":"override"}}');
 assert (calc->>'rawJourneyKm')::numeric=9,'electric cycling contributes half the time fallback even with hard effort';
 calc:=calculate_journey_contribution('{"activityType":"custom","durationMinutes":24}');
 assert (calc->>'rawJourneyKm')::numeric=7.2,'unknown types use time';
 calc:=calculate_journey_contribution('{"activityType":"custom","distanceKm":100}');
 assert calc->>'basis'='participation','unknown types never guess a speed';
 calc:=calculate_journey_contribution('{"activityType":"run","durationMinutes":"NaN"}');
 assert calc->>'basis'='invalid' and (calc->>'rawJourneyKm')::numeric=0,'nonfinite measurements never create participation';
 calc:=calculate_journey_contribution('{"activityType":"run","durationMinutes":12,"effort":0}');
 assert calc->>'diagnostic' is null and calc->>'effortSource'='not_used','effort does not change virtual distance';
 calc:=calculate_journey_contribution('{"activityType":"run","distanceKm":5,"durationMinutes":42,"effort":1}');
 assert (calc->>'rawJourneyKm')::numeric=11.25 and calc->>'basis'='recorded_distance','five km run uses distance rather than discounting faster running';
 calc:=calculate_journey_contribution('{"activityType":"run","distanceKm":5,"durationMinutes":20,"effort":5}');
 assert (calc->>'rawJourneyKm')::numeric=11.25,'pace and effort do not alter a fixed-distance run';
end $$;
-- Exclude the deliberately future-dated fixture from this historical-progress check.
update social_contexts set revoked_at=now() where activity_id='a5500000-0000-4000-8000-000000000008';
-- Every recorded measure can close without losing its progress.
set local role authenticated;
set local request.jwt.claim.sub='a5000000-0000-4000-8000-000000000001';
do $$declare result jsonb;cid uuid;metric text;before_total numeric;begin
 foreach metric in array array['distance','duration','count','days'] loop
  result:=social_challenges('a5100000-0000-4000-8000-000000000001','create',jsonb_build_object(
   'title','Close fixture '||metric,'metric',metric,'target',100,'scope','collective','activity_scope','all','types','[]'::jsonb,
   'starts_on','2020-01-01','ends_on',(current_date-1)::text,'time_zone','Europe/Brussels'));
  select (value->>'id')::uuid into cid from jsonb_array_elements(result) where value->>'title'='Close fixture '||metric;
  before_total:=(social_challenge_values(cid)->>'total')::numeric;
  assert before_total>0,'fixture must have recorded progress';
  perform social_challenges('a5100000-0000-4000-8000-000000000001','close',jsonb_build_object('id',cid));
  result:=social_challenge_values(cid);
  assert result->>'state'='closed','all measures expose closed state';
  assert result->>'closed_at' is not null,'closure timestamp available for archive placement';
  assert (result->>'total')::numeric=before_total,'closing preserves recorded progress';
 end loop;
end $$;
reset role;
-- Later workouts must not increase any closed recorded challenge.
create temp table closed_expected as select id,(social_challenge_values(id)->>'total')::numeric total
 from community_challenges where title like 'Close fixture %';
insert into activities(id,user_id,type,date,started_at,duration_min,distance_km,effort)
 values('a5500000-0000-4000-8000-000000000099','a5000000-0000-4000-8000-000000000001','run',current_date,clock_timestamp()+interval '1 hour',60,100,3);
insert into social_contexts(activity_id,audience_id) values('a5500000-0000-4000-8000-000000000099','a5200000-0000-4000-8000-000000000001');
do $$declare ch record;begin
 for ch in select * from closed_expected loop
  set local role authenticated;
  assert (social_challenge_values(ch.id)->>'total')::numeric=ch.total,'post-close movement excluded';
  reset role;
  begin
   update community_challenges set status='active' where id=ch.id;
   raise exception 'Closed challenge reopened';
  exception when raise_exception then if sqlerrm='Closed challenge reopened' then raise;end if;end;
 end loop;
end $$;
rollback;
