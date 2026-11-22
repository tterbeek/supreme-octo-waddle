-- Add Dance without changing existing activity data or sharing decisions.
begin;
do $$
declare item record; definition text; updated text;
begin
  for item in
    select c.oid,c.conname,c.conrelid::regclass as relation
    from pg_constraint c join pg_namespace n on n.oid=c.connamespace
    where n.nspname='public' and c.contype='c' and c.conname in (
      'activities_type_check','activity_preferences_activity_type_check',
      'goals_activity_type_check','presets_type_check',
      'user_activity_types_activity_type_check','equipment_activity_types_check')
  loop
    definition:=pg_get_constraintdef(item.oid);
    if position('''dance''' in definition)>0 then continue;end if;
    updated:=replace(definition,'''other''::text','''other''::text, ''dance''::text');
    if updated=definition then raise exception 'Unrecognized activity constraint %',item.conname;end if;
    execute format('alter table %s drop constraint %I',item.relation,item.conname);
    execute format('alter table %s add constraint %I %s',item.relation,item.conname,updated);
  end loop;
  -- Preserve the deployed functions, including their authorization and challenge
  -- calculations; extend only their existing activity-type allowlists.
  for item in
    select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in('social_set_rule','social_challenges','social_challenges_legacy')
  loop
    definition:=pg_get_functiondef(item.oid);
    updated:=replace(definition,'''restore'',''other''','''restore'',''other'',''dance''');
    updated:=replace(updated,'"restore","other"','"restore","other","dance"');
    if updated<>definition then execute updated;end if;
  end loop;
end $$;

-- Existing users keep their chosen order and enabled/disabled types.
insert into public.user_activity_types(user_id,activity_type,sort_order,is_enabled)
select user_id,'dance',max(sort_order)+10,true
from public.user_activity_types group by user_id
on conflict(user_id,activity_type) do nothing;

-- Seed Dance for new users too, before the existing early-return guard.
do $$
declare definition text;
begin
  definition:=pg_get_functiondef('public.ensure_user_activity_types_seeded()'::regprocedure);
  definition:=replace(definition,'  if exists (',
    '  insert into public.user_activity_types(user_id,activity_type,sort_order,is_enabled)
       select auth.uid(),''dance'',coalesce(max(sort_order),90)+10,true
       from public.user_activity_types where user_id=auth.uid()
       having count(*)>0
       on conflict(user_id,activity_type) do nothing;

  if exists (');
  definition:=replace(definition,'(auth.uid(),''other'',90,true);',
    '(auth.uid(),''other'',90,true), (auth.uid(),''dance'',100,true);');
  execute definition;
end $$;
commit;
