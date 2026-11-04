-- Snapshot the saved workout and equipment atomically. All create-from-activity
-- forms use this owner-only path; a failed relation insert rolls back the preset.
create function public.create_activity_preset(p_activity uuid,p_name text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare a activities;result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to save a preset';end if;
 if nullif(btrim(p_name),'') is null then raise exception 'Preset name is required';end if;
 select * into a from activities where id=p_activity and user_id=auth.uid() for share;
 if not found then raise exception 'Activity unavailable';end if;
 if a.import_status<>'ready' then raise exception 'Wait for the activity import to finish';end if;
 insert into presets(user_id,type,name,distance_km,duration_min,effort,route_polyline,last_used_at)
 values(auth.uid(),a.type,btrim(p_name),a.distance_km,a.duration_min,a.effort,a.route_polyline,now())
 returning id into result;
 insert into preset_equipment(preset_id,equipment_id)
 select distinct result,e.id from activity_equipment ae join equipment e on e.id=ae.equipment_id
 where ae.activity_id=a.id and e.user_id=auth.uid();
 return result;
end;$$;
revoke all on function public.create_activity_preset(uuid,text) from public,anon;
grant execute on function public.create_activity_preset(uuid,text) to authenticated;
