begin;
update social_config set enabled=true;
insert into auth.users(id,email) values
 ('b5000000-0000-4000-8000-000000000001','curated-owner@example.test'),
 ('b5000000-0000-4000-8000-000000000002','curated-member@example.test'),
 ('b5000000-0000-4000-8000-000000000003','curated-outsider@example.test');
insert into communities(id,owner_id,name) values('b5100000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000001','Curated fixture');
insert into community_members(community_id,user_id,role,status,joined_at) values
 ('b5100000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000001','owner','active','2019-01-01'),
 ('b5100000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000002','member','active','2019-01-01');
insert into social_audiences(id,kind,community_id) values('b5200000-0000-4000-8000-000000000001','community','b5100000-0000-4000-8000-000000000001');
create temp table curated_id(id uuid);
grant all on curated_id to authenticated;
set local role authenticated;
set local request.jwt.claim.sub='b5000000-0000-4000-8000-000000000001';
do $$declare result jsonb;cid uuid;detail jsonb;begin
 assert jsonb_array_length(social_journey_catalog())=10,'ten routes available';
 result:=social_challenges('b5100000-0000-4000-8000-000000000001','create','{"title":"Our Paris chapter","metric":"virtual_distance","scope":"collective","target":"1","activity_scope":"all","types":[],"starts_on":"2020-01-01","time_zone":"Europe/Brussels","journey_template_slug":"weekend-in-paris","journey_template_version":1}');
 select (value->>'id')::uuid into cid from jsonb_array_elements(result) where value->>'title'='Our Paris chapter';
 insert into curated_id values(cid);
 detail:=social_journey_route(cid);
 assert detail->'summary'->'route'->>'slug'='weekend-in-paris','route metadata returned in authorized summary';
 assert (detail->'summary'->>'target')::numeric>436,'client cannot choose a smaller target than route';
 assert (detail->'summary'->>'target')::numeric=round((detail->'template'->>'targetKm')::numeric,12),'target derives from pinned geometry';
 assert jsonb_array_length(detail->'reached')=1,'start reached at zero';
 assert detail->'next'->>'name'='Brussels','next destination from trusted zero total';
 assert detail->'summary'->>'policy_version'='journey-distance-v1','existing calculation policy retained';
 assert not has_table_privilege('authenticated','public.journey_templates','INSERT'),'catalog cannot be altered by browser';
end $$;
reset role;
do $$declare cid uuid;begin
 select id into cid from curated_id;
 assert (select route_version from community_challenges where id=cid)='weekend-in-paris@1:great-circle-v1','template and geometry pinned';
 update community_challenges set target=1 where id=cid;
 assert (select target>436 from community_challenges where id=cid),'target remains fixed on updates';
 begin
  update community_challenges set journey_template_slug='discover-japan' where id=cid;
  raise exception 'Route changed';
 exception when raise_exception then if sqlerrm='Route changed' then raise;end if;end;
 begin update journey_templates set snapshot=snapshot||'{"title":"Changed"}' where slug='weekend-in-paris';raise exception 'Template changed';
 exception when raise_exception then if sqlerrm='Template changed' then raise;end if;end;
 insert into journey_templates select * from journey_templates on conflict(slug,version) do nothing;
 assert (select count(*) from journey_templates)=10,'seeding is idempotent';
 insert into journey_templates(slug,version,geometry_version,target_km,snapshot)
  select slug,2,geometry_version,target_km,snapshot||'{"version":2,"title":"Future Paris edition"}'::jsonb from journey_templates where slug='weekend-in-paris' and version=1;
 assert (calculate_journey_contribution('{"activityType":"run","distanceKm":5,"durationMinutes":42}')->>'rawJourneyKm')::numeric=11.25,'running calculation unchanged';
 assert (calculate_journey_contribution('{"activityType":"ride","distanceKm":30,"bike":{"mode":"electric"}}')->>'rawJourneyKm')::numeric=15,'electric-bike calculation unchanged';
end $$;
insert into activities(id,user_id,type,date,started_at,distance_km,effort) values
 ('b5500000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000001','run','2020-10-24','2020-10-24T10:00Z',100,1),
 ('b5500000-0000-4000-8000-000000000002','b5000000-0000-4000-8000-000000000002','ride','2020-10-24','2020-10-24T11:00Z',300,3);
insert into social_contexts(activity_id,audience_id) values
 ('b5500000-0000-4000-8000-000000000001','b5200000-0000-4000-8000-000000000001'),
 ('b5500000-0000-4000-8000-000000000002','b5200000-0000-4000-8000-000000000001');
set local role authenticated;
set local request.jwt.claim.sub='b5000000-0000-4000-8000-000000000002';
do $$declare detail jsonb;begin
 detail:=social_journey_route((select id from curated_id));
 assert (detail->'summary'->>'total')::numeric=525,'server contribution total drives map';
 assert (detail->'summary'->>'contributors_count')::int=2,'unique contributors';
 assert jsonb_array_length(detail->'reached')=3 and detail->'next'='null'::jsonb,'destination reached with overshoot retained';
 assert detail->'template'->>'title'='A Weekend in Paris','new catalog versions do not rewrite instances';
 assert not(detail ? 'activities') and not(detail ? 'notes'),'route projection contains no private activities';
 begin
  perform social_challenges('b5100000-0000-4000-8000-000000000001','create','{}');raise exception 'Member created challenge';
 exception when raise_exception then if sqlerrm='Member created challenge' then raise;end if;end;
end $$;
set local request.jwt.claim.sub='b5000000-0000-4000-8000-000000000003';
do $$begin
 assert social_challenge_values((select id from curated_id)) is null,'outsider cannot read summary';
 begin perform social_journey_route((select id from curated_id));raise exception 'Outsider read route';
 exception when raise_exception then if sqlerrm='Outsider read route' then raise;end if;end;
end $$;
reset role;
update social_contexts set revoked_at=now() where activity_id='b5500000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claim.sub='b5000000-0000-4000-8000-000000000001';
do $$declare detail jsonb;begin
 detail:=social_journey_route((select id from curated_id));
 assert (detail->'summary'->>'total')::numeric=300,'unsharing moves progress backwards';
 assert jsonb_array_length(detail->'reached')=2 and detail->'next'->>'name'='Paris','milestones move backwards without separate mutable state';
 perform social_challenges('b5100000-0000-4000-8000-000000000001','close',jsonb_build_object('id',(select id from curated_id)));
 detail:=social_journey_route((select id from curated_id));
 assert detail->'summary'->>'state'='closed' and detail->'summary'->>'closed_at' is not null,'closed route remains available for archive';
 assert detail->'next'->>'name'='Paris','closed-before-destination is not completed';
end $$;
reset role;
rollback;
