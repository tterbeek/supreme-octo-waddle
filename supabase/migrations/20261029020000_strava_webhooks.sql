-- Durable, service-only webhook inbox. No browser access or credentials in events.
create table public.strava_webhook_events (
 id uuid primary key default gen_random_uuid(),
 event_key text not null unique,
 owner_id bigint not null, object_id bigint not null,
 object_type text not null check(object_type in ('activity','athlete')),
 aspect_type text not null check(aspect_type in ('create','update','delete')),
 event_time bigint not null, updates jsonb not null default '{}',
 state text not null default 'pending' check(state in ('pending','processing','done','failed')),
 attempts integer not null default 0,
 available_at timestamptz not null default now(), lease_until timestamptz,
 last_error text, created_at timestamptz not null default now(), completed_at timestamptz
);
alter table public.strava_webhook_events enable row level security;
revoke all on public.strava_webhook_events from public,anon,authenticated;
grant all on public.strava_webhook_events to service_role;
create index strava_webhook_pending on public.strava_webhook_events(available_at,created_at) where state in ('pending','processing');

-- Prevent a later manual sync/stale create event from restoring withdrawn data.
create table public.strava_removed_activities (
 user_id uuid not null references auth.users on delete cascade,
 external_id text not null, primary key(user_id,external_id)
);
alter table public.strava_removed_activities enable row level security;
revoke all on public.strava_removed_activities from public,anon,authenticated;
grant all on public.strava_removed_activities to service_role;

-- One active event at a time also serializes token refresh and removal with creates.
create function public.claim_strava_webhook() returns setof public.strava_webhook_events
language plpgsql security definer set search_path=public,pg_temp as $$
declare next_id uuid;
begin
 perform pg_advisory_xact_lock(209776,1);
 if exists(select 1 from strava_webhook_events where state='processing' and lease_until>now()) then return;end if;
 select id into next_id from strava_webhook_events
 where (state='pending' and available_at<=now()) or (state='processing' and lease_until<=now())
 order by created_at for update skip locked limit 1;
 if next_id is not null then
  return query update strava_webhook_events set state='processing',attempts=attempts+1,
   lease_until=now()+interval '5 minutes' where id=next_id returning *;
 end if;
end;$$;
revoke all on function public.claim_strava_webhook() from public,anon,authenticated;
grant execute on function public.claim_strava_webhook() to service_role;

-- Strip provider workout data, preserving only the user's own enrichment.
-- The surviving record is private, manual, and carries no GPS/metrics/source identifiers.
create function public.remove_strava_workout_data(p_user_id uuid,p_external_id text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a record;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,209776));
 for a in select id,external_id from activities where user_id=p_user_id and external_source='strava'
   and (p_external_id is null or external_id=p_external_id) for update
 loop
  insert into strava_removed_activities values(p_user_id,a.external_id) on conflict do nothing;
  -- Explicit exclusions prevent automatic sharing of the retained personal entry.
  update social_activity_state set decision='exclude',updated_at=now() where activity_id=a.id;
  update social_contexts set revoked_at=coalesce(revoked_at,now()) where activity_id=a.id;
  delete from activity_shares where activity_id=a.id;
  update activity_photos set is_shared=false where activity_id=a.id;
  update activities set source='manual',external_source=null,external_id=null,raw_sport_type=null,raw_type=null,
   title='Personal movement reflection',type='other',social_private=true,share_legacy_photo=false,date=coalesce(created_at::date,current_date),
   started_at=null,distance_km=null,duration_min=null,route_polyline=null,route_checked_at=null,
   imported_at=null,last_synced_at=null,user_enrichment_status='completed',
   import_status='ready',import_token=null,import_updated_at=now()
  where id=a.id;
  -- social_auto may have considered previously unconfigured audiences during the update.
  update social_activity_state set decision='exclude',updated_at=now() where activity_id=a.id;
  update social_contexts set revoked_at=coalesce(revoked_at,now()) where activity_id=a.id;
 end loop;
 if p_external_id is not null then
  insert into strava_removed_activities values(p_user_id,p_external_id) on conflict do nothing;
 end if;
end;$$;
revoke all on function public.remove_strava_workout_data(uuid,text) from public,anon,authenticated;
grant execute on function public.remove_strava_workout_data(uuid,text) to service_role;

-- Scheduler makes delivery durable even if an Edge background task is interrupted.
-- Until explicitly configured in Vault this function is a no-op (including on dev).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create function public.wake_strava_webhook_worker() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare worker_url text; worker_secret text;
begin
 select decrypted_secret into worker_url from vault.decrypted_secrets where name='strava_webhook_worker_url' limit 1;
 select decrypted_secret into worker_secret from vault.decrypted_secrets where name='strava_webhook_worker_secret' limit 1;
 if worker_url is null or worker_secret is null then return;end if;
 if not exists(select 1 from strava_webhook_events where
  (state='pending' and available_at<=now()) or (state='processing' and lease_until<=now())) then return;end if;
 perform net.http_post(url:=worker_url,headers:=jsonb_build_object('Content-Type','application/json','x-worker-secret',worker_secret),
  body:='{}'::jsonb,timeout_milliseconds:=5000);
end;$$;
revoke all on function public.wake_strava_webhook_worker() from public,anon,authenticated;
grant execute on function public.wake_strava_webhook_worker() to service_role;
select cron.schedule('strava-webhook-worker','* * * * *','select public.wake_strava_webhook_worker()');

-- A stale sync must never recreate a removed workout or import after disconnect.
create function public.guard_strava_import() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.external_source='strava' then
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,209776));
  if exists(select 1 from strava_removed_activities where user_id=new.user_id and external_id=new.external_id)
    or not exists(select 1 from user_strava_connections where user_id=new.user_id) then
   raise exception 'Strava activity is no longer authorized';
  end if;
 end if;
 return new;
end;$$;
create trigger guard_strava_import before insert or update on public.activities
 for each row execute function public.guard_strava_import();

-- Cleanup and credential removal are one transaction, serialized with import inserts.
create function public.disconnect_strava_account(p_user_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform remove_strava_workout_data(p_user_id,null);
 delete from user_strava_connections where user_id=p_user_id;
end;$$;
revoke all on function public.disconnect_strava_account(uuid) from public,anon,authenticated;
grant execute on function public.disconnect_strava_account(uuid) to service_role;
