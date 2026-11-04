begin;
insert into auth.users(id,email) values
 ('fe000000-0000-4000-8000-000000000001','equipment-owner@example.test'),
 ('fe000000-0000-4000-8000-000000000002','equipment-other@example.test');
insert into equipment(id,user_id,name,activity_types,is_active) values
 ('fe100000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000001','Old shoes','{run}',true),
 ('fe100000-0000-4000-8000-000000000002','fe000000-0000-4000-8000-000000000001','Road shoes','{run,walk}',true),
 ('fe100000-0000-4000-8000-000000000003','fe000000-0000-4000-8000-000000000001','Trail shoes','{run}',true),
 ('fe100000-0000-4000-8000-000000000004','fe000000-0000-4000-8000-000000000001','Retired shoes','{run}',false),
 ('fe100000-0000-4000-8000-000000000005','fe000000-0000-4000-8000-000000000001','Unassigned','{}',true),
 ('fe100000-0000-4000-8000-000000000006','fe000000-0000-4000-8000-000000000002','Someone else shoes','{run}',true),
 ('fe100000-0000-4000-8000-000000000007','fe000000-0000-4000-8000-000000000001','New unused shoes','{run}',true);
insert into activities(id,user_id,type,date,created_at) values
 ('fe200000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000001','run',current_date-5,now()-interval '5 days'),
 ('fe200000-0000-4000-8000-000000000002','fe000000-0000-4000-8000-000000000001','run',current_date-2,now()-interval '2 days'),
 ('fe200000-0000-4000-8000-000000000003','fe000000-0000-4000-8000-000000000001','run',current_date-1,now()-interval '1 day'),
 ('fe200000-0000-4000-8000-000000000004','fe000000-0000-4000-8000-000000000001','walk',current_date,now()),
 ('fe200000-0000-4000-8000-000000000005','fe000000-0000-4000-8000-000000000002','run',current_date,now());
insert into activity_equipment(activity_id,equipment_id) values
 ('fe200000-0000-4000-8000-000000000001','fe100000-0000-4000-8000-000000000001'),
 ('fe200000-0000-4000-8000-000000000002','fe100000-0000-4000-8000-000000000002'),
 ('fe200000-0000-4000-8000-000000000003','fe100000-0000-4000-8000-000000000003'),
 ('fe200000-0000-4000-8000-000000000003','fe100000-0000-4000-8000-000000000004'),
 ('fe200000-0000-4000-8000-000000000003','fe100000-0000-4000-8000-000000000005'),
 ('fe200000-0000-4000-8000-000000000004','fe100000-0000-4000-8000-000000000002'),
 ('fe200000-0000-4000-8000-000000000005','fe100000-0000-4000-8000-000000000006');
set local role authenticated;
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000001';
do $$ declare ids uuid[];begin
 select array_agg(id) into ids from recent_equipment_for_type('run');
 assert ids=array['fe100000-0000-4000-8000-000000000003','fe100000-0000-4000-8000-000000000002']::uuid[],'two most recent distinct active assigned items only';
 select array_agg(id) into ids from recent_equipment_for_type('walk');
 assert ids=array['fe100000-0000-4000-8000-000000000002']::uuid[],'recency scoped to activity type, multi-type assignment supported';
 assert not exists(select 1 from recent_equipment_for_type('yoga')),'no fabricated usage';
 update equipment set activity_types='{ride}' where id='fe100000-0000-4000-8000-000000000003';
 assert not exists(select 1 from recent_equipment_for_type('run') where name='Trail shoes'),'changed assignments honored';
 begin
  update equipment set activity_types='{any}' where id='fe100000-0000-4000-8000-000000000002';
  raise exception 'Invalid activity type accepted';
 exception when check_violation then null;end;
end $$;
set local request.jwt.claim.sub='fe000000-0000-4000-8000-000000000002';
do $$ begin
 assert (select count(*) from recent_equipment_for_type('run'))=1,'other account only sees its own suggestions';
 update equipment set activity_types='{walk}' where id='fe100000-0000-4000-8000-000000000002';
 assert not found,'another account cannot edit assignments';
end $$;
rollback;
