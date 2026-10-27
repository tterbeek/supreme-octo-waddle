-- Additive, disabled-by-default cutover. Never promotes legacy copied posts.
set search_path=public,extensions;
create table public.social_config(singleton boolean primary key default true check(singleton),enabled boolean not null default false);
insert into public.social_config values(true,false);
alter table public.activities add column public_note text check(length(public_note)<=1000),
 add column social_private boolean not null default false,
 add column share_legacy_photo boolean not null default false;
alter table public.activity_photos add column is_shared boolean not null default false;

create table public.communities(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 80),description text not null default '' check(length(description)<=1500),
 invite_generation bigint not null default 0,created_at timestamptz not null default now()
);
create table public.community_members(
 community_id uuid references public.communities on delete cascade,user_id uuid references auth.users on delete cascade,
 role text not null check(role in('owner','admin','member')),status text not null check(status in('active','left','removed')),
 joined_at timestamptz not null default now(),removed_generation bigint not null default -1,
 primary key(community_id,user_id)
);
create table public.community_invites(
 id uuid primary key default gen_random_uuid(),community_id uuid not null references public.communities on delete cascade,
 token_hash text unique not null,generation bigint not null,issuer_id uuid references auth.users on delete set null,
 created_at timestamptz not null default now(),expires_at timestamptz not null default(now()+interval '30 days'),revoked_at timestamptz
);
create unique index community_one_owner on public.community_members(community_id) where role='owner' and status='active';
create table public.social_audiences(
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in('circle','community')),
 circle_owner uuid unique references auth.users on delete cascade,community_id uuid unique references public.communities on delete cascade,
 check((kind='circle' and circle_owner is not null and community_id is null) or
       (kind='community' and community_id is not null and circle_owner is null))
);
create table public.social_rules(
 user_id uuid references auth.users on delete cascade,audience_id uuid references public.social_audiences on delete cascade,
 mode text not null check(mode in('manual','all','types')),types text[] not null default '{}',
 effective_at timestamptz not null default now(),time_zone text not null default 'UTC',primary key(user_id,audience_id)
);
create table public.social_activity_state(
 activity_id uuid references public.activities on delete cascade,audience_id uuid references public.social_audiences on delete cascade,
 decision text not null check(decision in('automatic','include','exclude')),updated_at timestamptz not null default now(),
 primary key(activity_id,audience_id)
);
create table public.social_contexts(
 id uuid primary key default gen_random_uuid(),activity_id uuid not null references public.activities on delete cascade,
 audience_id uuid not null references public.social_audiences on delete cascade,
 created_at timestamptz not null default now(),revoked_at timestamptz
);
create unique index social_context_live on public.social_contexts(activity_id,audience_id) where revoked_at is null;
create index social_context_audience on public.social_contexts(audience_id,activity_id) where revoked_at is null;
create table public.social_comments(
 id uuid primary key default gen_random_uuid(),context_id uuid not null references public.social_contexts on delete cascade,
 author_id uuid not null references auth.users on delete cascade,body text not null check(length(btrim(body)) between 1 and 1000),
 created_at timestamptz not null default now()
);
create index social_comments_context on public.social_comments(context_id,created_at,id);
create table public.social_reactions(
 context_id uuid references public.social_contexts on delete cascade,user_id uuid references auth.users on delete cascade,
 reaction text not null check(reaction in('CHEER','INSPIRED','ENERGY','BEAUTIFUL','MOVED')),primary key(context_id,user_id)
);
create table public.social_blocks(
 blocker_id uuid references auth.users on delete cascade,blocked_id uuid references auth.users on delete cascade,
 primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id)
);
-- Preserve historical blocks even if a participant deletes a connection row.
insert into public.social_blocks select requester_user_id,addressee_user_id from public.user_connections where status='blocked'
 union select addressee_user_id,requester_user_id from public.user_connections where status='blocked';
create function public.social_preserve_block() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='blocked' then insert into social_blocks values(new.requester_user_id,new.addressee_user_id),(new.addressee_user_id,new.requester_user_id) on conflict do nothing;end if;
 return new;
end; $$;
create trigger social_connection_blocks after insert or update of status on public.user_connections for each row execute function public.social_preserve_block();
create table public.social_reports(
 id uuid primary key default gen_random_uuid(),reporter_id uuid not null references auth.users on delete cascade,
 context_id uuid references public.social_contexts on delete set null,comment_id uuid references public.social_comments on delete set null,
 reason text not null check(length(btrim(reason)) between 1 and 1000),created_at timestamptz not null default now(),resolved_at timestamptz
);
create table public.social_deleted_activities(activity_id uuid primary key,user_id uuid references auth.users on delete cascade);
create table public.social_rate_limits(key text not null,bucket timestamptz not null,n integer not null,primary key(key,bucket));
create table public.community_challenges(
 id uuid primary key default gen_random_uuid(),community_id uuid not null references public.communities on delete cascade,
 creator_id uuid references auth.users on delete set null,title text not null check(length(btrim(title)) between 1 and 100),
 metric text not null check(metric in('distance','duration','count','days')),
 target numeric not null check(target>0 and target<'Infinity'::numeric),types text[] not null default '{}',
 starts_on date not null,ends_on date not null,time_zone text not null,
 scope text not null check(scope in('collective','personal')),status text not null default 'active' check(status in('active','cancelled')),
 check(ends_on>starts_on),created_at timestamptz not null default now()
);
create table public.community_challenge_members(
 challenge_id uuid references public.community_challenges on delete cascade,user_id uuid references auth.users on delete cascade,
 joined_at timestamptz not null default now(),primary key(challenge_id,user_id)
);

create function public.social_enabled() returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select enabled from social_config where singleton;
$$;
create function public.social_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from social_blocks where (blocker_id=a and blocked_id=b) or(blocker_id=b and blocked_id=a))
 or exists(select 1 from user_connections where status='blocked' and
  ((requester_user_id=a and addressee_user_id=b) or(requester_user_id=b and addressee_user_id=a)));
