-- Closing retains progress for every challenge measure. Existing date windows still apply.
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
  'starts_on',starts_on,'ends_on',ends_on,'time_zone',time_zone,'total',total,'mine',mine,
  'participating',true,'has_cover',cover_image_path is not null and cover_owner_id is not null,'cover_updated_at',cover_updated_at,
  'state',case when status='cancelled' then 'cancelled' when status='closed' then 'closed' when (now() at time zone time_zone)::date>=ends_on then 'completed'
   when (now() at time zone time_zone)::date<starts_on then 'upcoming' else 'active' end) from progress;
$$;
create or replace function public.social_challenges(p_community uuid,p_action text default 'list',p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare ch community_challenges;uid uuid:=auth.uid();is_virtual boolean;selected text[];selection text;desired text;
begin
 if uid is null or not social_enabled() or not social_member(p_community,uid) then raise exception 'Community unavailable';end if;
 if p_action='close' then
  if not social_admin(p_community,uid) then raise exception 'Not authorized';end if;
  if not social_rate('challenge-close:'||uid,10) then raise exception 'Please try again shortly';end if;
  select * into ch from community_challenges where id=(p_data->>'id')::uuid and community_id=p_community for update;
  if not found or ch.status<>'active' then raise exception 'Only active challenges can be closed';end if;
  update community_challenges set status='closed',closed_at=clock_timestamp() where id=ch.id;
  return social_challenges_legacy(p_community,'list','{}');
 end if;
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

create function public.closed_challenge_guard() returns trigger language plpgsql as $$
begin
 if old.status='closed' and (new.status is distinct from old.status or new.closed_at is distinct from old.closed_at) then
  raise exception 'A closed challenge cannot be reopened or have its cutoff changed';
 end if;
 return new;
end;$$;
create trigger closed_challenge_guard before update on public.community_challenges for each row execute function public.closed_challenge_guard();
