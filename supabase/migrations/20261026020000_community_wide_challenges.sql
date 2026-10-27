-- Challenges are part of Community membership. No new sharing consent is
-- inferred: only currently authorized Community shares contribute. Existing
-- per-challenge membership rows are no longer used; no source data is changed.
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
  'participating',true,
  'state',case when status='cancelled' then 'cancelled' when (now() at time zone time_zone)::date>=ends_on then 'completed'
   when (now() at time zone time_zone)::date<starts_on then 'upcoming' else 'active' end) from progress;
$$;
create or replace function public.social_challenges(p_community uuid,p_action text default 'list',p_data jsonb default '{}') returns jsonb
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