$$;
create function public.social_member(c uuid,u uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from community_members where community_id=c and user_id=u and status='active');
$$;
create function public.social_admin(c uuid,u uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from community_members where community_id=c and user_id=u and status='active' and role in('owner','admin'));
$$;
create function public.social_connected(a uuid,b uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select not social_blocked(a,b) and exists(select 1 from user_connections where status='accepted' and
  ((requester_user_id=a and addressee_user_id=b) or(requester_user_id=b and addressee_user_id=a)));
$$;
create function public.social_destination(audience uuid,owner_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from social_audiences a where a.id=audience and
  ((a.kind='circle' and a.circle_owner=owner_id) or(a.kind='community' and social_member(a.community_id,owner_id))));
$$;
create function public.social_can_read(context uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select social_enabled() and auth.uid() is not null and exists(
  select 1 from social_contexts s join activities a on a.id=s.activity_id join social_audiences d on d.id=s.audience_id
  where s.id=context and s.revoked_at is null and not a.social_private and not social_blocked(a.user_id,auth.uid())
   and social_destination(d.id,a.user_id) and
   ((d.kind='circle' and (a.user_id=auth.uid() or social_connected(a.user_id,auth.uid())))
    or(d.kind='community' and social_member(d.community_id,auth.uid())))
 );
$$;
create function public.social_rate(k text,max_n integer) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare value integer;begin
 delete from social_rate_limits where bucket<now()-interval '1 day';
 insert into social_rate_limits values(k,date_trunc('minute',now()),1)
 on conflict(key,bucket) do update set n=social_rate_limits.n+1 returning n into value;
 return value<=max_n;
end; $$;
create function public.social_circle(u uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;begin
 insert into social_audiences(kind,circle_owner) values('circle',u) on conflict(circle_owner) do nothing;
 select id into result from social_audiences where circle_owner=u;return result;
end; $$;
create function public.social_decide(activity uuid,audience uuid,choice text,activate boolean) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c uuid;owner_id uuid;
begin
 select community_id into c from social_audiences where id=audience;
 if c is not null then perform 1 from communities where id=c for update;end if;
 select user_id into owner_id from activities where id=activity;
 if activate and not social_destination(audience,owner_id) then
  if choice='include' then raise exception 'Audience unavailable';end if;activate:=false;
 end if;
 insert into social_activity_state values(activity,audience,choice,now())
 on conflict(activity_id,audience_id) do update set decision=excluded.decision,updated_at=now();
 if activate then
  insert into social_contexts(activity_id,audience_id) values(activity,audience)
  on conflict(activity_id,audience_id) where revoked_at is null do nothing;
 else update social_contexts set revoked_at=now() where activity_id=activity and audience_id=audience and revoked_at is null;
 end if;
end; $$;
create function public.social_auto(activity uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a activities;r social_rules;state text;eligible boolean;
begin
 if not social_enabled() then return;end if;
 select * into a from activities where id=activity;if not found then return;end if;
 if a.social_private then return;end if;
 for r in select * from social_rules where user_id=a.user_id order by audience_id loop
  select decision into state from social_activity_state where activity_id=a.id and audience_id=r.audience_id;
  if state in('include','exclude') then continue;end if;
  eligible:=social_destination(r.audience_id,a.user_id) and r.mode<>'manual'
   and (r.mode='all' or a.type=any(r.types)) and a.created_at is not null
   and (a.created_at at time zone 'UTC')>=r.effective_at
   and case when a.started_at is not null then a.started_at>=r.effective_at
      when a.source='manual' then a.date>=(r.effective_at at time zone r.time_zone)::date
      else a.date>(r.effective_at at time zone r.time_zone)::date end;
  if eligible or state='automatic' then perform social_decide(a.id,r.audience_id,'automatic',coalesce(eligible,false));end if;
 end loop;
end; $$;
create function public.social_activity_trigger() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if TG_OP='INSERT' then perform social_auto(new.id);
 elsif (new.type,new.date,new.started_at) is distinct from (old.type,old.date,old.started_at) then perform social_auto(new.id);
 end if;return new;
end; $$;
create trigger social_activity_engine after insert or update of type,date,started_at on public.activities
 for each row execute function public.social_activity_trigger();

-- Only owners can inspect their private configuration/state. All social reads
-- use explicit projections; never extend activity/attachment row access.
do $$ declare t text;begin
 foreach t in array array['social_config','communities','community_members','community_invites','social_audiences','social_rules',
  'social_activity_state','social_contexts','social_comments','social_reactions','social_blocks','social_reports','social_rate_limits',
  'community_challenges','community_challenge_members','social_deleted_activities'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;

-- SQL/API helpers with explicit authorization below are the sole mutation surface.
create function public.social_home() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();circle_id uuid;begin
 if uid is null then raise exception 'Sign in required';end if;
 if not social_enabled() then return jsonb_build_object('enabled',false);end if;
 circle_id:=social_circle(uid);
 return jsonb_build_object('enabled',true,'circle',circle_id,'audiences',(
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'kind',a.kind,'name',coalesce(c.name,'Circle'),
   'community_id',c.id,'role',m.role,'mode',coalesce(r.mode,'manual'),'types',coalesce(r.types,'{}'),
   'description',c.description) order by a.kind,c.name),'[]'::jsonb)
  from social_audiences a left join communities c on c.id=a.community_id
   left join community_members m on m.community_id=c.id and m.user_id=uid and m.status='active'
   left join social_rules r on r.audience_id=a.id and r.user_id=uid
  where a.circle_owner=uid or m.user_id is not null));
end; $$;
create function public.social_set_rule(p_audience uuid,p_mode text,p_types text[],p_zone text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c uuid;
begin
 select community_id into c from social_audiences where id=p_audience;
 if c is not null then perform 1 from communities where id=c for update;end if;
 if auth.uid() is null or not social_enabled() or not social_destination(p_audience,auth.uid()) then raise exception 'Not authorized';end if;
 if p_mode not in('manual','all','types') or p_types is null or not p_types<@array['run','ride','walk','strength','yoga','hike','swim','meditation','restore','other']
  or (p_mode='types' and cardinality(p_types)=0) or not exists(select 1 from pg_timezone_names where name=p_zone) then raise exception 'Invalid sharing rule';end if;
 insert into social_rules values(auth.uid(),p_audience,p_mode,p_types,now(),p_zone)
 on conflict(user_id,audience_id) do update set mode=excluded.mode,types=excluded.types,effective_at=now(),time_zone=excluded.time_zone;
 -- No historical scan or reshare here.
end; $$;

create function public.social_challenge_values(p_challenge uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 with challenge as(select * from community_challenges where id=p_challenge and social_enabled()
   and social_member(community_id,auth.uid())), eligible as (
  select distinct a.id,a.user_id,a.distance_km,a.duration_min,
    case when a.started_at is not null then (a.started_at at time zone c.time_zone)::date else a.date end day_key
   from challenge c join social_audiences d on d.community_id=c.community_id
    join social_contexts s on s.audience_id=d.id join activities a on a.id=s.activity_id
    join community_challenge_members p on p.challenge_id=c.id and p.user_id=a.user_id
   where c.status='active' and social_can_read(s.id) and social_member(c.community_id,a.user_id)
    and (cardinality(c.types)=0 or a.type=any(c.types))
 ), in_period as (
  select e.* from eligible e cross join challenge c where day_key>=c.starts_on and day_key<c.ends_on
 ), progress as (
  select c.*,
   case c.metric when 'distance' then coalesce((select sum(distance_km) from in_period where distance_km>=0 and distance_km<'Infinity'::numeric),0)
    when 'duration' then coalesce((select sum(duration_min) from in_period where duration_min>=0 and duration_min<'Infinity'::numeric),0)
    when 'days' then (select count(distinct day_key) from in_period) else (select count(*) from in_period) end total,
   case c.metric when 'distance' then coalesce((select sum(distance_km) from in_period where user_id=auth.uid() and distance_km>=0 and distance_km<'Infinity'::numeric),0)
    when 'duration' then coalesce((select sum(duration_min) from in_period where user_id=auth.uid() and duration_min>=0 and duration_min<'Infinity'::numeric),0)
    when 'days' then (select count(distinct day_key) from in_period where user_id=auth.uid()) else (select count(*) from in_period where user_id=auth.uid()) end mine
  from challenge c
 ) select jsonb_build_object('id',id,'title',title,'metric',metric,'target',target,'scope',scope,'types',types,
  'starts_on',starts_on,'ends_on',ends_on,'time_zone',time_zone,'total',total,'mine',mine,
  'participating',exists(select 1 from community_challenge_members where challenge_id=id and user_id=auth.uid()),
  'state',case when status='cancelled' then 'cancelled' when (now() at time zone time_zone)::date>=ends_on then 'completed'
   when (now() at time zone time_zone)::date<starts_on then 'upcoming' else 'active' end) from progress;
$$;
create function public.social_challenges(p_community uuid,p_action text default 'list',p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare ch community_challenges;v_challenge_id uuid;uid uuid:=auth.uid();begin
 if uid is null or not social_enabled() or not social_member(p_community,uid) then raise exception 'Community unavailable';end if;
 if p_action='create' then
  if not social_admin(p_community,uid) then raise exception 'Not authorized';end if;
  if not social_rate('challenge:'||uid,10) then raise exception 'Please try again shortly';end if;
  if not exists(select 1 from pg_timezone_names where name=p_data->>'time_zone') then raise exception 'Invalid timezone';end if;
  if not coalesce(p_data->'types','[]')<@'["run","ride","walk","strength","yoga","hike","swim","meditation","restore","other"]'::jsonb then raise exception 'Invalid activity types';end if;
  insert into community_challenges(community_id,creator_id,title,metric,target,types,starts_on,ends_on,time_zone,scope)
   values(p_community,uid,btrim(p_data->>'title'),p_data->>'metric',(p_data->>'target')::numeric,
    array(select jsonb_array_elements_text(coalesce(p_data->'types','[]'))),(p_data->>'starts_on')::date,(p_data->>'ends_on')::date,p_data->>'time_zone',p_data->>'scope');
 elsif p_action in('join','leave','cancel') then
  v_challenge_id:=(p_data->>'id')::uuid;
  select * into ch from community_challenges where id=v_challenge_id and community_id=p_community for update;
  if not found then raise exception 'Challenge unavailable';end if;
  if p_action='cancel' then
   if not social_admin(p_community,uid) then raise exception 'Not authorized';end if;
   update community_challenges set status='cancelled' where id=ch.id;
  elsif p_action='leave' then delete from community_challenge_members where challenge_id=ch.id and user_id=uid;
  else
   if ch.status<>'active' or (now() at time zone ch.time_zone)::date>=ch.ends_on then raise exception 'Challenge has ended';end if;
   insert into community_challenge_members(challenge_id,user_id) values(ch.id,uid) on conflict do nothing;
  end if;
 elsif p_action<>'list' then raise exception 'Unknown challenge action';end if;
 -- This is also the reconciliation path: no cached/private contribution copies.
 return (select coalesce(jsonb_agg(social_challenge_values(id) order by created_at desc,id),'[]') from community_challenges where community_id=p_community);
end; $$;

-- Current connections remain authoritative. A reverse duplicate cannot bypass a
-- block. Existing rows/IDs/states are not rewritten or re-invited.
create function public.social_connection_update(p_id uuid,p_requester uuid,p_addressee uuid,p_status text) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from user_connections c where c.id=p_id and c.requester_user_id=p_requester and c.addressee_user_id=p_addressee
  and auth.uid() in(c.requester_user_id,c.addressee_user_id) and c.status<>'blocked'
  and ((p_status in('accepted','declined') and c.status='pending' and auth.uid()=c.addressee_user_id)
   or p_status in('removed','blocked')));
$$;
drop policy "Users can update their own connection rows" on public.user_connections;
create policy "Users can update their own connection rows" on public.user_connections for update to authenticated
 using(auth.uid() in(requester_user_id,addressee_user_id))
 with check(social_connection_update(id,requester_user_id,addressee_user_id,status));

create function public.social_activity(p_activity uuid,p_change jsonb default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a activities;photo_ids uuid[];choice jsonb;dest uuid;begin
 if auth.uid() is null or not social_enabled() then raise exception 'Sharing unavailable';end if;
 perform social_circle(auth.uid());
 select * into a from activities where id=p_activity and user_id=auth.uid() for update;
 if not found then raise exception 'Activity unavailable';end if;
 if p_change is not null then
  if not social_rate('activity:'||auth.uid(),60) then raise exception 'Please try again shortly';end if;
  if p_change ? 'public_note' then
   if length(p_change->>'public_note')>1000 then raise exception 'Shared note is too long';end if;
   update activities set public_note=nullif(btrim(p_change->>'public_note'),'') where id=a.id;
  end if;
  if p_change ? 'photos' then
   select coalesce(array_agg(value::uuid),'{}') into photo_ids from jsonb_array_elements_text(p_change->'photos');
   if exists(select 1 from unnest(photo_ids) x where not exists(select 1 from activity_photos p where p.id=x and p.activity_id=a.id and p.user_id=auth.uid())) then raise exception 'Photo unavailable';end if;
   update activity_photos set is_shared=id=any(photo_ids) where activity_id=a.id and user_id=auth.uid();
  end if;
  if p_change ? 'legacy_photo' then
   update activities set share_legacy_photo=coalesce((p_change->>'legacy_photo')::boolean,false) where id=a.id;
  end if;
  if p_change ? 'private' then
   update activities set social_private=(p_change->>'private')::boolean where id=a.id;
   if (p_change->>'private')::boolean then
    update social_contexts set revoked_at=now() where activity_id=a.id and revoked_at is null;
    update social_activity_state set decision='exclude',updated_at=now() where activity_id=a.id;
   end if;
  end if;
  for choice in select value from jsonb_array_elements(coalesce(p_change->'audiences','[]')) loop
   dest:=(choice->>'id')::uuid;
   if not social_destination(dest,auth.uid()) then raise exception 'Audience unavailable';end if;
   if (choice->>'share')::boolean and (select social_private from activities where id=a.id) then raise exception 'Turn off Keep private before sharing';end if;
   perform social_decide(a.id,dest,case when (choice->>'share')::boolean then 'include' else 'exclude' end,(choice->>'share')::boolean);
  end loop;
 end if;
 select * into a from activities where id=p_activity;
 return jsonb_build_object('private',a.social_private,'public_note',a.public_note,'legacy_photo',a.share_legacy_photo,
  'has_legacy_photo',a.note_image_url is not null,'photos',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'shared',is_shared,'thumb',thumb_path) order by sort_order,created_at,id),'[]') from activity_photos where activity_id=a.id and user_id=auth.uid()),
  'audiences',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'name',coalesce(c.name,'Circle'),
   'shared',exists(select 1 from social_contexts s where s.activity_id=a.id and s.audience_id=d.id and s.revoked_at is null and not a.social_private)) order by d.kind,c.name),'[]')
   from social_audiences d left join communities c on c.id=d.community_id where social_destination(d.id,auth.uid())));
