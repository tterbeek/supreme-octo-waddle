begin;
update social_config set enabled=true;
insert into auth.users(id,email) values
 ('fd000000-0000-4000-8000-000000000001','map-owner@example.test'),
 ('fd000000-0000-4000-8000-000000000002','map-viewer@example.test'),
 ('fd000000-0000-4000-8000-000000000003','map-outsider@example.test');
insert into user_connections(requester_user_id,addressee_user_id,status) values
 ('fd000000-0000-4000-8000-000000000001','fd000000-0000-4000-8000-000000000002','accepted');
set local role authenticated;
set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000001';
insert into activities(id,user_id,type,date,route_polyline) values
 ('fd000000-0000-4000-8000-000000000004',auth.uid(),'run',current_date,'_p~iF~ps|U_ulLnnqC_mqNvxq`@');
do $$ declare settings jsonb;circle uuid;begin
 settings:=social_map_consent();
 assert not (settings->>'decided')::boolean and not (settings->>'enabled')::boolean,'maps private without affirmative consent';
 circle:=(social_home()->>'circle')::uuid;
 perform social_activity('fd000000-0000-4000-8000-000000000004',jsonb_build_object('audiences',jsonb_build_array(jsonb_build_object('id',circle,'share',true))));
 assert not (social_feed()->0->>'has_map')::boolean,'auto/manual activity sharing does not imply map consent';
 settings:=social_map_consent(false);
 assert (settings->>'decided')::boolean and not (settings->>'enabled')::boolean,'decline is remembered';
 perform social_map_consent(true);
 assert (social_map_consent()->>'enabled')::boolean,'confirmation persists';
 assert (social_feed()->0->>'has_map')::boolean,'existing shared routes enabled only after explicit confirmation';
 assert not (social_feed()->0 ? 'route_polyline'),'safe projection never exposes raw geometry';
 assert not has_function_privilege('authenticated','public.social_route_input(uuid,uuid)','EXECUTE'),'raw route helper is server only';
 assert not has_table_privilege('authenticated','public.social_map_preferences','UPDATE'),'consent only through authenticated RPC';
end $$;
reset role;
do $$ declare activity uuid:='fd000000-0000-4000-8000-000000000004';viewer uuid:='fd000000-0000-4000-8000-000000000002';begin
 assert social_route_input(activity,viewer) is not null,'currently authorized viewer may request protected route';
 assert auth.uid()='fd000000-0000-4000-8000-000000000001'::uuid,'helper restores prior identity';
 assert social_route_input(activity,'fd000000-0000-4000-8000-000000000003') is null,'activity ID alone grants no access';
 insert into social_blocks(blocker_id,blocked_id) values('fd000000-0000-4000-8000-000000000001',viewer);
 assert social_route_input(activity,viewer) is null,'blocking applies to route requests';
 delete from social_blocks where blocked_id=viewer;
 update social_contexts set revoked_at=now() where activity_id=activity;
 assert social_route_input(activity,viewer) is null,'stale links lose route access after unsharing';
end $$;
set local role authenticated;
set local request.jwt.claim.sub='fd000000-0000-4000-8000-000000000001';
select social_map_consent(false);
reset role;
do $$ begin
 assert social_route_input('fd000000-0000-4000-8000-000000000004','fd000000-0000-4000-8000-000000000001') is null,'withdrawing map consent takes effect immediately';
end $$;
rollback;
