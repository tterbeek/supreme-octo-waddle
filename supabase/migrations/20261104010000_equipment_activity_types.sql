-- Assignments are explicit. Existing equipment remains available in All equipment.
alter table public.equipment add column activity_types text[] not null default '{}'
 check(activity_types <@ array['run','ride','walk','strength','yoga','hike','swim','meditation','restore','other']::text[]);

create function public.recent_equipment_for_type(p_type text) returns setof public.equipment
language sql stable security definer set search_path=public,pg_temp as $$
 select e.* from equipment e
 join activity_equipment ae on ae.equipment_id=e.id
 join activities a on a.id=ae.activity_id and a.user_id=auth.uid() and a.type=p_type
 where e.user_id=auth.uid() and e.is_active and p_type=any(e.activity_types) and a.import_status='ready'
 group by e.id
 order by max(a.date) desc,max(a.created_at) desc,e.id
 limit 2;
$$;
revoke all on function public.recent_equipment_for_type(text) from public,anon;
grant execute on function public.recent_equipment_for_type(text) to authenticated;
