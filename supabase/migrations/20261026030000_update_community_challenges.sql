-- Owners/admins can edit existing Community challenges in place.
-- Source activities and sharing choices are unchanged; progress remains derived.
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
    array(select jsonb_array_elements_text(coalesce(p_data->'types','[]'))),(p_data->>'starts_on')::date,(p_data->>'ends_on')::date,p_data->>'time_zone',p_data->>'scope');
  else
   v_challenge_id:=(p_data->>'id')::uuid;
   select * into ch from community_challenges where id=v_challenge_id and community_id=p_community for update;
   if not found then raise exception 'Challenge unavailable';end if;
   update community_challenges set title=btrim(p_data->>'title'),metric=p_data->>'metric',target=(p_data->>'target')::numeric,
    types=array(select jsonb_array_elements_text(coalesce(p_data->'types','[]'))),starts_on=(p_data->>'starts_on')::date,
    ends_on=(p_data->>'ends_on')::date,time_zone=p_data->>'time_zone',scope=p_data->>'scope'
    where id=ch.id;
  end if;
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

