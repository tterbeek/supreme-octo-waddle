-- Fictional records, exercised only by the isolated verifier; never retained.
begin;
insert into auth.users(id,email) values
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','memories@example.test'),
 ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb','other@example.test');
insert into public.activities(id,user_id,type,date,title,notes,created_at)
select md5('memory-'||n)::uuid,'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','walk',date '2024-01-10','Walk '||n,
 case when mod(n,2)=0 then 'Original words' else null end,'2024-01-10 12:00:00'
from generate_series(1,85) n;
insert into public.activities(id,user_id,type,date,title) values
 ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb','bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb','run','2024-01-10','Private');
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$
declare page1 jsonb;page2 jsonb;page3 jsonb;last_row jsonb;feature jsonb;again jsonb;neighbor jsonb; chosen uuid;
begin
 assert memory_date_tier('2024-10-24','2026-10-24')=0,'exact anniversary';
 assert memory_date_tier('2024-12-28','2026-01-02')=1,'year boundary';
 assert memory_date_tier('2024-02-29','2025-02-28')=1,'leap day nearby but never falsely exact';
 assert memory_date_tier('2024-02-29','2025-03-01')=1,'non-leap window uses March 1 only for nearby matching';
 assert memory_date_tier('2024-02-29','2028-02-29')=0,'leap exact';
 assert memory_date_tier('2024-10-10','2026-10-24')=1,'14 days inclusive';
 assert memory_date_tier('2024-10-09','2026-10-24')=2,'15 days excluded';
 assert memory_date_tier('2026-01-01','2026-10-24')=2,'nearby anniversaries only prior years';
 assert (select jsonb_array_length(memory_archive()))=1,'only own archive months';
 assert (memory_archive()->0->>'count')::int=85,'summary not subject to row cap';
 page1:=memory_page('2024-01-01','2024-02-01');last_row:=page1->39;
 page2:=memory_page('2024-01-01','2024-02-01',last_row);page3:=memory_page('2024-01-01','2024-02-01',page2->39);
 assert jsonb_array_length(page1)=40 and jsonb_array_length(page2)=40 and jsonb_array_length(page3)=5,'pagination complete';
 assert (select count(distinct row->>'id') from jsonb_array_elements(page1||page2||page3) row)=85,'ties ordered without duplication';
 neighbor:=memory_neighbors((page1->39->>'id')::uuid,'2024-01-01','2024-02-01');
 assert neighbor->>'earlier'=page2->0->>'id','reader crosses page boundaries';
 assert memory_neighbors('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb','2024-01-01','2024-02-01')='{}'::jsonb,'direct private context denied';
 feature:=memory_feature('Europe/Brussels');again:=memory_feature('Europe/Brussels');
 assert (feature->>'day')::date=(now() at time zone 'Europe/Brussels')::date,'server uses local calendar day';
 assert feature=again,'daily assignment stable'; chosen:=(feature->>'id')::uuid;
 assert chosen is not null,'eligible bare or noted activity';
 assert (select (notes is not null)=(mod((feature->>'day')::date-date '2000-01-01',3)<>0) from activities where id=chosen),'sparse entries get the reserved rotation day';
 assert not exists(select 1 from memory_days where exposed_at is not null),'prefetch does not record exposure';
 perform memory_feature_action((feature->>'day')::date,chosen);
 assert exists(select 1 from memory_days where exposed_at is not null),'display records exposure';
 assert feature=memory_feature('Europe/Brussels'),'own daily exposure does not invalidate assignment';
 perform memory_feature_action((feature->>'day')::date,chosen,true);
 assert memory_feature('Europe/Brussels')->>'id' is null,'dismiss hides for remainder of day';
 assert exists(select 1 from activities where id=chosen),'dismiss never deletes activity';
 assert exists(select 1 from memory_dismissals where activity_id=chosen),'dismissal persists';
 begin
  insert into memory_days(user_id,day,activity_id) values(auth.uid(),current_date+1,'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb');
  raise exception 'direct metadata write permitted';
 exception when insufficient_privilege then null;end;
end $$;
set local request.jwt.claim.sub='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
do $$ begin
 assert not exists(select 1 from memory_days),'metadata private';
 assert not exists(select 1 from memory_dismissals),'dismissals private';
 assert (memory_archive()->0->>'count')::int=1,'other owner isolation';
 assert jsonb_array_length(memory_page('2024-01-01','2024-02-01'))=1,'page owner isolation';
end $$;
reset role;
-- Cooldown is exposure-based; assignment alone is not exclusion.
delete from memory_days;delete from memory_dismissals;
insert into memory_days(user_id,day,activity_id,exposed_at)
select user_id,current_date-1,id,now()-interval '1 day' from activities
where user_id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa' limit 1;
set local role authenticated;
set local request.jwt.claim.sub='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
do $$ declare f jsonb;begin
 f:=memory_feature('UTC');
 assert not exists(select 1 from memory_days where activity_id=(f->>'id')::uuid and day=current_date-1),'cooldown excludes previous exposure';
end $$;
reset role;
delete from memory_days;
insert into memory_days(user_id,day,activity_id,exposed_at)
select user_id,current_date-(row_number() over(order by id))::int,id,now()-interval '1 day'
from activities where user_id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
set local role authenticated;
do $$ begin
 assert memory_feature('UTC')->>'id' is null,'all recently exposed means no replacement';
end $$;
reset role;
delete from memory_days;
delete from activities where user_id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
insert into activities(id,user_id,type,date,title) values
 ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','walk',current_date-89,'Recent walk');
set local role authenticated;
do $$ begin
 assert memory_feature('UTC')->>'id' is null,'recent activity is not suggested';
 assert jsonb_array_length(memory_page((current_date-90)::date,(current_date+1)::date))=1,'recent history is browseable';
end $$;
rollback;
