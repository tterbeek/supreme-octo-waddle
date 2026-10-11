create or replace function public._drop_check_constraints_for_column(
  target_table text,
  target_column text
)
returns void
language plpgsql
as $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_attribute attr
      on attr.attrelid = rel.oid
     and attr.attnum = any (con.conkey)
    where nsp.nspname = 'public'
      and rel.relname = target_table
      and con.contype = 'c'
      and attr.attname = target_column
  loop
    execute format(
      'alter table public.%I drop constraint if exists %I',
      target_table,
      constraint_name
    );
  end loop;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'activities'
  ) then
    perform public._drop_check_constraints_for_column('activities', 'type');
    execute $sql$
      alter table public.activities
      add constraint activities_type_check
      check (
        type = any (
          array[
            'run',
            'ride',
            'walk',
            'strength',
            'yoga',
            'hike',
            'swim',
            'meditation',
            'restore',
            'other'
          ]
        )
      )
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'presets'
  ) then
    perform public._drop_check_constraints_for_column('presets', 'type');
    execute $sql$
      alter table public.presets
      add constraint presets_type_check
      check (
        type = any (
          array[
            'run',
            'ride',
            'walk',
            'strength',
            'yoga',
            'hike',
            'swim',
            'meditation',
            'restore',
            'other'
          ]
        )
      )
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'goals'
  ) then
    perform public._drop_check_constraints_for_column('goals', 'activity_type');
    execute $sql$
      alter table public.goals
      add constraint goals_activity_type_check
      check (
        activity_type = any (
          array[
            'run',
            'ride',
            'walk',
            'strength',
            'yoga',
            'hike',
            'swim',
            'meditation',
            'restore',
            'other',
            'any'
          ]
        )
      )
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'activity_preferences'
  ) then
    perform public._drop_check_constraints_for_column(
      'activity_preferences',
      'activity_type'
    );
    execute $sql$
      alter table public.activity_preferences
      add constraint activity_preferences_activity_type_check
      check (
        activity_type = any (
          array[
            'run',
            'ride',
            'walk',
            'strength',
            'yoga',
            'hike',
            'swim',
            'meditation',
            'restore',
            'other'
          ]
        )
      )
    $sql$;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'user_activity_types'
  ) then
    perform public._drop_check_constraints_for_column(
      'user_activity_types',
      'activity_type'
    );
    execute $sql$
      alter table public.user_activity_types
      add constraint user_activity_types_activity_type_check
      check (
        activity_type = any (
          array[
            'run',
            'ride',
            'walk',
            'strength',
            'yoga',
            'hike',
            'swim',
            'meditation',
            'restore',
            'other'
          ]
        )
      )
    $sql$;
  end if;
end
$$;

drop function if exists public._drop_check_constraints_for_column(text, text);
