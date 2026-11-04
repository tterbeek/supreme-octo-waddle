begin;
insert into auth.users(id,email) values
 ('ff000000-0000-4000-8000-000000000001','preset-owner@example.test'),
 ('ff000000-0000-4000-8000-000000000002','preset-other@example.test');
insert into equipment(id,user_id,name) values
 ('ff100000-0000-4000-8000-000000000001','ff000000-0000-4000-8000-000000000001','Shoes'),
 ('ff100000-0000-4000-8000-000000000002','ff000000-0000-4000-8000-000000000001','Watch'),
 ('ff100000-0000-4000-8000-000000000003','ff000000-0000-4000-8000-000000000002','Other gear');
insert into activities(id,user_id,type,date,title,distance_km,duration_min,effort,route_polyline) values
 ('ff200000-0000-4000-8000-000000000001','ff000000-0000-4000-8000-000000000001','run',current_date,'Park loop',5,30,2,'_p~iF~ps|U_ulLnnqC_mqNvxq`@');
insert into activity_equipment(activity_id,equipment_id) values
 ('ff200000-0000-4000-8000-000000000001','ff100000-0000-4000-8000-000000000001'),
 ('ff200000-0000-4000-8000-000000000001','ff100000-0000-4000-8000-000000000002'),
 ('ff200000-0000-4000-8000-000000000001','ff100000-0000-4000-8000-000000000003');
set local role authenticated;
set local request.jwt.claim.sub='ff000000-0000-4000-8000-000000000001';
do $$ declare p uuid;begin
 p:=create_activity_preset('ff200000-0000-4000-8000-000000000001','  Park preset  ');
 assert (select name='Park preset' and distance_km=5 and duration_min=30 and effort=2 and route_polyline is not null from presets where id=p),'saved workout snapshot includes map and metrics';
 assert (select count(*) from preset_equipment where preset_id=p)=2,'all selected owner equipment copied';
 assert not exists(select 1 from preset_equipment where preset_id=p and equipment_id='ff100000-0000-4000-8000-000000000003'),'foreign gear never copied';
 delete from activity_equipment where activity_id='ff200000-0000-4000-8000-000000000001';
 assert (select count(*) from preset_equipment where preset_id=p)=2,'preset keeps its own equipment snapshot';
end $$;
set local request.jwt.claim.sub='ff000000-0000-4000-8000-000000000002';
do $$ begin
 begin
  perform create_activity_preset('ff200000-0000-4000-8000-000000000001','Forbidden');
  raise exception 'Other owner activity accepted';
 exception when raise_exception then
  if sqlerrm='Other owner activity accepted' then raise;end if;
 end;
 assert not exists(select 1 from presets where name='Forbidden'),'unauthorized call creates no preset';
end $$;
reset role;
-- Simulate a relation write failing after preset insertion: no partial preset survives.
insert into activity_equipment(activity_id,equipment_id) values
 ('ff200000-0000-4000-8000-000000000001','ff100000-0000-4000-8000-000000000001');
create function pg_temp.fail_preset_equipment() returns trigger language plpgsql as $$
begin raise exception 'Fixture link failure';end;$$;
create trigger fixture_fail_preset_equipment before insert on preset_equipment
 for each row execute function pg_temp.fail_preset_equipment();
set local role authenticated;
set local request.jwt.claim.sub='ff000000-0000-4000-8000-000000000001';
do $$ declare before_count integer;begin
 select count(*) into before_count from presets;
 begin
  perform create_activity_preset('ff200000-0000-4000-8000-000000000001','Broken preset');
  raise exception 'Expected link failure';
 exception when raise_exception then
  if sqlerrm<>'Fixture link failure' then raise;end if;
 end;
 assert (select count(*) from presets)=before_count,'failed equipment copy rolls back preset insertion';
end $$;
rollback;
