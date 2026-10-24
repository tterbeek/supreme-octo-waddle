begin;
insert into auth.users(id,email) values
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','selected@example.test'),
 ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','other-selected@example.test');
insert into activities(id,user_id,type,date,title,notes,created_at)
select md5('selected-note-'||n)::uuid,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','walk','2024-01-10','A saved title','x','2024-01-10 12:00:00'
from generate_series(1,85) n;
insert into activities(id,user_id,type,date,title,feeling_during)
select md5('selected-detail-'||n)::uuid,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','walk','2024-01-10','Details only','smile'
from generate_series(1,20) n;
insert into activities(id,user_id,type,date,title,source,raw_type,distance_km,duration_min,effort)
select md5('selected-basic-'||n)::uuid,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','run','2024-01-10','Morning run Brussels','polar','Automatic integration description',999,100,5
from generate_series(1,20) n;
insert into equipment(id,user_id,name) values(md5('selected-shoes')::uuid,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','My shoes');
insert into activity_equipment(activity_id,equipment_id) values(md5('selected-basic-1')::uuid,md5('selected-shoes')::uuid);
insert into activity_photos(id,user_id,activity_id,image_path,thumb_path,sort_order)
select md5('selected-photo-'||n)::uuid,'dddddddd-dddd-4ddd-8ddd-dddddddddddd',md5('selected-note-1')::uuid,'owner/photo-'||n,'owner/thumb-'||n,n
from generate_series(1,5) n;
insert into activities(id,user_id,type,date,title)
select md5('selected-sparse-month-'||n)::uuid,'dddddddd-dddd-4ddd-8ddd-dddddddddddd','walk','2023-04-01','Only data'
from generate_series(1,12) n;
insert into activities(id,user_id,type,date,notes) values(md5('selected-other')::uuid,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','walk','2024-01-10','PRIVATE');
set local role authenticated;
set local request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $$
declare first jsonb;second jsonb;third jsonb;archive jsonb; chosen uuid;
begin
 assert (select count(*) from memory_material('2024-01-01','2024-02-01') where material='personal')=85,'one-character notes qualify equally';
 assert (select material from memory_material('2024-01-01','2024-02-01') where id=md5('selected-basic-2')::uuid)='basic','generated title, import description, effort and metrics are not personal material';
 assert (select material from memory_material('2024-01-01','2024-02-01') where id=md5('selected-basic-1')::uuid)='details','recorded equipment is supporting context';
 assert (select count(*) from memory_material('2024-01-01','2024-02-01') where selected and material='details')=1,'one details sample per month';
 assert (select count(*) from memory_material('2024-01-01','2024-02-01') where selected and material='basic')=1,'one basic sample per month';
 first:=memory_page_v2('2024-01-01','2024-02-01');second:=memory_page_v2('2024-01-01','2024-02-01',first->39);third:=memory_page_v2('2024-01-01','2024-02-01',second->39);
 assert jsonb_array_length(first)=40 and jsonb_array_length(second)=40 and jsonb_array_length(third)=7,'selected browsing paginates without truncation';
 assert (select count(distinct r->>'id') from jsonb_array_elements(first||second||third) r)=87,'selected cursor ties are stable';
 assert memory_neighbors_v2((first->39->>'id')::uuid,'2024-01-01','2024-02-01')->>'earlier'=second->0->>'id','selected reader matches pagination';
 chosen:=(first->0->>'id')::uuid;
 assert (memory_neighbors_v2(chosen,'2024-01-01','2024-02-01',false)->>'total')::int=125,'reader broadening includes the complete record';
 select id into chosen from memory_material('2024-01-01','2024-02-01') where not selected limit 1;
 assert memory_neighbors_v2(chosen,'2024-01-01','2024-02-01')='{}'::jsonb,'unselected activity is outside selected reader';
 assert (memory_neighbors_v2(chosen,'2024-01-01','2024-02-01',true,chosen)->>'total')::int=88,'a separately featured sparse activity joins selected neighbors without exposing all sparse history';
 archive:=memory_archive_v2();
 assert jsonb_array_length(archive)=2,'sparse months remain in archive';
 assert (archive->0->>'count')::int=125 and (archive->0->>'selected_count')::int=87,'month summary gives both counts';
 assert (archive->1->>'personal_count')::int=0 and (archive->1->>'count')::int=12,'sparse month is explicit';
 assert jsonb_array_length(archive->0->'moments')=3,'landing preview is bounded';
 assert memory_summary(md5('selected-other')::uuid) is null,'summary cannot leak other owner';
 update activities set notes='A new personal note' where id=md5('selected-basic-2')::uuid;
 assert (select material='personal' and selected from memory_material('2024-01-01','2024-02-01') where id=md5('selected-basic-2')::uuid),'new notes immediately enter selection';
end $$;
set local request.jwt.claim.sub='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
do $$ begin
 assert (memory_archive_v2()->0->>'count')::int=1,'archive is owner scoped';
 assert jsonb_array_length(memory_page_v2('2024-01-01','2024-02-01',null,false))=1,'all activities remains private';
end $$;
reset role;
set local request.jwt.claim.sub='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
do $$ declare day_key date:='2026-01-10';run_id uuid:=md5('selected-type-run')::uuid;begin
 if mod(day_key-date '2000-01-01',3)=0 then day_key:=day_key+1;end if;
 insert into activities(id,user_id,type,date,notes) values(run_id,auth.uid(),'run','2024-01-10','A short thought');
 insert into memory_days(user_id,day,activity_id,exposed_at) values(auth.uid(),current_date-1,md5('selected-note-1')::uuid,now());
 assert (select type from activities where id=memory_pick_candidate(day_key))='run','another activity type is preferred when equal personal material is available';
end $$;
rollback;