end; $$;

create function public.social_activity_lifecycle() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if TG_OP='DELETE' then
  -- Account cascades have already removed auth.users; no undo tombstone is needed.
  if exists(select 1 from auth.users where id=old.user_id) then
   insert into social_deleted_activities values(old.id,old.user_id) on conflict do nothing;
  end if;return old;
 elsif TG_OP='INSERT' then
  if exists(select 1 from social_deleted_activities where activity_id=new.id) then new.social_private:=true;end if;
 else
  if new.note_image_url is distinct from old.note_image_url then new.share_legacy_photo:=false;end if;
  if new.social_private and not old.social_private then
   update social_contexts set revoked_at=now() where activity_id=new.id and revoked_at is null;
   update social_activity_state set decision='exclude',updated_at=now() where activity_id=new.id;
  end if;
 end if;return new;
end; $$;
create trigger social_private_lifecycle before insert or delete or update of social_private,note_image_url on activities
 for each row execute function public.social_activity_lifecycle();

create function public.social_photo_lifecycle() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if (new.image_path,new.thumb_path,new.activity_id,new.user_id) is distinct from (old.image_path,old.thumb_path,old.activity_id,old.user_id) then new.is_shared:=false;end if;
 return new;
end; $$;
create trigger social_photo_consent before update of image_path,thumb_path,activity_id,user_id on activity_photos
 for each row execute function public.social_photo_lifecycle();

