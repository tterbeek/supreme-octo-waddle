-- Explicit account-wide consent, off until positively confirmed.
create table public.social_map_preferences (
 user_id uuid primary key references auth.users on delete cascade,
 enabled boolean not null, decided_at timestamptz not null default now()
);
alter table public.social_map_preferences enable row level security;
revoke all on public.social_map_preferences from public,anon,authenticated;
grant all on public.social_map_preferences to service_role;

create function public.social_map_consent(p_enabled boolean default null) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null then raise exception 'Sign in to manage map sharing';end if;
 if p_enabled is not null then
  insert into social_map_preferences values(auth.uid(),p_enabled,now())
   on conflict(user_id) do update set enabled=excluded.enabled,decided_at=excluded.decided_at;
 end if;
 return jsonb_build_object(
  'decided',exists(select 1 from social_map_preferences where user_id=auth.uid()),
  'enabled',coalesce((select enabled from social_map_preferences where user_id=auth.uid()),false),
  'has_route',exists(select 1 from activities where user_id=auth.uid() and route_polyline is not null)
 );
end;$$;
revoke all on function public.social_map_consent(boolean) from public,anon;
grant execute on function public.social_map_consent(boolean) to authenticated;

-- Raw geometry is server-only. The Edge Function independently authenticates the
-- viewer and supplies this ID; browsers cannot invoke this helper.
create function public.social_route_input(p_activity uuid,p_viewer uuid) returns text
language plpgsql security definer set search_path=public,pg_temp as $$
declare previous_sub text;result text;
begin
 if p_viewer is null then return null;end if;
 previous_sub:=current_setting('request.jwt.claim.sub',true);
 perform set_config('request.jwt.claim.sub',p_viewer::text,true);
 if social_can_view_activity(p_activity) then
  select a.route_polyline into result from activities a
   join social_map_preferences m on m.user_id=a.user_id and m.enabled
   where a.id=p_activity and not a.social_private and a.import_status='ready';
 end if;
 perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
 return result;
exception when others then
 perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
 raise;
end;$$;
revoke all on function public.social_route_input(uuid,uuid) from public,anon,authenticated;
grant execute on function public.social_route_input(uuid,uuid) to service_role;

create or replace function public.social_feed(p_audience uuid default null,p_before jsonb default null,p_activity uuid default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare rows jsonb;owner_row jsonb;begin
 rows:=social_feed_placements(p_audience,p_before,p_activity);
 -- An owner may open/manage their thread by activity ID even with zero shares.
 -- Private activities are never added to the ordinary feed.
 if p_activity is not null and rows='[]' and social_can_view_activity(p_activity) then
  select jsonb_build_object('id',a.id,'date',a.date,'shared_at',null,'author_id',a.user_id,
   'author',coalesce(nullif(up.social_display_name,''),'MoveNotes member'),'title',a.title,'type',a.type,
   'distance_km',a.distance_km,'duration_min',a.duration_min,'public_note',a.public_note,'photos','[]'::jsonb,'contexts','[]'::jsonb)
   into owner_row from activities a left join user_preferences up on up.user_id=a.user_id where a.id=p_activity and a.user_id=auth.uid();
  if owner_row is not null then rows:=jsonb_build_array(owner_row);end if;
 end if;
 return (select coalesce(jsonb_agg(r.value||jsonb_build_object('has_map',exists(
    select 1 from activities a join social_map_preferences m on m.user_id=a.user_id
    where a.id=(r.value->>'id')::uuid and m.enabled and not a.social_private and a.route_polyline is not null
  ))||social_discussion_counts((r.value->>'id')::uuid) order by r.ordinality),'[]')
  from jsonb_array_elements(rows) with ordinality r(value,ordinality));
end; $$;
