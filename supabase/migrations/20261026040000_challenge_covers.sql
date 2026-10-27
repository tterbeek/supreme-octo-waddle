-- Private challenge covers use the existing image bucket and bounded media endpoint.
-- No activity data or sharing consent is changed.
alter table public.community_challenges add column cover_image_path text,
 add column cover_owner_id uuid references auth.users on delete set null,
 add column cover_updated_at timestamptz;

create function public.social_set_challenge_cover(p_challenge uuid,p_community uuid,p_path text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid();begin
 if uid is null or not social_enabled() or not social_admin(p_community,uid) then raise exception 'Not authorized';end if;
 perform 1 from community_challenges where id=p_challenge and community_id=p_community for update;
 if not found then raise exception 'Challenge unavailable';end if;
 if p_path is not null and (p_path !~ ('^'||uid::text||'/challenge-cover-[A-Za-z0-9.-]+\.jpg$')
  or not exists(select 1 from storage.objects where bucket_id in('actvity-notes','activity-notes') and name=p_path)) then raise exception 'Cover unavailable';end if;
 update community_challenges set cover_image_path=p_path,cover_owner_id=case when p_path is null then null else uid end,
  cover_updated_at=clock_timestamp() where id=p_challenge;
end; $$;
revoke all on function public.social_set_challenge_cover(uuid,uuid,text) from public,anon,authenticated;

create function public.social_challenge_media_path(p_challenge uuid) returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare ch community_challenges;begin
 select * into ch from community_challenges where id=p_challenge;
 if not found or not social_enabled() or auth.uid() is null or not social_member(ch.community_id,auth.uid())
  or ch.cover_image_path is null or ch.cover_owner_id is null then raise exception 'Cover unavailable';end if;
 return jsonb_build_object('path',ch.cover_image_path,'owner',ch.cover_owner_id);
end; $$;
revoke all on function public.social_challenge_media_path(uuid) from public,anon,authenticated;
grant execute on function public.social_challenge_media_path(uuid) to authenticated;

create or replace function public.social_challenge_values(p_challenge uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 with challenge as(select * from community_challenges where id=p_challenge and social_enabled()
   and social_member(community_id,auth.uid())), eligible as (
  select distinct a.id,a.user_id,a.distance_km,a.duration_min,
    case when a.started_at is not null then (a.started_at at time zone c.time_zone)::date else a.date end day_key
   from challenge c join social_audiences d on d.community_id=c.community_id
    join social_contexts s on s.audience_id=d.id join activities a on a.id=s.activity_id
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
  'participating',true,'has_cover',cover_image_path is not null and cover_owner_id is not null,'cover_updated_at',cover_updated_at,
  'state',case when status='cancelled' then 'cancelled' when (now() at time zone time_zone)::date>=ends_on then 'completed'
   when (now() at time zone time_zone)::date<starts_on then 'upcoming' else 'active' end) from progress;
$$;
create or replace function public.social_challenges(p_community uuid,p_action text default 'list',p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare ch community_challenges;v_challenge_id uuid;uid uuid:=auth.uid();begin
 if uid is null or not social_enabled() or not social_member(p_community,uid) then raise exception 'Community unavailable';end if;
 if p_action in('create','update') then
  if not social_admin(p_community,uid) then raise exception 'Not authorized';end if;
  if not social_rate('challenge:'||uid,10) then raise exception 'Please try again shortly';end if;
  if not exists(select 1 from pg_timezone_names where name=p_data->>'time_zone') then raise exception 'Invalid timezone';end if;
  if not coalesce(p_data->'types','[]')<@'["run","ride","walk","strength","yoga","hike","swim","meditation","restore","other"]'::jsonb then raise exception 'Invalid activity types';end if;
  if p_action='create' then
  insert into community_challenges(community_id,creator_id,title,metric,target,types,starts_on,ends_on,time_zone,scope)
   values(p_community,uid,btrim(p_data->>'title'),p_data->>'metric',(p_data->>'target')::numeric,
    array(select jsonb_array_elements_text(coalesce(p_data->'types','[]'))),(p_data->>'starts_on')::date,(p_data->>'ends_on')::date,p_data->>'time_zone',p_data->>'scope') returning * into ch;
  else
   v_challenge_id:=(p_data->>'id')::uuid;
   select * into ch from community_challenges where id=v_challenge_id and community_id=p_community for update;
   if not found then raise exception 'Challenge unavailable';end if;
   update community_challenges set title=btrim(p_data->>'title'),metric=p_data->>'metric',target=(p_data->>'target')::numeric,
    types=array(select jsonb_array_elements_text(coalesce(p_data->'types','[]'))),starts_on=(p_data->>'starts_on')::date,
    ends_on=(p_data->>'ends_on')::date,time_zone=p_data->>'time_zone',scope=p_data->>'scope'
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