create function public.social_leave(c uuid,u uuid,next_status text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare audience uuid;begin
 select id into audience from social_audiences where community_id=c;
 update community_members set status=next_status,role='member',removed_generation=case when next_status='removed'
   then (select invite_generation from communities where id=c) else removed_generation end where community_id=c and user_id=u;
 update social_contexts s set revoked_at=now() from activities a
  where s.activity_id=a.id and a.user_id=u and s.audience_id=audience and s.revoked_at is null;
 delete from social_rules where user_id=u and audience_id=audience;
 delete from social_activity_state s using activities a where s.activity_id=a.id and a.user_id=u and s.audience_id=audience;
 delete from community_challenge_members m using community_challenges ch where m.challenge_id=ch.id and ch.community_id=c and m.user_id=u;
end; $$;

create function public.social_community(p_action text,p_id uuid default null,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();c communities;target uuid;target_role text;begin
 if uid is null or not social_enabled() then raise exception 'Communities unavailable';end if;
 if p_action='create' then
  if not social_rate('create-community:'||uid,5) then raise exception 'Please try again shortly';end if;
  insert into communities(owner_id,name,description) values(uid,btrim(p_data->>'name'),coalesce(p_data->>'description','')) returning * into c;
  insert into community_members(community_id,user_id,role,status) values(c.id,uid,'owner','active');
  insert into social_audiences(kind,community_id) values('community',c.id);
  return jsonb_build_object('id',c.id);
 end if;
 select * into c from communities where id=p_id for update;
 if not found or not social_member(c.id,uid) then raise exception 'Community unavailable';end if;
 if p_action='get' then
  return jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'owner_id',c.owner_id,
   'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'role',m.role,
    'name',case when social_blocked(m.user_id,uid) then 'Blocked member' else coalesce(nullif(up.social_display_name,''),'MoveNotes member') end) order by m.joined_at,m.user_id),'[]')
    from community_members m left join user_preferences up on up.user_id=m.user_id
    where m.community_id=c.id and m.status='active' and (not social_blocked(m.user_id,uid) or social_admin(c.id,uid))));
 elsif p_action='leave' then
  if c.owner_id=uid then raise exception 'Transfer ownership or delete the Community before leaving';end if;
  perform social_leave(c.id,uid,'left');
 elsif p_action='delete' then
  if c.owner_id<>uid then raise exception 'Only the owner can delete a Community';end if;
  delete from communities where id=c.id;
 elsif p_action='edit' then
  if not social_admin(c.id,uid) then raise exception 'Not authorized';end if;
  update communities set name=btrim(p_data->>'name'),description=coalesce(p_data->>'description','') where id=c.id;
 elsif p_action in('remove','role','transfer') then
  target:=(p_data->>'user_id')::uuid;
  select role into target_role from community_members where community_id=c.id and user_id=target and status='active' for update;
  if not found or target=c.owner_id then raise exception 'Member unavailable';end if;
  if p_action='remove' then
   if not social_admin(c.id,uid) or (target_role='admin' and uid<>c.owner_id) then raise exception 'Not authorized';end if;
   perform social_leave(c.id,target,'removed');
  elsif p_action='role' then
   if c.owner_id<>uid or p_data->>'role' not in('admin','member') then raise exception 'Only the owner can change roles';end if;
   update community_members set role=p_data->>'role' where community_id=c.id and user_id=target;
  else
   if c.owner_id<>uid then raise exception 'Only the owner can transfer ownership';end if;
   update community_members set role='admin' where community_id=c.id and user_id=uid;
   update community_members set role='owner' where community_id=c.id and user_id=target;
   update communities set owner_id=target where id=c.id;
  end if;
 else raise exception 'Unknown Community action';end if;
 return jsonb_build_object('ok',true);
end; $$;

