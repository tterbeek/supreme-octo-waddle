begin;
insert into auth.users(id,email) values
 ('f9000000-0000-4000-8000-000000000001','trends-owner@example.test'),
 ('f9000000-0000-4000-8000-000000000002','trends-other@example.test');
insert into activities(user_id,type,date,distance_km,duration_min) values
 ('f9000000-0000-4000-8000-000000000001','run','2020-01-01',100,null),
 ('f9000000-0000-4000-8000-000000000001','run',current_date,0,30),
 ('f9000000-0000-4000-8000-000000000001','run',current_date,2,20),
 ('f9000000-0000-4000-8000-000000000001','run',current_date+1,777,777),
 ('f9000000-0000-4000-8000-000000000001','run',(date_trunc('month',current_date)-interval '3 months')::date,null,10),
 ('f9000000-0000-4000-8000-000000000001','run',(date_trunc('month',current_date)-interval '11 months')::date,11,null),
 ('f9000000-0000-4000-8000-000000000001','run',(date_trunc('month',current_date)-interval '12 months')::date,12,null),
 ('f9000000-0000-4000-8000-000000000002','run',current_date,999,999);
set local role authenticated;
set local request.jwt.claim.sub='f9000000-0000-4000-8000-000000000001';
do $$ begin
 assert (select count(*) from stats_activity_trends('month'))=3,'only populated months within latest twelve calendar months';
 assert (select distance_value=2 and duration_value=50 from stats_activity_trends('month') where period_start=date_trunc('month',current_date)::date),'aggregate per period without future or foreign data';
 assert (select distance_value is null and duration_value=10 from stats_activity_trends('month') where period_start=(date_trunc('month',current_date)-interval '3 months')::date),'missing distance stays absent';
 assert (select distance_value=100 from stats_activity_trends('year') where period_start='2020-01-01'),'year includes full historical data';
 assert (select count(*)=1 and sum(distance_value)=2 from stats_activity_trends('week')),'weekly range retained';
 assert (select count(*) from stats_activity_trends('month','Invalid/Zone'))=3,'invalid timezone safely falls back';
 begin perform stats_activity_trends('day');raise exception 'Invalid period accepted';
 exception when raise_exception then if SQLERRM<>'Invalid trend period' then raise;end if;end;
end $$;
set local request.jwt.claim.sub='f9000000-0000-4000-8000-000000000002';
do $$ begin
 assert (select count(*)=1 and sum(distance_value)=999 from stats_activity_trends('year')),'yearly history is account scoped';
end $$;
set local request.jwt.claim.sub='';
do $$ begin
 begin perform stats_activity_trends('year');raise exception 'Anonymous history exposed';
 exception when raise_exception then if SQLERRM<>'Sign in required' then raise;end if;end;
end $$;
rollback;
