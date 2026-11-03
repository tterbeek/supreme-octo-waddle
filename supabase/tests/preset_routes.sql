begin;
insert into auth.users(id,email) values
 ('fc000000-0000-4000-8000-000000000001','preset-route-owner@example.test'),
 ('fc000000-0000-4000-8000-000000000002','preset-route-other@example.test');
set local role authenticated;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000001';
insert into presets(id,user_id,type,name,route_polyline) values
 ('fc000000-0000-4000-8000-000000000003',auth.uid(),'run','Park loop','_p~iF~ps|U_ulLnnqC_mqNvxq`@');
do $$ declare p presets; a activities;begin
 select * into p from presets where id='fc000000-0000-4000-8000-000000000003';
 insert into activities(user_id,type,date,title,route_polyline)
 values(auth.uid(),p.type,current_date,p.name,p.route_polyline) returning * into a;
 assert a.route_polyline=p.route_polyline and a.source='manual' and a.external_id is null,'preset copies route without impersonating provider';
 update presets set name='Renamed loop' where id=p.id;
 assert (select route_polyline from presets where id=p.id)=a.route_polyline,'editing preset details retains route';
 delete from activities where id=a.id;
 assert (select route_polyline from presets where id=p.id) is not null,'route snapshot outlives source activity';
 begin
  update presets set route_polyline=repeat('x',5001) where id=p.id;
  raise exception 'Oversized route accepted';
 exception when check_violation then null;end;
end $$;
set local request.jwt.claim.sub='fc000000-0000-4000-8000-000000000002';
do $$ begin
 assert not exists(select 1 from presets where id='fc000000-0000-4000-8000-000000000003'),'other users cannot read preset GPS';
 update presets set route_polyline=null where id='fc000000-0000-4000-8000-000000000003';
 assert not found,'other users cannot change preset GPS';
end $$;
rollback;