create function public.social_invite(p_action text,p_community uuid default null,p_token text default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();c communities;i community_invites;m community_members;token text;generation bigint;
begin
 if not social_enabled() then return jsonb_build_object('status','unavailable');end if;
 if not social_rate('invite:'||coalesce(uid::text,'anonymous'),case when uid is null then 100 else 30 end) then return jsonb_build_object('status','try_later');end if;
 if p_action='rotate' then
  if uid is null or not social_admin(p_community,uid) then raise exception 'Not authorized';end if;
  update communities set invite_generation=invite_generation+1 where id=p_community returning invite_generation into generation;
  update community_invites set revoked_at=now() where community_id=p_community and revoked_at is null;
  token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
  insert into community_invites(community_id,token_hash,generation,issuer_id)
   values(p_community,encode(sha256(convert_to(token,'UTF8')),'hex'),generation,uid);
  return jsonb_build_object('token',token,'expires_at',now()+interval '30 days');
 end if;
 if p_action not in('preview','join') or p_token is null or p_token !~ '^[a-f0-9]{64}$' then return jsonb_build_object('status','invalid');end if;
 select * into i from community_invites where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and revoked_at is null and expires_at>now() for update;
 if not found then return jsonb_build_object('status','invalid');end if;
 select * into c from communities where id=i.community_id and invite_generation=i.generation;
 if not found then return jsonb_build_object('status','invalid');end if;
 if p_action='preview' then return jsonb_build_object('status','valid','name',c.name,'description',c.description);end if;
 if uid is null then return jsonb_build_object('status','sign_in');end if;
 select * into m from community_members where community_id=c.id and user_id=uid for update;
 if found and m.status='removed' and i.generation<=m.removed_generation then return jsonb_build_object('status','removed');end if;
 if m.status='active' then return jsonb_build_object('status','joined','id',c.id);end if;
 insert into community_members(community_id,user_id,role,status) values(c.id,uid,'member','active')
  on conflict(community_id,user_id) do update set status='active',role='member',joined_at=now();
 -- New/rejoining members have no automatic consent and no resurrected shares.
 return jsonb_build_object('status','joined','id',c.id);
end; $$;

create function public.social_feed(p_audience uuid default null,p_before jsonb default null,p_activity uuid default null)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 with visible as materialized (
  select s.id,s.activity_id,s.audience_id,s.created_at,d.kind,d.community_id,
   case when d.kind='circle' then 'Circle' else c.name end label
  from social_contexts s join social_audiences d on d.id=s.audience_id left join communities c on c.id=d.community_id
  where social_can_read(s.id) and (p_audience is null or s.audience_id=p_audience or
    (p_audience='00000000-0000-0000-0000-000000000001'::uuid and d.kind='circle'))
 ), unique_activities as (
  select a.id,a.date,max(v.created_at) shared_at from activities a join visible v on v.activity_id=a.id
   where p_activity is null or a.id=p_activity group by a.id,a.date
 ), page as (
  select * from unique_activities where p_before is null or (date,shared_at,id)<
   ((p_before->>'date')::date,(p_before->>'shared_at')::timestamptz,(p_before->>'id')::uuid)
  order by date desc,shared_at desc,id desc limit 30
 ) select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'date',a.date,'shared_at',p.shared_at,
  'author_id',a.user_id,'author',coalesce(nullif(up.social_display_name,''),'MoveNotes member'),
  'title',a.title,'type',a.type,'distance_km',a.distance_km,'duration_min',a.duration_min,'public_note',a.public_note,
  'photos',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'order',sort_order) order by sort_order,created_at,id),'[]')
   from activity_photos where activity_id=a.id and user_id=a.user_id and is_shared)
   ||case when a.share_legacy_photo and a.note_image_url is not null then '[{"id":"legacy","order":999}]'::jsonb else '[]'::jsonb end,
  'contexts',(select jsonb_agg(jsonb_build_object('id',v.id,'audience',v.audience_id,'kind',v.kind,'community',v.community_id,'name',v.label) order by v.kind,v.id)
   from visible v where v.activity_id=a.id)) order by p.date desc,p.shared_at desc,p.id desc),'[]'::jsonb)
 from page p join activities a on a.id=p.id left join user_preferences up on up.user_id=a.user_id;
$$;

create function public.social_comment_page(p_context uuid,p_before jsonb,p_moderate boolean) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 with page as materialized (
  select c.*,coalesce(nullif(up.social_display_name,''),'MoveNotes member') author
   from social_comments c left join user_preferences up on up.user_id=c.author_id
   where c.context_id=p_context and social_can_read(p_context) and not social_blocked(c.author_id,auth.uid())
    and (p_before is null or (c.created_at,c.id)<((p_before->>'created_at')::timestamptz,(p_before->>'id')::uuid))
   order by c.created_at desc,c.id desc limit 101
 ), shown as(select * from page order by created_at desc,id desc limit 100)
 select jsonb_build_object('comments',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'author_id',author_id,'author',author,'body',body,
   'created_at',created_at,'can_delete',author_id=auth.uid() or p_moderate) order by created_at,id),'[]') from shown),
  'has_more',(select count(*)>100 from page),
  'before',(select jsonb_build_object('created_at',created_at,'id',id) from shown order by created_at,id limit 1));
$$;

create function public.social_conversation(p_context uuid,p_action text default 'read',p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();s social_contexts;a activities;d social_audiences;comment_page jsonb;can_moderate boolean;
begin
 if uid is null or not social_can_read(p_context) then raise exception 'Conversation unavailable';end if;
 select * into s from social_contexts where id=p_context;
 select * into a from activities where id=s.activity_id;select * into d from social_audiences where id=s.audience_id;
 can_moderate:=a.user_id=uid or (d.kind='community' and social_admin(d.community_id,uid));
 if p_action<>'read' and not social_rate('conversation:'||uid,30) then raise exception 'Please try again shortly';end if;
 if p_action='comment' then
  insert into social_comments(context_id,author_id,body) values(p_context,uid,btrim(p_data->>'body'));
 elsif p_action='delete_comment' then
  delete from social_comments where id=(p_data->>'id')::uuid and context_id=p_context and (author_id=uid or can_moderate);
  if not found then raise exception 'Comment unavailable';end if;
 elsif p_action='reaction' then
  if p_data->>'reaction' is null then delete from social_reactions where context_id=p_context and user_id=uid;
  else insert into social_reactions values(p_context,uid,p_data->>'reaction') on conflict(context_id,user_id) do update set reaction=excluded.reaction;end if;
 elsif p_action='report' then
  if p_data ? 'comment' and not exists(select 1 from social_comments where id=(p_data->>'comment')::uuid and context_id=p_context and not social_blocked(author_id,uid)) then raise exception 'Comment unavailable';end if;
  insert into social_reports(reporter_id,context_id,comment_id,reason) values(uid,p_context,(p_data->>'comment')::uuid,btrim(p_data->>'reason'));
 elsif p_action='resolve_report' then
  if not can_moderate then raise exception 'Not authorized';end if;
  update social_reports set resolved_at=now() where id=(p_data->>'id')::uuid and context_id=p_context;
 elsif p_action='block' then
  if a.user_id=uid then raise exception 'Cannot block yourself';end if;
  insert into social_blocks values(uid,a.user_id) on conflict do nothing;
  return jsonb_build_object('blocked',true);
 elsif p_action<>'read' then raise exception 'Unknown conversation action';end if;
 comment_page:=social_comment_page(p_context,case when p_action='read' then p_data->'before' else null end,can_moderate);
 return jsonb_build_object('can_moderate',can_moderate,'comments',comment_page->'comments','has_more',comment_page->'has_more','before',comment_page->'before',
  'reactions',(select coalesce(jsonb_agg(jsonb_build_object('reaction',r.reaction,'count',r.n)),'[]') from (
   select reaction,count(*) n from social_reactions where context_id=p_context and not social_blocked(user_id,uid) group by reaction) r),
  'my_reaction',(select reaction from social_reactions where context_id=p_context and user_id=uid),
  'reports',case when can_moderate then (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'reason',r.reason,'comment_id',r.comment_id) order by r.created_at),'[]')
   from social_reports r where r.context_id=p_context and r.resolved_at is null) else '[]'::jsonb end);
