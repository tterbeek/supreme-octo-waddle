begin;
update social_config set enabled=true;
insert into auth.users(id,email) values
 ('fb000000-0000-4000-8000-000000000001','import-owner@example.test'),
 ('fb000000-0000-4000-8000-000000000002','import-viewer@example.test');
insert into user_connections(requester_user_id,addressee_user_id,status) values
 ('fb000000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000002','accepted');
set local role authenticated;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000001';
do $$ begin
 perform social_set_rule((social_home()->>'circle')::uuid,'all','{}','UTC');
end $$;
reset role;
-- Service-side discovery happens before naming/route processing.
insert into activities(id,user_id,type,date,started_at,title,source,external_source,external_id,import_status,import_token,import_updated_at,imported_at) values
 ('fb000000-0000-4000-8000-000000000003','fb000000-0000-4000-8000-000000000001','run',current_date,now(),'Running','polar','polar','fictional-workout','processing','fb000000-0000-4000-8000-000000000004',now(),now());
do $$ begin
 assert not exists(select 1 from social_contexts where activity_id='fb000000-0000-4000-8000-000000000003'),'partial import must not auto-share';
end $$;
set local role authenticated;
do $$ begin
 assert (select import_status from activities where id='fb000000-0000-4000-8000-000000000003')='processing','owner can see template state';
 begin
  update activities set title='Premature edit' where id='fb000000-0000-4000-8000-000000000003';
  raise exception 'pending activity was editable';
 exception when insufficient_privilege then null;end;
 begin
  update activities set import_status='ready' where id='fb000000-0000-4000-8000-000000000003';
  raise exception 'owner bypassed import lock';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
update activities set import_status='failed' where id='fb000000-0000-4000-8000-000000000003';
set local role authenticated;
do $$ begin
 begin
  update activities set title='Failed edit' where id='fb000000-0000-4000-8000-000000000003';
  raise exception 'failed activity was editable';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Retrying the same canonical row changes the lease; an old worker cannot finish it.
update activities set import_status='processing',import_token='fb000000-0000-4000-8000-000000000005' where id='fb000000-0000-4000-8000-000000000003';
update activities set import_status='ready',title='Stale worker' where id='fb000000-0000-4000-8000-000000000003' and import_token='fb000000-0000-4000-8000-000000000004';
do $$ begin
 assert (select import_status from activities where id='fb000000-0000-4000-8000-000000000003')='processing','stale completion cannot unlock a retry';
end $$;
update activities set import_status='ready',title='Morning run Brussels',route_polyline='_p~iF~ps|U_ulLnnqC_mqNvxq`@',route_checked_at=now(),import_updated_at=now()
 where id='fb000000-0000-4000-8000-000000000003' and import_token='fb000000-0000-4000-8000-000000000005';
do $$ begin
 assert exists(select 1 from social_contexts where activity_id='fb000000-0000-4000-8000-000000000003' and revoked_at is null),'finished import auto-shares once ready';
 assert (select count(*) from activities where external_source='polar' and external_id='fictional-workout')=1,'one canonical activity survives retry';
end $$;
set local role authenticated;
do $$ begin
 update activities set title='My own title',user_enrichment_status='completed' where id='fb000000-0000-4000-8000-000000000003';
 assert found,'finished import is editable';
 begin
  update activities set import_token=gen_random_uuid() where id='fb000000-0000-4000-8000-000000000003';
  raise exception 'client changed import lease';
 exception when insufficient_privilege then null;end;
 insert into activities(id,user_id,type,date,title) values('fb000000-0000-4000-8000-000000000006',auth.uid(),'walk',current_date,'Manual');
 update activities set title='Edited manual' where id='fb000000-0000-4000-8000-000000000006';
 assert found,'manual creation/editing unchanged';
end $$;
set local request.jwt.claim.sub='fb000000-0000-4000-8000-000000000002';
do $$ begin
 assert not exists(select 1 from activities where id='fb000000-0000-4000-8000-000000000003'),'connected viewers cannot read private import metadata';
end $$;
rollback;
