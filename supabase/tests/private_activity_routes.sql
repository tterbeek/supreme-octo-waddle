begin;
update social_config set enabled=true;
insert into auth.users(id,email) values
 ('fa000000-0000-4000-8000-000000000001','route-owner@example.test'),
 ('fa000000-0000-4000-8000-000000000002','route-viewer@example.test');
insert into user_connections(requester_user_id,addressee_user_id,status) values
 ('fa000000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000002','accepted');
set local role authenticated;
set local request.jwt.claim.sub='fa000000-0000-4000-8000-000000000001';
insert into activities(id,user_id,type,date,route_polyline,route_checked_at) values
 ('fa000000-0000-4000-8000-000000000003',auth.uid(),'walk',current_date,'_p~iF~ps|U_ulLnnqC_mqNvxq`@',now());
do $$ declare c uuid;begin
 assert (select route_polyline from activities where id='fa000000-0000-4000-8000-000000000003') is not null,'owner can load private route';
 c:=(social_home()->>'circle')::uuid;
 perform social_activity('fa000000-0000-4000-8000-000000000003',jsonb_build_object('audiences',jsonb_build_array(jsonb_build_object('id',c,'share',true))));
end $$;
set local request.jwt.claim.sub='fa000000-0000-4000-8000-000000000002';
do $$ declare f jsonb;begin
 assert not exists(select 1 from activities where id='fa000000-0000-4000-8000-000000000003'),'connected viewer cannot read private route columns';
 f:=social_feed(null,null,'fa000000-0000-4000-8000-000000000003');
 assert jsonb_array_length(f)=1,'viewer can see shared activity';
 assert not (f->0 ? 'route_polyline') and not (f->0 ? 'route_checked_at'),'shared projection never includes GPS';
 update activities set route_polyline=null where id='fa000000-0000-4000-8000-000000000003';
 assert not found,'other user cannot modify route';
end $$;
set local request.jwt.claim.sub='fa000000-0000-4000-8000-000000000001';
do $$ begin
 assert (select route_polyline from activities where id='fa000000-0000-4000-8000-000000000003') is not null,'route survives unauthorized update';
 begin
  update activities set route_polyline=repeat('x',5001) where id='fa000000-0000-4000-8000-000000000003';
  raise exception 'Oversized route accepted';
 exception when check_violation then null;end;
end $$;
rollback;