end; $$;

-- Private originals remain unreadable to audiences. This path resolver is called
-- with the viewer's JWT by the Edge Function; it never grants storage privileges.
create function public.social_media_path(p_context uuid,p_photo text,p_thumb boolean default false) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare a activities;path text;begin
 if not social_can_read(p_context) then raise exception 'Photo unavailable';end if;
 select x.* into a from activities x join social_contexts s on s.activity_id=x.id where s.id=p_context;
 if p_photo='legacy' and a.share_legacy_photo then path:=case when p_thumb then coalesce(a.note_thumb_image_url,a.note_image_url) else a.note_image_url end;
 elsif p_photo ~ '^[a-fA-F0-9-]{36}$' then
  select case when p_thumb then coalesce(thumb_path,image_path) else image_path end into path
   from activity_photos where id=p_photo::uuid and activity_id=a.id and user_id=a.user_id and is_shared;
 end if;
 if path is null then raise exception 'Photo unavailable';end if;
 return jsonb_build_object('path',path,'owner',a.user_id);
end; $$;

-- Legacy get_circle_feed: reversible cutover guard; original records/expiry retained.
CREATE OR REPLACE FUNCTION "public"."get_circle_feed"("p_user_id" "uuid", "p_limit" integer DEFAULT 30, "p_before_occurred_on" "date" DEFAULT NULL::"date", "p_before_shared_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_before_recipient_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("recipient_id" "uuid", "activity_share_id" "uuid", "shared_at" timestamp with time zone, "occurred_on" "date", "author_user_id" "uuid", "author_display_name" "text", "author_profile_image_path" "text", "author_profile_thumb_path" "text", "title" "text", "activity_type" "text", "distance_km" numeric, "duration_min" numeric, "shared_photo_url" "text", "shared_thumb_photo_url" "text", "photos" "jsonb", "tags" "jsonb", "reaction_groups" "jsonb", "current_user_reaction" "text", "has_new_reactions" boolean, "seen_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with viewer as (
    select up.circle_last_seen_at
    from public.user_preferences up
    where up.user_id = p_user_id
  )
  select
    r.id as recipient_id,
    r.activity_share_id,
    r.shared_at,
    s.occurred_on,
    s.author_user_id,
    coalesce(
      nullif(up.social_display_name, ''),
      split_part(coalesce(up.login_email, ''), '@', 1),
      'Mover'
    ) as author_display_name,
    up.social_profile_image_path as author_profile_image_path,
    up.social_profile_thumb_path as author_profile_thumb_path,
    s.title,
    s.activity_type,
    s.distance_km,
    s.duration_min,
    s.shared_photo_url,
    s.shared_thumb_photo_url,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'image_path', sp.image_path,
            'thumb_path', sp.thumb_path,
            'sort_order', sp.sort_order
          )
          order by sp.sort_order asc, sp.created_at asc, sp.id asc
        )
        from public.activity_share_photos sp
        where sp.activity_share_id = s.id
      ),
      case
        when s.shared_photo_url is not null then jsonb_build_array(
          jsonb_build_object(
            'image_path', s.shared_photo_url,
            'thumb_path', s.shared_thumb_photo_url,
            'sort_order', 0
          )
        )
        else '[]'::jsonb
      end
    ) as photos,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'type', st.type,
            'value', st.value,
            'metadata', st.metadata,
            'source', st.source
          )
          order by st.created_at asc, st.id asc
        )
        from public.activity_share_tags st
        where st.activity_share_id = s.id
      ),
      '[]'::jsonb
    ) as tags,
    coalesce(rg.reaction_groups, '{}'::jsonb) as reaction_groups,
    cur.current_user_reaction,
    case
      when s.author_user_id = p_user_id then coalesce(nr.has_new_reactions, false)
      else false
    end as has_new_reactions,
    r.seen_at
  from public.activity_share_recipients r
  join public.activity_shares s
    on s.id = r.activity_share_id
  left join public.user_preferences up
    on up.user_id = s.author_user_id
  left join viewer v
    on true
  left join lateral (
    select jsonb_object_agg(grouped.reaction_type, grouped.reactors) as reaction_groups
    from (
      select
        ar.reaction_type,
        jsonb_agg(
          jsonb_build_object(
            'user_id', ar.user_id,
            'name', coalesce(
              nullif(upr.social_display_name, ''),
              split_part(coalesce(upr.login_email, ''), '@', 1),
              'Mover'
            ),
            'profile_thumb_path', upr.social_profile_thumb_path,
            'reacted_at', ar.updated_at
          )
          order by ar.updated_at desc, ar.user_id
        ) as reactors
      from public.activity_share_reactions ar
      left join public.user_preferences upr
        on upr.user_id = ar.user_id
      where ar.activity_share_id = s.id
      group by ar.reaction_type
    ) grouped
  ) rg
    on true
  left join lateral (
    select ar.reaction_type as current_user_reaction
    from public.activity_share_reactions ar
    where ar.activity_share_id = s.id
      and ar.user_id = p_user_id
    limit 1
  ) cur
    on true
  left join lateral (
    select exists (
      select 1
      from public.activity_share_reactions ar
      where ar.activity_share_id = s.id
        and ar.user_id <> p_user_id
        and ar.updated_at > coalesce(v.circle_last_seen_at, to_timestamp(0))
    ) as has_new_reactions
  ) nr
    on true
  where auth.uid() = p_user_id
    and r.recipient_user_id = p_user_id
    and r.hidden_at is null
    and s.deleted_at is null
    and s.expires_at > now()
    and not public.social_enabled()
    and (s.author_user_id=p_user_id or public.social_connected(s.author_user_id,p_user_id))
    and (
      p_before_occurred_on is null
      or p_before_shared_at is null
      or p_before_recipient_id is null
      or (s.occurred_on, r.shared_at, r.id) < (p_before_occurred_on, p_before_shared_at, p_before_recipient_id)
    )
  order by s.occurred_on desc, r.shared_at desc, r.id desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

