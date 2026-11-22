-- Retire the unused per-activity bike override. Equipment/import classification remains.
begin;
create or replace function public.journey_refresh_bike(p_activity uuid,p_force boolean default false) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare a activities;old_snapshot journey_bike_snapshots;sig text;modes text[];resolved text:='unknown';source text:='unspecified';subtype text;cfg jsonb;r journey_bike_snapshots;
begin
 select * into a from activities where id=p_activity;
 if not found then return jsonb_build_object('mode','not_applicable','source',null,'revision',0);end if;
 if a.type<>'ride' then return jsonb_build_object('mode','not_applicable','source',null,'revision',0);end if;
 sig:=jsonb_build_array(a.type,a.raw_sport_type,a.raw_type,
  (select coalesce(jsonb_agg(equipment_id order by equipment_id),'[]') from activity_equipment where activity_id=a.id))::text;
 select * into old_snapshot from journey_bike_snapshots where activity_id=a.id;
 if found and old_snapshot.signature=sig and not p_force then
  return jsonb_build_object('mode',old_snapshot.mode,'source',old_snapshot.source,'revision',old_snapshot.revision);
 end if;
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
 insert into journey_bike_snapshots(activity_id,signature,mode,source) values(a.id,sig,resolved,source)
  on conflict(activity_id) do update set signature=excluded.signature,mode=excluded.mode,source=excluded.source,
   revision=journey_bike_snapshots.revision+1,updated_at=now() returning * into r;
 return jsonb_build_object('mode',r.mode,'source',r.source,'revision',r.revision);
end;$$;
create or replace function public.journey_activity_revision() returns trigger language plpgsql as $$
begin
 if (new.type,new.date,new.started_at,new.distance_km,new.duration_min,new.effort,new.raw_sport_type,new.raw_type,new.import_status,new.social_private)
 is distinct from (old.type,old.date,old.started_at,old.distance_km,old.duration_min,old.effort,old.raw_sport_type,old.raw_type,old.import_status,old.social_private)
 then new.journey_revision:=old.journey_revision+1;else new.journey_revision:=old.journey_revision;end if;return new;
end;$$;
alter table public.activities drop column if exists cycling_mode_override;
-- Refresh derived snapshots and queue challenge recalculation using existing rules.
select public.journey_refresh_bike(id,true) from public.activities where type='ride';
select public.journey_mark_dirty();
commit;
