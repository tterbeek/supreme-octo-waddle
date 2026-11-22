-- Return the authoritative closure timestamp for chronological archive placement.
create or replace function public.social_challenge_values_legacy(p_challenge uuid) returns jsonb
language sql stable security definer set search_path=public,pg_temp as $$
 with challenge as(select * from community_challenges where id=p_challenge and social_enabled()
   and social_member(community_id,auth.uid())), eligible as (
  select distinct a.id,a.user_id,a.distance_km,a.duration_min,a.started_at,a.created_at,
    case when a.started_at is not null then (a.started_at at time zone c.time_zone)::date else a.date end day_key
   from challenge c join social_audiences d on d.community_id=c.community_id
    join social_contexts s on s.audience_id=d.id join activities a on a.id=s.activity_id
   where c.status in('active','closed') and social_can_read(s.id) and social_member(c.community_id,a.user_id)
    and (cardinality(c.types)=0 or a.type=any(c.types))
 ), in_period as (
  select e.* from eligible e cross join challenge c where day_key>=c.starts_on and day_key<c.ends_on
   and (c.closed_at is null or (e.started_at is not null and e.started_at<c.closed_at)
    or (e.started_at is null and (day_key<(c.closed_at at time zone c.time_zone)::date
      or (day_key=(c.closed_at at time zone c.time_zone)::date and e.created_at at time zone 'UTC'<c.closed_at))))
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
  'closed_at',closed_at,'starts_on',starts_on,'ends_on',ends_on,'time_zone',time_zone,'total',total,'mine',mine,
  'participating',true,'has_cover',cover_image_path is not null and cover_owner_id is not null,'cover_updated_at',cover_updated_at,
  'state',case when status='cancelled' then 'cancelled' when status='closed' then 'closed' when (now() at time zone time_zone)::date>=ends_on then 'completed'
   when (now() at time zone time_zone)::date<starts_on then 'upcoming' else 'active' end) from progress;
$$;
