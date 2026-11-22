-- Virtual distance extends Community challenges. Membership stays automatic;
-- existing activity sharing is the consent boundary. Legacy measures are unchanged.
create table public.journey_policies(version text primary key,config jsonb not null);
alter table public.journey_policies enable row level security;
revoke all on public.journey_policies from public,anon,authenticated;
grant select on public.journey_policies to service_role;
insert into public.journey_policies values('journey-distance-v1', '{"id":"journey-distance-v1","decimalPlaces":12,"participationKmPerDay":"1","activityCategories":{"ride":"cycling","run":"running","walk":"walking","swim":"swimming","strength":"strength","hike":"other","yoga":"other","meditation":"other","restore":"other","other":"other"},"electricSubtypes":["ebikeride","emountainbikeride","electriccycling","electricmountainbiking","ebiking","ebike","electricbiking"],"conventionalSubtypes":["ride","mountainbikeride","gravelride","virtualride","cycling","roadcycling","mountainbiking","indoorcycling","spinning"],"virtualKmPerHour":"18","distanceMultipliers":{"cycling":"1","electric_cycling":"0.5","running":"2.25","walking":"4","swimming":"9"},"electricTimeFactor":"0.5"}'::jsonb);
create function public.journey_policy_immutable() returns trigger language plpgsql as $$
begin raise exception 'Create a new policy version instead of changing an existing policy';end;$$;
create trigger journey_policy_immutable before update or delete on public.journey_policies
 for each row execute function public.journey_policy_immutable();

alter table public.equipment add column category text check(category in('bike','shoes','other')),
 add column electric_assist text check(electric_assist in('none','electric','unknown')),
 add constraint equipment_bike_assistance check(category is not distinct from 'bike' or electric_assist is null);
create function public.clear_non_bike_assist() returns trigger language plpgsql as $$
begin
 if new.category is distinct from old.category and new.category is distinct from 'bike' then new.electric_assist:=null;end if;
 return new;
end;$$;
create trigger clear_non_bike_assist before update on public.equipment
 for each row execute function public.clear_non_bike_assist();

alter table public.activities add column cycling_mode_override text check(cycling_mode_override in('conventional','electric','unknown')),
 add column journey_revision bigint not null default 1;
alter table public.community_challenges drop constraint community_challenges_metric_check,
 drop constraint community_challenges_status_check,alter column ends_on drop not null,
 add constraint community_challenges_metric_check check(metric in('distance','duration','count','days','virtual_distance')),
 add constraint community_challenges_status_check check(status in('draft','active','closed','cancelled')),
 add column activity_scope text not null default 'all' check(activity_scope in('all','selected')),
 add column journey_policy_version text references public.journey_policies(version),
 add column activated_at timestamptz,add column closed_at timestamptz,add column route_version text,
 add constraint virtual_policy_required check((metric='virtual_distance')=(journey_policy_version is not null)),
 add constraint virtual_collective check(metric<>'virtual_distance' or scope='collective'),
 add constraint legacy_end_required check(metric='virtual_distance' or ends_on is not null),
 add constraint selected_types_required check(activity_scope<>'selected' or cardinality(types)>0);
update public.community_challenges set activity_scope='selected' where cardinality(types)>0;

create table public.journey_bike_snapshots(
 activity_id uuid primary key references public.activities on delete cascade,
 signature text not null,mode text not null,source text,revision bigint not null default 1,updated_at timestamptz not null default now()
);
create table public.journey_contributions(
 challenge_id uuid references public.community_challenges on delete cascade,
 activity_id uuid references public.activities on delete cascade,user_id uuid not null references auth.users on delete cascade,
 activity_revision bigint not null,bike_revision bigint not null default 0,occurred_at timestamptz not null,day_key date not null,
 policy_version text not null references public.journey_policies,inputs jsonb not null,calculation jsonb not null,
 journey_km numeric(38,12) not null default 0 check(journey_km>=0 and journey_km<'Infinity'::numeric),
 active boolean not null default true,withdraw_reason text,updated_at timestamptz not null default now(),
 primary key(challenge_id,activity_id)
);
create unique index journey_one_participation_allocation on public.journey_contributions(challenge_id,user_id,day_key)
 where active and journey_km>0 and calculation->>'basis'='participation';
