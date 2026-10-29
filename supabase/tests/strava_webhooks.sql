begin;
insert into auth.users(id,email) values('99999999-1111-4444-8888-999999999999','strava-webhook-fixture@example.test');
insert into public.user_strava_connections(user_id,strava_athlete_id,access_token,refresh_token,token_expires_at)
 values('99999999-1111-4444-8888-999999999999',987654321,'fixture','fixture',now()+interval '1 hour');
insert into public.activities(id,user_id,type,date,title,source,external_source,external_id,notes,feeling_during,effort,distance_km,duration_min,route_polyline)
 values('99999999-2222-4444-8888-999999999999','99999999-1111-4444-8888-999999999999','run','2026-10-25','Strava title','strava','strava','7654321','My private reflection','happy',2,5,30,'fixture-route');

insert into public.activity_photos(activity_id,user_id,image_path,thumb_path,is_shared)
 values('99999999-2222-4444-8888-999999999999','99999999-1111-4444-8888-999999999999','fixture-photo','fixture-thumb',true);
insert into public.social_audiences(id,kind,circle_owner)
 values('99999999-3333-4444-8888-999999999999','circle','99999999-1111-4444-8888-999999999999');
insert into public.social_contexts(activity_id,audience_id)
 values('99999999-2222-4444-8888-999999999999','99999999-3333-4444-8888-999999999999');

do $$
declare e record; a record;
begin
 if has_table_privilege('authenticated','public.strava_webhook_events','SELECT')
 or has_table_privilege('anon','public.strava_webhook_events','INSERT')
 or has_function_privilege('authenticated','public.remove_strava_workout_data(uuid,text)','EXECUTE')
 or has_function_privilege('anon','public.claim_strava_webhook()','EXECUTE') then
  raise exception 'Webhook internals exposed to browsers';
 end if;
 insert into strava_webhook_events(event_key,owner_id,object_id,object_type,aspect_type,event_time)
 values('fixture',987654321,7654321,'activity','create',1793260800) on conflict do nothing;
 insert into strava_webhook_events(event_key,owner_id,object_id,object_type,aspect_type,event_time)
 values('fixture',987654321,7654321,'activity','create',1793260800) on conflict do nothing;
 if (select count(*) from strava_webhook_events where event_key='fixture')<>1 then raise exception 'Duplicate delivery';end if;
 select * into e from claim_strava_webhook();
 if e.state<>'processing' or e.attempts<>1 then raise exception 'Event was not leased';end if;
 if exists(select 1 from claim_strava_webhook()) then raise exception 'Concurrent worker claimed active event';end if;
 update strava_webhook_events set lease_until=now()-interval '1 second' where id=e.id;
 select * into e from claim_strava_webhook();
 if e.attempts<>2 then raise exception 'Expired lease not recovered';end if;
 perform remove_strava_workout_data('99999999-1111-4444-8888-999999999999','7654321');
 perform remove_strava_workout_data('99999999-1111-4444-8888-999999999999','7654321');
 select * into a from activities where id='99999999-2222-4444-8888-999999999999';
 if a.source<>'manual' or a.external_id is not null or a.route_polyline is not null or a.distance_km is not null or a.duration_min is not null then
  raise exception 'Provider data survived removal';
 end if;
 if not a.social_private then raise exception 'Personal entry is not private';end if;
 if not exists(select 1 from activity_photos where activity_id=a.id and image_path='fixture-photo' and not is_shared) then
  raise exception 'Personal photo removed or still shared';
 end if;
 if a.notes<>'My private reflection' or a.feeling_during<>'happy' or a.effort<>2 then raise exception 'Personal enrichment lost';end if;
 if exists(select 1 from social_contexts where activity_id=a.id and revoked_at is null) then raise exception 'Removal retained social access';end if;
 begin
  insert into activities(user_id,type,date,source,external_source,external_id)
   values(a.user_id,'run',current_date,'strava','strava','7654321');
  raise exception 'Withdrawn import recreated';
 exception when raise_exception then
  if sqlerrm='Withdrawn import recreated' then raise;end if;
 end;
 perform disconnect_strava_account(a.user_id);
 if exists(select 1 from user_strava_connections where user_id=a.user_id) then raise exception 'Credentials retained';end if;
end $$;
rollback;