-- Legacy share_activity_with_connections: reversible cutover guard; original records/expiry retained.
CREATE OR REPLACE FUNCTION "public"."share_activity_with_connections"("p_activity_id" "uuid", "p_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  auth_user uuid;
  v_activity record;
  v_share_id uuid;
  v_shared_at timestamptz;
  v_photo_rows integer;
begin
  if public.social_enabled() then raise exception 'Refresh MoveNotes to use the new sharing controls'; end if;
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  select
    a.id,
    a.user_id,
    a.type,
    a.title,
    coalesce(
      (
        select p.image_path
        from public.activity_photos p
        where p.activity_id = a.id
        order by p.sort_order asc, p.created_at asc, p.id asc
        limit 1
      ),
      a.note_image_url
    ) as cover_image_path,
    coalesce(
      (
        select p.thumb_path
        from public.activity_photos p
        where p.activity_id = a.id
        order by p.sort_order asc, p.created_at asc, p.id asc
        limit 1
      ),
      a.note_thumb_image_url
    ) as cover_thumb_path,
    a.date,
    a.distance_km,
    a.duration_min
  into v_activity
  from public.activities a
  where a.id = p_activity_id
    and a.user_id = p_user_id;

  if not found then
    raise exception 'Activity not found or not owned by user.';
  end if;

  if exists (
    select 1
    from public.activity_shares s
    where s.activity_id = p_activity_id
  ) then
    raise exception 'Activity already shared with Circle.';
  end if;

  insert into public.activity_shares (
    activity_id,
    author_user_id,
    visibility,
    title,
    activity_type,
    summary_text,
    distance_km,
    duration_min,
    shared_photo_url,
    shared_thumb_photo_url,
    occurred_on
  )
  values (
    v_activity.id,
    p_user_id,
    'connections',
    v_activity.title,
    v_activity.type,
    null,
    v_activity.distance_km,
    v_activity.duration_min,
    v_activity.cover_image_path,
    v_activity.cover_thumb_path,
    v_activity.date
  )
  returning id, shared_at
  into v_share_id, v_shared_at;

  insert into public.activity_share_photos (
    activity_share_id,
    image_path,
    thumb_path,
    sort_order
  )
  select
    v_share_id,
    p.image_path,
    p.thumb_path,
    coalesce(p.sort_order, 0)
  from public.activity_photos p
  where p.activity_id = v_activity.id
  order by p.sort_order asc, p.created_at asc, p.id asc
  on conflict (activity_share_id, sort_order, image_path) do nothing;

  get diagnostics v_photo_rows = row_count;

  if v_photo_rows = 0 and v_activity.cover_image_path is not null then
    insert into public.activity_share_photos (
      activity_share_id,
      image_path,
      thumb_path,
      sort_order
    )
    values (
      v_share_id,
      v_activity.cover_image_path,
      v_activity.cover_thumb_path,
      0
    )
    on conflict (activity_share_id, sort_order, image_path) do nothing;
  end if;

  insert into public.activity_share_tags (
    activity_share_id,
    type,
    value,
    metadata,
    source
  )
  select
    v_share_id,
    t.type,
    t.value,
    coalesce(t.metadata, '{}'::jsonb),
    t.source
  from public.activity_tags t
  where t.activity_id = v_activity.id
  on conflict (activity_share_id, type) do update
  set
    value = excluded.value,
    metadata = excluded.metadata,
    source = excluded.source;

  insert into public.activity_share_recipients (
    activity_share_id,
    recipient_user_id,
    shared_at,
    seen_at
  )
  values (
    v_share_id,
    p_user_id,
    v_shared_at,
    now()
  )
  on conflict (activity_share_id, recipient_user_id) do nothing;

  insert into public.activity_share_recipients (
    activity_share_id,
    recipient_user_id,
    shared_at
  )
  select distinct
    v_share_id,
    case
      when c.requester_user_id = p_user_id then c.addressee_user_id
      else c.requester_user_id
    end as recipient_user_id,
    v_shared_at
  from public.user_connections c
  where c.status = 'accepted'
    and (c.requester_user_id = p_user_id or c.addressee_user_id = p_user_id)
    and (
      case
        when c.requester_user_id = p_user_id then c.addressee_user_id
        else c.requester_user_id
      end
    ) <> p_user_id
  on conflict (activity_share_id, recipient_user_id) do nothing;

  return v_share_id;
end;
$$;

-- Legacy refresh_shared_activity: reversible cutover guard; original records/expiry retained.
CREATE OR REPLACE FUNCTION "public"."refresh_shared_activity"("p_activity_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  auth_user uuid;
  v_activity record;
  v_share_id uuid;
  v_shared_at timestamptz;
  v_photo_rows integer;
begin
  if public.social_enabled() then return false; end if;
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  select
    a.id,
    a.user_id,
    a.type,
    a.title,
    coalesce(
      (
        select p.image_path
        from public.activity_photos p
        where p.activity_id = a.id
        order by p.sort_order asc, p.created_at asc, p.id asc
        limit 1
      ),
      a.note_image_url
    ) as cover_image_path,
    coalesce(
      (
        select p.thumb_path
        from public.activity_photos p
        where p.activity_id = a.id
        order by p.sort_order asc, p.created_at asc, p.id asc
        limit 1
      ),
      a.note_thumb_image_url
    ) as cover_thumb_path,
    a.date,
    a.distance_km,
    a.duration_min
  into v_activity
  from public.activities a
  where a.id = p_activity_id
    and a.user_id = p_user_id;

  if not found then
    raise exception 'Activity not found or not owned by user.';
  end if;

  select s.id, s.shared_at
  into v_share_id, v_shared_at
  from public.activity_shares s
  where s.activity_id = p_activity_id
    and s.author_user_id = p_user_id
    and s.deleted_at is null
  limit 1;

  if v_share_id is null then
    return false;
  end if;

  update public.activity_shares
  set
    title = v_activity.title,
    activity_type = v_activity.type,
    distance_km = v_activity.distance_km,
    duration_min = v_activity.duration_min,
    shared_photo_url = v_activity.cover_image_path,
    shared_thumb_photo_url = v_activity.cover_thumb_path,
    occurred_on = v_activity.date
  where id = v_share_id;

  insert into public.activity_share_recipients (
    activity_share_id,
    recipient_user_id,
    shared_at,
    seen_at
  )
  values (
    v_share_id,
    p_user_id,
    v_shared_at,
    now()
  )
  on conflict (activity_share_id, recipient_user_id) do nothing;

  delete from public.activity_share_photos
  where activity_share_id = v_share_id;

  insert into public.activity_share_photos (
    activity_share_id,
    image_path,
    thumb_path,
    sort_order
  )
  select
    v_share_id,
    p.image_path,
    p.thumb_path,
    coalesce(p.sort_order, 0)
  from public.activity_photos p
  where p.activity_id = v_activity.id
  order by p.sort_order asc, p.created_at asc, p.id asc;

  get diagnostics v_photo_rows = row_count;

  if v_photo_rows = 0 and v_activity.cover_image_path is not null then
    insert into public.activity_share_photos (
      activity_share_id,
      image_path,
      thumb_path,
      sort_order
    )
    values (
      v_share_id,
      v_activity.cover_image_path,
      v_activity.cover_thumb_path,
      0
    )
    on conflict (activity_share_id, sort_order, image_path) do nothing;
  end if;

  delete from public.activity_share_tags
  where activity_share_id = v_share_id;

  insert into public.activity_share_tags (
    activity_share_id,
    type,
    value,
    metadata,
    source
  )
  select
    v_share_id,
    t.type,
    t.value,
    coalesce(t.metadata, '{}'::jsonb),
    t.source
  from public.activity_tags t
  where t.activity_id = v_activity.id;

  return true;
end;
$$;

-- Revoke direct helper execution (SECURITY DEFINER internal helpers must not be
-- callable with forged owner IDs). Grant only the explicit public RPC surface.
do $$ declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'social\_%' escape '\' loop
   execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
grant execute on function public.social_enabled(),public.social_home(),public.social_set_rule(uuid,text,text[],text),
 public.social_activity(uuid,jsonb),public.social_community(text,uuid,jsonb),public.social_feed(uuid,jsonb,uuid),
 public.social_conversation(uuid,text,jsonb),public.social_media_path(uuid,text,boolean),
 public.social_challenges(uuid,text,jsonb),public.social_connection_update(uuid,uuid,uuid,text) to authenticated;
grant execute on function public.social_invite(text,uuid,text) to anon,authenticated;

-- Legacy records keep their original expiry. Hide legacy recipients' media and
-- reaction paths during cutover, and recheck live connections on rollback.
create or replace function public.can_access_circle_share(p_activity_share_id uuid,p_user_id uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
 select auth.uid()=p_user_id and not social_enabled() and exists(select 1 from activity_shares s
  where s.id=p_activity_share_id and s.deleted_at is null and s.expires_at>now()
   and (s.author_user_id=p_user_id or (social_connected(s.author_user_id,p_user_id) and exists(
    select 1 from activity_share_recipients r where r.activity_share_id=s.id and r.recipient_user_id=p_user_id and r.hidden_at is null))));
$$;

-- No new storage SELECT policy is granted to recipients. This closes the old
-- mint-arbitrary-lifetime-URL path at cutover; owner storage policies are retained.
drop policy if exists "Circle recipients can read shared images" on storage.objects;
create policy "Circle recipients can read shared images" on storage.objects for select to authenticated using(
 bucket_id in('actvity-notes','activity-notes') and not public.social_enabled() and exists(
  select 1 from public.activity_shares s left join public.activity_share_photos p on p.activity_share_id=s.id
   where public.can_access_circle_share(s.id,auth.uid()) and exists(
    select 1 from unnest(array[p.image_path,p.thumb_path,s.shared_photo_url,s.shared_thumb_photo_url]) v(path)
    where name=split_part(replace(replace(regexp_replace(coalesce(v.path,''),
     '^https?://[^/]+/storage/v1/object/(?:sign|public)/(?:actvity-notes|activity-notes)/',''),'%2F','/'),'%2f','/'),'?',1))));

-- Permission-check helpers used by storage/RLS must be executable by the caller.
grant execute on function public.social_enabled() to anon;

do $$ declare t text;p record;begin
 foreach t in array array['activity_shares','activity_share_photos','activity_share_tags','activity_share_recipients','activity_share_reactions'] loop
  execute format('create policy social_legacy_cutover on public.%I as restrictive for all to authenticated using(not public.social_enabled()) with check(not public.social_enabled())',t);
  for p in select polname from pg_policy where polrelid=('public.'||t)::regclass and polcmd='r' loop
   execute format('drop policy %I on public.%I',p.polname,t);
  end loop;
  execute format('create policy social_legacy_read on public.%I for select to authenticated using(public.can_access_circle_share(%s,auth.uid()))',
   t,case when t='activity_shares' then 'id' else 'activity_share_id' end);
  if t='activity_share_recipients' then
   execute 'drop policy social_legacy_read on public.activity_share_recipients';
   execute 'create policy social_legacy_read on public.activity_share_recipients for select to authenticated using(recipient_user_id=auth.uid() and public.can_access_circle_share(activity_share_id,auth.uid()))';
  end if;
 end loop;
end $$;


-- Preserve revocation/block intent across rollback to the legacy UI.
CREATE OR REPLACE FUNCTION "public"."unshare_activity"("p_activity_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  auth_user uuid;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  if exists(select 1 from public.activities where id=p_activity_id and user_id=p_user_id) then
    perform public.social_decide(p_activity_id,public.social_circle(p_user_id),'exclude',false);
  end if;
  delete from public.activity_shares
  where activity_id = p_activity_id
    and author_user_id = p_user_id;

  return found;
end;
$$;

-- Preserve revocation/block intent across rollback to the legacy UI.
CREATE OR REPLACE FUNCTION "public"."accept_circle_invite"("p_token" "text", "p_user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  auth_user uuid;
  v_invite record;
  v_connection record;
begin
  auth_user := auth.uid();
  if auth_user is null or auth_user <> p_user_id then
    raise exception 'Not authorized';
  end if;

  select *
  into v_invite
  from public.circle_invite_links l
  where l.token = p_token
  limit 1
  for update;

  if not found then
    return 'invalid';
  end if;

  if v_invite.revoked_at is not null then
    return 'revoked';
  end if;

  if v_invite.expires_at <= now() then
    return 'expired';
  end if;

  if v_invite.accepted_by_user_id is not null and v_invite.accepted_by_user_id <> p_user_id then
    return 'used';
  end if;

  if public.social_blocked(v_invite.inviter_user_id,p_user_id) then return 'blocked'; end if;

  if v_invite.inviter_user_id = p_user_id then
    return 'cannot_accept_own';
  end if;

  select c.*
  into v_connection
  from public.user_connections c
  where
    (c.requester_user_id = v_invite.inviter_user_id and c.addressee_user_id = p_user_id)
    or
    (c.requester_user_id = p_user_id and c.addressee_user_id = v_invite.inviter_user_id)
  order by c.created_at desc
  limit 1
  for update;

  if found then
    if v_connection.status = 'blocked' then
      return 'blocked';
    end if;

    if v_connection.status = 'accepted' then
      update public.circle_invite_links
      set accepted_by_user_id = coalesce(accepted_by_user_id, p_user_id),
          accepted_at = coalesce(accepted_at, now())
      where id = v_invite.id;
      return 'already_connected';
    end if;

    update public.user_connections
    set
      status = 'accepted',
      responded_at = now()
    where id = v_connection.id;
  else
    insert into public.user_connections (
      requester_user_id,
      addressee_user_id,
      status,
      responded_at
    )
    values (
      v_invite.inviter_user_id,
      p_user_id,
      'accepted',
      now()
    );
  end if;

  update public.circle_invite_links
  set accepted_by_user_id = coalesce(accepted_by_user_id, p_user_id),
      accepted_at = coalesce(accepted_at, now())
  where id = v_invite.id;

  return 'connected';
end;
$$;