create table public.journey_participation_days(
 challenge_id uuid references public.community_challenges on delete cascade,user_id uuid references auth.users on delete cascade,
 day_key date not null,activity_id uuid references public.activities on delete cascade,primary key(challenge_id,user_id,day_key)
);
create sequence public.journey_dirty_revision;
create table public.journey_reconcile_queue(
 challenge_id uuid primary key references public.community_challenges on delete cascade,
 revision bigint not null default nextval('public.journey_dirty_revision'),requested_at timestamptz not null default now(),
 attempts integer not null default 0,last_error text
);
create table public.journey_milestones(
 challenge_id uuid primary key references public.community_challenges on delete cascade,
 reached boolean not null default false,first_reached_at timestamptz,changed_at timestamptz not null default now()
);
create table public.journey_progress_events(
 id bigint generated always as identity primary key,challenge_id uuid references public.community_challenges on delete cascade,
 reached boolean not null,created_at timestamptz not null default now()
);
do $$ declare t text;begin
 foreach t in array array['journey_bike_snapshots','journey_contributions','journey_participation_days','journey_reconcile_queue','journey_milestones','journey_progress_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end;$$;

create function public.calculate_journey_contribution(p_input jsonb,p_policy text default 'journey-distance-v1') returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare cfg jsonb;typ text:=coalesce(p_input->>'activityType','other');cat text;mode text;src text;dur numeric:=0;dist numeric:=0;
 multiplier numeric;minutes numeric;basis text;diag text;explain text;credit numeric:=0;
begin
 select config into cfg from journey_policies where version=p_policy;
 if cfg is null then raise exception 'Unknown virtual-distance policy';end if;
 mode:=case when typ='ride' then coalesce(p_input->'bike'->>'mode','unknown') else 'not_applicable' end;
 src:=case when typ='ride' then coalesce(p_input->'bike'->>'source','unspecified') end;
 cat:=case when typ='ride' and mode='electric' then 'electric_cycling' else coalesce(cfg->'activityCategories'->>typ,'other') end;
 begin
  dur:=coalesce((p_input->>'durationMinutes')::numeric,0);dist:=coalesce((p_input->>'distanceKm')::numeric,0);
  if dur<0 or dist<0 or dur>='Infinity'::numeric or dist>='Infinity'::numeric then raise exception 'Invalid';end if;
 exception when others then basis:='invalid';diag:='invalid_measurement';explain:='invalid_measurement';
 end;
 if basis is distinct from 'invalid' then
  multiplier:=(cfg->'distanceMultipliers'->>cat)::numeric;
  if dist>0 and multiplier is not null then basis:='recorded_distance';credit:=round(dist*multiplier,12);
  elsif dur>0 then basis:='recorded_duration';minutes:=dur;multiplier:=null;credit:=round(dur*(cfg->>'virtualKmPerHour')::numeric/60*case when cat='electric_cycling' then (cfg->>'electricTimeFactor')::numeric else 1 end,12);
  else basis:='participation';explain:=case when dist>0 then 'no_distance_conversion' else 'participation' end;multiplier:=null;end if;
  if basis<>'participation' then explain:=basis;end if;
 end if;
 if credit>=1e26 then credit:=0;basis:='invalid';diag:='invalid_measurement';explain:='invalid_measurement';minutes:=null;multiplier:=null;end if;
 return jsonb_build_object('basis',basis,'rawJourneyKm',credit::numeric(38,12)::text,'policyVersion',p_policy,
  'category',cat,'resolvedBikeMode',mode,'bikeModeSource',src,'durationMinutesUsed',case when minutes is not null then round(minutes,12)::text end,
  'recordedDistanceKm',case when basis='recorded_distance' then round(dist,12)::text end,'distanceMultiplier',multiplier::text,
  'referenceSpeedKmh',null,'effortSource','not_used','effortFactor',null,'explanationCode',explain,'diagnostic',diag);
end;$$;

create function public.journey_refresh_bike(p_activity uuid,p_force boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a activities;old_snapshot journey_bike_snapshots;sig text;modes text[];resolved text:='unknown';source text:='unspecified';subtype text;cfg jsonb;r journey_bike_snapshots;
begin
 select * into a from activities where id=p_activity;
 if not found then return jsonb_build_object('mode','not_applicable','source',null,'revision',0);end if;
 if a.type<>'ride' then return jsonb_build_object('mode','not_applicable','source',null,'revision',0);end if;
 sig:=jsonb_build_array(a.type,a.cycling_mode_override,a.raw_sport_type,a.raw_type,
  (select coalesce(jsonb_agg(equipment_id order by equipment_id),'[]') from activity_equipment where activity_id=a.id))::text;
 select * into old_snapshot from journey_bike_snapshots where activity_id=a.id;
 if found and old_snapshot.signature=sig and not p_force then
  return jsonb_build_object('mode',old_snapshot.mode,'source',old_snapshot.source,'revision',old_snapshot.revision);
 end if;
 if a.cycling_mode_override is not null then resolved:=a.cycling_mode_override;source:='override';
 else
  select array_agg(distinct case e.electric_assist when 'none' then 'conventional' when 'electric' then 'electric' else 'unknown' end)
   into modes from activity_equipment ae join equipment e on e.id=ae.equipment_id
   where ae.activity_id=a.id and e.user_id=a.user_id and e.category='bike';
  if cardinality(modes)>1 then source:='conflicting_bikes';
  elsif cardinality(modes)=1 and modes[1]<>'unknown' then resolved:=modes[1];source:='equipment';
  else
   select config into cfg from journey_policies where version='journey-distance-v1';
   subtype:=regexp_replace(lower(coalesce(a.raw_sport_type,a.raw_type,'')),'[ _-]','','g');
   if (cfg->'electricSubtypes')?subtype then resolved:='electric';source:='import';
   elsif (cfg->'conventionalSubtypes')?subtype then resolved:='conventional';source:='import';end if;
  end if;
 end if;
 insert into journey_bike_snapshots(activity_id,signature,mode,source) values(a.id,sig,resolved,source)
  on conflict(activity_id) do update set signature=excluded.signature,mode=excluded.mode,source=excluded.source,
   revision=journey_bike_snapshots.revision+1,updated_at=now() returning * into r;
 return jsonb_build_object('mode',r.mode,'source',r.source,'revision',r.revision);
end;$$;

create function public.journey_mark_dirty() returns void language sql security definer set search_path=public,pg_temp as $$
 insert into journey_reconcile_queue(challenge_id)
 select id from community_challenges where metric='virtual_distance' order by id
 on conflict(challenge_id) do update set revision=nextval('public.journey_dirty_revision'),attempts=0,last_error=null;
$$;
create function public.journey_change_trigger() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if TG_TABLE_NAME='activities' and TG_OP<>'DELETE' then perform journey_refresh_bike(new.id);end if;
 if TG_TABLE_NAME='activity_equipment' then
  if TG_OP<>'INSERT' then perform journey_refresh_bike(old.activity_id);end if;
  if TG_OP<>'DELETE' then perform journey_refresh_bike(new.activity_id);end if;
 end if;
 perform journey_mark_dirty();return null;
end;$$;
create function public.journey_activity_revision() returns trigger language plpgsql as $$
begin
 if (new.type,new.date,new.started_at,new.distance_km,new.duration_min,new.effort,new.cycling_mode_override,new.raw_sport_type,new.raw_type,new.import_status,new.social_private)
 is distinct from (old.type,old.date,old.started_at,old.distance_km,old.duration_min,old.effort,old.cycling_mode_override,old.raw_sport_type,old.raw_type,old.import_status,old.social_private)
 then new.journey_revision:=old.journey_revision+1;else new.journey_revision:=old.journey_revision;end if;return new;
end;$$;
create trigger journey_activity_revision before update on public.activities for each row execute function public.journey_activity_revision();
-- Seed the existing rides before equipment acquires any user classifications.
select journey_refresh_bike(id) from activities where type='ride';
create trigger journey_activity_changed after insert or update or delete on public.activities for each row execute function public.journey_change_trigger();
create trigger journey_equipment_changed after insert or update or delete on public.activity_equipment for each row execute function public.journey_change_trigger();
create trigger journey_sharing_changed after insert or update or delete on public.social_contexts for each row execute function public.journey_change_trigger();
create trigger journey_members_changed after insert or update or delete on public.community_members for each row execute function public.journey_change_trigger();
create trigger journey_challenge_changed after insert or update or delete on public.community_challenges for each row execute function public.journey_change_trigger();

create function public.refresh_activity_bike_default(p_activity uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not exists(select 1 from activities where id=p_activity and user_id=auth.uid() and import_status='ready')
 then raise exception 'Activity unavailable';end if;
 perform journey_refresh_bike(p_activity,true);perform journey_mark_dirty();
end;$$;
create function public.set_activity_equipment(p_activity uuid,p_ids uuid[]) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare old_ids uuid[];new_ids uuid[];
begin
 if auth.uid() is null then raise exception 'Sign in to select equipment';end if;
 perform 1 from activities where id=p_activity and user_id=auth.uid() and import_status='ready' for update;
 if not found then raise exception 'Activity unavailable';end if;
 select coalesce(array_agg(distinct id order by id),'{}') into new_ids from unnest(coalesce(p_ids,'{}')) id;
 if exists(select 1 from unnest(new_ids) selected(id) where selected.id is null or not exists(select 1 from equipment e where e.id=selected.id and e.user_id=auth.uid()))
 then raise exception 'Equipment unavailable';end if;
 select coalesce(array_agg(equipment_id order by equipment_id),'{}') into old_ids from activity_equipment where activity_id=p_activity;
 if old_ids=new_ids then return;end if;
 delete from activity_equipment where activity_id=p_activity and not(equipment_id=any(new_ids));
 insert into activity_equipment(activity_id,equipment_id) select p_activity,id from unnest(new_ids) id
  where not exists(select 1 from activity_equipment where activity_id=p_activity and equipment_id=id);
end;$$;

create function public.reconcile_journey(p_challenge uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare ch community_challenges;item record;bike jsonb;calc jsonb;credit numeric;input jsonb;queued bigint;total numeric;reached_now boolean;prior journey_milestones;
begin
 -- Small-app serialized engine: every bucket and projection changes in one transaction.
 perform pg_advisory_xact_lock(86753,1);
 select * into ch from community_challenges where id=p_challenge and metric='virtual_distance';
 if not found then return;end if;
 select revision into queued from journey_reconcile_queue where challenge_id=ch.id;
 update journey_contributions set active=false,journey_km=0,withdraw_reason='not_currently_eligible',updated_at=now() where challenge_id=ch.id;
 delete from journey_participation_days where challenge_id=ch.id;
 if social_enabled() and ch.status in('active','closed') then
 for item in
  select a.id,a.user_id,a.type,a.duration_min,a.distance_km,a.effort,a.journey_revision,
   case when a.started_at is null then a.date::timestamp at time zone ch.time_zone else a.started_at end occurred_at,
   case when a.started_at is null then a.date else (a.started_at at time zone ch.time_zone)::date end local_day
  from activities a join community_members cm on cm.community_id=ch.community_id and cm.user_id=a.user_id and cm.status='active'
   join social_audiences d on d.community_id=ch.community_id
   join social_contexts s on s.audience_id=d.id and s.activity_id=a.id and s.revoked_at is null
   left join social_activity_state choice on choice.activity_id=a.id and choice.audience_id=d.id
  where not a.social_private and a.import_status='ready'
   and (ch.activity_scope='all' or a.type=any(ch.types))
   and case when a.started_at is not null then
    a.started_at>=ch.starts_on::timestamp at time zone ch.time_zone and a.started_at<=now()
    and (ch.closed_at is null or a.started_at<ch.closed_at)
    and (a.started_at>=cm.joined_at or choice.decision='include')
   else
    a.date>=ch.starts_on and a.date<=(now() at time zone ch.time_zone)::date
    and (a.date>=(cm.joined_at at time zone ch.time_zone)::date and a.created_at at time zone 'UTC'>=cm.joined_at or choice.decision='include')
    and (ch.closed_at is null or a.date<(ch.closed_at at time zone ch.time_zone)::date
      or (a.date=(ch.closed_at at time zone ch.time_zone)::date and a.created_at at time zone 'UTC'<ch.closed_at))
   end
  order by occurred_at,a.id
 loop
  bike:=journey_refresh_bike(item.id);
  input:=jsonb_build_object('activityType',item.type,'durationMinutes',item.duration_min,'distanceKm',item.distance_km,'effort',item.effort,'bike',bike);
  calc:=calculate_journey_contribution(input,ch.journey_policy_version);
  credit:=(calc->>'rawJourneyKm')::numeric;
  if calc->>'basis'='participation' then
   insert into journey_participation_days values(ch.id,item.user_id,item.local_day,item.id) on conflict do nothing;
   credit:=case when found then 1 else 0 end;
   calc:=calc||jsonb_build_object('rawJourneyKm',credit::numeric(38,12)::text,
    'explanationCode',case when credit=0 then 'participation_already_counted' else calc->>'explanationCode' end);
  end if;
  insert into journey_contributions(challenge_id,activity_id,user_id,activity_revision,bike_revision,occurred_at,day_key,policy_version,inputs,calculation,journey_km)
   values(ch.id,item.id,item.user_id,item.journey_revision,coalesce((bike->>'revision')::bigint,0),item.occurred_at,item.local_day,ch.journey_policy_version,input,calc,credit)
   on conflict(challenge_id,activity_id) do update set activity_revision=excluded.activity_revision,bike_revision=excluded.bike_revision,
    occurred_at=excluded.occurred_at,day_key=excluded.day_key,inputs=excluded.inputs,calculation=excluded.calculation,journey_km=excluded.journey_km,
    active=true,withdraw_reason=null,updated_at=now();
 end loop;
 end if;
 select coalesce(sum(journey_km),0) into total from journey_contributions where challenge_id=ch.id and active;
 reached_now:=total>=ch.target and ch.status in('active','closed');
 select * into prior from journey_milestones where challenge_id=ch.id;
 if not found or prior.reached is distinct from reached_now then
  insert into journey_milestones(challenge_id,reached,first_reached_at)
   values(ch.id,reached_now,case when reached_now then now() end)
   on conflict(challenge_id) do update set reached=excluded.reached,
    first_reached_at=coalesce(journey_milestones.first_reached_at,excluded.first_reached_at),changed_at=now();
  if reached_now or prior.challenge_id is not null then
   insert into journey_progress_events(challenge_id,reached) values(ch.id,reached_now);
  end if;
 end if;
 -- A concurrent source transaction can enqueue a newer revision while this runs.
 -- It remains dirty; stale work cannot clear its revision or restore an old amount.
 delete from journey_reconcile_queue where challenge_id=ch.id and revision=queued;
end;$$;

create function public.journey_reconcile_pending() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare item record;started timestamptz:=clock_timestamp();begin
 -- Active journeys also recheck time: future-dated movement only counts once due.
 insert into journey_reconcile_queue(challenge_id)
 select id from community_challenges where metric='virtual_distance' and status='active'
 order by id on conflict do nothing;
 for item in select challenge_id from journey_reconcile_queue order by requested_at,challenge_id limit 100 loop
  exit when clock_timestamp()-started>interval '20 seconds';
  begin perform reconcile_journey(item.challenge_id);
  exception when others then
   update journey_reconcile_queue set attempts=attempts+1,last_error='Reconciliation failed; retry pending'
    where challenge_id=item.challenge_id;
  end;
 end loop;
end;$$;
select cron.schedule('journey-reconciliation','* * * * *','select public.journey_reconcile_pending()');
create trigger journey_config_changed after update on public.social_config for each row execute function public.journey_change_trigger();

create function public.journey_challenge_guard() returns trigger language plpgsql as $$
begin
 if TG_OP='UPDATE' and old.metric='virtual_distance' then
  if new.journey_policy_version is distinct from old.journey_policy_version and (old.status<>'draft' or new.metric='virtual_distance') then raise exception 'The calculation policy is pinned';end if;
  if old.status<>'draft' and (new.metric,new.scope,new.types,new.activity_scope,new.starts_on,new.time_zone,new.route_version)
   is distinct from (old.metric,old.scope,old.types,old.activity_scope,old.starts_on,old.time_zone,old.route_version)
   then raise exception 'Active journey rules are fixed; create a new challenge for different rules';end if;
  if old.status in('closed','cancelled') and new.status<>old.status then raise exception 'This journey cannot be reopened';end if;
  if old.closed_at is not null and new.closed_at is distinct from old.closed_at then raise exception 'The closure cutoff is fixed';end if;
 end if;
 return new;
end;$$;
create trigger journey_challenge_guard before update on public.community_challenges for each row execute function public.journey_challenge_guard();

alter function public.social_challenge_values(uuid) rename to social_challenge_values_legacy;
revoke all on function public.social_challenge_values_legacy(uuid) from public,anon,authenticated;
create function public.social_challenge_values(p_challenge uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare ch community_challenges;total numeric;mine numeric;people bigint;begin
 select * into ch from community_challenges where id=p_challenge;
 if not found or not social_enabled() or not social_member(ch.community_id,auth.uid()) then return null;end if;
 if ch.metric<>'virtual_distance' then return social_challenge_values_legacy(p_challenge)||jsonb_build_object('activity_scope',ch.activity_scope);end if;
 perform reconcile_journey(ch.id);
 select coalesce(sum(journey_km),0),coalesce(sum(journey_km) filter(where user_id=auth.uid()),0),
  count(distinct user_id) filter(where journey_km>0) into total,mine,people
  from journey_contributions c where c.challenge_id=ch.id and c.active
   and exists(select 1 from activities a join community_members cm on cm.community_id=ch.community_id and cm.user_id=a.user_id and cm.status='active'
    where a.id=c.activity_id and a.journey_revision=c.activity_revision and not a.social_private
    and exists(select 1 from social_contexts s join social_audiences d on d.id=s.audience_id
     where s.activity_id=a.id and s.revoked_at is null and d.community_id=ch.community_id));
 return jsonb_build_object('id',ch.id,'title',ch.title,'metric',ch.metric,'target',ch.target::text,
  'scope','collective','types',ch.types,'activity_scope',ch.activity_scope,'starts_on',ch.starts_on,'ends_on',ch.ends_on,
  'time_zone',ch.time_zone,'total',total::text,'mine',mine::text,'contributors_count',people,
  'participating',true,'policy_version',ch.journey_policy_version,'closed_at',ch.closed_at,
  'has_cover',ch.cover_image_path is not null and ch.cover_owner_id is not null,'cover_updated_at',ch.cover_updated_at,
  'destination_reached',total>=ch.target and ch.status in('active','closed'),
  'state',case when ch.status='active' and (now() at time zone ch.time_zone)::date<ch.starts_on then 'upcoming' else ch.status end);
end;$$;

create function public.social_journey_details(p_challenge uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare ch community_challenges;summary jsonb;begin
 select * into ch from community_challenges where id=p_challenge and metric='virtual_distance';
 if not found or not social_enabled() or not social_member(ch.community_id,auth.uid()) then raise exception 'Community unavailable';end if;
 summary:=social_challenge_values(ch.id);
 return jsonb_build_object('summary',summary,'policy',(select config from journey_policies where version=ch.journey_policy_version),
  'own',(select coalesce(jsonb_agg(row order by occurred_at desc,id),'[]') from (
   select a.id,a.title,a.type,c.occurred_at,c.journey_km::text amount,c.calculation
   from journey_contributions c join activities a on a.id=c.activity_id
   where c.challenge_id=ch.id and c.user_id=auth.uid() and c.active order by c.occurred_at desc,a.id limit 50
  ) row));
end;$$;

alter function public.social_challenges(uuid,text,jsonb) rename to social_challenges_legacy;
create or replace function public.social_challenges_legacy(p_community uuid,p_action text default 'list',p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare ch community_challenges;v_challenge_id uuid;uid uuid:=auth.uid();begin
 if uid is null or not social_enabled() or not social_member(p_community,uid) then raise exception 'Community unavailable';end if;
 if p_action in('create','update') then
  p_data:=p_data||jsonb_build_object('activity_scope',coalesce(p_data->>'activity_scope',case when jsonb_array_length(coalesce(p_data->'types','[]'))>0 then 'selected' else 'all' end));
  if p_data->>'activity_scope' not in('all','selected') or (p_data->>'activity_scope'='selected' and jsonb_array_length(coalesce(p_data->'types','[]'))=0) then raise exception 'Choose eligible activity types';end if;
  if p_data->>'activity_scope'='all' then p_data:=p_data||'{"types":[]}'::jsonb;end if;
  if not social_admin(p_community,uid) then raise exception 'Not authorized';end if;
  if not social_rate('challenge:'||uid,10) then raise exception 'Please try again shortly';end if;
  if not exists(select 1 from pg_timezone_names where name=p_data->>'time_zone') then raise exception 'Invalid timezone';end if;
  if not coalesce(p_data->'types','[]')<@'["run","ride","walk","strength","yoga","hike","swim","meditation","restore","other"]'::jsonb then raise exception 'Invalid activity types';end if;
  if p_action='create' then
  insert into community_challenges(community_id,creator_id,title,metric,target,types,starts_on,ends_on,time_zone,scope,activity_scope)
   values(p_community,uid,btrim(p_data->>'title'),p_data->>'metric',(p_data->>'target')::numeric,
    array(select jsonb_array_elements_text(coalesce(p_data->'types','[]'))),(p_data->>'starts_on')::date,(p_data->>'ends_on')::date,p_data->>'time_zone',p_data->>'scope',p_data->>'activity_scope') returning * into ch;
  else
   v_challenge_id:=(p_data->>'id')::uuid;
   select * into ch from community_challenges where id=v_challenge_id and community_id=p_community for update;
   if not found then raise exception 'Challenge unavailable';end if;
   update community_challenges set title=btrim(p_data->>'title'),metric=p_data->>'metric',target=(p_data->>'target')::numeric,
    types=array(select jsonb_array_elements_text(coalesce(p_data->'types','[]'))),starts_on=(p_data->>'starts_on')::date,
    ends_on=(p_data->>'ends_on')::date,time_zone=p_data->>'time_zone',scope=p_data->>'scope',activity_scope=p_data->>'activity_scope',
    journey_policy_version=null,status=case when ch.metric='virtual_distance' and ch.status='draft' then 'active' else status end
    where id=ch.id;
  end if;
  if p_data ? 'cover_path' then perform social_set_challenge_cover(ch.id,p_community,p_data->>'cover_path');end if;
 elsif p_action='cover' then
  if not social_rate('challenge:'||uid,10) then raise exception 'Please try again shortly';end if;
  perform social_set_challenge_cover((p_data->>'id')::uuid,p_community,p_data->>'cover_path');
 elsif p_action='cancel' then
  v_challenge_id:=(p_data->>'id')::uuid;
  select * into ch from community_challenges where id=v_challenge_id and community_id=p_community for update;
  if not found then raise exception 'Challenge unavailable';end if;
  if not social_admin(p_community,uid) then raise exception 'Not authorized';end if;
  update community_challenges set status='cancelled' where id=ch.id;
 elsif p_action in('join','leave') then
  raise exception 'Challenges include all Community members; individual joining or leaving is unavailable';
 elsif p_action<>'list' then raise exception 'Unknown challenge action';end if;
 -- This is also the reconciliation path: no cached/private contribution copies.
 return (select coalesce(jsonb_agg(social_challenge_values(id) order by created_at desc,id),'[]') from community_challenges where community_id=p_community);
end; $$;


revoke all on function public.social_challenges_legacy(uuid,text,jsonb) from public,anon,authenticated;
create function public.social_challenges(p_community uuid,p_action text default 'list',p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare ch community_challenges;uid uuid:=auth.uid();is_virtual boolean;selected text[];selection text;desired text;
begin
 if uid is null or not social_enabled() or not social_member(p_community,uid) then raise exception 'Community unavailable';end if;
 if p_action='list' then return social_challenges_legacy(p_community,p_action,p_data);end if;
 if p_action in('join','leave') then raise exception 'All Community members participate automatically';end if;
 if p_action<>'create' then
  select * into ch from community_challenges where id=(p_data->>'id')::uuid and community_id=p_community;
 end if;
 is_virtual:=p_data->>'metric'='virtual_distance' or ch.metric='virtual_distance';
 if p_action='update' and ch.metric='virtual_distance' and ch.status='draft' and p_data->>'metric'<>'virtual_distance' then
  return social_challenges_legacy(p_community,p_action,p_data);
 end if;
 if not coalesce(is_virtual,false) then return social_challenges_legacy(p_community,p_action,p_data);end if;
 if not social_admin(p_community,uid) then raise exception 'Not authorized';end if;
 if not social_rate('virtual-challenge:'||uid,10) then raise exception 'Please try again shortly';end if;
 if p_action in('create','update') then
  if p_action='update' and (ch.id is null or ch.metric<>'virtual_distance') then raise exception 'Create a new challenge to use Virtual distance';end if;
  if p_data->>'metric'<>'virtual_distance' then raise exception 'Create a new challenge to change its measure';end if;
  if p_data->>'scope'<>'collective' then raise exception 'Virtual-distance challenges are collective';end if;
  if not exists(select 1 from pg_timezone_names where name=p_data->>'time_zone') then raise exception 'Invalid timezone';end if;
  selection:=coalesce(p_data->>'activity_scope','all');
  selected:=array(select jsonb_array_elements_text(coalesce(p_data->'types','[]')));
  if selection not in('all','selected') or (selection='selected' and cardinality(selected)=0)
   or not selected<@array['run','ride','walk','strength','yoga','hike','swim','meditation','restore','other'] then raise exception 'Choose eligible activity types';end if;
  if selection='all' then selected:='{}';end if;
  desired:=coalesce(p_data->>'status','active');
  if p_action='create' then
   if desired not in('draft','active') then raise exception 'Invalid journey status';end if;
   insert into community_challenges(community_id,creator_id,title,metric,target,scope,types,activity_scope,starts_on,ends_on,time_zone,status,journey_policy_version,activated_at)
    values(p_community,uid,btrim(p_data->>'title'),'virtual_distance',(p_data->>'target')::numeric,'collective',selected,selection,
     (p_data->>'starts_on')::date,nullif(p_data->>'ends_on','')::date,p_data->>'time_zone',desired,'journey-distance-v1',case when desired='active' then now() end)
    returning * into ch;
  else
   if ch.status<>'draft' then desired:=ch.status;end if;
   if desired not in('draft','active','closed','cancelled') then raise exception 'Invalid journey status';end if;
   update community_challenges set title=btrim(p_data->>'title'),target=(p_data->>'target')::numeric,
    types=selected,activity_scope=selection,starts_on=(p_data->>'starts_on')::date,ends_on=nullif(p_data->>'ends_on','')::date,
    time_zone=p_data->>'time_zone',status=desired,activated_at=case when desired='active' then coalesce(activated_at,now()) else activated_at end
    where id=ch.id;
  end if;
  if p_data?'cover_path' then perform social_set_challenge_cover(ch.id,p_community,p_data->>'cover_path');end if;
 elsif p_action='close' then
  if ch.status<>'active' then raise exception 'Only active journeys can be closed';end if;
  update community_challenges set status='closed',closed_at=clock_timestamp() where id=ch.id;
 elsif p_action='cancel' then
  update community_challenges set status='cancelled' where id=ch.id;
 elsif p_action='cover' then perform social_set_challenge_cover(ch.id,p_community,p_data->>'cover_path');
 else raise exception 'Unknown journey action';end if;
 return social_challenges_legacy(p_community,'list','{}');
end;$$;

-- Every trusted amount, policy, input snapshot and reconciliation function is private.
do $$ declare signature text;begin
 foreach signature in array array[
 'calculate_journey_contribution(jsonb,text)','journey_refresh_bike(uuid,boolean)','journey_mark_dirty()',
 'reconcile_journey(uuid)','journey_reconcile_pending()'
 ] loop execute 'revoke all on function public.'||signature||' from public,anon,authenticated';
 execute 'grant execute on function public.'||signature||' to service_role';end loop;
end;$$;
revoke all on function public.refresh_activity_bike_default(uuid),public.set_activity_equipment(uuid,uuid[]),
 public.social_journey_details(uuid),public.social_challenges(uuid,text,jsonb),public.social_challenge_values(uuid) from public,anon;
grant execute on function public.refresh_activity_bike_default(uuid),public.set_activity_equipment(uuid,uuid[]),
 public.social_journey_details(uuid),public.social_challenges(uuid,text,jsonb),public.social_challenge_values(uuid) to authenticated;
