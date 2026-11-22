begin;
do $$ begin
 assert not exists(select 1 from information_schema.columns where table_schema='public' and table_name='activities' and column_name='cycling_mode_override'),'Unused override is removed';
 assert position('cycling_mode_override' in pg_get_functiondef('public.journey_refresh_bike(uuid,boolean)'::regprocedure))=0,'Bike resolver no longer needs removed column';
 assert position('cycling_mode_override' in pg_get_functiondef('public.journey_activity_revision()'::regprocedure))=0,'Activity trigger no longer needs removed column';
end $$;
insert into auth.users(id,email) values('fa220000-0000-4000-8000-000000000002','bike-cleanup@example.test');
insert into public.activities(id,user_id,type,date,duration_min,raw_sport_type)
values('fa220000-0000-4000-8000-000000000003','fa220000-0000-4000-8000-000000000002','ride',current_date,60,'EBikeRide');
update public.activities set duration_min=61 where id='fa220000-0000-4000-8000-000000000003';
do $$ begin
 assert (select mode='electric' and source='import' from journey_bike_snapshots where activity_id='fa220000-0000-4000-8000-000000000003'),'Electric import classification retained';
end $$;
rollback;
